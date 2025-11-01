import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { renderRSC } from '../shared/rsc-renderer.js'
import { batchSaveMetadata } from '../shared/metadata.js'
import { generateHTMLTemplate } from '../shared/html-template.js'

/**
 * SSG 预渲染模块
 *
 * 核心功能：
 * 1. 遍历路由树，识别可以静态生成的路由
 * 2. 对每个静态路由：
 *    - 执行 RSC 渲染生成 Flight Protocol
 *    - 生成完整 HTML
 *    - 保存到 .next/static/ 目录
 * 3. 更新 manifest.json 标记预渲染状态
 *
 * 文件结构：
 * .next/static/
 *   ├── pages/
 *   │   ├── index.html         # / 路由的 HTML
 *   │   └── about.html          # /about 路由的 HTML
 *   └── flight/
 *       ├── index.txt           # / 路由的 Flight Protocol
 *       └── about.txt           # /about 路由的 Flight Protocol
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')


/**
 * 预渲染所有静态路由
 *
 * @param {Object} routeTree - 路由树
 * @param {Map} clientComponentMap - Client Component 映射表
 * @returns {Array} 预渲染的路由列表
 */
export async function prerenderStaticRoutes(routeTree, clientComponentMap) {
  console.log('5️⃣  预渲染静态页面...\n')

  const outputDir = path.join(projectRoot, '.next/static')
  const pagesDir = path.join(outputDir, 'pages')
  const flightDir = path.join(outputDir, 'flight')

  // 创建输出目录
  fs.mkdirSync(pagesDir, { recursive: true })
  fs.mkdirSync(flightDir, { recursive: true })

  // 收集所有可预渲染的路由
  const staticRoutes = collectStaticRoutes(routeTree)
  console.log(`  找到 ${staticRoutes.length} 个静态路由:\n`)

  const prerendered = []
  const metadataList = []

  // 渲染每个静态路由
  for (const routeInfo of staticRoutes) {
    try {
      console.log(`  📄 预渲染: ${routeInfo.path}`)

      // 渲染 RSC
      const { flight, clientModules } = await renderRSC(
        routeInfo.routePath,
        {},
        clientComponentMap
      )

      // 转换 clientComponentMap 为 id -> module 格式
      // clientComponentMap 是 Map<Component, {id, chunks, name}>
      // 需要转换为 {id: {default: Component}}
      const moduleMap = {}
      for (const [Component, info] of clientComponentMap.entries()) {
        moduleMap[info.id] = { default: Component }
      }

      // 生成 HTML（使用统一模板，启用预渲染）
      const html = generateHTMLTemplate({
        flight,
        clientModules,
        pathname: routeInfo.path,
        serverData: {
          nodeVersion: process.version,
          buildTime: new Date().toISOString(),
          env: 'production',
          prerendered: true
        },
        prerendered: true,  // SSG 启用预渲染
        moduleMap  // 传递模块映射表以渲染 Client Components
      })

      // 保存文件
      const htmlPath = getHtmlPath(pagesDir, routeInfo.path)
      const flightPath = getFlightPath(flightDir, routeInfo.path)

      fs.writeFileSync(htmlPath, html)
      fs.writeFileSync(flightPath, flight)

      // 获取 revalidate 配置
      const targetNode = routeInfo.routePath[routeInfo.routePath.length - 1]
      const revalidate = targetNode.page?.revalidate

      prerendered.push({
        path: routeInfo.path,
        htmlPath: path.relative(outputDir, htmlPath),
        flightPath: path.relative(outputDir, flightPath),
        revalidate: revalidate  // 添加 revalidate 配置
      })

      // 收集元数据
      metadataList.push({
        path: routeInfo.path,
        revalidate: revalidate
      })

      const revalidateInfo = revalidate !== undefined ? ` [revalidate: ${revalidate}]` : ''
      console.log(`    ✓ HTML:   ${path.relative(projectRoot, htmlPath)}${revalidateInfo}`)
      console.log(`    ✓ Flight: ${path.relative(projectRoot, flightPath)}`)

    } catch (error) {
      console.error(`    ✗ 渲染失败: ${error.message}`)
    }
  }

  // 批量保存元数据
  if (metadataList.length > 0) {
    batchSaveMetadata(metadataList)
    console.log(`  ✓ 元数据已保存\n`)
  }

  console.log(`  ✅ 预渲染完成！共 ${prerendered.length} 个页面\n`)
  return prerendered
}

/**
 * 收集所有可以静态生成的路由
 *
 * 规则：
 * - 有 page.jsx 的路由
 * - 非动态路由（不包含 [param]）
 *
 * @param {Object} node - 路由节点
 * @param {Array} path - 从根到当前节点的路径
 * @param {Array} result - 累积结果
 * @returns {Array} 静态路由列表
 */
function collectStaticRoutes(node, path = [node], result = []) {
  // 当前节点有 page.jsx 且不是动态路由
  if (node.page && !node.dynamic) {
    result.push({
      path: node.path,
      routePath: [...path]  // 完整路径（用于 Layout 嵌套）
    })
  }

  // 递归收集子路由
  if (node.children) {
    for (const child of node.children) {
      collectStaticRoutes(child, [...path, child], result)
    }
  }

  return result
}


/**
 * 获取 HTML 文件路径
 *
 * 映射规则：
 * / → index.html
 * /about → about.html
 * /blog/post → blog/post.html
 *
 * @param {string} pagesDir - pages 目录
 * @param {string} pathname - 路由路径
 * @returns {string} 文件路径
 */
function getHtmlPath(pagesDir, pathname) {
  if (pathname === '/') {
    return path.join(pagesDir, 'index.html')
  }

  // 移除前导斜杠
  const normalized = pathname.startsWith('/') ? pathname.slice(1) : pathname

  return path.join(pagesDir, `${normalized}.html`)
}

/**
 * 获取 Flight 文件路径
 *
 * @param {string} flightDir - flight 目录
 * @param {string} pathname - 路由路径
 * @returns {string} 文件路径
 */
function getFlightPath(flightDir, pathname) {
  if (pathname === '/') {
    return path.join(flightDir, 'index.txt')
  }

  const normalized = pathname.startsWith('/') ? pathname.slice(1) : pathname

  return path.join(flightDir, `${normalized}.txt`)
}
