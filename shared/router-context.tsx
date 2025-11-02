import { createContext } from 'react'

/**
 * Router Context Value Type
 */
export interface RouterContextValue {
  navigate: (href: string) => Promise<void>
  isPending?: boolean
}

/**
 * Router Context
 *
 * 提供路由导航功能给整个应用
 */
export const RouterContext = createContext<RouterContextValue>({
  navigate: async (href: string) => {
    // 默认降级：整页刷新
    if (typeof window !== 'undefined') {
      window.location.href = href
    }
  },
  isPending: false
})
