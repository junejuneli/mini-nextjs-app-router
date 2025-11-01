'use client'

import React, { useContext } from 'react'
import { RouterContext } from '../shared/router-context.jsx'

/**
 * Link 组件 - 客户端导航
 *
 * 拦截点击事件，使用客户端路由实现无刷新导航
 */
export default function Link({ href, children, ...props }) {
  const { navigate } = useContext(RouterContext)

  const handleClick = e => {
    e.preventDefault()
    console.log(`🔗 [Link] 点击链接: ${href}`)
    navigate(href)
  }

  return (
    <a href={href} onClick={handleClick} {...props}>
      {children}
    </a>
  )
}
