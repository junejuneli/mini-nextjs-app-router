import express from 'express'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { renderRSC } from '../shared/rsc-renderer.js'
import { shouldRevalidate, getPageAge } from '../shared/metadata.js'
import { regenerateInBackground } from './regenerate.js'
import { generateHTMLTemplate } from '../shared/html-template.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

const app = express()
const PORT = process.env.PORT || 3000

console.log('\n🚀 Mini Next.js App Router 服务器启动中...\n')

// 加载路由清单
const manifestPath = path.join(projectRoot, '.next/manifest.json')
let manifest

try {
  const manifestData = fs.readFileSync(manifestPath, 'utf-8')
  manifest = JSON.parse(manifestData)
  console.log('✅ 路由清单加载成功')
} catch (error) {
  console.error('❌ 请先运行 npm run build 构建项目')
  process.exit(1)
}

// 静态资源
app.use(express.static(path.join(projectRoot, '.next/static')))
app.use(express.static(path.join(projectRoot, 'public')))

/**
 * 构建 Client Component 映射表
 *
 * 遍历路由路径，找到所有标记为 isClient 的组件，加载并注册到 Map 中
 * 同时递归注册所有被引用的 Client Components
 *
 * @param {Array} routePath - 路由路径数组
 * @returns {Map} Client Component 映射表 (Component Function -> Module Info)
 */
async function buildClientComponentMap(routePath) {
  const clientComponentMap = new Map()

  // 扫描并注册所有 Client Components（包括 client/ 目录）
  const clientDir = path.join(projectRoot, 'client')
  if (fs.existsSync(clientDir)) {
    const clientFiles = fs.readdirSync(clientDir)
      .filter(f => f.endsWith('.jsx') || f.endsWith('.js'))

    for (const file of clientFiles) {
      const absolutePath = path.join(clientDir, file)
      try {
        const componentModule = await import(absolutePath)
        const Component = componentModule.default

        if (Component) {
          const relativePath = './' + path.relative(projectRoot, absolutePath)

          clientComponentMap.set(Component, {
            id: relativePath,
            chunks: [path.basename(file, path.extname(file))],
            name: 'default'
          })

          console.log('  注册 Client Component:', relativePath)
        }
      } catch (error) {
        // 跳过无法导入的文件（如工具类）
      }
    }
  }

  for (const node of routePath) {
    // 检查 page
    if (node.page?.isClient) {
      const componentModule = await import(node.page.absolutePath)
      const Component = componentModule.default

      // 转换路径格式：/Users/.../app/dashboard/page.jsx -> ./app/dashboard/page.jsx
      const relativePath = './' + path.relative(projectRoot, node.page.absolutePath)

      clientComponentMap.set(Component, {
        id: relativePath,
        chunks: [path.basename(node.page.file, path.extname(node.page.file))],  // 'page'
        name: 'default'
      })

      console.log('  注册 Client Component:', relativePath)
    }

    // 检查 layout
    if (node.layout?.isClient) {
      const componentModule = await import(node.layout.absolutePath)
      const Component = componentModule.default

      const relativePath = './' + path.relative(projectRoot, node.layout.absolutePath)

      clientComponentMap.set(Component, {
        id: relativePath,
        chunks: [path.basename(node.layout.file, path.extname(node.layout.file))],
        name: 'default'
      })

      console.log('  注册 Client Component:', relativePath)
    }
  }

  return clientComponentMap
}

// RSC API 接口 (用于客户端导航)
app.get('*', async (req, res, next) => {
  const url = req.path

  // 跳过静态资源请求，让 express.static 中间件处理
  if (url.match(/\.(js|css|json|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)) {
    return next()
  }

  const isRSCRequest = req.query._rsc === '1'

  console.log(`📥 ${isRSCRequest ? 'RSC' : 'HTML'} 请求: ${url}`)

  try {
    // 1. 检查是否有预渲染文件
    const prerenderInfo = findPrerenderedInfo(url)

    if (prerenderInfo) {
      // 2. ISR: 检查是否需要重新验证
      const needsRevalidation = shouldRevalidate(url, prerenderInfo.revalidate)
      const pageAge = getPageAge(url)

      if (needsRevalidation && prerenderInfo.revalidate !== false) {
        // Stale-while-revalidate: 返回旧内容 + 后台重新生成
        console.log(`⚡ 使用预渲染文件 (age: ${pageAge}s, 触发后台重新生成)`)

        // 匹配路由获取完整路径
        const routePath = matchRoute(manifest.routeTree, url)
        if (routePath) {
          const staticDir = path.join(projectRoot, '.next/static')
          const htmlPath = path.join(staticDir, prerenderInfo.htmlPath)
          const flightPath = path.join(staticDir, prerenderInfo.flightPath)

          // 后台重新生成
          const clientComponentMap = await buildClientComponentMap(routePath)
          regenerateInBackground(url, {
            routePathNodes: routePath,
            clientComponentMap,
            htmlPath,
            flightPath
          })
        }
      } else {
        console.log(`⚡ 使用预渲染文件 (age: ${pageAge}s)`)
      }

      // 返回预渲染文件(可能是旧的)
      const filePath = isRSCRequest
        ? path.join(projectRoot, '.next/static', prerenderInfo.flightPath)
        : path.join(projectRoot, '.next/static', prerenderInfo.htmlPath)

      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8')

        if (isRSCRequest) {
          res.setHeader('Content-Type', 'text/x-component')
        } else {
          res.setHeader('Content-Type', 'text/html')
        }

        res.send(content)
        return
      }
    }

    // 2. 动态渲染（无预渲染文件或动态路由）
    console.log('🔄 动态渲染')

    // 匹配路由 - 返回完整路径 [rootNode, ...childNodes]
    const routePath = matchRoute(manifest.routeTree, url)

    if (!routePath) {
      res.status(404).send('404 Not Found')
      return
    }

    // 获取最后一个节点（目标路由）
    const targetRoute = routePath[routePath.length - 1]

    if (!targetRoute.page) {
      res.status(404).send('404 Not Found - No page.jsx')
      return
    }

    // 渲染 RSC（传入完整路径以支持嵌套 Layout）
    const clientComponentMap = await buildClientComponentMap(routePath)
    const { flight, clientModules } = await renderRSC(routePath, {}, clientComponentMap)

    console.log('📦 Flight Protocol 长度:', flight?.length || 0)

    // 如果是 RSC 请求，直接返回 Flight
    if (isRSCRequest) {
      res.setHeader('Content-Type', 'text/x-component')
      res.send(flight)
      return
    }

    // 否则返回完整 HTML（使用统一模板，SSR 不预渲染）
    const html = generateHTMLTemplate({
      flight,
      clientModules,
      pathname: targetRoute.path,
      serverData: {
        nodeVersion: process.version,
        requestTime: new Date().toISOString(),
        env: 'production',
        prerendered: false  // SSR 不预渲染
      },
      prerendered: false  // SSR 由客户端渲染
    })
    res.setHeader('Content-Type', 'text/html')
    res.send(html)

  } catch (error) {
    console.error('渲染失败:', error)
    res.status(500).send('Internal Server Error')
  }
})

/**
 * 查找预渲染信息
 *
 * @param {string} url - URL 路径
 * @returns {Object|null} 预渲染信息或 null
 */
function findPrerenderedInfo(url) {
  if (!manifest.prerendered || manifest.prerendered.length === 0) {
    return null
  }

  // 查找匹配的预渲染路由
  const prerendered = manifest.prerendered.find(item => item.path === url)

  if (!prerendered) {
    return null
  }

  return prerendered
}

/**
 * 路由匹配 - 返回完整路径上的节点数组
 *
 * 核心：App Router 需要嵌套 Layout，所以要收集路径上所有节点
 *
 * 示例：/dashboard/settings
 *   → [rootNode, dashboardNode, settingsNode]
 *   → 收集所有 layout: [RootLayout, DashboardLayout]
 *
 * @param {Object} routeTree - 路由树根节点
 * @param {string} url - URL 路径
 * @returns {Array} 路径上的所有节点（从根到叶）
 */
function matchRoute(routeTree, url) {
  const segments = url === '/' || url === '' ? [] : url.split('/').filter(Boolean)

  // 收集路径上的所有节点
  const path = []

  // 从根节点开始
  let current = routeTree
  path.push(current)

  // 如果是根路径，直接返回
  if (segments.length === 0) {
    return path
  }

  // 递归查找
  for (const segment of segments) {
    if (!current.children) break

    const child = current.children.find(c => c.segment === segment)

    if (!child) {
      console.warn(`Route not found: ${url}`)
      return null
    }

    path.push(child)
    current = child
  }

  return path
}


app.listen(PORT, () => {
  console.log(`\n✅ 服务器运行在 http://localhost:${PORT}\n`)
})
