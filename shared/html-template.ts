import React from 'react'
import ReactDOMServer from 'react-dom/server'
import { FlightDecoder } from './flight-decoder.ts'
import { extractHTMLParts, getBodyChildren, getStyleElements, normalizeBodyChildren } from './extract-body.ts'
import { ClientRoot } from './client-root.tsx'
import type { ModuleInfo, ModuleMap } from './types.ts'

/**
 * 统一的 HTML 模板生成器
 *
 * 用于 SSG/ISR/SSR 场景，生成完整的 HTML 文档
 */

/**
 * HTML 模板生成选项
 */
export interface HTMLTemplateOptions {
  /** Flight Protocol 字符串 */
  flight: string
  /** Client Component 列表 */
  clientModules: ModuleInfo[]
  /** 路由路径 */
  pathname: string
  /** 服务器数据 */
  serverData?: Record<string, any>
  /** 模块映射表（用于服务端渲染 Client Components） */
  moduleMap?: ModuleMap
  /** 是否为预渲染模式（SSG/ISR） */
  prerendered?: boolean
}

/**
 * Body 和 Styles 提取结果
 */
interface BodyAndStyles {
  bodyContent: string
  styles: string
}

/**
 * 生成 HTML 模板
 *
 * @param options - 配置选项
 * @returns HTML 字符串
 */
export function generateHTMLTemplate(options: HTMLTemplateOptions): string {
  const {
    flight,
    clientModules,
    pathname,
    serverData = {},
    moduleMap = {}
  } = options

  const decoder = new FlightDecoder(moduleMap)
  const reactTree = decoder.decode(flight)
  const { bodyContent, styles } = extractBodyAndStyles(reactTree)

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mini Next.js App Router</title>
  ${styles}
</head>
<body>
  <div id="__next">${bodyContent}</div>

  <!-- Flight Payload -->
  <script id="__FLIGHT_DATA__" type="application/json">
${JSON.stringify({ flight, pathname })}
  </script>

  <!-- Server Data -->
  <script id="__SERVER_DATA__" type="application/json">
${JSON.stringify(serverData)}
  </script>

  <!-- Client Modules -->
  <script>
    window.__CLIENT_MODULES__ = ${JSON.stringify(clientModules)};
  </script>

  <!-- 客户端入口 -->
  <script type="module" src="/client.js"></script>
</body>
</html>`
}

/**
 * 从 React 树中提取 <body> 子元素和 <style> 标签
 *
 * 使用 ClientRoot 包装内容，确保服务端和客户端结构一致
 *
 * @param reactTree - React 元素树（<html> 根元素）
 * @returns body 内容和 style 标签
 */
function extractBodyAndStyles(reactTree: React.ReactElement): BodyAndStyles {
  const { bodyElement, headElement } = extractHTMLParts(reactTree)

  // 提取并渲染 <style> 标签
  const styleElements = getStyleElements(headElement)
  const styles = styleElements
    .map(style => ReactDOMServer.renderToStaticMarkup(style))
    .join('\n')

  // 提取并包装 <body> 的子元素
  const bodyChildren = getBodyChildren(bodyElement)
  let bodyContent = ''

  if (bodyChildren) {
    // 规范化子元素（数组 -> Fragment）
    const normalizedTree = normalizeBodyChildren(bodyChildren)

    // 使用 ClientRoot 包装（提供 RouterContext.Provider + Suspense）
    const wrappedTree = React.createElement(ClientRoot, { tree: normalizedTree })
    bodyContent = ReactDOMServer.renderToString(wrappedTree)
  }

  return { bodyContent, styles }
}
