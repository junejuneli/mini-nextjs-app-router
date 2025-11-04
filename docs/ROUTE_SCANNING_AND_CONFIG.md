# 路由扫描与配置系统

> Next.js App Router 如何扫描文件系统、构建路由树、提取配置

---

## 核心流程

```
构建时:
  扫描 app/ 目录
    ↓
  识别特殊文件 (page, layout, loading, error)
    ↓
  解析动态路由 ([id], [...slug])
    ↓
  提取配置 (revalidate, dynamic)
    ↓
  构建路由树 → 保存到 manifest.json
```

---

## 文件结构映射

```
app/
├── layout.tsx              → / (Root Layout)
├── page.tsx                → / (首页)
├── about/
│   └── page.tsx            → /about
├── blog/
│   ├── [id]/
│   │   └── page.tsx        → /blog/[id] (动态路由)
│   └── [...slug]/
│       └── page.tsx        → /blog/[...slug] (Catch-all)
└── (marketing)/            → (路由组，不出现在 URL)
    └── pricing/
        └── page.tsx        → /pricing
```

---

## 路由树数据结构

**代码位置**: `build/scan-app.ts:75-87`

```typescript
interface RouteNode {
  segment: string              // 路由段名称
  path: string                 // URL 路径
  dynamic: boolean             // 是否动态路由
  param?: string               // 动态参数名 (如 'id')
  catchAll?: boolean           // 是否 catch-all

  // 特殊文件
  layout?: FileInfo
  page?: FileInfo & PageConfig
  loading?: FileInfo
  error?: FileInfo
  notFound?: FileInfo

  children: RouteNode[]
}

interface PageConfig {
  revalidate?: number | false  // ISR 配置
  dynamic?: string             // 渲染模式
}
```

---

## 扫描算法

### 1. 递归遍历目录

**代码位置**: `build/scan-app.ts:97-176`

```typescript
function scanDirectory(dir: string): RouteNode {
  const entries = fs.readdirSync(dir)
  const segmentResult = parseSegment(path.basename(dir))

  const node: RouteNode = {
    segment: segmentResult.segment,
    path: buildUrlPath(...),
    dynamic: segmentResult.dynamic,
    children: []
  }

  for (const entry of entries) {
    if (entry.isFile()) {
      handleSpecialFile(entry, node)  // 识别 page.tsx, layout.tsx...
    } else if (entry.isDirectory()) {
      node.children.push(scanDirectory(entry))
    }
  }

  return node
}
```

### 2. 识别特殊文件

```typescript
const SPECIAL_FILES = {
  'page.tsx': 'page',
  'layout.tsx': 'layout',
  'loading.tsx': 'loading',
  'error.tsx': 'error',
  'not-found.tsx': 'notFound'
}

// 如果是 page，提取配置
if (fileType === 'page') {
  node.page.revalidate = extractRevalidateConfig(filePath)
  node.page.dynamic = extractDynamicConfig(filePath)
}
```

### 3. 解析动态路由

**代码位置**: `build/scan-app.ts:190-220`

```typescript
function parseSegment(segment: string) {
  // [id] → { dynamic: true, param: 'id' }
  const dynamicMatch = segment.match(/^\[([^\]]+)\]$/)
  if (dynamicMatch) {
    const param = dynamicMatch[1]

    // [...slug] → { dynamic: true, catchAll: true, param: 'slug' }
    const catchAllMatch = param.match(/^\.\.\.(.+)$/)
    if (catchAllMatch) {
      return { segment, dynamic: true, catchAll: true, param: catchAllMatch[1] }
    }

    return { segment, dynamic: true, param }
  }

  return { segment, dynamic: false }
}
```

### 4. 路由组支持

```typescript
// (marketing)/pricing → URL 为 /pricing，不包含 (marketing)
function buildUrlPath(parentPath: string, segment: string): string {
  if (segment.startsWith('(') && segment.endsWith(')')) {
    return parentPath  // 路由组不出现在 URL
  }
  return `${parentPath}/${segment}`
}
```

---

## 配置提取

### 1. revalidate 配置

**代码位置**: `build/scan-app.ts:257-275`

```typescript
function extractRevalidateConfig(filePath: string): number | false | undefined {
  const content = fs.readFileSync(filePath, 'utf-8')
  // 正则匹配: export const revalidate = 60
  const match = content.match(/export\s+const\s+revalidate\s*=\s*(\d+|false)/)
  return match ? (match[1] === 'false' ? false : parseInt(match[1])) : undefined
}
```

**用法**:
```tsx
export const revalidate = 60  // ISR: 每 60 秒重新验证

export default async function BlogPage() {
  const posts = await fetchPosts()
  return <div>{posts.map(...)}</div>
}
```

**支持的值**:
- `undefined` - SSG (永久缓存)
- `number` - ISR (定时重新生成)
- `false` - SSR (每次重新渲染)

### 2. dynamic 配置

**代码位置**: `build/scan-app.ts:285-300`

```typescript
function extractDynamicConfig(filePath: string): string | undefined {
  const content = fs.readFileSync(filePath, 'utf-8')
  // 正则匹配: export const dynamic = 'force-dynamic'
  const match = content.match(/export\s+const\s+dynamic\s*=\s*['"]([^'"]+)['"]/)
  return match ? match[1] : undefined
}
```

**用法**:
```tsx
export const dynamic = 'force-dynamic'  // 强制 SSR

export default async function DashboardPage() {
  const user = await getCurrentUser()  // 每次请求都执行
  return <div>Welcome, {user.name}!</div>
}
```

**支持的选项**:
- `'auto'` - 自动选择 (默认)
- `'force-static'` - 强制 SSG
- `'force-dynamic'` - 强制 SSR
- `'error'` - 禁止动态渲染

---

## 配置传递流程

### 构建时

```
scanAppDirectory() → 扫描 app/，提取配置
  ↓
collectStaticRoutes() → 筛选可 SSG 的路由
  ↓ (排除 force-dynamic 和动态路由)
  ↓
prerenderStaticRoutes() → 生成 HTML + Flight
  ↓
batchSaveMetadata() → 保存 revalidate 到元数据
  ↓
保存 manifest.json
```


---

## 实战案例

### 案例 1: ISR 页面

```tsx
// app/blog/page.tsx
export const revalidate = 60

export default async function BlogPage() {
  const posts = await fetchPosts()
  return <div>{posts.map(...)}</div>
}
```

**构建输出**:
```
.next/
├── static/pages/blog.html
├── static/flight/blog.txt
└── cache/metadata/blog.json  # { generatedAt: ..., revalidate: 60 }
```

**运行时行为**:
```
T=0    访问 /blog → 返回缓存 (瞬间)
T=30   访问 /blog → 返回缓存
T=65   访问 /blog (超过 60s)
       ├─ 返回旧缓存 (用户无感知)
       └─ 后台重新生成
T=70   访问 /blog → 返回新内容 ✅
```

### 案例 2: 强制 SSR

```tsx
// app/dashboard/page.tsx
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const user = await getCurrentUser()
  return <div>Welcome, {user.name}!</div>
}
```

**构建行为**:
- ❌ 不预渲染，不生成静态文件
- ✅ 每次请求都执行 SSR

### 案例 3: 混合配置

```
app/
├── page.tsx                (SSG)
├── blog/
│   ├── page.tsx            (ISR, revalidate: 60)
│   └── [id]/page.tsx       (动态路由)
└── dashboard/page.tsx      (SSR, dynamic: 'force-dynamic')
```

**预渲染决策**:
```typescript
[
  { path: '/', revalidate: undefined },     // ✅ SSG
  { path: '/blog', revalidate: 60 }        // ✅ ISR
  // ❌ /blog/[id] - 动态路由跳过
  // ❌ /dashboard - force-dynamic 跳过
]
```

---

## 设计决策

### 1. 为什么在构建时提取配置？

✅ **构建时提取**:
- 一次扫描，多次使用
- 配置存储在 manifest，快速读取
- 支持构建时优化决策

❌ **运行时提取**:
- 每次请求都要 import 模块
- 无法在构建时优化

### 2. 为什么使用正则而不是 AST？

**正则方式** (本项目):
```typescript
const match = content.match(/export\s+const\s+revalidate\s*=\s*(\d+|false)/)
```

**优点**:
- ✅ 简单易懂
- ✅ 性能快
- ✅ 教学价值高

**局限性**:
```typescript
// ✅ 正则能识别
export const revalidate = 60

// ❌ 正则识别不了
const value = 60
export const revalidate = value
```

**Next.js 使用 SWC**: Rust AST 解析器，支持复杂表达式

### 3. 为什么 ISR 需要独立元数据文件？

**方案 A: 存储在 manifest** (❌ 不可行):
- manifest 是构建产物，不应运行时修改
- 重启服务器会丢失 ISR 时间

**方案 B: 独立元数据文件** (✅ 当前方案):
```
.next/cache/metadata/
├── blog.json          { generatedAt: ..., revalidate: 60 }
└── posts-1.json
```
- ✅ 构建产物不变
- ✅ 运行时可更新
- ✅ 可持久化

---

## 配置实现状态

### ✅ 已实现

| 配置项 | 代码位置 | 说明 |
|--------|----------|------|
| `revalidate` | `build/scan-app.ts:257` | ISR 时间控制 |
| `dynamic` | `build/scan-app.ts:285` | 渲染模式控制 |
| 动态路由 | `build/scan-app.ts:190` | `[id]`, `[...slug]` |
| 路由组 | `build/scan-app.ts:234` | `(marketing)` |

### ❌ 未实现 (Next.js 官方支持)

| 配置项 | 作用 |
|--------|------|
| `generateStaticParams()` | 动态路由预渲染 |
| `dynamicParams` | 控制未列出参数 |
| `generateMetadata()` | 动态生成 meta 标签 |
| `fetchCache` | Fetch 缓存行为 |
| `runtime` | 运行时选择 |

---

## 关键文件

| 文件 | 职责 |
|------|------|
| `build/scan-app.ts` | 扫描目录、提取配置、构建路由树 |
| `build/render-static.ts` | 预渲染静态页面、保存元数据 |
| `shared/metadata.ts` | 保存/读取元数据 |
| `server/index.ts` | 处理请求、ISR 判断 |
| `server/regenerate.ts` | ISR 后台重新生成 |

---

**相关文档**:
- [Next.js Route Segment Config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config)
- [FLIGHT_PROTOCOL_DEEP_DIVE.md](./FLIGHT_PROTOCOL_DEEP_DIVE.md)
