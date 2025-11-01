import React, { Suspense } from 'react'
import { RouterContext } from './router-context.jsx'

/**
 * ClientRoot - 服务端渲染的根组件包装器
 *
 * 提供与客户端 Router 相同的组件结构：
 * - RouterContext.Provider
 * - ServerErrorBoundary（与客户端 ErrorBoundary 结构一致）
 * - Suspense
 *
 * ⭐ 关键：确保服务端渲染和客户端水合时的 DOM 结构完全一致
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

/**
 * ServerErrorBoundary - 服务端错误边界占位组件（类组件）
 *
 * ⚠️ 必须使用类组件，与客户端 ErrorBoundary 保持类型一致
 *
 * 为什么要用类组件？
 * - 客户端的 ErrorBoundary 是 React.Component 类组件
 * - React Hydration 会检查组件类型是否匹配
 * - 如果服务端是函数组件，客户端是类组件，会导致 hydration warning
 *
 * 服务端行为：
 * - 不处理错误（服务端错误会直接抛出到构建/渲染流程）
 * - 只是一个透传组件，保证结构一致
 * - 客户端水合后，ErrorBoundary 会接管错误处理
 */
class ServerErrorBoundary extends React.Component {
  render() {
    return this.props.children
  }
}

export function ClientRoot({ tree }) {
  return (
    <RouterContext.Provider value={DEFAULT_ROUTER_CONTEXT}>
      <ServerErrorBoundary>
        <Suspense fallback={<div />}>
          {tree}
        </Suspense>
      </ServerErrorBoundary>
    </RouterContext.Provider>
  )
}
