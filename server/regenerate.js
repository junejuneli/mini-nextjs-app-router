import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { renderRSC } from '../shared/rsc-renderer.js'
import { updateGeneratedAt } from '../shared/metadata.js'
import { generateHTMLTemplate } from '../shared/html-template.js'

/**
 * ISR 重新生成模块
 *
 * 功能：
 * 1. 后台重新生成静态页面
 * 2. 原子性写入文件
 * 3. 锁机制防止重复生成
 * 4. 失败处理
 *
 * 重新生成流程：
 * 1. 检查是否有其他任务正在生成
 * 2. 渲染 RSC 生成 Flight Protocol
 * 3. 生成 HTML
 * 4. 原子性写入文件(临时文件 → 重命名)
 * 5. 更新元数据
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

// 重新生成锁 Map<path, Promise>
const regenerationLocks = new Map()


/**
 * 后台重新生成单个页面
 *
 * @param {string} routePath - 路由路径
 * @param {Array} routePathNodes - 路由路径节点数组(用于 Layout 嵌套)
 * @param {Map} clientComponentMap - Client Component 映射表
 * @param {string} htmlPath - HTML 文件路径
 * @param {string} flightPath - Flight 文件路径
 */
async function regeneratePage(routePath, routePathNodes, clientComponentMap, htmlPath, flightPath) {
  console.log(`  🔄 ISR: 开始重新生成 ${routePath}`)

  try {
    // 1. 渲染 RSC
    const { flight, clientModules } = await renderRSC(
      routePathNodes,
      {},
      clientComponentMap
    )

    // 转换 clientComponentMap 为 id -> module 格式
    const moduleMap = {}
    for (const [Component, info] of clientComponentMap.entries()) {
      moduleMap[info.id] = { default: Component }
    }

    // 2. 生成 HTML（使用统一模板，启用预渲染）
    const html = generateHTMLTemplate({
      flight,
      clientModules,
      pathname: routePath,
      serverData: {
        nodeVersion: process.version,
        buildTime: new Date().toISOString(),
        env: 'production',
        prerendered: true,
        regenerated: true,  // 标记为 ISR 重新生成
        regeneratedAt: new Date().toISOString()
      },
      prerendered: true,  // ISR 也启用预渲染
      moduleMap  // 传递模块映射表以渲染 Client Components
    })

    // 3. 原子性写入 HTML (先写临时文件，再重命名)
    const htmlTempPath = htmlPath + '.tmp'
    fs.writeFileSync(htmlTempPath, html)
    fs.renameSync(htmlTempPath, htmlPath)

    // 4. 原子性写入 Flight Protocol
    const flightTempPath = flightPath + '.tmp'
    fs.writeFileSync(flightTempPath, flight)
    fs.renameSync(flightTempPath, flightPath)

    // 5. 更新元数据
    updateGeneratedAt(routePath)

    console.log(`  ✅ ISR: 重新生成完成 ${routePath}`)

  } catch (error) {
    console.error(`  ❌ ISR: 重新生成失败 ${routePath}`, error.message)
    throw error
  }
}

/**
 * 带锁的重新生成(防止重复生成)
 *
 * @param {string} routePath - 路由路径
 * @param {Object} options - 重新生成选项
 * @returns {Promise} 重新生成 Promise
 */
export async function regenerateWithLock(routePath, options) {
  // 检查是否已有重新生成任务
  if (regenerationLocks.has(routePath)) {
    console.log(`  ⏳ ISR: ${routePath} 正在重新生成，等待完成...`)
    return regenerationLocks.get(routePath)
  }

  // 创建重新生成任务
  const regeneratePromise = regeneratePage(
    routePath,
    options.routePathNodes,
    options.clientComponentMap,
    options.htmlPath,
    options.flightPath
  )

  // 加锁
  regenerationLocks.set(routePath, regeneratePromise)

  try {
    await regeneratePromise
  } finally {
    // 解锁
    regenerationLocks.delete(routePath)
  }

  return regeneratePromise
}

/**
 * 后台重新生成(不等待完成)
 *
 * @param {string} routePath - 路由路径
 * @param {Object} options - 重新生成选项
 */
export function regenerateInBackground(routePath, options) {
  // 启动后台任务，不等待完成
  regenerateWithLock(routePath, options).catch(error => {
    console.error(`ISR 后台重新生成失败: ${routePath}`, error)
  })
}
