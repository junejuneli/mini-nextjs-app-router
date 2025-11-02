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

  // 收集所有可预渲染的路由（包括静态路由和动态路由）
  const staticRoutes = collectStaticRoutes(routeTree)
  const dynamicRoutes = await collectDynamicRoutes(routeTree)

  const allRoutes = [...staticRoutes, ...dynamicRoutes]
  console.log(`  找到 ${staticRoutes.length} 个静态路由 + ${dynamicRoutes.length} 个动态路由:\n`)

  const prerendered = []
  const metadataList = []

  // 渲染每个静态路由（包括静态和动态）
  for (const routeInfo of allRoutes) {
    try {
      const paramInfo = routeInfo.params ? ` ${JSON.stringify(routeInfo.params)}` : ''
      console.log(`  📄 预渲染: ${routeInfo.path}${paramInfo}`)

      // 渲染 RSC（传递参数）
      const { flight, clientModules } = await renderRSC(
        routeInfo.routePath,
        routeInfo.params || {},  // ⭐ 传递动态路由参数
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

      // 保存文件（确保父目录存在）
      const htmlPath = getHtmlPath(pagesDir, routeInfo.path)
      const flightPath = getFlightPath(flightDir, routeInfo.path)

      // 创建父目录（如果不存在）
      fs.mkdirSync(path.dirname(htmlPath), { recursive: true })
      fs.mkdirSync(path.dirname(flightPath), { recursive: true })

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
  // 当前节点有 page.jsx 且不是动态路由 且不是 force-dynamic
  // node.dynamic 有两个含义：
  // 1. 路由段的 dynamic (来自 parseSegment) - 表示是否为动态路由如 [id]
  // 2. 页面的 dynamic 配置 (来自 extractDynamicConfig) - 表示渲染模式
  const isDynamicRoute = node.dynamic  // 动态路由如 [id]
  const isForceDynamic = node.page?.dynamic === 'force-dynamic'  // SSR 配置

  if (node.page && !isDynamicRoute && !isForceDynamic) {
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
 * 收集动态路由并通过 generateStaticParams() 生成静态页面
 *
 * 核心流程：
 * 1. 遍历路由树，找到动态路由节点（node.dynamic === true）
 * 2. 检查对应的 page.jsx 是否导出 generateStaticParams 函数
 * 3. 调用该函数获取参数列表：[{ slug: 'post-1' }, { slug: 'post-2' }]
 * 4. 为每个参数组合生成路由信息
 *
 * @param {Object} node - 路由节点
 * @param {Array} path - 从根到当前节点的路径
 * @param {Array} result - 累积结果
 * @returns {Promise<Array>} 动态路由生成的静态路由列表
 */
async function collectDynamicRoutes(node, path = [node], result = []) {
  // 检查当前节点是否为动态路由 且有 page.jsx 且不是强制 SSR
  if (node.dynamic && node.page && node.page.dynamic !== 'force-dynamic') {
    try {
      // 动态导入 page.jsx 模块
      const pageModule = await import(node.page.absolutePath)

      // 检查是否导出 generateStaticParams
      if (pageModule.generateStaticParams) {
        console.log(`  🔧 调用 generateStaticParams: ${node.page.file}`)

        // 调用函数获取参数列表
        const paramsList = await pageModule.generateStaticParams()

        console.log(`     生成 ${paramsList.length} 个参数组合`)

        // 为每个参数组合生成路由
        for (const params of paramsList) {
          // 构建具体路径：将 [slug] 替换为实际值
          const concretePath = buildPathWithParams(node, path, params)

          result.push({
            path: concretePath,
            routePath: [...path],  // 完整路径（用于 Layout 嵌套）
            params  // 参数对象，如 { slug: 'react-server-components' }
          })
        }
      }
    } catch (error) {
      console.warn(`    ⚠️  无法处理动态路由 ${node.path}: ${error.message}`)
    }
  }

  // 递归处理子路由
  if (node.children) {
    for (const child of node.children) {
      await collectDynamicRoutes(child, [...path, child], result)
    }
  }

  return result
}

/**
 * 根据参数构建具体路径
 *
 * 核心思路：使用 node.path 作为模板，将其中的动态段替换为实际参数值
 *
 * 示例：
 * - node.path: /blog/[slug]
 * - 参数: { slug: 'hello-world' }
 * - 结果: /blog/hello-world
 *
 * @param {Object} node - 当前动态路由节点
 * @param {Array} path - 完整路径（未使用，保留以备后续扩展）
 * @param {Object} params - 参数对象
 * @returns {string} 具体路径
 */
function buildPathWithParams(node, path, params) {
  // 使用 node.path 作为模板（例如 "/blog/[slug]"）
  let concretePath = node.path

  // 替换所有动态段：[param] → 实际值
  // 如果是 catch-all 路由 [...slug]，params[slug] 是数组
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      // Catch-all: [...slug] → /a/b/c
      concretePath = concretePath.replace(`[...${key}]`, value.join('/'))
    } else {
      // 普通动态路由: [id] → 123
      concretePath = concretePath.replace(`[${key}]`, value)
    }
  }

  return concretePath
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
