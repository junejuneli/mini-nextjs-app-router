import express, { type Request, type Response, type NextFunction } from 'express'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { renderRSC } from '../shared/rsc-renderer.ts'
import { shouldRevalidate, getPageAge } from '../shared/metadata.ts'
import { regenerateInBackground } from './regenerate.ts'
import { generateHTMLTemplate } from '../shared/html-template.ts'
import type { RouteNode, ClientComponentMap, ModuleInfo, PrerenderInfo } from '../shared/types.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

const app = express()
const PORT = process.env.PORT || 3000

console.log('\n🚀 Mini Next.js App Router 服务器启动中...\n')

// 加载路由清单
const manifestPath = path.join(projectRoot, '.next/manifest.json')

interface Manifest {
  routeTree: RouteNode
  buildTime: string
  version: string
  prerendered: PrerenderInfo[]
}

let manifest: Manifest

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
 * 路由匹配结果
 */
interface RouteMatchResult {
  /** 匹配的路由节点列表（从根到目标） */
  path: RouteNode[]
  /** 提取的动态参数 */
  params: Record<string, string | string[]>
}

/**
 * 构建 Client Component 映射表
 *
 * 遍历路由路径，找到所有标记为 isClient 的组件，加载并注册到 Map 中
 * 同时递归注册所有被引用的 Client Components
 *
 * @param routePath - 路由路径数组
 * @returns Client Component 映射表 (Component Function -> Module Info)
 */
async function buildClientComponentMap(routePath: RouteNode[]): Promise<ClientComponentMap> {
  const clientComponentMap: ClientComponentMap = new Map()

  // 扫描并注册所有 Client Components（包括 client/ 目录）
  const clientDir = path.join(projectRoot, 'client')
  if (fs.existsSync(clientDir)) {
    const clientFiles = fs.readdirSync(clientDir)
      .filter(f => f.endsWith('.tsx') || f.endsWith('.jsx') || f.endsWith('.ts') || f.endsWith('.js'))

    for (const file of clientFiles) {
      const absolutePath = path.join(clientDir, file)
      try {
        const componentModule = await import(absolutePath)
        const Component = componentModule.default

        if (Component) {
          const relativePath = './' + path.relative(projectRoot, absolutePath)

          const moduleInfo: ModuleInfo = {
            id: relativePath,
            chunks: [path.basename(file, path.extname(file))],
            name: 'default'
          }

          clientComponentMap.set(Component, moduleInfo)

          console.log('  注册 Client Component:', relativePath)
        }
      } catch (error) {
        // 跳过无法导入的文件（如工具类）
      }
    }
  }

  for (const node of routePath) {
    // 检查 page
    if (node.page?.isClient && node.page.absolutePath) {
      const componentModule = await import(node.page.absolutePath)
      const Component = componentModule.default

      // 转换路径格式：/Users/.../app/dashboard/page.jsx -> ./app/dashboard/page.jsx
      const relativePath = './' + path.relative(projectRoot, node.page.absolutePath)

      const moduleInfo: ModuleInfo = {
        id: relativePath,
        chunks: [path.basename(node.page.file, path.extname(node.page.file))],  // 'page'
        name: 'default'
      }

      clientComponentMap.set(Component, moduleInfo)

      console.log('  注册 Client Component:', relativePath)
    }

    // 检查 layout
    if (node.layout?.isClient && node.layout.absolutePath) {
      const componentModule = await import(node.layout.absolutePath)
      const Component = componentModule.default

      const relativePath = './' + path.relative(projectRoot, node.layout.absolutePath)

      const moduleInfo: ModuleInfo = {
        id: relativePath,
        chunks: [path.basename(node.layout.file, path.extname(node.layout.file))],
        name: 'default'
      }

      clientComponentMap.set(Component, moduleInfo)

      console.log('  注册 Client Component:', relativePath)
    }
  }

  return clientComponentMap
}

// RSC API 接口 (用于客户端导航)
app.get('*', async (req: Request, res: Response, next: NextFunction) => {
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
        const matchResult = matchRoute(manifest.routeTree, url)
        if (matchResult) {
          const { path: routePath } = matchResult
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

    // 匹配路由 - 返回完整路径 [rootNode, ...childNodes] + 动态参数
    const matchResult = matchRoute(manifest.routeTree, url)

    if (!matchResult) {
      // 路由不匹配时，渲染 not-found.jsx
      console.log('❌ 路由未找到，渲染 not-found.jsx')
      return await renderNotFound(manifest.routeTree, isRSCRequest, res)
    }

    const { path: routePath, params } = matchResult

    // 获取最后一个节点（目标路由）
    const targetRoute = routePath[routePath.length - 1]

    if (!targetRoute.page) {
      // 路由匹配但没有 page.jsx，也渲染 not-found.jsx
      console.log('❌ 路由无 page.jsx，渲染 not-found.jsx')
      return await renderNotFound(manifest.routeTree, isRSCRequest, res)
    }

    // 渲染 RSC（传入完整路径以支持嵌套 Layout + 动态参数）
    if (Object.keys(params).length > 0) {
      console.log('📌 动态路由参数:', params)
    }
    const clientComponentMap = await buildClientComponentMap(routePath)
    const { flight, clientModules } = await renderRSC(routePath, params, clientComponentMap)

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
 * @param url - URL 路径
 * @returns 预渲染信息或 null
 */
function findPrerenderedInfo(url: string): PrerenderInfo | null {
  if (!manifest.prerendered || manifest.prerendered.length === 0) {
    return null
  }

  // 查找匹配的预渲染路由
  const prerendered = manifest.prerendered.find(item => item.routePath === url)

  if (!prerendered) {
    return null
  }

  return prerendered
}

/**
 * 渲染 not-found.jsx
 *
 * @param routeTree - 路由树根节点
 * @param isRSCRequest - 是否为 RSC 请求
 * @param res - Express response 对象
 */
async function renderNotFound(
  routeTree: RouteNode,
  isRSCRequest: boolean,
  res: Response
): Promise<void> {
  // 检查根节点是否有 not-found.jsx
  if (!routeTree.notFound) {
    // 如果没有 not-found.jsx，返回简单的 404
    res.status(404).send('404 Not Found')
    return
  }

  // 构建 not-found 的渲染路径：[rootNode]（包含 layout 和 notFound）
  const notFoundPath: RouteNode[] = [{
    segment: routeTree.segment,
    path: routeTree.path,
    layout: routeTree.layout,
    page: routeTree.notFound,  // 将 notFound 当作 page 来渲染
    notFound: routeTree.notFound
  }]

  // 构建 Client Component Map
  const clientComponentMap = await buildClientComponentMap(notFoundPath)

  // 渲染 RSC
  const { flight, clientModules } = await renderRSC(notFoundPath, {}, clientComponentMap)

  console.log('📦 Not-Found Flight Protocol 长度:', flight?.length || 0)

  // 如果是 RSC 请求，直接返回 Flight
  if (isRSCRequest) {
    res.status(404)
    res.setHeader('Content-Type', 'text/x-component')
    res.send(flight)
    return
  }

  // 否则返回完整 HTML
  const html = generateHTMLTemplate({
    flight,
    clientModules,
    pathname: '/not-found',
    serverData: {
      nodeVersion: process.version,
      requestTime: new Date().toISOString(),
      env: 'production',
      prerendered: false
    },
    prerendered: false
  })

  res.status(404)
  res.setHeader('Content-Type', 'text/html')
  res.send(html)
}

/**
 * 路由匹配 - 返回完整路径上的节点数组 + 提取的动态参数
 *
 * 核心：App Router 需要嵌套 Layout，所以要收集路径上所有节点
 *
 * 支持特性：
 * 1. 静态路由：精确匹配
 * 2. 动态路由：[param] 匹配单个段
 * 3. Catch-all 路由：[...param] 匹配剩余所有段
 *
 * 示例：
 * - /dashboard/settings → [rootNode, dashboardNode, settingsNode], {}
 * - /blog/hello → [rootNode, blogNode, [slug]Node], { slug: 'hello' }
 *
 * @param routeTree - 路由树根节点
 * @param url - URL 路径
 * @returns { path: Array, params: Object } 或 null
 */
function matchRoute(routeTree: RouteNode, url: string): RouteMatchResult | null {
  const segments = url === '/' || url === '' ? [] : url.split('/').filter(Boolean)

  // 收集路径上的所有节点和提取的参数
  const path: RouteNode[] = []
  const params: Record<string, string | string[]> = {}

  // 从根节点开始
  let current: RouteNode = routeTree
  path.push(current)

  // 如果是根路径，直接返回
  if (segments.length === 0) {
    return { path, params }
  }

  // 递归查找
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]

    if (!current.children) break

    // ⭐ 优先精确匹配静态路由
    let child = current.children.find(c => c.segment === segment && !c.dynamic)

    // ⭐ 如果没有精确匹配，尝试动态路由匹配
    if (!child) {
      // 查找动态路由节点
      child = current.children.find(c => c.dynamic)

      if (child) {
        // Catch-all 路由：[...slug] 匹配剩余所有段
        if (child.catchAll && child.param) {
          const remainingSegments = segments.slice(i)
          params[child.param] = remainingSegments
          path.push(child)
          // Catch-all 路由消耗所有剩余段，结束匹配
          return { path, params }
        } else if (child.param) {
          // 普通动态路由：[id] 匹配单个段
          params[child.param] = segment
        }
      }
    }

    // 如果仍然没有匹配，返回 null
    if (!child) {
      console.warn(`Route not found: ${url}`)
      return null
    }

    path.push(child)
    current = child
  }

  return { path, params }
}


app.listen(PORT, () => {
  console.log(`\n✅ 服务器运行在 http://localhost:${PORT}\n`)
})
