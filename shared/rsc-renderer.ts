import React from 'react'
import { FlightEncoder } from './flight-encoder.ts'
import type { RouteNode, ClientComponentMap, ModuleInfo, FileInfo } from './types.ts'

/**
 * RSC (React Server Components) 渲染器
 *
 * 核心职责：
 * 1. 执行 Server Components
 * 2. 构建 Layout 树（嵌套布局）
 * 3. 编码为 Flight Protocol
 * 4. 返回 Flight Payload + Client Module 列表
 *
 * 渲染流程：
 * Route: /dashboard/settings
 *   ↓
 * 1. 收集 Layout 层级
 *    [RootLayout, DashboardLayout]
 *   ↓
 * 2. 从内到外构建树
 *    RootLayout( DashboardLayout( SettingsPage() ) )
 *   ↓
 * 3. 执行 Server Components
 *   ↓
 * 4. 编码为 Flight
 *   ↓
 * 5. 返回 { flight, clientModules }
 */

/**
 * RSC 渲染结果
 */
export interface RSCRenderResult {
  /** Flight Protocol 字符串 */
  flight: string
  /** 引用的 Client Components */
  clientModules: ModuleInfo[]
}

/**
 * 路由参数类型
 */
type RouteParams = Record<string, string | string[]>

/**
 * 渲染 RSC 树
 *
 * @param routePathOrNode - 路由路径数组 或 单个路由节点（向后兼容）
 * @param params - 路由参数 (如 { id: '123' })
 * @param clientComponentMap - Client Component 映射
 * @returns { flight: string, clientModules: Array }
 */
export async function renderRSC(
  routePathOrNode: RouteNode[] | RouteNode,
  params: RouteParams = {},
  clientComponentMap: ClientComponentMap = new Map()
): Promise<RSCRenderResult> {
  // 兼容处理：支持数组或单个节点
  const routePath = Array.isArray(routePathOrNode) ? routePathOrNode : [routePathOrNode]
  const targetRoute = routePath[routePath.length - 1]

  console.log('🎨 渲染 RSC 树:', targetRoute.path)
  console.log('  Layout 层级:', routePath.length)

  // 1. 构建 Layout 树（使用完整路径）
  const tree = await buildLayoutTree(routePath, params)

  // 2. 编码为 Flight Protocol（异步）⭐
  const encoder = new FlightEncoder(clientComponentMap)
  const flight = await encoder.encode(tree)

  // 3. 获取 Client Module 列表
  const clientModules = encoder.getClientModules()

  console.log('✅ RSC 渲染完成')
  console.log('  Client Modules:', clientModules.length)

  return {
    flight,
    clientModules
  }
}

/**
 * 构建 Layout 树
 *
 * 核心算法：
 * 1. 从路径数组收集所有 Layout
 * 2. 从内到外嵌套渲染
 *
 * 示例：
 * Path: [rootNode, dashboardNode]
 *   ↓
 * Layouts: [RootLayout, DashboardLayout]
 *   ↓
 * Tree: <RootLayout><DashboardLayout><Page /></DashboardLayout></RootLayout>
 *
 * @param routePath - 路由路径数组
 * @param params - 路由参数
 * @returns Layout 树
 */
async function buildLayoutTree(routePath: RouteNode[], params: RouteParams): Promise<React.ReactElement> {
  const targetRoute = routePath[routePath.length - 1]

  // 1. 从路径收集所有 Layout
  const layouts: FileInfo[] = []
  for (const node of routePath) {
    if (node.layout) {
      layouts.push(node.layout)
    }
  }

  console.log('  收集到的 Layout:', layouts.map(l => l.file))

  // 2. 加载 Page 组件
  if (!targetRoute.page) {
    throw new Error(`Route ${targetRoute.path} has no page.jsx`)
  }

  let tree = await loadAndRenderComponent(targetRoute.page, params)

  // 3. 包裹 loading.jsx (如果存在)
  if (targetRoute.loading) {
    tree = await wrapWithSuspense(tree, targetRoute.loading, params)
  }

  // 4. 从内到外包裹 Layout ⭐️
  for (let i = layouts.length - 1; i >= 0; i--) {
    const layoutInfo = layouts[i]
    console.log('  包裹 Layout:', layoutInfo.file)
    tree = await renderLayout(layoutInfo, tree, params)
  }

  return tree
}

/**
 * 渲染 Layout 组件
 *
 * @param layoutInfo - Layout 信息 { file, isClient }
 * @param children - 子树
 * @param params - 路由参数
 * @returns 包裹后的树
 */
async function renderLayout(
  layoutInfo: FileInfo,
  children: React.ReactElement,
  params: RouteParams
): Promise<React.ReactElement> {
  const LayoutComponent = await loadComponent(layoutInfo.absolutePath)

  // 执行 Layout 组件（可能是异步函数）
  let element: any = React.createElement(LayoutComponent, { children, params })

  // 如果 Layout 是异步的，等待它执行完成 ⭐
  if (element && typeof element.then === 'function') {
    element = await element
  }

  return element
}

/**
 * 加载并渲染组件
 *
 * Next.js Page 组件接收的 props 格式：
 * - params: 动态路由参数，如 { slug: 'hello-world' }
 * - searchParams: 查询参数（目前未实现）
 *
 * @param componentInfo - 组件信息
 * @param params - 动态路由参数
 * @returns ReactElement
 */
async function loadAndRenderComponent(
  componentInfo: FileInfo,
  params: RouteParams
): Promise<React.ReactElement> {
  const Component = await loadComponent(componentInfo.absolutePath)

  // ⭐ Next.js 规范：Page 组件接收 { params, searchParams } 作为 props
  // 即使 params 为空对象，也要传递（保持一致性）
  const props = { params }

  // 执行组件（可能是异步函数）
  let element: any = React.createElement(Component, props)

  // 如果组件返回 Promise，等待它执行完成 ⭐
  if (element && typeof element.then === 'function') {
    element = await element
  }

  return element
}

/**
 * 动态加载组件
 *
 * @param absolutePath - 组件绝对路径
 * @returns 组件函数
 */
async function loadComponent(absolutePath: string): Promise<React.ComponentType<any>> {
  try {
    // 使用 import() 动态加载
    const module = await import(absolutePath)

    const Component = module.default

    if (!Component) {
      throw new Error(`No default export in ${absolutePath}`)
    }

    return Component
  } catch (error) {
    console.error(`Failed to load component: ${absolutePath}`, error)
    throw error
  }
}

/**
 * 包裹 Suspense (loading.jsx)
 *
 * @param children - 子树
 * @param loadingInfo - Loading 组件信息
 * @param params - 参数
 * @returns ReactElement
 */
async function wrapWithSuspense(
  children: React.ReactElement,
  loadingInfo: FileInfo,
  params: RouteParams
): Promise<React.ReactElement> {
  const LoadingComponent = await loadComponent(loadingInfo.absolutePath)
  const fallback = React.createElement(LoadingComponent, params)

  return React.createElement(
    React.Suspense,
    { fallback },
    children
  )
}
