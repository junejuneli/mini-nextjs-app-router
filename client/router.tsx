import React, { useState, useTransition, useCallback, useEffect, Suspense } from 'react'
import { RouterContext } from '../shared/router-context.tsx'
import { flightDecoder } from './module-map.ts'
import { extractBodyChildren } from '../shared/extract-body.ts'
import { ErrorBoundary } from './ErrorBoundary.tsx'

/**
 * Router Component Props
 */
interface RouterProps {
  initialTree: React.ReactElement
  initialPathname: string
}

/**
 * 路由缓存项
 */
interface RouteCacheEntry {
  tree: React.ReactElement
}

/**
 * Router Component - 管理客户端路由
 *
 * 使用 useState 管理路由树，避免 root.render() 导致的整树重建
 * React 通过 reconciliation 智能更新变化部分
 */

// 路由缓存 - 模块级变量，所有 Router 实例共享
const routeCache = new Map<string, RouteCacheEntry>()

export function Router({ initialTree, initialPathname }: RouterProps): React.ReactElement {
  const [currentTree, setCurrentTree] = useState<React.ReactElement>(initialTree)
  const [isPending, startTransition] = useTransition()

  // 初始化缓存
  if (!routeCache.has(initialPathname)) {
    routeCache.set(initialPathname, { tree: initialTree })
  }

  // 统一的路由加载逻辑
  const loadRoute = useCallback(async (href: string): Promise<React.ReactElement> => {
    let newTree = routeCache.get(href)?.tree

    if (!newTree) {
      console.log(`🌐 [Router] 加载路由: ${href}`)
      // 构建 RSC 请求 URL,保留查询参数
      const separator = href.includes('?') ? '&' : '?'
      const rscUrl = `${href}${separator}_rsc=1`

      const response = await fetch(rscUrl)
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

  const navigate = useCallback(async (href: string): Promise<void> => {
    // 比较完整的 URL (包括查询参数)
    const currentUrl = window.location.pathname + window.location.search
    if (href === currentUrl) return

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

  const handlePopState = useCallback(async (event: PopStateEvent): Promise<void> => {
    const href = (event.state as { href?: string })?.href || window.location.pathname
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
