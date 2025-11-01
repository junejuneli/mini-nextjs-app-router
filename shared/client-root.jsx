import React, { Suspense } from 'react'
import { RouterContext } from './router-context.jsx'

/**
 * ClientRoot - 服务端渲染的根组件包装器
 *
 * 提供与客户端 Router 相同的组件结构（RouterContext.Provider + Suspense）
 * 确保服务端渲染和客户端水合时的 DOM 结构完全一致，避免 hydration 错误。
 *
 * - 服务端：使用静态的 Provider（占位）
 * - 客户端：Router 接管后提供真正的状态管理
 */

// 默认的 RouterContext 值（服务端渲染时使用）
const DEFAULT_ROUTER_CONTEXT = {
  navigate: async (href) => {
    if (typeof window !== 'undefined') {
      window.location.href = href
    }
  },
  isPending: false
}

export function ClientRoot({ tree }) {
  return (
    <RouterContext.Provider value={DEFAULT_ROUTER_CONTEXT}>
      <Suspense fallback={<div />}>
        {tree}
      </Suspense>
    </RouterContext.Provider>
  )
}
