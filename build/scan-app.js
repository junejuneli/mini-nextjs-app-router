import fs from 'fs'
import path from 'path'
import { isClientComponent } from '../shared/detect-client.js'

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
const SPECIAL_FILES = {
  'page.jsx': 'page',
  'page.js': 'page',
  'layout.jsx': 'layout',
  'layout.js': 'layout',
  'loading.jsx': 'loading',
  'loading.js': 'loading',
  'error.jsx': 'error',
  'error.js': 'error',
  'not-found.jsx': 'notFound',
  'not-found.js': 'notFound'
}

/**
 * 扫描 app/ 目录入口
 */
export function scanAppDirectory(appDir) {
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
 * @param {string} dir - 当前目录绝对路径
 * @param {string} appDir - app/ 根目录
 * @param {string} urlPath - 累积的 URL 路径
 * @returns {Object} 路由节点
 */
function scanDirectory(dir, appDir, urlPath) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  // 当前路由段名称（目录名）
  const segment = path.basename(dir)

  // 解析路由段类型
  const segmentInfo = parseSegment(segment)

  // 构建路由节点
  const node = {
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
        node[fileType] = {
          file: relativePath,
          absolutePath: entryPath,
          isClient: isClientComponent(entryPath)
        }

        // 如果是 page.jsx，提取 revalidate 配置
        if (fileType === 'page') {
          node[fileType].revalidate = extractRevalidateConfig(entryPath)
        }

        const revalidateInfo = node[fileType].revalidate !== undefined
          ? ` [revalidate: ${node[fileType].revalidate}]`
          : ''

        console.log(`  ${fileType.padEnd(10)} ${relativePath} ${node[fileType].isClient ? '(Client)' : '(Server)'}${revalidateInfo}`)
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
 * @param {string} segment - 路由段名称
 * @returns {Object} 解析结果
 */
function parseSegment(segment) {
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
 * @param {string} parentPath - 父路径
 * @param {string} segment - 当前段
 * @returns {string} URL 路径
 */
function buildUrlPath(parentPath, segment) {
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
 * @param {string} filePath - 文件路径
 * @returns {number|false|undefined} revalidate 值
 */
function extractRevalidateConfig(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')

    // 匹配 export const revalidate = 60
    // 或 export const revalidate = false
    const match = content.match(/export\s+const\s+revalidate\s*=\s*(\d+|false)/);

    if (match) {
      const value = match[1]
      return value === 'false' ? false : parseInt(value, 10)
    }

    return undefined
  } catch (error) {
    console.warn(`提取 revalidate 配置失败: ${filePath}`, error.message)
    return undefined
  }
}

/**
 * 打印路由树（调试用）
 */
export function printRouteTree(node, indent = 0) {
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

  for (const child of node.children) {
    printRouteTree(child, indent + 1)
  }
}
