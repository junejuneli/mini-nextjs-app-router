import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import type { PageMetadata } from './types.ts'

/**
 * ISR 元数据管理模块
 *
 * 功能：
 * 1. 存储每个预渲染页面的生成时间
 * 2. 记录 revalidate 配置
 * 3. 支持原子性更新
 *
 * 元数据格式：
 * {
 *   generatedAt: 1699999999999,  // Unix timestamp (ms)
 *   revalidate: 60,               // 重新验证间隔(秒), false 表示永不重新验证
 *   path: "/about"                // 路由路径
 * }
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const metadataDir = path.join(projectRoot, '.next/cache/metadata')

/**
 * 元数据保存选项
 */
export interface MetadataSaveOptions {
  revalidate?: number | false
  [key: string]: any
}

/**
 * 批量元数据项
 */
export interface MetadataBatchItem {
  path: string
  revalidate?: number | false
}

/**
 * 初始化元数据目录
 */
export function initMetadataDir(): void {
  if (!fs.existsSync(metadataDir)) {
    fs.mkdirSync(metadataDir, { recursive: true })
  }
}

/**
 * 获取元数据文件路径
 *
 * @param routePath - 路由路径 (如 "/", "/about")
 * @returns 文件路径
 */
function getMetadataPath(routePath: string): string {
  // 路由路径转文件名: / → index.json, /about → about.json
  const filename = routePath === '/' ? 'index.json' : routePath.slice(1).replace(/\//g, '_') + '.json'
  return path.join(metadataDir, filename)
}

/**
 * 保存元数据
 *
 * @param routePath - 路由路径
 * @param metadata - 元数据对象
 */
export function saveMetadata(routePath: string, metadata: MetadataSaveOptions): void {
  initMetadataDir()

  const metadataPath = getMetadataPath(routePath)
  const data: PageMetadata = {
    ...metadata,
    path: routePath,
    generatedAt: Date.now(),
    revalidate: metadata.revalidate ?? false
  }

  // 原子性写入：先写临时文件，再重命名
  const tempPath = metadataPath + '.tmp'
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2))
  fs.renameSync(tempPath, metadataPath)
}

/**
 * 加载元数据
 *
 * @param routePath - 路由路径
 * @returns 元数据对象，不存在返回 null
 */
export function loadMetadata(routePath: string): PageMetadata | null {
  const metadataPath = getMetadataPath(routePath)

  if (!fs.existsSync(metadataPath)) {
    return null
  }

  try {
    const content = fs.readFileSync(metadataPath, 'utf-8')
    return JSON.parse(content) as PageMetadata
  } catch (error) {
    console.error(`加载元数据失败: ${routePath}`, error)
    return null
  }
}

/**
 * 更新元数据的生成时间
 *
 * @param routePath - 路由路径
 */
export function updateGeneratedAt(routePath: string): void {
  const metadata = loadMetadata(routePath)

  if (!metadata) {
    console.warn(`元数据不存在: ${routePath}`)
    return
  }

  saveMetadata(routePath, {
    ...metadata,
    generatedAt: Date.now()
  })
}

/**
 * 检查是否需要重新验证
 *
 * @param routePath - 路由路径
 * @param revalidate - 重新验证间隔(秒)
 * @returns true 表示需要重新验证
 */
export function shouldRevalidate(routePath: string, revalidate?: number | false): boolean {
  // revalidate 为 false 或未配置，表示永不重新验证
  if (revalidate === false || revalidate === undefined) {
    return false
  }

  const metadata = loadMetadata(routePath)

  if (!metadata) {
    // 元数据不存在，需要重新生成
    return true
  }

  const now = Date.now()
  const age = now - metadata.generatedAt
  const revalidateMs = revalidate * 1000

  return age >= revalidateMs
}

/**
 * 获取页面年龄(秒)
 *
 * @param routePath - 路由路径
 * @returns 年龄(秒)，元数据不存在返回 Infinity
 */
export function getPageAge(routePath: string): number {
  const metadata = loadMetadata(routePath)

  if (!metadata) {
    return Infinity
  }

  const now = Date.now()
  const ageMs = now - metadata.generatedAt

  return Math.floor(ageMs / 1000)
}

/**
 * 批量保存元数据
 *
 * @param metadataList - 元数据列表 [{ path, revalidate }, ...]
 */
export function batchSaveMetadata(metadataList: MetadataBatchItem[]): void {
  initMetadataDir()

  for (const item of metadataList) {
    saveMetadata(item.path, {
      revalidate: item.revalidate
    })
  }
}
