'use client'

import React, { useContext } from 'react'
import { RouterContext } from '../shared/router-context.tsx'

/**
 * Link Component Props
 */
interface LinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string
  children: React.ReactNode
}

/**
 * Link 组件 - 客户端导航
 *
 * 拦截点击事件，使用客户端路由实现无刷新导航
 */
export default function Link({ href, children, ...props }: LinkProps): React.ReactElement {
  const { navigate } = useContext(RouterContext)

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>): void => {
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
