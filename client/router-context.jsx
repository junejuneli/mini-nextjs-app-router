import { createContext } from 'react'

/**
 * Router Context
 *
 * 提供路由导航功能给整个应用
 */
export const RouterContext = createContext({
  navigate: async (href) => {
    // 默认降级：整页刷新
    window.location.href = href
  }
})
