import React, { useState, useTransition, useCallback, useEffect, Suspense } from 'react'
import { RouterContext } from '../shared/router-context.jsx'
import { flightDecoder } from './module-map.ts'
import { extractBodyChildren } from '../shared/extract-body.js'
import { ErrorBoundary } from './ErrorBoundary.jsx'

/**
 * Router Component - 管理客户端路由
 *
 * 使用 useState 管理路由树，避免 root.render() 导致的整树重建
 * React 通过 reconciliation 智能更新变化部分
 */

// 路由缓存 - 模块级变量，所有 Router 实例共享
const routeCache = new Map()

export function Router({ initialTree, initialPathname }) {
  const [currentTree, setCurrentTree] = useState(initialTree)
  const [isPending, startTransition] = useTransition()

  // 初始化缓存
  if (!routeCache.has(initialPathname)) {
    routeCache.set(initialPathname, { tree: initialTree })
  }

  // 统一的路由加载逻辑
  const loadRoute = useCallback(async (href) => {
    let newTree = routeCache.get(href)?.tree

    if (!newTree) {
      console.log(`🌐 [Router] 加载路由: ${href}`)
      const response = await fetch(`${href}?_rsc=1`)
      const flight = await response.text()
      console.log(`📦 [Router] 接收 Flight 数据: 长度=${flight.length}`)

      // 解码 flight 并提取 body 子元素（与初始化时保持一致）
      const decodedTree = flightDecoder.decode(flight)
      newTree = extractBodyChildren(decodedTree)

      routeCache.set(href, { tree: newTree })
    } else {
      console.log(`⚡ [Router] 使用缓存路由: ${href}`)
    }

    return newTree
  }, [])

  const navigate = useCallback(async href => {
    if (href === window.location.pathname) return

    try {
      const newTree = await loadRoute(href)
      startTransition(() => {
        setCurrentTree(newTree)
      })
      window.history.pushState({ href }, '', href)
    } catch (error) {
      window.location.href = href
    }
  }, [loadRoute])

  const handlePopState = useCallback(async event => {
    const href = event.state?.href || window.location.pathname
    console.log(`⬅️  [Router] 浏览器后退/前进: ${href}`)

    try {
      const newTree = await loadRoute(href)
      startTransition(() => setCurrentTree(newTree))
    } catch (error) {
      window.location.href = href
    }
  }, [loadRoute])

  useEffect(() => {
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [handlePopState])

  return (
    <RouterContext.Provider value={{ navigate, isPending }}>
      <ErrorBoundary>
        <Suspense fallback={<div />}>
          {currentTree}
        </Suspense>
      </ErrorBoundary>
    </RouterContext.Provider>
  )
}
