# Server Runtime and ISR Implementation

## 文件结构

```
server/
├── index.ts           # Express 服务器主入口 (480 行)
└── regenerate.ts      # ISR 后台重新生成模块 (170 行)
```

---

## 请求处理流程

```
HTTP Request
    │
    ├─ 静态资源? ────────────────> express.static 中间件
    │
    ├─ 预渲染文件存在? ──┬─ Yes ──┬─ 需要重新验证? ──┬─ Yes ──> 触发后台 ISR + 返回旧缓存
    │                    │        │                   └─ No ──> 直接返回缓存
    │                    │        │
    │                    └─ No ──> 动态渲染
    │
    └─ 路由匹配 ──┬─ 匹配成功 ──┬─ 有 page.jsx? ──┬─ Yes ──> 渲染 RSC
                  │             │                 └─ No ──> 渲染 not-found.jsx
                  │
                  └─ 匹配失败 ──> 渲染 not-found.jsx
```

## 渲染策略选择

```typescript
// server/index.ts:195-245

// 1. 检查是否有预渲染文件（如果有查询参数，跳过预渲染缓存）
const prerenderInfo = !hasSearchParams ? findPrerenderedInfo(url) : null

if (prerenderInfo) {
  // 2. ISR 检查: 是否需要重新验证
  const needsRevalidation = shouldRevalidate(url, prerenderInfo.revalidate)

  if (needsRevalidation && prerenderInfo.revalidate !== false) {
    // Stale-while-revalidate:
    // 1) 立即返回旧内容（用户得到快速响应）
    // 2) 触发后台重新生成（下次请求得到新内容）
    regenerateInBackground(url, { ... })
  }

  // 返回预渲染文件（可能是旧的，但响应快）
  return fs.readFileSync(filePath)
}

// 3. 动态渲染（无预渲染文件 或 动态路由 或 有查询参数）
const { flight } = await renderRSC(routePath, { params, searchParams }, clientComponentMap)
```

**核心原则**：
- 查询参数绕过缓存，触发动态渲染
- Stale-while-revalidate：返回旧缓存 + 后台更新
- ISR 仅用于预渲染页面

---

## 路由匹配算法

```typescript
// server/index.ts:418-474

function matchRoute(routeTree: RouteNode, url: string): RouteMatchResult | null {
  const segments = url === '/' ? [] : url.split('/').filter(Boolean)

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]

    // ⭐ 优先级 1: 精确匹配静态路由
    let child = current.children.find(c => c.segment === segment && !c.dynamic)

    // ⭐ 优先级 2: 动态路由匹配
    if (!child) {
      child = current.children.find(c => c.dynamic)

      if (child) {
        // Catch-all: [...slug] 匹配剩余所有段
        if (child.catchAll && child.param) {
          params[child.param] = segments.slice(i)  // 数组
          return { path, params }  // 结束匹配
        }
        // 普通动态路由: [id] 匹配单个段
        else if (child.param) {
          params[child.param] = segment  // 字符串
        }
      }
    }

    if (!child) return null  // 未匹配

    path.push(child)
    current = child
  }

  return { path, params }
}
```

**匹配优先级**：静态路由 > 动态路由 > Catch-all

---

## clientComponentMap

```typescript
// server/index.ts:99-175

async function buildClientComponentMap(routePath: RouteNode[]): Promise<ClientComponentMap> {
  const clientComponentMap: ClientComponentMap = new Map()

  // 步骤 1: 扫描 client/ 目录（全局 Client Components）
  const clientFiles = fs.readdirSync('./client')
    .filter(f => f.endsWith('.tsx') || f.endsWith('.jsx'))

  for (const file of clientFiles) {
    const Component = (await import(absolutePath)).default
    const relativePath = './' + path.relative(projectRoot, absolutePath)

    clientComponentMap.set(Component, {
      id: relativePath,                               // './client/Link.jsx'
      chunks: [path.basename(file, path.extname(file))],  // ['Link']
      name: 'default'
    })
  }

  // 步骤 2: 扫描路由路径中的 Client Components
  for (const node of routePath) {
    // 检查 page.jsx
    if (node.page?.isClient) {
      const Component = (await import(node.page.absolutePath)).default
      clientComponentMap.set(Component, { ... })
    }

    // 检查 layout.jsx
    if (node.layout?.isClient) {
      const Component = (await import(node.layout.absolutePath)).default
      clientComponentMap.set(Component, { ... })
    }
  }

  return clientComponentMap
}
```

**核心设计**：
- 格式：`Map<Component, {id, chunks, name}>`
- 扫描 `client/` 目录（全局）+ 路由路径（特定路由）
- 每次渲染前重建（确保动态路由组件被注册）

---

## ISR 实现

### Stale-while-revalidate 策略

```
用户请求 → 缓存过期? ─┬─ Yes ─> 返回旧缓存 + 触发后台重新生成
                     └─ No ─> 直接返回缓存
```

### 时间检查

```typescript
// shared/metadata.ts

function shouldRevalidate(routePath: string, revalidate: number | false): boolean {
  if (revalidate === false) return false  // 永久缓存

  const metadata = loadMetadata(routePath)
  if (!metadata?.generatedAt) return true  // 无元数据，需要重新生成

  const age = Date.now() - metadata.generatedAt
  return age > revalidate * 1000  // 年龄 > revalidate 秒
}
```

### 后台重新生成

```typescript
// server/regenerate.ts

export function regenerateInBackground(routePath: string, options: RegenerateOptions): void {
  // 启动后台任务，不等待完成（async fire-and-forget）
  regenerateWithLock(routePath, options).catch(error => {
    console.error(`ISR 后台重新生成失败: ${routePath}`, error)
  })
}

async function regenerateWithLock(routePath: string, options: RegenerateOptions): Promise<void> {
  // 锁机制: 防止重复生成
  if (regenerationLocks.has(routePath)) {
    return regenerationLocks.get(routePath)!  // 复用现有任务
  }

  const regeneratePromise = regeneratePage(...)
  regenerationLocks.set(routePath, regeneratePromise)

  try {
    await regeneratePromise
  } finally {
    regenerationLocks.delete(routePath)  // 任务完成，释放锁
  }
}
```

**并发安全**：
- 锁机制：`regenerationLocks` Map 防止重复生成
- 原子写入：先写 `.tmp` 文件，再 `rename()` 替换（避免读到半写状态）

---

## Flight Protocol 双模式

| 特性           | SSG 模式              | SSR 模式              |
|----------------|-----------------------|-----------------------|
| 渲染时机       | 构建时                | 请求时                |
| HTML 内容      | 真实组件（SEO 友好）  | 占位符（客户端渲染）  |
| `prerendered`  | `true`                | `false`               |
| `moduleMap`    | 传递（服务端渲染）    | 不传递（客户端加载）  |

---

## 查询参数处理

```typescript
// server/index.ts:22-45
function extractSearchParams(req: Request): Record<string, string | string[]> {
  // 过滤内部参数（_rsc）
  // 处理同名参数（?tag=a&tag=b → { tag: ['a', 'b'] }）
  // 传递给 renderRSC() 的 { params, searchParams }
}
```

---

## not-found.jsx 处理

**触发场景**：
1. 路由未匹配：`matchRoute()` 返回 `null`
2. 路由匹配但无 `page.jsx`

**渲染策略**：
- 将 `notFound` 作为 `page` 渲染（复用 RSC 逻辑）
- 保留 Layout（保持一致外观）
- 返回 404 状态码

---

## 关键技术点

1. **路由匹配**：静态 > 动态 > Catch-all 优先级
2. **渲染策略**：SSG/ISR/SSR 自动切换
3. **ISR 实现**：Stale-while-revalidate + 锁机制 + 原子写入
4. **并发安全**：`regenerationLocks` Map 防止重复生成
5. **查询参数**：绕过缓存，触发动态渲染
6. **not-found.jsx**：复用 RSC 渲染逻辑，保留 Layout
