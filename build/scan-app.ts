import fs from 'fs'
import path from 'path'
import { isClientComponent } from '../shared/detect-client.ts'
import type { RouteNode, FileInfo, PageConfig } from '../shared/types.ts'

/**
 * 扫描 app/ 目录，构建路由树
 *
 * 核心原理：
 * 1. 递归遍历 app/ 目录
 * 2. 识别特殊文件：page.jsx, layout.jsx, loading.jsx, error.jsx, not-found.jsx
 * 3. 提取动态路由参数：[id], [...slug]
 * 4. 构建嵌套的路由树结构
 * 5. 标记组件类型（Server/Client）
 *
 * 路由树结构：
 * {
 *   segment: '',              // 路由段（空字符串表示根）
 *   path: '/',                // URL 路径
 *   dynamic: false,           // 是否动态路由
 *   page: {                   // page.jsx
 *     file: 'app/page.jsx',
 *     isClient: false
 *   },
 *   layout: { ... },          // layout.jsx
 *   loading: { ... },         // loading.jsx
 *   error: { ... },           // error.jsx
 *   children: [               // 子路由
 *     { segment: 'about', ... }
 *   ]
 * }
 */

// 特殊文件名映射
const SPECIAL_FILES: Record<string, keyof RouteNode> = {
  'page.tsx': 'page',
  'page.jsx': 'page',
  'page.ts': 'page',
  'page.js': 'page',
  'layout.tsx': 'layout',
  'layout.jsx': 'layout',
  'layout.ts': 'layout',
  'layout.js': 'layout',
  'loading.tsx': 'loading',
  'loading.jsx': 'loading',
  'loading.ts': 'loading',
  'loading.js': 'loading',
  'error.tsx': 'error',
  'error.jsx': 'error',
  'error.ts': 'error',
  'error.js': 'error',
  'not-found.tsx': 'notFound',
  'not-found.jsx': 'notFound',
  'not-found.ts': 'notFound',
  'not-found.js': 'notFound',
  'global-error.tsx': 'globalError',
  'global-error.jsx': 'globalError',
  'global-error.ts': 'globalError',
  'global-error.js': 'globalError'
}

/**
 * 路由段解析结果
 */
interface SegmentParseResult {
  segment: string
  dynamic: boolean
  param?: string
  catchAll?: boolean
}

/**
 * 扫描 app/ 目录入口
 */
export function scanAppDirectory(appDir: string): RouteNode {
  console.log('📂 扫描 app/ 目录...')

  if (!fs.existsSync(appDir)) {
    throw new Error(`app/ 目录不存在: ${appDir}`)
  }

  // 从根目录开始扫描
  const routeTree = scanDirectory(appDir, appDir, '')

  console.log('✅ 扫描完成\n')
  return routeTree
}

/**
 * 递归扫描目录
 *
 * @param dir - 当前目录绝对路径
 * @param appDir - app/ 根目录
 * @param urlPath - 累积的 URL 路径
 * @returns 路由节点
 */
function scanDirectory(dir: string, appDir: string, urlPath: string): RouteNode {
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  // 当前路由段名称（目录名）
  const segment = path.basename(dir)

  // 解析路由段类型
  const segmentInfo = parseSegment(segment)

  // 构建路由节点
  const node: RouteNode = {
    segment: segmentInfo.segment,
    path: urlPath || '/',
    dynamic: segmentInfo.dynamic,
    param: segmentInfo.param,
    catchAll: segmentInfo.catchAll,
    children: []
  }

  // 扫描当前目录下的文件
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name)
    const relativePath = path.relative(appDir, entryPath)

    if (entry.isFile()) {
      // 检查是否为特殊文件
      const fileType = SPECIAL_FILES[entry.name]

      if (fileType) {
        const fileInfo: FileInfo = {
          file: relativePath,
          absolutePath: entryPath,
          isClient: isClientComponent(entryPath)
        }

        // 如果是 page.jsx，提取 revalidate 和 dynamic 配置
        if (fileType === 'page') {
          const revalidate = extractRevalidateConfig(entryPath)
          const dynamicConfig = extractDynamicConfig(entryPath)

          if (revalidate !== undefined || dynamicConfig !== undefined) {
            fileInfo.config = {
              revalidate,
              dynamic: dynamicConfig
            }
          }
        }

        // 使用类型断言来赋值
        (node as any)[fileType] = fileInfo

        const revalidateInfo = fileInfo.config?.revalidate !== undefined
          ? ` [revalidate: ${fileInfo.config.revalidate}]`
          : ''

        const dynamicInfo = fileInfo.config?.dynamic === 'force-dynamic'
          ? ' [SSR]'
          : ''

        console.log(`  ${String(fileType).padEnd(10)} ${relativePath} ${fileInfo.isClient ? '(Client)' : '(Server)'}${revalidateInfo}${dynamicInfo}`)
      }
    }
    else if (entry.isDirectory()) {
      // 跳过 Node 模块和隐藏目录
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
        continue
      }

      // 递归扫描子目录
      const childUrlPath = buildUrlPath(urlPath, entry.name)
      const childNode = scanDirectory(entryPath, appDir, childUrlPath)

      if (!node.children) {
        node.children = []
      }
      node.children.push(childNode)
    }
  }

  return node
}

/**
 * 解析路由段
 *
 * 支持的格式：
 * - 普通段: about → { segment: 'about', dynamic: false }
 * - 动态段: [id] → { segment: '[id]', dynamic: true, param: 'id' }
 * - Catch-all: [...slug] → { segment: '[...slug]', catchAll: true, param: 'slug' }
 *
 * @param segment - 路由段名称
 * @returns 解析结果
 */
function parseSegment(segment: string): SegmentParseResult {
  // 动态路由: [id]
  const dynamicMatch = segment.match(/^\[([^\]]+)\]$/)
  if (dynamicMatch) {
    const param = dynamicMatch[1]

    // Catch-all 路由: [...slug]
    const catchAllMatch = param.match(/^\.\.\.(.+)$/)
    if (catchAllMatch) {
      return {
        segment,
        dynamic: true,
        catchAll: true,
        param: catchAllMatch[1]
      }
    }

    // 普通动态路由: [id]
    return {
      segment,
      dynamic: true,
      param
    }
  }

  // 静态路由
  return {
    segment,
    dynamic: false
  }
}

/**
 * 构建 URL 路径
 *
 * Next.js 路由组特性：
 * - 括号包裹的目录（如 (marketing)）不出现在 URL 中
 * - 用于代码组织和共享布局，不影响路由结构
 * - 例如：app/(marketing)/pricing/page.jsx → /pricing
 *
 * @param parentPath - 父路径
 * @param segment - 当前段
 * @returns URL 路径
 */
function buildUrlPath(parentPath: string, segment: string): string {
  // ⭐ 路由组：括号包裹的目录不出现在 URL 中
  // (marketing), (app), (admin) 等都会被跳过
  if (segment.startsWith('(') && segment.endsWith(')')) {
    return parentPath || '/'
  }

  // 根路径
  if (!parentPath || parentPath === '/') {
    return `/${segment}`
  }

  return `${parentPath}/${segment}`
}

/**
 * 提取 page.jsx 的 revalidate 配置
 *
 * 查找文件中的 export const revalidate = ...
 *
 * @param filePath - 文件路径
 * @returns revalidate 值
 */
function extractRevalidateConfig(filePath: string): number | false | undefined {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')

    // 匹配 export const revalidate = 60
    // 或 export const revalidate = false
    const match = content.match(/export\s+const\s+revalidate\s*=\s*(\d+|false)/)

    if (match) {
      const value = match[1]
      return value === 'false' ? false : parseInt(value, 10)
    }

    return undefined
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`提取 revalidate 配置失败: ${filePath}`, message)
    return undefined
  }
}

/**
 * 提取 dynamic 配置
 *
 * 支持：
 * - export const dynamic = 'force-dynamic' (强制 SSR)
 * - export const dynamic = 'force-static' (强制 SSG)
 * - export const dynamic = 'error' (禁止动态渲染)
 * - export const dynamic = 'auto' (自动选择，默认)
 *
 * @param filePath - 文件路径
 * @returns dynamic 配置值
 */
function extractDynamicConfig(filePath: string): PageConfig['dynamic'] | undefined {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')

    // 匹配 export const dynamic = 'force-dynamic'
    const match = content.match(/export\s+const\s+dynamic\s*=\s*['"]([^'"]+)['"]/)

    if (match) {
      const value = match[1] as PageConfig['dynamic']
      return value
    }

    return undefined
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`提取 dynamic 配置失败: ${filePath}`, message)
    return undefined
  }
}

/**
 * 打印路由树（调试用）
 */
export function printRouteTree(node: RouteNode, indent: number = 0): void {
  const prefix = '  '.repeat(indent)

  console.log(`${prefix}📍 ${node.path}`)

  if (node.layout) {
    console.log(`${prefix}  └─ layout: ${node.layout.file}`)
  }
  if (node.page) {
    console.log(`${prefix}  └─ page:   ${node.page.file}`)
  }
  if (node.loading) {
    console.log(`${prefix}  └─ loading: ${node.loading.file}`)
  }

  if (node.children) {
    for (const child of node.children) {
      printRouteTree(child, indent + 1)
    }
  }
}
