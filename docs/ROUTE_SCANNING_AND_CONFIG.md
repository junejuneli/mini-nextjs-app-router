# Next.js App Router 路由扫描与配置系统深入解析

> 深入理解 Next.js App Router 如何扫描文件系统、构建路由树、传递配置给渲染器

---

## 目录

1. [核心概念](#核心概念)
2. [路由扫描系统](#路由扫描系统)
3. [配置提取机制](#配置提取机制)
4. [配置传递流程](#配置传递流程)
5. [实战案例](#实战案例)
6. [与真实 Next.js 对比](#与真实-nextjs-对比)

---

## 核心概念

### 什么是路由扫描？

路由扫描是 Next.js App Router 的**构建时**核心功能：

1. **递归遍历** `app/` 目录
2. **识别特殊文件**：`page.tsx`、`layout.tsx`、`loading.tsx`、`error.tsx`
3. **提取路由参数**：`[id]`、`[...slug]`
4. **构建路由树**：反映嵌套的 Layout 和 Page 关系
5. **提取配置**：`revalidate`、`dynamic` 等

### 为什么需要路由扫描？

**传统 CSR**：
```
浏览器请求 → 服务器返回 HTML → JS 加载 → React Router 解析路由
```

**Next.js App Router**：
```
构建时扫描 → 生成路由树 → 预渲染静态页面 → 服务端根据路由树渲染
```

**优势**：
- ✅ **静态分析**：构建时就知道所有路由
- ✅ **SSG 优化**：自动识别可预渲染的路由
- ✅ **配置驱动**：通过导出配置控制渲染行为

---

## 路由扫描系统

### 文件结构映射

```
app/
├── layout.tsx              → / (Root Layout)
├── page.tsx                → / (首页)
├── about/
│   └── page.tsx            → /about
├── blog/
│   ├── layout.tsx          → /blog/* (Blog Layout)
│   ├── [id]/
│   │   └── page.tsx        → /blog/[id] (动态路由)
│   └── [...slug]/
│       └── page.tsx        → /blog/[...slug] (Catch-all)
└── dashboard/
    ├── page.tsx            → /dashboard
    └── settings/
        └── page.tsx        → /dashboard/settings
```

### 路由树数据结构

扫描后生成的路由树：

```javascript
{
  segment: '',              // 路由段名称（根为空字符串）
  path: '/',                // URL 路径
  dynamic: false,           // 是否动态路由
  param: undefined,         // 动态参数名（如 'id'）
  catchAll: false,          // 是否 catch-all 路由

  // 特殊文件
  layout: {
    file: 'app/layout.tsx',           // 相对路径
    absolutePath: '/project/app/...',  // 绝对路径
    isClient: false                    // 是否 Client Component
  },

  page: {
    file: 'app/page.tsx',
    absolutePath: '/project/app/page.tsx',
    isClient: false,
    revalidate: undefined,    // ISR 配置
    dynamic: undefined        // 渲染模式配置
  },

  loading: { /* ... */ },     // loading.tsx
  error: { /* ... */ },       // error.tsx
  notFound: { /* ... */ },    // not-found.tsx

  // 子路由
  children: [
    {
      segment: 'about',
      path: '/about',
      // ...
    },
    {
      segment: '[id]',
      path: '/blog/[id]',
      dynamic: true,
      param: 'id',
      // ...
    }
  ]
}
```

### 扫描流程详解

#### 第 1 步：递归遍历目录

```javascript
// build/scan-app.ts
function scanDirectory(dir, appDir, urlPath) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  const node = {
    segment: path.basename(dir),
    path: urlPath || '/',
    children: []
  }

  for (const entry of entries) {
    if (entry.isFile()) {
      // 识别特殊文件
      handleSpecialFile(entry, node)
    } else if (entry.isDirectory()) {
      // 递归扫描子目录
      const childNode = scanDirectory(...)
      node.children.push(childNode)
    }
  }

  return node
}
```

#### 第 2 步：识别特殊文件

```javascript
const SPECIAL_FILES = {
  'page.tsx': 'page',
  'page.js': 'page',
  'layout.tsx': 'layout',
  'layout.js': 'layout',
  'loading.tsx': 'loading',
  'loading.js': 'loading',
  'error.tsx': 'error',
  'error.js': 'error',
  'not-found.tsx': 'notFound',
  'not-found.js': 'notFound'
}

// 检查文件名是否为特殊文件
const fileType = SPECIAL_FILES[entry.name]
if (fileType) {
  node[fileType] = {
    file: relativePath,
    absolutePath: entryPath,
    isClient: isClientComponent(entryPath)  // 检测 'use client'
  }
}
```

#### 第 3 步：解析动态路由

```javascript
function parseSegment(segment) {
  // 动态路由: [id]
  const dynamicMatch = segment.match(/^\[([^\]]+)\]$/)
  if (dynamicMatch) {
    const param = dynamicMatch[1]

    // Catch-all 路由: [...slug]
    if (param.startsWith('...')) {
      return {
        segment,
        dynamic: true,
        catchAll: true,
        param: param.slice(3)  // 移除 '...'
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
  return { segment, dynamic: false }
}
```

**示例**：

| 目录名 | 解析结果 |
|--------|---------|
| `about` | `{ segment: 'about', dynamic: false }` |
| `[id]` | `{ segment: '[id]', dynamic: true, param: 'id' }` |
| `[...slug]` | `{ segment: '[...slug]', dynamic: true, catchAll: true, param: 'slug' }` |

#### 第 4 步：构建 URL 路径

```javascript
function buildUrlPath(parentPath, segment) {
  if (!parentPath || parentPath === '/') {
    return `/${segment}`
  }
  return `${parentPath}/${segment}`
}
```

**示例**：

```
/                     (根)
├── /about            (about)
├── /blog             (blog)
│   ├── /blog/[id]    (blog + [id])
│   └── /blog/tech    (blog + tech)
```

---

## 配置提取机制

### 支持的配置类型

本项目实现了 Next.js App Router 的**核心配置**，通过导出配置常量控制渲染行为：

#### 1. `revalidate` - ISR 配置 ✅ 已实现

```javascript
// app/blog/page.tsx
export const revalidate = 60  // 每 60 秒重新验证

export default function BlogPage() {
  const posts = await fetchPosts()  // 可能过期
  return <div>{/* ... */}</div>
}
```

**作用**：
- `undefined` - 永久缓存（默认 SSG）
- `number` - ISR，每 N 秒后台重新生成
- `false` - 强制每次重新渲染（SSR）

**实现文件**：`build/scan-app.ts` - `extractRevalidateConfig()`

#### 2. `dynamic` - 渲染模式配置 ✅ 已实现

```javascript
// app/dashboard/page.tsx
export const dynamic = 'force-dynamic'  // 强制 SSR

export default function DashboardPage() {
  const user = await getCurrentUser()  // 每次请求都执行
  return <div>{/* ... */}</div>
}
```

**支持的选项**：
- `'auto'` - 自动选择（默认）
- `'force-static'` - 强制 SSG
- `'force-dynamic'` - 强制 SSR（已测试）
- `'error'` - 禁止动态渲染，抛错

**实现文件**：`build/scan-app.ts` - `extractDynamicConfig()`

#### 3. 未实现的配置（真实 Next.js 支持）

以下配置在真实 Next.js 中可用，但本教学项目**未实现**：

- `dynamicParams` - 动态参数处理
- `generateStaticParams()` - 动态路由预渲染
- `fetchCache` - Fetch 缓存控制
- `runtime` - 运行时选择（nodejs/edge）
- `preferredRegion` - 边缘函数区域

### 配置提取实现

#### 提取 `revalidate`

```javascript
function extractRevalidateConfig(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')

  // 正则匹配: export const revalidate = 60
  const match = content.match(/export\s+const\s+revalidate\s*=\s*(\d+|false)/)

  if (match) {
    const value = match[1]
    return value === 'false' ? false : parseInt(value, 10)
  }

  return undefined
}
```

#### 提取 `dynamic`

```javascript
function extractDynamicConfig(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')

  // 正则匹配: export const dynamic = 'force-dynamic'
  const match = content.match(/export\s+const\s+dynamic\s*=\s*['"]([^'"]+)['"]/)

  if (match) {
    return match[1]  // 'force-dynamic', 'force-static', etc.
  }

  return undefined
}
```

### 配置应用时机

扫描时立即提取并存储在路由节点：

```javascript
// build/scan-app.ts
if (fileType === 'page') {
  node[fileType] = {
    file: relativePath,
    absolutePath: entryPath,
    isClient: isClientComponent(entryPath),

    // ⭐ 提取配置
    revalidate: extractRevalidateConfig(entryPath),
    dynamic: extractDynamicConfig(entryPath)
  }
}
```

---

## 配置传递流程

### 从扫描到渲染的完整流程

```
┌─────────────────────────────────────────────────────────────┐
│ 1. 构建时（build/index.ts）                                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐                                           │
│  │ scanAppDirectory()                                       │
│  │ - 递归遍历 app/                                          │
│  │ - 识别特殊文件                                           │
│  │ - 提取配置 (revalidate, dynamic)                        │
│  │ - 构建路由树                                             │
│  └──────┬───────┘                                           │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────┐                                           │
│  │ 路由树                                                   │
│  │ {                                                        │
│  │   page: {                                                │
│  │     revalidate: 60,                                      │
│  │     dynamic: 'auto'                                      │
│  │   }                                                      │
│  │ }                                                        │
│  └──────┬───────┘                                           │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────┐                                           │
│  │ collectStaticRoutes()                                    │
│  │ - 筛选可 SSG 的路由                                      │
│  │ - 排除 dynamic: 'force-dynamic'                         │
│  │ - 排除动态路由 [id]                                      │
│  └──────┬───────┘                                           │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────┐                                           │
│  │ prerenderStaticRoutes()                                  │
│  │ - 调用 renderRSC()                                       │
│  │ - 生成 HTML + Flight                                     │
│  │ - 保存到 .next/static/                                   │
│  └──────┬───────┘                                           │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────┐                                           │
│  │ batchSaveMetadata()                                      │
│  │ - 保存 revalidate 到元数据文件                          │
│  │ - 用于运行时 ISR 判断                                    │
│  └──────────────┘                                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 2. 运行时（server/index.ts）                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐                                           │
│  │ 加载 manifest.json                                       │
│  │ {                                                        │
│  │   routes: [...],                                         │
│  │   prerendered: [                                         │
│  │     {                                                    │
│  │       path: '/blog',                                     │
│  │       revalidate: 60                                     │
│  │     }                                                    │
│  │   ]                                                      │
│  │ }                                                        │
│  └──────┬───────┘                                           │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────┐                                           │
│  │ 处理请求 GET /blog                                       │
│  └──────┬───────┘                                           │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────┐                                           │
│  │ 检查是否预渲染                                           │
│  │ - 查找 manifest.prerendered                             │
│  └──────┬───────┘                                           │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────┐                                           │
│  │ shouldRevalidate()                                       │
│  │ - 读取元数据文件                                         │
│  │ - 比较时间 (now - lastGenerated)                        │
│  │ - 判断是否超过 revalidate                                │
│  └──────┬───────┘                                           │
│         │                                                    │
│    Yes  │  No                                               │
│    ┌────┴────┐                                              │
│    ▼         ▼                                              │
│  ┌─────┐  ┌──────┐                                          │
│  │ ISR │  │ 返回 │                                          │
│  │后台 │  │缓存  │                                          │
│  │重生成│  │HTML  │                                          │
│  └─────┘  └──────┘                                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 关键文件和职责

| 文件 | 阶段 | 职责 |
|------|------|------|
| `build/scan-app.ts` | 构建时 | 扫描目录、提取配置、构建路由树 |
| `build/render-static.ts` | 构建时 | 预渲染静态页面、保存元数据 |
| `shared/metadata.ts` | 构建+运行时 | 保存/读取元数据（revalidate 等） |
| `server/index.ts` | 运行时 | 加载 manifest、处理请求、ISR 判断 |
| `server/regenerate.ts` | 运行时 | ISR 后台重新生成 |

---

## 实战案例

### 案例 1：ISR 页面的完整生命周期

**代码**：

```javascript
// app/blog/page.tsx
export const revalidate = 60  // ISR: 60 秒

export default async function BlogPage() {
  const posts = await fetch('https://api.example.com/posts')
    .then(r => r.json())

  return (
    <div>
      {posts.map(post => (
        <article key={post.id}>{post.title}</article>
      ))}
    </div>
  )
}
```

**构建时**：

1. **扫描**：
   ```javascript
   {
     path: '/blog',
     page: {
       file: 'app/blog/page.tsx',
       revalidate: 60,  // ← 提取配置
       dynamic: undefined
     }
   }
   ```

2. **预渲染**：
   ```javascript
   // 执行 BlogPage 组件
   const posts = await fetch(...)  // 获取初始数据

   // 生成 HTML + Flight
   fs.writeFileSync('.next/static/pages/blog.html', html)
   fs.writeFileSync('.next/static/flight/blog.txt', flight)

   // 保存元数据
   fs.writeFileSync('.next/cache/metadata/blog.json', {
     lastGenerated: Date.now(),
     revalidate: 60
   })
   ```

3. **更新 manifest**：
   ```json
   {
     "prerendered": [
       {
         "path": "/blog",
         "htmlPath": "pages/blog.html",
         "flightPath": "flight/blog.txt",
         "revalidate": 60
       }
     ]
   }
   ```

**运行时**：

```
T=0    用户访问 /blog
       ├─ 检查预渲染缓存 ✓
       ├─ shouldRevalidate() = false (刚构建)
       └─ 返回缓存 HTML (瞬间)

T=30   用户访问 /blog
       ├─ 检查预渲染缓存 ✓
       ├─ shouldRevalidate() = false (未超时)
       └─ 返回缓存 HTML

T=65   用户访问 /blog  (超过 60 秒)
       ├─ 检查预渲染缓存 ✓
       ├─ shouldRevalidate() = true ⚠️
       ├─ 立即返回缓存 HTML (用户无感知)
       └─ 后台触发重新生成
           ├─ 重新执行 BlogPage
           ├─ fetch 最新数据
           ├─ 生成新 HTML/Flight
           ├─ 更新缓存
           └─ 更新元数据时间

T=70   用户访问 /blog
       └─ 返回新生成的 HTML ✅
```

### 案例 2：强制 SSR 页面

**代码**：

```javascript
// app/dashboard/page.tsx
export const dynamic = 'force-dynamic'  // 强制 SSR

export default async function DashboardPage() {
  const user = await getCurrentUser()  // 依赖 cookies
  return <div>Welcome, {user.name}!</div>
}
```

**构建时**：

```javascript
{
  path: '/dashboard',
  page: {
    file: 'app/dashboard/page.tsx',
    dynamic: 'force-dynamic'  // ← 提取配置
  }
}

// collectStaticRoutes() 检查
if (node.page.dynamic === 'force-dynamic') {
  // ❌ 不预渲染，跳过
  return
}
```

**结果**：
- ✅ 不会出现在 `manifest.prerendered` 中
- ✅ 不生成静态 HTML
- ✅ 每次请求都执行 SSR

**运行时**：

```javascript
app.get('/dashboard', async (req, res) => {
  // 检查 manifest.prerendered
  const prerenderInfo = manifest.prerendered.find(p => p.path === '/dashboard')

  if (!prerenderInfo) {
    // ✅ 执行 SSR
    const { flight, clientModules } = await renderRSC('/dashboard', req)
    const html = generateHTMLTemplate({ flight, ... })
    res.send(html)
  }
})
```

### 案例 3：混合配置的路由树

**文件结构**：

```
app/
├── layout.tsx              (Root Layout)
├── page.tsx                (SSG, 首页)
├── blog/
│   ├── layout.tsx          (Blog Layout)
│   ├── page.tsx            (ISR, revalidate: 60)
│   └── [id]/
│       └── page.tsx        (动态路由, 不预渲染)
└── dashboard/
    └── page.tsx            (SSR, dynamic: 'force-dynamic')
```

**扫描结果**：

```javascript
{
  path: '/',
  layout: { file: 'app/layout.tsx' },
  page: { file: 'app/page.tsx', revalidate: undefined },  // SSG
  children: [
    {
      path: '/blog',
      layout: { file: 'app/blog/layout.tsx' },
      page: {
        file: 'app/blog/page.tsx',
        revalidate: 60  // ISR
      },
      children: [
        {
          path: '/blog/[id]',
          dynamic: true,  // 动态路由
          page: { file: 'app/blog/[id]/page.tsx' }
        }
      ]
    },
    {
      path: '/dashboard',
      page: {
        file: 'app/dashboard/page.tsx',
        dynamic: 'force-dynamic'  // SSR
      }
    }
  ]
}
```

**预渲染决策**：

```javascript
collectStaticRoutes(routeTree)
// 结果：
[
  { path: '/', revalidate: undefined },     // ✅ SSG
  { path: '/blog', revalidate: 60 }        // ✅ ISR
  // ❌ /blog/[id] - 动态路由跳过
  // ❌ /dashboard - force-dynamic 跳过
]
```

**manifest.json**：

```json
{
  "routes": [
    { "path": "/", "pattern": "^/$" },
    { "path": "/blog", "pattern": "^/blog$" },
    { "path": "/blog/[id]", "pattern": "^/blog/([^/]+?)$", "dynamic": true },
    { "path": "/dashboard", "pattern": "^/dashboard$" }
  ],
  "prerendered": [
    { "path": "/", "htmlPath": "pages/index.html", "revalidate": null },
    { "path": "/blog", "htmlPath": "pages/blog.html", "revalidate": 60 }
  ]
}
```

---

## 与真实 Next.js 对比

### Mini 实现 vs Next.js

| 功能 | Mini 实现 | 真实 Next.js | 差异 |
|------|-----------|--------------|------|
| **路由扫描** | 同步递归扫描 | Rust 编写的 Turbopack 扫描 | Next.js 更快，支持增量构建 |
| **配置提取** | 正则匹配源码 | Babel/SWC AST 解析 | Next.js 更准确，支持复杂表达式 |
| **路由树结构** | 嵌套对象 | 扁平化 + 索引 | Next.js 便于查找和更新 |
| **ISR 元数据** | JSON 文件 | KV 数据库 (Vercel) | Next.js 支持分布式 |
| **动态路由** | 正则匹配 | 基于 Radix Tree | Next.js 性能更好 |
| **配置类型** | `revalidate`, `dynamic` | 30+ 配置选项 | Next.js 功能更全 |

### Mini 实现的优势

1. **易于理解**：200 行代码完整实现路由扫描
2. **清晰的数据流**：扫描 → 配置 → 传递 → 渲染
3. **教学友好**：每个步骤都有详细注释

### 真实 Next.js 的优势

1. **性能优化**：
   - 增量构建（只重新构建变化的路由）
   - 并行渲染（多个路由同时预渲染）
   - 缓存机制（避免重复解析）

2. **功能完整**：
   - `generateStaticParams()` - 动态路由预渲染（本项目未实现）
   - `generateMetadata()` - 动态元数据（本项目未实现）
   - `dynamicParams` - 动态参数处理（本项目未实现）
   - Parallel Routes - 并行路由段（本项目未实现）
   - Intercepting Routes - 路由拦截（本项目未实现）
   - 更多配置选项（fetchCache, runtime, preferredRegion 等）

3. **生产级特性**：
   - 分布式 ISR（多实例协调）
   - 边缘函数支持
   - 自动代码分割

---

## 深入理解：关键设计决策

### 1. 为什么在构建时提取配置？

**问题**：能否在运行时动态读取配置？

```javascript
// 运行时读取 (不推荐)
app.get('/blog', async (req, res) => {
  const pageModule = await import('./app/blog/page.tsx')
  const revalidate = pageModule.revalidate  // ← 运行时获取

  if (shouldRevalidate(revalidate)) {
    // ...
  }
})
```

**缺点**：
- ❌ 每次请求都要 `import` 模块（性能差）
- ❌ 无法在构建时优化（如跳过不需要的预渲染）
- ❌ 配置变更需要重启服务器

**构建时提取的优势**：
- ✅ 一次扫描，多次使用
- ✅ 配置存储在 manifest，快速读取
- ✅ 支持构建时优化决策

### 2. 为什么使用正则而不是 AST？

**正则方式**：

```javascript
const match = content.match(/export\s+const\s+revalidate\s*=\s*(\d+)/)
```

**AST 方式**（Next.js）：

```javascript
const ast = parse(content)
const exportNode = ast.body.find(n =>
  n.type === 'ExportNamedDeclaration' &&
  n.declaration.declarations[0].id.name === 'revalidate'
)
const value = exportNode.declaration.declarations[0].init.value
```

**为什么 Mini 选择正则？**

| 维度 | 正则 | AST |
|------|------|-----|
| 实现复杂度 | ⭐ 简单 | ⭐⭐⭐ 复杂 |
| 准确性 | ⭐⭐ 中等 | ⭐⭐⭐ 高 |
| 性能 | ⭐⭐⭐ 快 | ⭐⭐ 慢 |
| 教学价值 | ⭐⭐⭐ 高 | ⭐ 低 |

**局限性**：

```javascript
// ✅ 正则能识别
export const revalidate = 60

// ❌ 正则识别不了
const value = 60
export const revalidate = value

// ❌ 正则识别不了
export const revalidate = process.env.NODE_ENV === 'production' ? 60 : 0
```

**真实 Next.js 使用 SWC**：
- Rust 实现的高性能 AST 解析器
- 支持复杂表达式和条件配置
- 与构建系统深度集成

### 3. 为什么 ISR 需要元数据文件？

**问题**：为什么不直接在 manifest.json 中存储时间戳？

```json
// 方案 A: 存储在 manifest (不可行)
{
  "prerendered": [
    {
      "path": "/blog",
      "lastGenerated": 1704067200000,  // ❌ 构建时固定
      "revalidate": 60
    }
  ]
}
```

**问题**：
- ❌ manifest 是构建产物，不应运行时修改
- ❌ 多实例部署时无法共享状态
- ❌ 重启服务器会丢失 ISR 时间

**方案 B：独立元数据文件（✅ 推荐）**

```
.next/cache/metadata/
├── blog.json          { lastGenerated: ..., revalidate: 60 }
└── posts-1.json       { lastGenerated: ..., revalidate: 120 }
```

**优势**：
- ✅ 构建产物不变
- ✅ 运行时可更新
- ✅ 可以持久化到数据库（生产环境）

---

## 总结

### 关键要点

1. **路由扫描是 Next.js App Router 的基础**
   - 构建时扫描 app/ 目录
   - 生成路由树和 manifest
   - 为预渲染和运行时提供元数据

2. **配置驱动的渲染模式**
   - `revalidate` 控制 ISR 行为
   - `dynamic` 强制 SSR/SSG
   - 配置在构建时提取并持久化

3. **分层的数据流**
   ```
   app/ 目录 → 路由树 → manifest.json → 服务器路由 → 渲染
              ↓
          元数据文件 → ISR 判断
   ```

4. **性能与可维护性的平衡**
   - Mini 实现：简单直接，易于理解
   - 真实 Next.js：高性能，功能完整

### 学习建议

1. **阅读源码**：
   - `build/scan-app.ts` - 路由扫描
   - `build/render-static.ts` - SSG 预渲染
   - `server/index.ts` - 运行时路由

2. **实验修改**：
   - 添加新的配置类型（如 `export const fetchCache = 'force-cache'`）
   - 实现 `generateStaticParams()` 支持动态路由预渲染
   - 实现 `dynamicParams` 控制未列出的参数
   - 优化路由匹配性能

3. **对比真实 Next.js**：
   - 查看 `.next/` 目录结构
   - 使用 `NEXT_PUBLIC_ANALYZE=true` 分析构建
   - 阅读 Next.js 文档的高级特性

---

## 参考资源

- [Next.js App Router 文档](https://nextjs.org/docs/app)
- [ISR 详解](https://nextjs.org/docs/app/building-your-application/data-fetching/fetching-caching-and-revalidating)
- [Route Segment Config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config)
- 本项目源码：`build/scan-app.ts`, `build/render-static.ts`

---

## 附录：配置实现状态

### 本项目实现的配置

| 配置项 | 状态 | 文件位置 | 说明 |
|--------|------|----------|------|
| `revalidate` | ✅ 完整实现 | `build/scan-app.ts:208` | ISR 时间控制，支持数字和 false |
| `dynamic` | ✅ 完整实现 | `build/scan-app.ts:240` | 渲染模式控制，支持 4 种选项 |

### Next.js 官方配置（未实现）

| 配置项 | 优先级 | 作用 | 实现难度 |
|--------|--------|------|----------|
| `generateStaticParams()` | ⭐⭐⭐ 高 | 动态路由预渲染 | 中等 |
| `dynamicParams` | ⭐⭐ 中 | 控制未列出参数的处理 | 简单 |
| `generateMetadata()` | ⭐⭐ 中 | 动态生成 meta 标签 | 中等 |
| `fetchCache` | ⭐ 低 | Fetch 缓存行为 | 简单 |
| `runtime` | ⭐ 低 | 选择运行时（nodejs/edge） | 复杂 |
| `preferredRegion` | ⭐ 低 | 边缘函数区域 | 复杂（需部署平台） |

**实现建议**：

对于学习项目，建议优先实现：
1. ✅ `revalidate` - 已实现，是 ISR 的核心
2. ✅ `dynamic` - 已实现，控制 SSR/SSG
3. 🔜 `generateStaticParams()` - 下一步建议实现，完善动态路由
4. 🔜 `dynamicParams` - 配合上一项使用

**扩展实现示例**：

```javascript
// 实现 generateStaticParams() 提取
function extractGenerateStaticParams(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')

  // 检查是否导出 generateStaticParams
  if (/export\s+(async\s+)?function\s+generateStaticParams/.test(content)) {
    return true
  }

  return false
}

// 在预渲染时调用
if (node.page.hasGenerateStaticParams) {
  const pageModule = await import(node.page.absolutePath)
  const params = await pageModule.generateStaticParams()

  // 为每个参数组合生成页面
  for (const param of params) {
    await renderRSC(routePath, param, clientComponentMap)
  }
}
```

---

**🎓 现在你已经深入理解了 Next.js App Router 的路由扫描和配置系统！**
