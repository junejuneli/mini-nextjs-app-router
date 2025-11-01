import React, { useState, useTransition, useCallback, useEffect, Suspense } from 'react'
import { RouterContext } from './router-context.jsx'
import { flightDecoder } from './module-map.ts'

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
      const response = await fetch(`${href}?_rsc=1`)
      const flight = await response.text()
      newTree = flightDecoder.decode(flight)
      routeCache.set(href, { tree: newTree })
    }

    return newTree
  }, [])

  const navigate = useCallback(async href => {
    if (href === window.location.pathname) return

    try {
      const newTree = await loadRoute(href)
      startTransition(() => setCurrentTree(newTree))

      console.log('ljj - 设置新路由',href, newTree)

      window.history.pushState({ href }, '', href)
    } catch (error) {
      console.error('Navigation failed:', error)
      window.location.href = href
    }
  }, [loadRoute])

  const handlePopState = useCallback(async event => {
    const href = event.state?.href || window.location.pathname

    try {
      const newTree = await loadRoute(href)
      startTransition(() => setCurrentTree(newTree))
      console.log('ljj - 设置新路由2',href, newTree)
    } catch (error) {
      console.error('Browser navigation failed:', error)
      window.location.href = href
    }
  }, [loadRoute])

  useEffect(() => {
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [handlePopState])

  return (
    <RouterContext.Provider value={{ navigate, isPending }}>
      <Suspense fallback={<div />}>
        {currentTree}
      </Suspense>
    </RouterContext.Provider>
  )
}
