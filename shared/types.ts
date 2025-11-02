/**
 * 核心类型定义
 *
 * 这个文件包含整个 Mini Next.js App Router 项目的核心类型定义
 */

import type React from 'react'

// ==================== Route Tree 路由树结构 ====================

/**
 * 路由段信息（解析后的段名称）
 */
export interface SegmentInfo {
  /** 原始段名称 */
  original: string
  /** 是否为动态路由 */
  dynamic: boolean
  /** 动态参数名（如 [id] 的 'id'） */
  param?: string
  /** 是否为 catch-all 路由（[...slug]） */
  catchAll?: boolean
}

/**
 * 文件信息
 */
export interface FileInfo {
  /** 相对于项目根目录的文件路径（如 'app/page.jsx'） */
  file: string
  /** 文件的绝对路径 */
  absolutePath: string
  /** 是否为 Client Component */
  isClient?: boolean
  /** 页面配置（仅 page.jsx 有） */
  config?: PageConfig
}

/**
 * 页面配置
 */
export interface PageConfig {
  /** ISR 重新验证时间（秒），false 表示不重新验证 */
  revalidate?: number | false
  /** 渲染模式 */
  dynamic?: 'force-static' | 'force-dynamic' | 'error' | 'auto'
  /** 是否启用运行时（Node.js/Edge） */
  runtime?: 'nodejs' | 'edge'
}

/**
 * 路由节点（路由树中的一个节点）
 */
export interface RouteNode {
  /** 路由段名称（如 'about', '[id]', ''） */
  segment: string
  /** URL 路径（如 '/', '/about', '/blog/[id]'） */
  path: string
  /** 是否为动态路由 */
  dynamic?: boolean
  /** 动态参数名 */
  param?: string
  /** 是否为 catch-all 路由 */
  catchAll?: boolean
  /** page.jsx 文件信息 */
  page?: FileInfo
  /** layout.jsx 文件信息 */
  layout?: FileInfo
  /** loading.jsx 文件信息 */
  loading?: FileInfo
  /** error.jsx 文件信息 */
  error?: FileInfo
  /** not-found.jsx 文件信息 */
  notFound?: FileInfo
  /** global-error.jsx 文件信息 */
  globalError?: FileInfo
  /** 子路由节点 */
  children?: RouteNode[]
}

/**
 * 路由扫描结果
 */
export interface RouteScanResult {
  /** 路由树根节点 */
  routeTree: RouteNode
  /** 所有路由路径列表（用于调试） */
  allRoutes: string[]
}

// ==================== Client Component Map 客户端组件映射 ====================

/**
 * 模块信息（Client Component 的模块引用）
 */
export interface ModuleInfo {
  /** 模块 ID（相对路径，如 './client/Link.jsx'） */
  id: string
  /** Vite chunk 文件名列表（用于预加载） */
  chunks: string[]
  /** 导出名称（通常是 'default'） */
  name: string
}

/**
 * Client Component Map（组件构造函数 -> 模块信息）
 */
export type ClientComponentMap = Map<React.ComponentType<any>, ModuleInfo>

/**
 * 模块映射表（路径 -> 模块对象或 loader 函数）
 */
export type ModuleMap = Record<string, any>

// ==================== Flight Protocol 类型 ====================

/**
 * Flight Chunk 类型
 */
export type FlightChunkType = 'M' | 'J' | 'S' | 'E' | 'H'

/**
 * Flight 模块引用（M chunk）
 */
export interface FlightModuleChunk {
  type: 'M'
  id: number
  value: ModuleInfo
}

/**
 * Flight JSON 数据（J chunk）
 */
export interface FlightJSONChunk {
  type: 'J'
  id: number
  value: any
}

/**
 * Flight Symbol（S chunk）
 */
export interface FlightSymbolChunk {
  type: 'S'
  id: number
  value: string
}

/**
 * Flight Error（E chunk）
 */
export interface FlightErrorChunk {
  type: 'E'
  id: number
  value: {
    message: string
    stack?: string
  }
}

/**
 * Flight 预加载提示（H chunk）
 */
export interface FlightHintChunk {
  type: 'H'
  id: number
  value: {
    type: 'preload' | 'prefetch'
    href: string
  }
}

/**
 * 所有 Flight Chunk 类型的联合类型
 */
export type FlightChunk =
  | FlightModuleChunk
  | FlightJSONChunk
  | FlightSymbolChunk
  | FlightErrorChunk
  | FlightHintChunk

/**
 * Flight 编码结果
 */
export interface FlightEncodeResult {
  /** Flight Protocol 字符串 */
  flight: string
  /** 引用的所有 Client Components */
  clientComponents: ModuleInfo[]
}

/**
 * React 元素数组表示（Flight Protocol 格式）
 *
 * 格式: ["$", type, key, props]
 */
export type FlightElementArray = [
  marker: '$',
  type: string | React.ComponentType<any>,
  key: string | null,
  props: Record<string, any>
]

// ==================== ISR Metadata 增量静态再生 ====================

/**
 * 页面元数据（用于 ISR）
 */
export interface PageMetadata {
  /** 生成时间戳（毫秒） */
  generatedAt: number
  /** 重新验证时间（秒），false 表示永不重新验证 */
  revalidate: number | false
  /** 页面路径 */
  path: string
}

/**
 * 预渲染信息
 */
export interface PrerenderInfo {
  /** 路由路径（如 '/', '/about'） */
  routePath: string
  /** HTML 文件路径（相对于 .next/） */
  htmlPath: string
  /** Flight 文件路径（相对于 .next/） */
  flightPath: string
  /** 重新验证时间 */
  revalidate?: number | false
  /** 渲染模式 */
  dynamic?: string
}

// ==================== Build 构建相关 ====================

/**
 * 构建清单（.next/manifest.json）
 */
export interface BuildManifest {
  /** 路由树 */
  routeTree: RouteNode
  /** 预渲染的页面列表 */
  prerenderedPages: PrerenderInfo[]
  /** 构建时间戳 */
  buildTime: number
}

/**
 * 静态渲染结果
 */
export interface StaticRenderResult {
  /** HTML 内容 */
  html: string
  /** Flight Protocol 数据 */
  flight: string
  /** 引用的 Client Components */
  clientComponents: ModuleInfo[]
}

// ==================== Server 服务器相关 ====================

/**
 * 路由匹配结果
 */
export interface RouteMatch {
  /** 匹配的路由节点列表（从根到目标） */
  routePathNodes: RouteNode[]
  /** 提取的动态参数 */
  params: Record<string, string | string[]>
}

/**
 * 渲染选项
 */
export interface RenderOptions {
  /** 路由路径节点 */
  routePathNodes: RouteNode[]
  /** 动态参数 */
  params?: Record<string, string | string[]>
  /** Client Component Map */
  clientComponentMap: ClientComponentMap
  /** 请求 URL（用于服务端） */
  url?: string
}

/**
 * SSR/SSG 渲染结果
 */
export interface RenderResult {
  /** HTML 内容（完整的 HTML 文档） */
  html: string
  /** Flight Protocol 数据 */
  flight: string
  /** 引用的 Client Components */
  clientComponents: ModuleInfo[]
}

// ==================== 运行时检查相关 ====================

/**
 * React 元素类型守卫
 */
export function isReactElement(value: any): value is React.ReactElement {
  return (
    typeof value === 'object' &&
    value !== null &&
    value.$$typeof === Symbol.for('react.element')
  )
}

/**
 * Promise 类型守卫
 */
export function isPromise<T = any>(value: any): value is Promise<T> {
  return value && typeof value.then === 'function'
}

/**
 * 函数类型守卫
 */
export function isFunction(value: any): value is Function {
  return typeof value === 'function'
}

// ==================== React 组件类型辅助 ====================

/**
 * 异步服务器组件
 */
export type AsyncServerComponent<P = any> = (props: P) => Promise<React.ReactElement>

/**
 * 同步服务器组件
 */
export type SyncServerComponent<P = any> = (props: P) => React.ReactElement

/**
 * 服务器组件（可同步或异步）
 */
export type ServerComponent<P = any> =
  | SyncServerComponent<P>
  | AsyncServerComponent<P>

/**
 * 客户端组件
 */
export type ClientComponent<P = any> = React.ComponentType<P>

// ==================== 模块加载相关 ====================

/**
 * 动态导入的模块对象
 */
export interface DynamicModule {
  default?: any
  [key: string]: any
}

/**
 * 模块加载器（Vite import.meta.glob 返回类型）
 */
export type ModuleLoader = () => Promise<DynamicModule>

// ==================== 错误处理 ====================

/**
 * 路由错误
 */
export class RouteError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500
  ) {
    super(message)
    this.name = 'RouteError'
  }
}

/**
 * 渲染错误
 */
export class RenderError extends Error {
  constructor(
    message: string,
    public cause?: Error
  ) {
    super(message)
    this.name = 'RenderError'
  }
}
