# 增量导航更新实现方案

> Partial Rendering - 只传输变化的路由段

---

## 一、问题分析

### 1.1 当前实现的问题

```typescript
// 当前行为: 全量传输
导航: /dashboard → /dashboard/settings

客户端请求:
GET /dashboard/settings?_rsc=1

服务端返回: 完整树
<RootLayout>           ← 重复传输
  <DashboardLayout>    ← 重复传输
    <SettingsPage />   ← 真正变化的部分
  </DashboardLayout>
</RootLayout>

Flight Protocol 大小: ~15 KB
```

**问题**:
- ❌ 每次导航都传输完整的 Layout 树
- ❌ 浪费带宽 (80% 数据是重复的)
- ❌ 不符合 Next.js 原版行为

### 1.2 Next.js 原版行为

```typescript
// 原版行为: 增量传输
导航: /dashboard → /dashboard/settings

客户端请求:
GET /dashboard/settings?_rsc=1
Referer: http://localhost:3000/dashboard

服务端计算:
fromPath: /dashboard          → [root, dashboard]
toPath:   /dashboard/settings → [root, dashboard, settings]
共同段:   [root, dashboard]
变化段:   [settings] ← 只传输这个

Flight Protocol 大小: ~3 KB (节省 80%)
```

---

## 二、核心原理

### 2.1 Route Segments 概念

```
路由 URL:  /dashboard/settings/profile
           ├─────────┼────────┼───────
           │         │        │
路由段:     root      dashboard settings profile
           (/)
```

**关键特性**:
- 每个 `/` 分隔的部分是一个 segment
- Root 是特殊的空 segment
- 每个 segment 对应一个 Layout 层级

### 2.2 共享段计算算法

```typescript
function getSharedSegments(fromPath: string, toPath: string): number {
  const fromSegments = fromPath.split('/').filter(Boolean)
  const toSegments = toPath.split('/').filter(Boolean)

  let sharedCount = 0
  for (let i = 0; i < Math.min(fromSegments.length, toSegments.length); i++) {
    if (fromSegments[i] === toSegments[i]) {
      sharedCount++
    } else {
      break
    }
  }

  // +1 for root segment
  return sharedCount + 1
}
```

**示例**:
```typescript
getSharedSegments('/dashboard/profile', '/dashboard/settings')
// fromSegments: ['dashboard', 'profile']
// toSegments:   ['dashboard', 'settings']
// 共同前缀:     ['dashboard']
// 返回: 2 (root + dashboard)

getSharedSegments('/about', '/blog')
// fromSegments: ['about']
// toSegments:   ['blog']
// 共同前缀:     []
// 返回: 1 (only root)
```

### 2.3 Flight Protocol 分段传输

```typescript
// 完整传输 (首次加载)
M1:{"id":"./RootLayout.jsx",...}
M2:{"id":"./DashboardLayout.jsx",...}
M3:{"id":"./SettingsPage.jsx",...}
J0:["$","html",null,{
  "children":["$","@1",null,{
    "children":["$","@2",null,{
      "children":["$","@3",null,{}]
    }]
  }]
}]

// 增量传输 (客户端导航)
M3:{"id":"./SettingsPage.jsx",...}
J0:["$","@3",null,{}]  ← 只有 SettingsPage
```

### 2.4 客户端树合并策略

```typescript
// 当前树结构
currentTree = {
  root: {
    children: {
      dashboard: {
        children: {
          profile: <ProfilePage />  ← 旧的
        }
      }
    }
  }
}

// 接收增量数据
incrementalData = <SettingsPage />

// 合并策略 (Replace, not Merge)
1. 保留共享段: root, dashboard
2. 替换变化段: profile → settings
3. React reconciliation 更新 DOM

// 合并后
newTree = {
  root: {                         ← 保留
    children: {
      dashboard: {                ← 保留
        children: {
          settings: <SettingsPage />  ← 替换
        }
      }
    }
  }
}
```

---

## 三、实现方案

### 3.1 服务端改造 (`server/index.ts`)

#### 核心逻辑

```typescript
// server/index.ts (新增函数)

/**
 * 从 Referer header 提取路径
 */
function extractFromPath(req: Request): string | null {
  const referer = req.headers.referer
  if (!referer) return null

  try {
    const url = new URL(referer)
    // 确保是同域请求
    if (url.host !== req.headers.host) return null
    return url.pathname
  } catch {
    return null
  }
}

/**
 * 计算共同路由段数量
 */
function getSharedSegmentCount(fromPath: string, toPath: string): number {
  const fromSegments = fromPath.split('/').filter(Boolean)
  const toSegments = toPath.split('/').filter(Boolean)

  let sharedCount = 0
  for (let i = 0; i < Math.min(fromSegments.length, toSegments.length); i++) {
    if (fromSegments[i] === toSegments[i]) {
      sharedCount++
    } else {
      break
    }
  }

  // +1 for root segment
  return sharedCount + 1
}
```

#### 请求处理改造

```typescript
// server/index.ts:187 (修改主路由处理)

app.get('*', async (req: Request, res: Response, next: NextFunction) => {
  const url = req.path
  const isRSCRequest = req.query._rsc === '1'

  // ... 静态资源检查 ...

  // ⭐ 增量更新逻辑
  if (isRSCRequest) {
    const fromPath = extractFromPath(req)

    if (fromPath && fromPath !== url) {
      console.log(`🔄 增量导航: ${fromPath} → ${url}`)

      // 匹配路由
      const matchResult = matchRoute(manifest.routeTree, url)
      if (!matchResult) {
        return await renderNotFound(manifest.routeTree, isRSCRequest, res)
      }

      const { path: routePath, params } = matchResult
      const searchParams = extractSearchParams(req)

      // 计算共同段
      const sharedCount = getSharedSegmentCount(fromPath, url)
      console.log(`  共享段: ${sharedCount}, 总段: ${routePath.length}`)

      // 只渲染变化部分
      if (sharedCount < routePath.length) {
        const clientComponentMap = await buildClientComponentMap(routePath)

        // ⭐ 传递 startIndex 参数
        const { flight, clientModules } = await renderRSC(
          routePath,
          { params, searchParams },
          clientComponentMap,
          sharedCount  // ← 从这个索引开始渲染
        )

        console.log(`  增量 Flight 大小: ${flight.length} 字节`)

        res.setHeader('Content-Type', 'text/x-component')
        res.setHeader('X-Nextjs-Partial', 'true')  // 标记增量响应
        res.setHeader('X-Nextjs-Shared-Segments', String(sharedCount))
        res.send(flight)
        return
      }
    }
  }

  // 完整渲染逻辑 (首次加载、非 RSC 请求)
  // ... 原有代码 ...
})
```

### 3.2 RSC 渲染器改造 (`shared/rsc-renderer.ts`)

#### 函数签名修改

```typescript
// shared/rsc-renderer.ts:80

export async function renderRSC(
  routePath: RouteNode[],
  options: RenderOptions = {},
  clientComponentMap: ClientComponentMap = new Map(),
  startIndex: number = 0  // ⭐ 新增参数: 从哪个索引开始渲染
): Promise<RSCRenderResult> {
  const targetRoute = routePath[routePath.length - 1]
  const params: RouteParams = options.params || {}
  const searchParams: SearchParams = options.searchParams || {}

  console.log('🎨 渲染 RSC 树:', targetRoute.path)
  console.log('  Layout 层级:', routePath.length)
  console.log('  起始索引:', startIndex)

  // ⭐ 构建部分 Layout 树
  const tree = await buildLayoutTree(routePath, params, searchParams, startIndex)

  const encoder = new FlightEncoder(clientComponentMap)
  const flight = await encoder.encode(tree)
  const clientModules = encoder.getClientModules()

  console.log('✅ RSC 渲染完成')
  console.log('  渲染段数:', routePath.length - startIndex)

  return { flight, clientModules }
}
```

#### Layout 树构建改造

```typescript
// shared/rsc-renderer.ts:135

async function buildLayoutTree(
  routePath: RouteNode[],
  params: RouteParams,
  searchParams: SearchParams,
  startIndex: number = 0  // ⭐ 新增参数
): Promise<React.ReactElement> {
  const targetRoute = routePath[routePath.length - 1]

  // 1. 收集 Layout (从 startIndex 开始)
  const layouts: FileInfo[] = []
  for (let i = startIndex; i < routePath.length; i++) {
    if (routePath[i].layout) {
      layouts.push(routePath[i].layout)
    }
  }

  console.log('  收集到的 Layout (部分):', layouts.map(l => l.file))

  // 2. 加载 Page 组件
  if (!targetRoute.page) {
    throw new Error(`Route ${targetRoute.path} has no page.jsx`)
  }

  let tree = await loadAndRenderComponent(targetRoute.page, params, searchParams)

  // 3. 包裹 loading.jsx (如果存在)
  if (targetRoute.loading) {
    tree = await wrapWithSuspense(tree, targetRoute.loading, params)
  }

  // 4. 从内到外包裹 Layout (只包裹变化部分)
  for (let i = layouts.length - 1; i >= 0; i--) {
    const layoutInfo = layouts[i]
    console.log('  包裹 Layout:', layoutInfo.file)
    tree = await renderLayout(layoutInfo, tree, params)
  }

  return tree
}
```

### 3.3 客户端改造 (`client/router.tsx`)

**核心问题**: 服务端返回的增量 Flight 只包含变化部分（如 `<SettingsPage />`），客户端必须将其合并到当前完整树中。

#### 修改 Router 状态

```typescript
// client/router.tsx:32

export function Router({ initialTree, initialPathname }: RouterProps): React.ReactElement {
  const [currentTree, setCurrentTree] = useState<React.ReactElement>(initialTree)
  const [currentPathname, setCurrentPathname] = useState<string>(initialPathname)  // ⭐ 新增
  const [isPending, startTransition] = useTransition()

  // 初始化缓存
  if (!routeCache.has(initialPathname)) {
    routeCache.set(initialPathname, { tree: initialTree })
  }

  // ... loadRoute, navigate 等方法
}
```

#### 修改路由加载逻辑

```typescript
// client/router.tsx:42 (修改 loadRoute 函数)

const loadRoute = useCallback(async (href: string): Promise<React.ReactElement> => {
  let newTree = routeCache.get(href)?.tree

  if (!newTree) {
    console.log(`🌐 [Router] 加载路由: ${href}`)

    const separator = href.includes('?') ? '&' : '?'
    const rscUrl = `${href}${separator}_rsc=1`

    const response = await fetch(rscUrl)

    // ⭐ 检测增量响应
    const isPartial = response.headers.get('X-Nextjs-Partial') === 'true'
    const sharedSegments = parseInt(response.headers.get('X-Nextjs-Shared-Segments') || '0', 10)

    const flight = await response.text()
    console.log(`📦 [Router] 接收 Flight 数据: 长度=${flight.length}`)

    // 解码 Flight Protocol
    const decodedTree = flightDecoder.decode(flight)
    const partialContent = extractBodyChildren(decodedTree)

    if (isPartial) {
      console.log(`⚡ [Router] 增量更新 (共享段: ${sharedSegments})`)

      // ⭐ 核心: 合并增量数据到当前树
      newTree = mergePartialTree(
        currentTree,
        partialContent,
        currentPathname,
        href,
        sharedSegments
      )
    } else {
      console.log(`🔄 [Router] 完整加载`)
      newTree = partialContent
    }

    routeCache.set(href, { tree: newTree })
  } else {
    console.log(`⚡ [Router] 使用缓存路由: ${href}`)
  }

  return newTree
}, [currentTree, currentPathname])
```

#### 树合并核心函数

```typescript
// client/router.tsx (新增函数)

/**
 * 合并增量树到当前完整树
 *
 * 核心逻辑:
 * 1. 服务端返回的 partialContent 是从 sharedSegments 深度开始的子树
 * 2. 需要将其插入到当前树的正确位置
 * 3. 保留共享 Layout 组件的实例和状态
 *
 * 示例:
 * currentTree (完整树):
 *   <html>                         ← depth 0 (root segment)
 *     <RootLayout>                 ← depth 0 (root layout)
 *       <DashboardLayout>          ← depth 1 (dashboard segment)
 *         <ProfilePage />          ← depth 2 (旧页面)
 *       </DashboardLayout>
 *     </RootLayout>
 *   </html>
 *
 * partialContent (增量数据, sharedSegments=2):
 *   <SettingsPage />               ← 从 depth 2 开始
 *
 * 结果:
 *   <html>                         ← 保留 (共享)
 *     <RootLayout>                 ← 保留 (共享)
 *       <DashboardLayout>          ← 保留 (共享)
 *         <SettingsPage />         ← 替换
 *       </DashboardLayout>
 *     </RootLayout>
 *   </html>
 */
function mergePartialTree(
  currentTree: React.ReactElement,
  partialContent: React.ReactElement,
  fromPath: string,
  toPath: string,
  sharedSegments: number
): React.ReactElement {
  console.log('🔀 [合并] 开始树合并')
  console.log('  从路径:', fromPath)
  console.log('  到路径:', toPath)
  console.log('  共享段数:', sharedSegments)

  /**
   * 递归遍历树，在指定深度替换子树
   *
   * @param node - 当前节点
   * @param currentDepth - 当前深度 (0 = root)
   * @returns 新的节点 (可能是克隆的，也可能是 partial)
   */
  function traverseAndReplace(
    node: React.ReactElement,
    currentDepth: number
  ): React.ReactElement {
    console.log(`  [遍历] depth=${currentDepth}, type=${getDisplayName(node)}`)

    // 边界情况 1: 到达替换深度
    if (currentDepth === sharedSegments) {
      console.log(`  [替换] 在 depth=${currentDepth} 处替换为增量内容`)
      return partialContent
    }

    // 边界情况 2: 深度超过预期，说明树结构有问题
    if (currentDepth > sharedSegments) {
      console.error(`  [错误] 深度 ${currentDepth} 超过共享段 ${sharedSegments}`)
      return partialContent
    }

    // 获取子节点
    const children = node.props.children

    // 边界情况 3: 没有子节点
    if (!children) {
      console.warn(`  [警告] depth=${currentDepth} 无子节点，无法继续遍历`)
      return partialContent
    }

    // 边界情况 4: 子节点是数组
    if (Array.isArray(children)) {
      console.log(`  [数组] 子节点是数组，长度=${children.length}`)

      // 找到第一个有效的 React 元素继续遍历
      let foundValidChild = false
      const newChildren = children.map((child, index) => {
        if (foundValidChild) {
          return child
        }

        if (React.isValidElement(child)) {
          console.log(`  [数组] 使用索引 ${index} 的子元素继续遍历`)
          foundValidChild = true
          return traverseAndReplace(child, currentDepth + 1)
        }

        return child
      })

      if (!foundValidChild) {
        console.warn(`  [警告] 数组中没有有效的 React 元素`)
        return partialContent
      }

      return React.cloneElement(node, {
        ...node.props,
        children: newChildren
      })
    }

    // 边界情况 5: 子节点是单个 React 元素
    if (React.isValidElement(children)) {
      console.log(`  [单元素] 继续遍历子节点`)

      const newChild = traverseAndReplace(children, currentDepth + 1)

      return React.cloneElement(node, {
        ...node.props,
        children: newChild
      })
    }

    // 边界情况 6: 子节点是文本或其他类型
    console.warn(`  [警告] 子节点类型无法遍历: ${typeof children}`)
    return partialContent
  }

  /**
   * 获取组件显示名称 (用于调试)
   */
  function getDisplayName(element: React.ReactElement): string {
    if (typeof element.type === 'string') {
      return element.type
    }

    if (typeof element.type === 'function') {
      return element.type.name || 'Anonymous'
    }

    if (element.type && typeof element.type === 'object') {
      return (element.type as any).displayName || 'Component'
    }

    return 'Unknown'
  }

  // 从根节点开始遍历 (depth = 0)
  const result = traverseAndReplace(currentTree, 0)

  console.log('✅ [合并] 树合并完成')

  return result
}
```

**完整实现说明**:

1. **处理数组子节点**: Layout 可能包含多个子元素（如 ErrorBoundary、Suspense 等）
2. **深度验证**: 防止树结构异常导致无限遍历
3. **类型检查**: 处理文本节点、Fragment 等特殊情况
4. **详细日志**: 便于调试和理解合并过程
5. **React.cloneElement**: 保留原组件实例和 props
6. **错误降级**: 遇到异常时返回 partial（完整渲染）

#### 更新导航函数

```typescript
// client/router.tsx:67 (修改 navigate 函数)

const navigate = useCallback(async (href: string): Promise<void> => {
  const currentUrl = window.location.pathname + window.location.search
  if (href === currentUrl) return

  try {
    const newTree = await loadRoute(href)
    startTransition(() => {
      setCurrentTree(newTree)
      setCurrentPathname(href)  // ⭐ 更新当前路径
    })
    window.history.pushState({ href }, '', href)
  } catch (error) {
    console.error('[Router] 导航失败:', error)
    window.location.href = href
  }
}, [loadRoute])
```

**为什么必须有树合并**:
- ✅ 服务端只传输 `<SettingsPage />` (变化部分)
- ✅ 客户端必须将其插入到 `<RootLayout><DashboardLayout>` 下
- ✅ 保留共享 Layout 的组件实例和状态

---

## 四、实现步骤

### Phase 0: 构建时准备 (不需要改动)

**说明**: 当前的构建系统已经满足需求，无需改动

**已有功能**:
```typescript
// build/scan-app.js - 已经扫描所有路由
// build/generate-routes.js - 已经生成完整路由树
// 路由树结构已包含所有必要信息:
{
  path: '/dashboard/settings',
  segment: 'settings',
  layout: { file: 'layout.jsx', ... },
  page: { file: 'page.jsx', ... },
  children: []
}
```

**核心**: 路由树的层级结构天然支持 segment 索引，无需额外元数据

---

### Phase 1: 服务端增量渲染 (核心)

#### 1.1 添加工具函数 (`server/index.ts`)

在文件开头添加两个工具函数:

```typescript
// server/index.ts (在 extractSearchParams 函数后添加)

/**
 * 从 Referer header 提取来源路径
 *
 * @param req - Express Request
 * @returns 来源路径,如果无效则返回 null
 */
function extractFromPath(req: Request): string | null {
  const referer = req.headers.referer
  if (!referer) return null

  try {
    const refererUrl = new URL(referer)
    const currentHost = req.headers.host

    // 确保是同域请求 (防止跨域利用)
    if (refererUrl.host !== currentHost) {
      console.log('⚠️  [增量更新] 跨域 Referer,忽略')
      return null
    }

    return refererUrl.pathname
  } catch (error) {
    console.log('⚠️  [增量更新] 无效的 Referer URL')
    return null
  }
}

/**
 * 计算两个路径的共享路由段数量
 *
 * 算法:
 * 1. 分割路径为 segments
 * 2. 从左到右比较,直到遇到不同的 segment
 * 3. 返回共享数量 + 1 (加 1 是因为 root segment)
 *
 * 示例:
 * - /dashboard/profile, /dashboard/settings → 2 (root + dashboard)
 * - /about, /blog → 1 (only root)
 * - /blog/post-1, /blog/post-2 → 2 (root + blog)
 *
 * @param fromPath - 来源路径
 * @param toPath - 目标路径
 * @returns 共享段数量
 */
function getSharedSegmentCount(fromPath: string, toPath: string): number {
  // 分割并过滤空字符串
  const fromSegments = fromPath.split('/').filter(Boolean)
  const toSegments = toPath.split('/').filter(Boolean)

  let sharedCount = 0

  // 比较共同前缀
  const minLength = Math.min(fromSegments.length, toSegments.length)
  for (let i = 0; i < minLength; i++) {
    if (fromSegments[i] === toSegments[i]) {
      sharedCount++
    } else {
      break  // 遇到第一个不同的 segment 就停止
    }
  }

  // +1 for root segment (/)
  return sharedCount + 1
}
```

#### 1.2 修改主路由处理逻辑 (`server/index.ts`)

找到 `app.get('*', async (req, res, next) => { ... })` 主路由处理函数，在 RSC 请求处理部分添加增量逻辑:

```typescript
// server/index.ts:187 附近 (在 if (isRSCRequest) 块内)

if (isRSCRequest) {
  console.log('📡 [服务器] RSC 请求:', url)

  // ⭐ 新增: 增量导航检测
  const fromPath = extractFromPath(req)
  let isPartialRender = false
  let sharedCount = 0

  // 尝试增量渲染
  if (fromPath && fromPath !== url) {
    console.log(`🔄 [增量更新] 检测到导航: ${fromPath} → ${url}`)

    // 匹配目标路由
    const matchResult = matchRoute(manifest.routeTree, url)
    if (matchResult) {
      const { path: routePath } = matchResult

      // 计算共享段数量
      sharedCount = getSharedSegmentCount(fromPath, url)
      const totalSegments = routePath.length

      console.log(`  共享段: ${sharedCount}, 总段数: ${totalSegments}`)

      // 如果有未共享的段,启用增量渲染
      if (sharedCount < totalSegments) {
        isPartialRender = true
        console.log(`  ✅ 启用增量渲染 (起始索引: ${sharedCount})`)
      } else {
        console.log(`  ⚠️  无变化段,使用完整渲染`)
      }
    }
  }

  // ... 原有的路由匹配逻辑保持不变 ...
  const matchResult = matchRoute(manifest.routeTree, url)
  if (!matchResult) {
    return await renderNotFound(manifest.routeTree, isRSCRequest, res)
  }

  const { path: routePath, params } = matchResult
  const searchParams = extractSearchParams(req)

  // 构建客户端组件映射
  const clientComponentMap = await buildClientComponentMap(routePath)

  // ⭐ 修改: 传递 startIndex 参数
  const { flight, clientModules } = await renderRSC(
    routePath,
    { params, searchParams },
    clientComponentMap,
    isPartialRender ? sharedCount : 0  // ← 增量渲染时传入起始索引
  )

  console.log(`📦 [服务器] 生成 Flight Payload: ${flight.length} 字节`)
  if (isPartialRender) {
    console.log(`  (增量传输,节省约 ${Math.round((1 - flight.length / 15000) * 100)}%)`)
  }

  // ⭐ 新增: 添加响应头标记
  res.setHeader('Content-Type', 'text/x-component')
  if (isPartialRender) {
    res.setHeader('X-Nextjs-Partial', 'true')
    res.setHeader('X-Nextjs-Shared-Segments', String(sharedCount))
  }

  res.send(flight)
  return
}
```

#### 1.3 修改 RSC 渲染器 (`shared/rsc-renderer.ts`)

**修改函数签名**:

```typescript
// shared/rsc-renderer.ts:80 附近

export async function renderRSC(
  routePath: RouteNode[],
  options: RenderOptions = {},
  clientComponentMap: ClientComponentMap = new Map(),
  startIndex: number = 0  // ⭐ 新增参数: 从哪个索引开始渲染
): Promise<RSCRenderResult> {
  const targetRoute = routePath[routePath.length - 1]
  const params: RouteParams = options.params || {}
  const searchParams: SearchParams = options.searchParams || {}

  console.log('🎨 渲染 RSC 树:', targetRoute.path)
  console.log('  Layout 层级:', routePath.length)
  console.log('  起始索引:', startIndex)  // ⭐ 新增日志

  // ⭐ 传递 startIndex 到 buildLayoutTree
  const tree = await buildLayoutTree(routePath, params, searchParams, startIndex)

  const encoder = new FlightEncoder(clientComponentMap)
  const flight = await encoder.encode(tree)
  const clientModules = encoder.getClientModules()

  console.log('✅ RSC 渲染完成')
  console.log('  渲染段数:', routePath.length - startIndex)  // ⭐ 新增日志

  return { flight, clientModules }
}
```

**修改 Layout 树构建函数**:

```typescript
// shared/rsc-renderer.ts:135 附近

async function buildLayoutTree(
  routePath: RouteNode[],
  params: RouteParams,
  searchParams: SearchParams,
  startIndex: number = 0  // ⭐ 新增参数
): Promise<React.ReactElement> {
  const targetRoute = routePath[routePath.length - 1]

  // ⭐ 修改: 从 startIndex 开始收集 Layout
  const layouts: FileInfo[] = []
  for (let i = startIndex; i < routePath.length; i++) {
    if (routePath[i].layout) {
      layouts.push(routePath[i].layout)
    }
  }

  console.log('  收集到的 Layout (部分):', layouts.map(l => l.file))

  // 2. 加载 Page 组件 (保持不变)
  if (!targetRoute.page) {
    throw new Error(`Route ${targetRoute.path} has no page.jsx`)
  }

  let tree = await loadAndRenderComponent(targetRoute.page, params, searchParams)

  // 3. 包裹 loading.jsx (保持不变)
  if (targetRoute.loading) {
    tree = await wrapWithSuspense(tree, targetRoute.loading, params)
  }

  // 4. 从内到外包裹 Layout (只包裹收集到的部分)
  for (let i = layouts.length - 1; i >= 0; i--) {
    const layoutInfo = layouts[i]
    console.log('  包裹 Layout:', layoutInfo.file)
    tree = await renderLayout(layoutInfo, tree, params)
  }

  return tree
}
```

---

### Phase 2: 客户端适配 (完整实现)

#### 2.1 添加 currentPathname 状态 (`client/router.tsx`)

```typescript
// client/router.tsx:32 附近

export function Router({ initialTree, initialPathname }: RouterProps): React.ReactElement {
  const [currentTree, setCurrentTree] = useState<React.ReactElement>(initialTree)
  const [currentPathname, setCurrentPathname] = useState<string>(initialPathname)  // ⭐ 新增
  const [isPending, startTransition] = useTransition()

  // 初始化缓存
  if (!routeCache.has(initialPathname)) {
    routeCache.set(initialPathname, { tree: initialTree })
  }

  // ... loadRoute, navigate 等方法
}
```

#### 2.2 实现树合并函数 (`client/router.tsx`)

```typescript
// client/router.tsx (新增函数,放在 Router 组件外部)

/**
 * 合并增量树到当前完整树
 *
 * 核心逻辑:
 * 1. 递归遍历当前树到 sharedSegments 深度
 * 2. 在该深度替换子树为 partialContent
 * 3. 使用 React.cloneElement 保留父组件实例
 */
function mergePartialTree(
  currentTree: React.ReactElement,
  partialContent: React.ReactElement,
  fromPath: string,
  toPath: string,
  sharedSegments: number
): React.ReactElement {
  console.log('🔀 [合并] 开始树合并')
  console.log('  从路径:', fromPath)
  console.log('  到路径:', toPath)
  console.log('  共享段数:', sharedSegments)

  function traverseAndReplace(
    node: React.ReactElement,
    currentDepth: number
  ): React.ReactElement {
    console.log(`  [遍历] depth=${currentDepth}, type=${getDisplayName(node)}`)

    // 边界情况 1: 到达替换深度
    if (currentDepth === sharedSegments) {
      console.log(`  [替换] 在 depth=${currentDepth} 处替换为增量内容`)
      return partialContent
    }

    // 边界情况 2: 深度超过预期
    if (currentDepth > sharedSegments) {
      console.error(`  [错误] 深度 ${currentDepth} 超过共享段 ${sharedSegments}`)
      return partialContent
    }

    const children = node.props.children

    // 边界情况 3: 没有子节点
    if (!children) {
      console.warn(`  [警告] depth=${currentDepth} 无子节点`)
      return partialContent
    }

    // 边界情况 4: 子节点是数组
    if (Array.isArray(children)) {
      let foundValidChild = false
      const newChildren = children.map((child, index) => {
        if (foundValidChild) return child

        if (React.isValidElement(child)) {
          foundValidChild = true
          return traverseAndReplace(child, currentDepth + 1)
        }
        return child
      })

      if (!foundValidChild) return partialContent

      return React.cloneElement(node, {
        ...node.props,
        children: newChildren
      })
    }

    // 边界情况 5: 单个 React 元素
    if (React.isValidElement(children)) {
      const newChild = traverseAndReplace(children, currentDepth + 1)
      return React.cloneElement(node, {
        ...node.props,
        children: newChild
      })
    }

    // 边界情况 6: 文本或其他类型
    console.warn(`  [警告] 子节点类型无法遍历: ${typeof children}`)
    return partialContent
  }

  function getDisplayName(element: React.ReactElement): string {
    if (typeof element.type === 'string') return element.type
    if (typeof element.type === 'function') return element.type.name || 'Anonymous'
    if (element.type && typeof element.type === 'object') {
      return (element.type as any).displayName || 'Component'
    }
    return 'Unknown'
  }

  const result = traverseAndReplace(currentTree, 0)
  console.log('✅ [合并] 树合并完成')
  return result
}
```

#### 2.3 修改路由加载逻辑 (`client/router.tsx`)

```typescript
// client/router.tsx:42 附近 (修改 loadRoute 函数)

const loadRoute = useCallback(async (href: string): Promise<React.ReactElement> => {
  let newTree = routeCache.get(href)?.tree

  if (!newTree) {
    console.log(`🌐 [Router] 加载路由: ${href}`)

    const separator = href.includes('?') ? '&' : '?'
    const rscUrl = `${href}${separator}_rsc=1`

    const response = await fetch(rscUrl)

    // ⭐ 检测增量响应
    const isPartial = response.headers.get('X-Nextjs-Partial') === 'true'
    const sharedSegments = parseInt(response.headers.get('X-Nextjs-Shared-Segments') || '0', 10)

    const flight = await response.text()
    console.log(`📦 [Router] 接收 Flight 数据: 长度=${flight.length}`)

    // ⭐ 统一解码 Flight Protocol
    const decodedTree = flightDecoder.decode(flight)
    const partialContent = extractBodyChildren(decodedTree)

    if (isPartial) {
      console.log(`⚡ [Router] 增量更新 (共享段: ${sharedSegments})`)

      // ⭐ 核心: 合并增量数据到当前树
      newTree = mergePartialTree(
        currentTree,
        partialContent,
        currentPathname,
        href,
        sharedSegments
      )
    } else {
      console.log(`🔄 [Router] 完整加载`)
      newTree = partialContent
    }

    routeCache.set(href, { tree: newTree })
  } else {
    console.log(`⚡ [Router] 使用缓存路由: ${href}`)
  }

  return newTree
}, [currentTree, currentPathname])
```

#### 2.4 更新导航函数 (`client/router.tsx`)

```typescript
// client/router.tsx:67 附近 (修改 navigate 函数)

const navigate = useCallback(async (href: string): Promise<void> => {
  const currentUrl = window.location.pathname + window.location.search
  if (href === currentUrl) return

  try {
    const newTree = await loadRoute(href)
    startTransition(() => {
      setCurrentTree(newTree)
      setCurrentPathname(href)  // ⭐ 更新当前路径
    })
    window.history.pushState({ href }, '', href)
  } catch (error) {
    console.error('[Router] 导航失败:', error)
    window.location.href = href
  }
}, [loadRoute])
```

**完整实现说明**:
- ✅ 服务端只传输变化部分 (如 `<SettingsPage />`)
- ✅ 客户端精确合并到共享段末端
- ✅ 递归树遍历处理所有边界情况
- ✅ 保留共享 Layout 的组件实例和状态
- ✅ 使用 `React.cloneElement` 避免重新创建组件

---

### Phase 3: 测试验证

#### 3.1 测试场景

创建测试页面验证增量更新:

```bash
# 确保有嵌套路由结构
app/
├── layout.jsx          # Root Layout
├── page.jsx            # /
├── dashboard/
│   ├── layout.jsx      # Dashboard Layout
│   ├── page.jsx        # /dashboard
│   ├── settings/
│   │   └── page.jsx    # /dashboard/settings
│   └── profile/
│       └── page.jsx    # /dashboard/profile
```

#### 3.2 测试步骤

**测试 1: 基本增量导航**

```typescript
// 1. 访问 http://localhost:3000/dashboard
// 预期日志:
// 🎨 渲染 RSC 树: /dashboard
//   Layout 层级: 2
//   起始索引: 0
//   收集到的 Layout: ['app/layout.jsx', 'app/dashboard/layout.jsx']

// 2. 点击链接导航到 /dashboard/settings
// 客户端日志:
// 🌐 [Router] 加载路由: /dashboard/settings

// 服务端日志:
// 📡 [服务器] RSC 请求: /dashboard/settings
// 🔄 [增量更新] 检测到导航: /dashboard → /dashboard/settings
//   共享段: 2, 总段数: 3
//   ✅ 启用增量渲染 (起始索引: 2)
// 🎨 渲染 RSC 树: /dashboard/settings
//   Layout 层级: 3
//   起始索引: 2
//   收集到的 Layout: ['app/dashboard/settings/page.jsx']  ← 只有 Page,无新 Layout
// 📦 [服务器] 生成 Flight Payload: 3421 字节
//   (增量传输,节省约 77%)

// 客户端日志:
// 📦 [Router] 接收 Flight 数据: 长度=3421
// ⚡ [Router] 增量更新 (共享段: 2)
```

**测试 2: 无共享段导航**

```typescript
// 从 /dashboard → /about
// 预期:
// 🔄 [增量更新] 检测到导航: /dashboard → /about
//   共享段: 1, 总段数: 2
//   ✅ 启用增量渲染 (起始索引: 1)
// 收集到的 Layout: ['app/about/page.jsx']
```

**测试 3: 回退导航**

```typescript
// 从 /dashboard/settings → /dashboard
// 预期:
// 🔄 [增量更新] 检测到导航: /dashboard/settings → /dashboard
//   共享段: 2, 总段数: 2
//   ⚠️  无变化段,使用完整渲染
```

**测试 4: 浏览器前进/后退**

```typescript
// 点击浏览器后退按钮
// 预期:
// ⬅️  [Router] 浏览器后退/前进: /dashboard
// ⚡ [Router] 使用缓存路由: /dashboard  ← 从缓存读取,无网络请求
```

#### 3.3 性能验证

使用浏览器 DevTools 验证:

```typescript
// Network 面板:
// 1. 完整导航 (/dashboard)
//    - Request: /dashboard?_rsc=1
//    - Size: ~15 KB
//    - Headers: (无 X-Nextjs-Partial)

// 2. 增量导航 (/dashboard → /dashboard/settings)
//    - Request: /dashboard/settings?_rsc=1
//    - Size: ~3 KB ✅ (节省 80%)
//    - Headers:
//      - X-Nextjs-Partial: true ✅
//      - X-Nextjs-Shared-Segments: 2 ✅
```

---

### Phase 4: 边界情况处理

#### 4.1 无 Referer Header

```typescript
// 场景: 直接在地址栏输入 URL
// 处理: extractFromPath() 返回 null,降级为完整渲染
// 行为: 正常,无增量优化
```

#### 4.2 跨域 Referer

```typescript
// 场景: 从外部网站链接跳转
// 处理: extractFromPath() 检测 host 不同,返回 null
// 行为: 正常,无增量优化
```

#### 4.3 动态路由参数变化

```typescript
// /blog/post-1 → /blog/post-2
// fromPath: /blog/post-1 → [blog, post-1]
// toPath:   /blog/post-2 → [blog, post-2]
// 共享段: 1 (root)  ← 'post-1' !== 'post-2'
// 结果: 只重新渲染 blog layout + page
```

#### 4.4 查询参数变化

```typescript
// /search?q=react → /search?q=nextjs
// 路径相同: /search === /search
// 结果: 服务端检测到 fromPath === toPath,不启用增量渲染
// 行为: 完整渲染 (查询参数影响 Page,需完整重新渲染)
```

---

## 五、总结

### 核心实现要点

1. **服务端增量渲染**
   - 从 Referer header 提取来源路径
   - 计算共享路由段数量
   - 只渲染变化部分（startIndex → end）
   - 添加响应头标记增量数据

2. **客户端树合并**
   - 解码增量 Flight 数据
   - 递归遍历当前树到共享深度
   - 在共享段末端替换子树
   - 保留共享 Layout 的组件实例

3. **边界情况处理**
   - 无 Referer → 完整渲染
   - 跨域请求 → 完整渲染
   - 回退导航 → 完整渲染
   - 动态参数变化 → 增量渲染

### 改动文件清单

| 文件 | 改动内容 | 代码量 |
|------|---------|-------|
| `server/index.ts` | 工具函数 + 增量检测 | ~80 行 |
| `shared/rsc-renderer.ts` | startIndex 参数 | ~20 行 |
| `client/router.tsx` | 树合并逻辑 | ~60 行 |
| **总计** | | **~160 行** |

### 实现步骤

1. **服务端** (server/index.ts)
   - 添加 `extractFromPath()` 函数
   - 添加 `getSharedSegmentCount()` 函数
   - 修改 RSC 请求处理逻辑

2. **RSC 渲染器** (shared/rsc-renderer.ts)
   - `renderRSC()` 添加 startIndex 参数
   - `buildLayoutTree()` 从 startIndex 开始收集 Layout

3. **客户端** (client/router.tsx)
   - Router 添加 currentPathname 状态
   - 实现 `mergePartialTree()` 函数
   - 修改 loadRoute 调用树合并

---

**相关资源**:
- [Next.js Partial Rendering 文档](https://nextjs.org/docs/app/building-your-application/routing/linking-and-navigating)
- [React Reconciliation 算法](https://react.dev/learn/preserving-and-resetting-state)
- [本项目 Router 实现](../client/router.tsx)
- [本项目 RSC 渲染器实现](../shared/rsc-renderer.ts)
