import ReactDOMServer from 'react-dom/server'
import { FlightDecoder } from './flight-decoder.js'

/**
 * 统一的 HTML 模板生成器
 *
 * 用于：
 * 1. SSG 构建时生成（build/render-static.js）
 * 2. ISR 重新生成（server/regenerate.js）
 * 3. SSR 运行时渲染（server/index.js）
 *
 * 核心功能：
 * - 统一 HTML 结构
 * - 可选预渲染（SSG/ISR）或客户端渲染（SSR）
 * - 统一元数据注入
 */

/**
 * 生成 HTML 模板
 *
 * @param {Object} options - 配置选项
 * @param {string} options.flight - Flight Protocol 字符串
 * @param {Array} options.clientModules - Client Component 列表
 * @param {string} options.pathname - 路由路径
 * @param {Object} options.serverData - 服务器数据
 * @param {boolean} options.prerendered - 是否预渲染 HTML 内容
 *   - true: SSG/ISR，将 Flight 转换为 HTML 填充到 <div id="root">
 *   - false: SSR，<div id="root"> 为空，由客户端渲染
 * @param {Object} options.moduleMap - 模块映射表（用于服务端渲染 Client Components）
 * @returns {string} HTML 字符串
 */
export function generateHTMLTemplate(options) {
  const {
    flight,
    clientModules,
    pathname,
    serverData,
    prerendered = false,
    moduleMap = {}
  } = options

  // 根据是否预渲染决定 root 的内容
  const decoder = new FlightDecoder(moduleMap)
  const reactTree = decoder.decode(flight)

  // 提取 <body> 子元素和 <style> 标签
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
  <div id="root">${bodyContent}</div>

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
 * @param {React.Element} reactTree - React 元素树（通常是 <html> 根元素）
 * @returns {{bodyContent: string, styles: string}} body 内容和 style 标签
 */
function extractBodyAndStyles(reactTree) {
  // 渲染完整的树以获取 HTML 字符串
  const fullHTML = ReactDOMServer.renderToString(reactTree)

  // 提取所有 <style> 标签
  const styleMatches = fullHTML.match(/<style[^>]*>[\s\S]*?<\/style>/g) || []
  const styles = styleMatches.join('\n')

  // 提取 <body> 的子元素内容（不包括 <body> 标签本身）
  const bodyMatch = fullHTML.match(/<body[^>]*>([\s\S]*)<\/body>/)
  const bodyContent = bodyMatch ? bodyMatch[1] : ''

  return { bodyContent, styles }
}
