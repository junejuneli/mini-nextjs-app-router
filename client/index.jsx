import React, { Suspense } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { Router } from './router.jsx'
import { flightDecoder } from './module-map.ts'

/**
 * Mini Next.js App Router 客户端入口
 *
 * SSG 页面：使用 hydrateRoot() 水合预渲染的 HTML
 * SSR 页面：使用 createRoot().render() 客户端渲染
 *
 * 整个应用生命周期只调用一次 hydrate 或 render
 * 后续路由切换通过 Router 组件内部的 setState 完成
 *
 * 使用 React.lazy + Suspense 实现代码分割和按需加载
 */

// 读取初始 Flight 数据
const flightDataElement = document.getElementById('__FLIGHT_DATA__')
if (!flightDataElement) throw new Error('Missing flight data')

const { flight, pathname } = JSON.parse(flightDataElement.textContent)

// 解码初始树（使用共享的 flightDecoder 实例）
let initialTree = flightDecoder.decode(flight)

console.log('ljj - 解码后的树结构', {
  type: initialTree?.type,
  typeOfType: typeof initialTree?.type,
  hasProps: !!initialTree?.props,
  propsKeys: Object.keys(initialTree?.props || {}),
  childrenIsArray: Array.isArray(initialTree?.props?.children),
  childrenLength: initialTree?.props?.children?.length
})

// ⭐ 提取 <body> 的子元素，与服务端渲染保持一致
// 服务端只渲染了 <body> 的内容到 <div id="root">，客户端也应该只 hydrate body 的内容
initialTree = extractBodyContent(initialTree)

console.log('ljj - 提取后的初始树',pathname,initialTree)

// 获取根元素
const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Missing root element')

// 检查是否有预渲染内容（SSG 页面）
const hasPrerenderedContent = rootElement.innerHTML.trim().length > 0

// 创建 Router 组件，包裹在 Suspense 中以支持 lazy 加载
// ⭐ fallback 必须与服务端占位符一致 (空 div)
const app = <Router initialTree={initialTree} initialPathname={pathname} />

if (hasPrerenderedContent) {
  // SSG 页面：水合现有 DOM
  hydrateRoot(rootElement, app)
} else {
  // SSR 页面：客户端渲染
  const root = createRoot(rootElement)
  root.render(app)
}

/**
 * 从完整的 React 树中提取 <body> 的子元素
 *
 * Flight Protocol 解码后得到的是完整的 <html> 树：
 * <html>
 *   <head><style>...</style></head>
 *   <body><nav>...</nav><div>...</div></body>
 * </html>
 *
 * 但服务端 HTML 模板中，<div id="root"> 只包含 <body> 的内容（不包括 <body> 标签）
 * 因此客户端 hydration 时也应该只使用 <body> 的子元素
 *
 * @param {React.Element} tree - 完整的 React 树
 * @returns {React.Element | React.Fragment} <body> 的子元素
 */
function extractBodyContent(tree) {
  // 如果是 <html> 元素
  if (tree?.type === 'html') {
    const children = tree.props?.children
    if (Array.isArray(children)) {
      // 找到 <body> 元素
      const bodyElement = children.find(child => child?.type === 'body')
      if (bodyElement?.props?.children) {
        // 返回 <body> 的子元素（可能是数组或单个元素）
        const bodyChildren = bodyElement.props.children
        // 如果是数组，包装在 Fragment 中；否则直接返回
        return Array.isArray(bodyChildren)
          ? React.createElement(React.Fragment, null, ...bodyChildren)
          : bodyChildren
      }
    }
  }

  // 如果不是标准的 <html> 结构，直接返回原树
  return tree
}
