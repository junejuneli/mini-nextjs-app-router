# Server Actions 实现详解

> `'use server'` 指令与 Server Actions RPC 机制完整实现方案

## 目录

- [1. 概念与原理](#1-概念与原理)
- [2. 技术架构](#2-技术架构)
- [3. 核心实现](#3-核心实现)
- [4. 使用示例](#4-使用示例)
- [5. 安全性](#5-安全性)
- [6. 集成指南](#6-集成指南)
- [7. Next.js 真实实现原理](#7-nextjs-真实实现原理)

---

## 1. 概念与原理

### 1.1 什么是 Server Actions？

Server Actions 是一种 **RPC 机制**，允许客户端直接调用服务端函数，无需手动编写 API 端点。

```typescript
// 传统方式：需要创建 API Route
// app/api/create-todo/route.ts
export async function POST(request: Request) {
  const { title } = await request.json()
  await db.todos.create({ title })
  return Response.json({ success: true })
}

// Server Actions：直接调用函数
// app/actions.ts
'use server'
export async function createTodo(formData: FormData) {
  await db.todos.create({ title: formData.get('title') })
  return { success: true }
}

// 使用
<form action={createTodo}>
  <input name="title" />
  <button>Create</button>
</form>
```

**优势**：类型安全 | 简化代码 | 渐进增强 | 自动优化

### 1.2 `'use server'` 指令

两种使用方式：

**模块级**（整个文件）：
```typescript
'use server'  // 文件顶部

export async function createTodo() { /* ... */ }
export async function deleteTodo() { /* ... */ }
```

**函数级**（单个函数 + 闭包）：
```typescript
export default function Page({ userId }) {
  async function updateUser(formData: FormData) {
    'use server'  // 函数内部
    await db.users.update(userId, formData)  // 可访问闭包变量
  }
  return <form action={updateUser}>...</form>
}
```

### 1.3 工作原理

```
构建时:
  扫描代码 → 生成 Action ID → 分离服务端/客户端代码
  ├─ 服务端: registerServerAction(id, fn)
  └─ 客户端: createServerReference(id)

运行时:
  客户端调用 → POST /page?_action=id → 服务端执行 → 返回结果
```

---

## 2. 技术架构

### 2.1 整体流程

```
┌─────────────────────────────────────────────────────────┐
│ 构建时 (npm run build)                                  │
├─────────────────────────────────────────────────────────┤
│ 1. 扫描 'use server' → 提取 Server Actions             │
│ 2. 生成 Action ID (SHA-256 hash)                       │
│ 3. 保存到 .next/actions.json (Manifest)                │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ 服务器启动 (npm start)                                  │
├─────────────────────────────────────────────────────────┤
│ 1. 读取 .next/actions.json                             │
│ 2. 动态 import 函数并注册到 ActionRegistry             │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ 运行时调用                                               │
├─────────────────────────────────────────────────────────┤
│ 客户端: POST + Next-Action header                       │
│ 服务端: 从 Registry 查找 → 执行 → 返回结果             │
└─────────────────────────────────────────────────────────┘
```

### 2.2 核心组件

| 组件 | 职责 | 运行时机 |
|------|------|----------|
| `scan-actions.ts` | 扫描 'use server' 指令 | 构建时 |
| `generate-action-manifest.ts` | 生成 Action Manifest | 构建时 |
| `action-registry.ts` | 存储并执行 Server Actions | 运行时（服务端） |
| `load-actions.ts` | 从 Manifest 加载 Actions | 启动时 |
| `server-reference.ts` | 创建客户端 RPC stub | 运行时（客户端） |

### 2.3 通信协议

**请求格式**：
```http
POST /current-page HTTP/1.1
Next-Action: a3f5e7b9c1d4e8f2
Content-Type: application/json

["arg1", "arg2"]
```

**响应格式**：
```json
// 普通数据
{
  "data": { "success": true }
}

// 或 RSC Payload (触发 UI 更新)
Content-Type: text/x-component
M1:{"id":"./Comment.tsx","name":"default"}
J0:["$","div",null,{"children":"Updated"}]
```

---

## 3. 核心实现

### 3.1 构建时：扫描 Server Actions

**文件**: `build/scan-actions.ts`

```typescript
import crypto from 'crypto'

export interface ServerAction {
  id: string              // SHA-256 hash
  name: string            // 函数名
  filePath: string        // 绝对路径
  relativePath: string    // 相对路径
  type: 'inline' | 'module'
  line: number
}

export function scanServerActions(appDir: string, projectRoot: string): ServerAction[] {
  const actions: ServerAction[] = []

  function scanFile(filePath: string) {
    const content = fs.readFileSync(filePath, 'utf-8')
    const relativePath = './' + path.relative(projectRoot, filePath)

    // 模块级 'use server'
    const hasModuleDirective = /^['"]use server['"]/.test(content.trim())
    if (hasModuleDirective) {
      const exportRegex = /export\s+(?:async\s+)?function\s+(\w+)/g
      let match: RegExpExecArray | null
      while ((match = exportRegex.exec(content)) !== null) {
        const lineNumber = content.substring(0, match.index).split('\n').length
        actions.push({
          id: generateActionId(relativePath, match[1], lineNumber),
          name: match[1],
          filePath,
          relativePath,
          type: 'module',
          line: lineNumber
        })
      }
    }

    // 内联 'use server'
    const inlineRegex = /(?:async\s+)?function\s+(\w+)[^{]*{[\s\n]*['"]use server['"]/g
    while ((match = inlineRegex.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length
      actions.push({
        id: generateActionId(relativePath, match[1], lineNumber),
        name: match[1],
        filePath,
        relativePath,
        type: 'inline',
        line: lineNumber
      })
    }
  }

  // 递归扫描目录...
  return actions
}

function generateActionId(filePath: string, functionName: string, line: number): string {
  const source = `${filePath}:${functionName}:${line}`
  return crypto.createHash('sha256').update(source).digest('hex').slice(0, 16)
}
```

### 3.2 构建时：生成 Manifest

**文件**: `build/generate-action-manifest.ts`

```typescript
export interface ActionManifest {
  version: string
  buildTime: string
  actions: ServerAction[]
}

export function generateActionManifest(
  appDir: string,
  projectRoot: string,
  outputPath: string
): ActionManifest {
  const actions = scanServerActions(appDir, projectRoot)

  const manifest: ActionManifest = {
    version: '1.0.0',
    buildTime: new Date().toISOString(),
    actions
  }

  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2))

  console.log(`✅ 生成 Action Manifest: ${actions.length} 个 Actions`)
  return manifest
}
```

**集成到 build/index.js**:
```javascript
import { generateActionManifest } from './generate-action-manifest.ts'

// 构建流程
console.log('📁 扫描路由...')
const routeTree = scanApp(appDir)

console.log('📝 扫描 Server Actions...')
generateActionManifest(appDir, projectRoot, '.next/actions.json')

console.log('🎨 预渲染静态页面...')
await renderStaticPages(routeTree)
```

**生成的 Manifest 示例**:
```json
{
  "version": "1.0.0",
  "buildTime": "2025-01-15T10:30:00.000Z",
  "actions": [
    {
      "id": "a3f5e7b9c1d4e8f2",
      "name": "createTodo",
      "filePath": "/path/to/app/actions.ts",
      "relativePath": "./app/actions.ts",
      "type": "module",
      "line": 5
    }
  ]
}
```

### 3.3 服务端：Action Registry

**文件**: `server/action-registry.ts`

```typescript
type ServerActionHandler = (...args: any[]) => Promise<any>

class ActionRegistry {
  private actions = new Map<string, ServerActionHandler>()

  register(id: string, handler: ServerActionHandler): void {
    this.actions.set(id, handler)
  }

  async execute(id: string, args: any[]): Promise<any> {
    const handler = this.actions.get(id)
    if (!handler) throw new Error(`Server Action not found: ${id}`)
    return await handler(...args)
  }

  has(id: string): boolean {
    return this.actions.has(id)
  }
}

export const actionRegistry = new ActionRegistry()
```

### 3.4 服务端：启动时加载 Actions

**文件**: `server/load-actions.ts`

```typescript
export async function loadServerActions(manifestPath: string) {
  if (!fs.existsSync(manifestPath)) {
    console.warn('⚠️  Action Manifest 不存在，请先运行 npm run build')
    return
  }

  const manifest: ActionManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))

  console.log(`📦 加载 ${manifest.actions.length} 个 Server Actions`)

  for (const action of manifest.actions) {
    const module = await import(action.filePath)
    const handler = module[action.name]

    if (typeof handler === 'function') {
      actionRegistry.register(action.id, handler)
      console.log(`  ✓ ${action.name}`)
    }
  }
}
```

**集成到 server/index.ts**:
```typescript
import { loadServerActions } from './load-actions.ts'
import { actionRegistry } from './action-registry.ts'

// 启动时加载 Server Actions
await loadServerActions('.next/actions.json')

// 添加 Server Actions 中间件
app.use(express.json())
app.use(async (req, res, next) => {
  const actionId = req.headers['next-action']

  if (actionId && req.method === 'POST') {
    try {
      const args = Array.isArray(req.body) ? req.body : [req.body]
      const result = await actionRegistry.execute(actionId, args)

      // 返回普通数据或 RSC Payload
      res.json({ data: result })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
    return
  }

  next()
})
```

### 3.5 客户端：Server Reference

**文件**: `shared/server-reference.ts`

```typescript
export function createServerReference(
  actionId: string,
  boundArgs?: any[]
): (...args: any[]) => Promise<any> {

  const serverAction = async function(...args: any[]) {
    const allArgs = boundArgs ? [...boundArgs, ...args] : args

    // 序列化参数
    let body: any
    let headers = { 'Next-Action': actionId }

    if (allArgs[0] instanceof FormData) {
      body = allArgs[0]
    } else {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(allArgs)
    }

    // 发送请求
    const response = await fetch(window.location.pathname, {
      method: 'POST',
      headers,
      body
    })

    if (!response.ok) {
      throw new Error(await response.text())
    }

    const contentType = response.headers.get('Content-Type')

    if (contentType?.includes('text/x-component')) {
      // RSC Payload - 触发 UI 更新
      const flight = await response.text()
      window.dispatchEvent(new CustomEvent('rsc-update', { detail: flight }))
    } else {
      // 普通数据
      const result = await response.json()
      return result.data
    }
  }

  // 添加元数据
  Object.defineProperty(serverAction, '$$typeof', {
    value: Symbol.for('react.server.reference')
  })
  Object.defineProperty(serverAction, '$$id', { value: actionId })
  Object.defineProperty(serverAction, '$$bound', { value: boundArgs })

  return serverAction
}
```

### 3.6 Flight Protocol 集成

**修改 shared/flight-encoder.ts**:
```typescript
async encodeProps(props: Record<string, any>) {
  const encoded: Record<string, any> = {}

  for (const [key, value] of Object.entries(props)) {
    // 检测 Server Action 引用
    if (typeof value === 'function' &&
        value.$$typeof === Symbol.for('react.server.reference')) {
      encoded[key] = {
        $$typeof: 'server.action',
        id: value.$$id,
        bound: value.$$bound
      }
      continue
    }

    if (typeof value === 'function') {
      encoded[key] = null  // 普通函数无法序列化
      continue
    }

    encoded[key] = await this.encodeValue(value)
  }

  return encoded
}
```

**修改 shared/flight-decoder.ts**:
```typescript
import { createServerReference } from './server-reference.ts'

private resolveValue(value: any, modules, chunks): any {
  // 检测 Server Action 引用
  if (value?.$$typeof === 'server.action') {
    if (typeof window !== 'undefined') {
      return createServerReference(value.id, value.bound)
    }
    // 服务端 SSG 时返回占位符
    return () => { throw new Error('Server Action 不能在 SSG 时调用') }
  }

  // ... 其他解析逻辑
}
```

---

## 4. 使用示例

### 4.1 模块级 Server Actions

```typescript
// app/actions.ts
'use server'

export async function createTodo(formData: FormData) {
  const title = formData.get('title') as string
  await db.todos.create({ title })
  return { success: true, id: Date.now() }
}

export async function deleteTodo(id: number) {
  await db.todos.delete(id)
  return { success: true }
}
```

```typescript
// app/page.tsx (Client Component)
'use client'
import { createTodo, deleteTodo } from './actions'

export default function TodoPage() {
  async function handleSubmit(formData: FormData) {
    const result = await createTodo(formData)
    console.log('创建成功:', result)
  }

  return (
    <form action={handleSubmit}>
      <input name="title" required />
      <button type="submit">添加</button>
    </form>
  )
}
```

### 4.2 内联 Server Actions (闭包)

```typescript
// app/posts/[id]/page.tsx (Server Component)
export default async function PostPage({ params }: { params: { id: string } }) {
  const post = await db.posts.findById(params.id)

  // 内联 Server Action - 捕获 params.id
  async function likePost() {
    'use server'
    await db.posts.incrementLikes(params.id)
    const updated = await db.posts.findById(params.id)
    return { likes: updated.likes }
  }

  return (
    <div>
      <h1>{post.title}</h1>
      <LikeButton action={likePost} initialLikes={post.likes} />
    </div>
  )
}
```

```typescript
// LikeButton.tsx (Client Component)
'use client'
export default function LikeButton({ action, initialLikes }) {
  const [likes, setLikes] = useState(initialLikes)

  async function handleLike() {
    const result = await action()
    setLikes(result.likes)
  }

  return <button onClick={handleLike}>❤️ {likes}</button>
}
```

### 4.3 返回 RSC Payload (UI 刷新)

```typescript
// app/comments/actions.ts
'use server'
import CommentList from './comment-list'  // Server Component

export async function addComment(postId: string, formData: FormData) {
  const content = formData.get('content')
  await db.comments.create({ postId, content })

  // 返回 Server Component - 自动触发 UI 更新
  return <CommentList postId={postId} />
}
```

---

## 5. 安全性

### 5.1 CSRF 防护

```typescript
// server/index.ts
app.use(async (req, res, next) => {
  const actionId = req.headers['next-action']

  if (actionId && req.method === 'POST') {
    // 验证 Origin
    const origin = req.headers['origin']
    const host = req.headers['host']

    if (origin && !origin.endsWith(host)) {
      return res.status(403).json({ error: 'CSRF attack detected' })
    }

    // 执行 action...
  }
  next()
})
```

### 5.2 闭包加密

**问题**：内联 Server Action 捕获的闭包变量会发送到客户端，可能被篡改。

**解决**：加密闭包变量（生产环境必须）

```typescript
import crypto from 'crypto'

const SECRET_KEY = process.env.SERVER_ACTION_SECRET

function encryptBoundArgs(args: any[]): string {
  const json = JSON.stringify(args)
  const cipher = crypto.createCipheriv('aes-256-gcm', SECRET_KEY, iv)
  return cipher.update(json, 'utf8', 'base64') + cipher.final('base64')
}

function decryptBoundArgs(encrypted: string): any[] {
  const decipher = crypto.createDecipheriv('aes-256-gcm', SECRET_KEY, iv)
  const decrypted = decipher.update(encrypted, 'base64', 'utf8') + decipher.final('utf8')
  return JSON.parse(decrypted)
}
```

### 5.3 权限验证

**永远在服务端验证权限**，不要信任客户端数据：

```typescript
'use server'
import { getServerSession } from './auth'

export async function deleteUser(userId: string) {
  // 服务端重新获取用户会话
  const session = await getServerSession()

  if (!session?.user?.isAdmin) {
    throw new Error('无权限')
  }

  await db.users.delete(userId)
}
```

### 5.4 输入验证

```typescript
'use server'
import { z } from 'zod'

const createTodoSchema = z.object({
  title: z.string().min(1).max(100),
  priority: z.enum(['low', 'medium', 'high']).optional()
})

export async function createTodo(formData: FormData) {
  const data = createTodoSchema.parse({
    title: formData.get('title'),
    priority: formData.get('priority')
  })

  await db.todos.create(data)
}
```

---

## 6. 集成指南

### 6.1 文件清单

**新增文件**:
```
build/
  scan-actions.ts                 # 扫描 'use server' 指令
  generate-action-manifest.ts     # 生成 Action Manifest

server/
  action-registry.ts              # Action 注册表
  load-actions.ts                 # 加载 Actions

shared/
  server-reference.ts             # 客户端 RPC stub
```

**修改文件**:
```
build/index.js                    # 集成 Action Manifest 生成
server/index.ts                   # 添加 Server Action 中间件
shared/flight-encoder.ts          # 序列化 Server Action 引用
shared/flight-decoder.ts          # 反序列化 Server Action
client/router.tsx                 # 监听 RSC 更新事件
```

### 6.2 构建流程

```
构建时 (npm run build):
  ├─ 扫描路由
  ├─ 扫描 Server Actions → 生成 .next/actions.json
  ├─ SSG 预渲染
  └─ 打包客户端代码

启动时 (npm start):
  ├─ 读取 .next/actions.json
  ├─ 动态 import 并注册到 ActionRegistry
  └─ 启动服务器

⭐ 优化：扫描只在构建时执行，启动速度 O(n) → O(1)
```

### 6.3 实现步骤

**阶段 1: 基础 RPC**
- [x] 创建 `scan-actions.ts`, `generate-action-manifest.ts`
- [x] 创建 `action-registry.ts`, `load-actions.ts`
- [x] 创建 `server-reference.ts`
- [x] 修改 `server/index.ts` 添加中间件
- [ ] 测试基本调用

**阶段 2: Flight 集成**
- [x] 修改 `flight-encoder.ts`, `flight-decoder.ts`
- [x] 修改 `client/router.tsx` 监听 RSC 更新
- [ ] 测试 Server Component → Client Component 传递 Action

**阶段 3: 高级特性**
- [ ] FormData 支持 (multipart/form-data)
- [ ] 闭包加密
- [ ] 返回 RSC Payload 自动更新 UI
- [ ] useFormStatus, useFormState hooks

### 6.4 调试技巧

**查看已注册的 Actions**:
```typescript
// server/index.ts
app.get('/__debug/actions', (req, res) => {
  res.json({
    total: actionRegistry.getAllIds().length,
    actions: actionRegistry.getAllIds()
  })
})
```

访问 `http://localhost:3000/__debug/actions`

**启用详细日志**:
```typescript
// server/action-registry.ts
async execute(id: string, args: any[]): Promise<any> {
  console.log('🎯 执行 Server Action:', id)
  console.log('📦 参数:', args)

  const result = await handler(...args)

  console.log('✅ 结果:', result)
  return result
}
```

---

## 7. Next.js 真实实现原理

### 7.1 构建时：SWC/Webpack 插件转换

Next.js 使用 **SWC (Rust-based compiler)** 在构建时对代码进行 AST 转换，而不是运行时扫描。

**原理**：

```
源码:
  'use server'
  export async function createTodo(formData) { ... }

↓ SWC 编译器转换 ↓

服务端 bundle:
  import { registerServerReference } from 'private-next-rsc-server-reference'
  export const createTodo = registerServerReference(
    async function createTodo(formData) { ... },
    '$$id',  // Action ID
    null     // 闭包绑定（如有）
  )

客户端 bundle:
  import { createServerReference } from 'react-server-dom-webpack/client'
  export const createTodo = createServerReference('$$id')
```

**关键点**：
- **编译器级别代码分离**：服务端保留实际函数，客户端只有 RPC stub
- **Webpack Module Federation**：通过模块联邦机制共享 Action ID
- **闭包捕获**：编译器自动提取闭包依赖，生成绑定参数

### 7.2 运行时：Flight Protocol 扩展

Next.js 的 Server Actions 是 **React Flight Protocol** 的原生扩展，使用 `react-server-dom-webpack` 包。

**核心机制**：

```typescript
// React Flight 内置支持
Symbol.for('react.server.reference')  // 标记 Server Action

// Flight 序列化格式
{
  $$typeof: Symbol.for('react.server.reference'),
  $$id: 'action-hash',
  $$bound: [encryptedArgs]  // AES-256-GCM 加密
}
```

**通信协议**：
```http
POST /page-url HTTP/1.1
Next-Action: action-hash
Next-Router-State-Tree: %5B%22%22...  // 路由状态（用于 UI 刷新）
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary...

------WebKitFormBoundary...
Content-Disposition: form-data; name="0"
["arg1", "arg2"]
```

**关键优化**：
- **流式响应**：支持 Suspense 流式传输（`Transfer-Encoding: chunked`）
- **路由状态同步**：返回时携带 `Next-Router-State-Tree`，触发局部刷新
- **自动 revalidate**：执行 Server Action 后自动重新验证缓存路径

### 7.3 安全机制

**闭包加密实现**：

```typescript
// next/dist/server/app-render/action-encryption.js
const algorithm = 'aes-256-gcm'
const key = Buffer.from(process.env.__NEXT_SERVER_ACTIONS_ENCRYPTION_KEY, 'base64')

export function encrypt(data: unknown): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(algorithm, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(data), 'utf8'),
    cipher.final()
  ])

  const authTag = cipher.getAuthTag()

  // Format: iv:authTag:encrypted
  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64')
  ].join(':')
}
```

**CSRF 防护**：
- **Origin 验证**：严格校验 `Origin` header
- **SameSite Cookies**：配合 Cookie 策略防护
- **Action Signature**：对 Action ID 进行签名验证

### 7.4 缓存集成

Server Actions 与 Next.js 四层缓存紧密集成：

```typescript
// 执行 Server Action 后自动重新验证路径
export async function createTodo(formData: FormData) {
  'use server'
  await db.todos.create({ title: formData.get('title') })

  // 自动触发缓存重新验证
  revalidatePath('/todos')       // 重新验证特定路径
  revalidateTag('todo-list')     // 重新验证特定标签
}
```

**缓存失效流程**：
```
Server Action 执行
  ↓
revalidatePath('/todos')
  ↓
标记 Full Route Cache 失效
  ↓
客户端导航到 /todos 时
  ↓
重新从服务端获取 RSC Payload
  ↓
更新 Router Cache
```

### 7.5 渐进增强（Progressive Enhancement）

Next.js 实现了**无 JavaScript 也能提交表单**的特性：

```typescript
// 浏览器禁用 JS 时
<form action="/api/__server-actions/action-hash" method="POST">
  <input name="title" />
  <button type="submit">Submit</button>
</form>

// 服务端处理
POST /api/__server-actions/action-hash
  ↓
执行 Server Action
  ↓
返回 302 重定向（非 RSC Payload）
  ↓
浏览器导航到新页面
```

**实现原理**：
- **构建时注入 fallback URL**：`<form action="/__server-actions/hash">`
- **服务端检测 Accept header**：
  - `Accept: text/x-component` → 返回 RSC Payload
  - 其他 → 返回 HTML redirect
- **客户端 JS 拦截提交**：有 JS 时阻止默认行为，改为 fetch

### 7.6 与本实现的差异

| 特性 | 本文档实现 | Next.js 真实实现 |
|------|-----------|------------------|
| **代码转换** | 运行时正则扫描 | SWC 编译器 AST 转换 |
| **代码分离** | 手动 import/export | Webpack Module Federation |
| **闭包加密** | 可选（简化示例） | 强制 AES-256-GCM 加密 |
| **通信协议** | 简化 JSON | React Flight Protocol 完整实现 |
| **缓存集成** | 无 | 四层缓存自动失效 |
| **渐进增强** | 无 | 完整支持无 JS 提交 |
| **性能优化** | 构建时 Manifest | 编译时 Chunk Splitting + Tree Shaking |

### 7.7 生产级建议

如果要达到 Next.js 的生产级水平，需要进一步实现：

1. **使用 Babel/SWC 插件**：
   - 替换运行时扫描为编译时 AST 转换
   - 自动提取闭包依赖
   - 生成优化的 bundle

2. **完整 Flight Protocol 集成**：
   - 使用 `react-server-dom-webpack` 官方包
   - 支持流式传输（Suspense streaming）
   - 处理错误边界

3. **强制闭包加密**：
   - 所有闭包变量使用 AES-256-GCM 加密
   - 添加 IV 和 AuthTag 验证
   - 密钥轮换机制

4. **缓存集成**：
   - 实现 `revalidatePath()`, `revalidateTag()`
   - 与 ISR、Router Cache 联动
   - 自动缓存失效

5. **渐进增强**：
   - 构建时生成 fallback action URL
   - 服务端检测 `Accept` header
   - 客户端 JS 拦截表单提交

---

## 总结

Server Actions 通过**构建时代码转换**和**运行时 RPC 机制**，实现客户端与服务端的无缝函数调用。

**核心要点**：
1. ✅ **Action Registry** - 服务端注册表，根据 ID 执行函数
2. ✅ **RPC 通信** - POST + `Next-Action` header
3. ✅ **Flight 集成** - 序列化/反序列化 Server Action 引用
4. ✅ **构建时 Manifest** - 扫描一次，启动快速加载（O(1)）
5. ✅ **安全性** - 闭包加密、权限验证、CSRF 防护

**本文档 vs Next.js**：
- 本文档：教学型实现，核心机制完整，易于理解
- Next.js：生产级实现，使用 SWC 编译器，性能和安全性更强

**参考资料**：
- [React: use server directive](https://react.dev/reference/rsc/use-server)
- [Next.js: Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [Waku Framework Implementation](https://github.com/dai-shi/waku)
- [React Server Components Discussion](https://github.com/reactwg/server-components/discussions)

---

本文档提供完整的教学型实现方案，理解核心原理后，可参考 Next.js 源码进一步优化。🚀
