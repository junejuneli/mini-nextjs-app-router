# Mini Next.js App Router 架构文档

> 深入理解 React Server Components 和 Flight Protocol 原理

---

## 目录

1. [核心概念](#核心概念)
2. [Flight Protocol 详解](#flight-protocol-详解)
3. [渲染流程](#渲染流程)
4. [关键代码解析](#关键代码解析)
5. [与真实 Next.js 对比](#与真实-nextjs-对比)

---

## 核心概念

### 什么是 React Server Components (RSC)?

传统 React 应用：
```
服务端 → 生成 HTML Shell
客户端 → 下载完整 JS Bundle → 渲染所有组件 → Hydration
```

**问题**：
- 所有组件代码都发送到客户端（Bundle 大）
- 无法直接访问服务端资源（需要 API 层）

RSC 架构：
```
服务端 → 渲染 Server Components → 序列化为 Flight Payload
客户端 → 解析 Flight → 只 Hydrate Client Components
```

**优势**：
- Server Component 代码不发送到客户端（Zero Bundle）
- 可以直接在组件中访问数据库、文件系统
- Client Component 只在需要交互时使用

### Server Component vs Client Component

| 维度 | Server Component | Client Component |
|------|------------------|------------------|
| **标记** | 无（默认） | `'use client'` |
| **执行位置** | 仅服务端 | 服务端预渲染 + 客户端 Hydration |
| **Bundle** | 不发送到客户端 | 发送到客户端 |
| **能力** | 访问 DB、文件系统 | useState, useEffect, 事件处理 |
| **数据获取** | 直接 await | 客户端 fetch |
| **嵌套规则** | 可包含 Server/Client | 只能包含 Client |

### 示例对比

**Server Component** (app/page.tsx):
```jsx
// 无需 'use client' 指令，默认是 Server Component
export default async function Page() {
  // ✅ 直接访问数据库
  const posts = await db.posts.findMany()

  // ✅ 访问文件系统
  const readme = await fs.readFile('README.md', 'utf-8')

  return (
    <div>
      <h1>Posts: {posts.length}</h1>
      <ClientButton />  {/* 嵌入 Client Component */}
    </div>
  )
}
```

**Client Component** (components/ClientButton.jsx):
```jsx
'use client'  // ← 必须声明

import { useState } from 'react'

export default function ClientButton() {
  // ✅ 可以使用 Hooks
  const [count, setCount] = useState(0)

  // ✅ 可以绑定事件
  return <button onClick={() => setCount(count + 1)}>Count: {count}</button>
}
```

---

## Flight Protocol 详解

### 为什么需要 Flight Protocol?

**挑战**：如何在服务端渲染包含 Server/Client 组件的 React 树，并传输给客户端？

传统 JSON 序列化不行：
```javascript
// ❌ 无法序列化函数引用
{
  type: ClientButton,  // 函数无法 JSON.stringify
  props: { onClick: handler }  // 函数无法序列化
}
```

**Flight Protocol 解决方案**：
1. Server Component → 在服务端执行，序列化渲染结果
2. Client Component → 替换为**模块引用**（字符串）
3. 使用自定义格式传输

### Flight Protocol 格式

#### 数据类型

```
M - Module Reference (Client Component 模块引用)
J - JSON (普通数据)
S - Symbol/String (特殊符号)
E - Error (错误对象)
```

#### 格式规范

```
TYPE + ID + ':' + DATA
```

示例：
```
M1:{"id":"./Button.jsx","chunks":["Button"],"name":"default"}
J0:["$","div",null,{"children":["$","@1",null,{"text":"Click"}]}]
```

### 完整示例

#### 输入 (Server Component)

```jsx
<div>
  <h1>Server Title</h1>
  <ClientButton text="Click me" />
</div>
```

#### 输出 (Flight Payload)

```
M1:{"id":"./components/ClientButton.jsx","chunks":["ClientButton"],"name":"default"}
J0:["$","div",null,{"children":[["$","h1",null,{"children":"Server Title"}],["$","@1",null,{"text":"Click me"}]]}]
```

#### 解读

**第一行 (M1)**:
```json
{
  "id": "./components/ClientButton.jsx",  // 模块路径
  "chunks": ["ClientButton"],             // 对应的 JS chunk
  "name": "default"                       // 导出名称
}
```

- 定义了一个模块引用，ID 为 1
- 客户端需要动态加载 `./components/ClientButton.jsx`

**第二行 (J0)**:
```json
["$","div",null,{
  "children":[
    ["$","h1",null,{"children":"Server Title"}],
    ["$","@1",null,{"text":"Click me"}]
  ]
}]
```

- `["$", type, key, props]` 是 React 元素的数组格式
- `"@1"` 引用了 M1 定义的模块

### Flight 编码流程

```
1. 遍历 React 树
   │
   ├─ 遇到 Server Component
   │  └→ 执行组件函数
   │     └→ 获取渲染结果
   │        └→ 继续遍历子树
   │
   ├─ 遇到 Client Component
   │  └→ 生成 M chunk (模块引用)
   │     └→ 在树中插入 "@N" 引用
   │
   └─ 遇到普通元素 ('div', 'span')
      └→ 序列化为 ["$", "div", null, {...}]
   │
2. 输出 Flight Protocol 字符串
   M1:...
   M2:...
   J0:...
```

### Flight 解码流程

```
1. 按行分割 Flight 响应
   │
2. 解析每个 chunk
   ├─ M chunks → 存入 modules Map
   └─ J chunks → 存入 chunks Map
   │
3. 从根 chunk (J0) 开始递归解析
   │
4. 遇到 ["$", type, key, props]
   ├─ type 是字符串 ('div')
   │  └→ React.createElement('div', props)
   │
   └─ type 是引用 ('@1')
      └→ 查找 M1
         └→ 动态 import('./ClientButton.jsx')
            └→ 创建 React.lazy Component
   │
5. 返回完整 React 树
```

---

## 渲染流程

### 完整请求流程

#### 1. 用户访问 `/dashboard`

#### 2. 服务端处理

```javascript
// server/index.ts

// 2.1 路由匹配
const route = matchRoute('/dashboard')
// → { path: '/dashboard', page: {...}, layout: {...} }

// 2.2 渲染 RSC
const { flight, clientModules } = await renderRSC(route)
```

**2.2.1 构建 Layout 树** (server/rsc-renderer.ts):
```javascript
// 收集 Layout 层级
const layouts = [RootLayout, DashboardLayout]

// 从内到外构建树
let tree = <DashboardPage />
tree = <DashboardLayout>{tree}</DashboardLayout>
tree = <RootLayout>{tree}</RootLayout>
```

**2.2.2 执行 Server Components**:
```javascript
// 执行 RootLayout
const rootResult = RootLayout({
  children: <DashboardLayout>...</DashboardLayout>
})

// 执行 DashboardLayout (如果是 Client Component，跳过执行)
// ...
```

**2.2.3 编码为 Flight** (server/flight-encoder.ts):
```javascript
const encoder = new FlightEncoder(clientComponentMap)

// 递归遍历树
function encodeElement(element) {
  if (typeof element.type === 'string') {
    // 普通 HTML 元素
    return ["$", "div", null, {...}]
  }

  if (isClientComponent(element.type)) {
    // Client Component → 生成模块引用
    const ref = createModuleReference(element.type)
    return ["$", "@1", null, {...}]
  }

  // Server Component → 执行并继续编码
  const rendered = element.type(element.props)
  return encodeValue(rendered)
}
```

**2.2.4 输出 Flight**:
```
M1:{"id":"./app/dashboard/ClientCounter.tsx","chunks":["ClientCounter"],"name":"default"}
J0:["$","html",null,{"children":[...]}]
```

#### 3. 生成 HTML

```javascript
const html = `
<!DOCTYPE html>
<html>
<head>...</head>
<body>
  <div id="__next"></div>

  <!-- 注入 Flight Payload -->
  <script id="__FLIGHT_DATA__" type="application/json">
    ${JSON.stringify({ flight, pathname: '/dashboard' })}
  </script>

  <!-- 客户端入口 -->
  <script type="module" src="/client.js"></script>
</body>
</html>
`
```

#### 4. 客户端处理

**4.1 读取 Flight Payload** (client/index.tsx):
```javascript
const flightData = JSON.parse(
  document.getElementById('__FLIGHT_DATA__').textContent
)

const { flight, pathname } = flightData
```

**4.2 解码 Flight** (client/module-map.ts):
```javascript
const decoder = new FlightDecoder(moduleMap)

// 解析每一行
for (const line of flight.split('\n')) {
  if (line.startsWith('M')) {
    parseModuleChunk(line)  // M1:... → modules.set('M1', {...})
  }
  if (line.startsWith('J')) {
    parseJSONChunk(line)    // J0:... → chunks.set('J0', {...})
  }
}

// 从根开始解析
const tree = resolveChunk('J0')
```

**4.3 处理模块引用**:
```javascript
function resolveElement(["$", "@1", null, props]) {
  // 查找 M1
  const moduleInfo = modules.get('M1')
  // → { id: './app/dashboard/ClientCounter.tsx', ... }

  // 动态加载
  const Component = React.lazy(() =>
    import('./app/dashboard/ClientCounter.tsx')
  )

  return <Component {...props} />
}
```

**4.4 Hydrate**:
```javascript
hydrateRoot(
  document.getElementById('__next'),
  <Suspense fallback={<Loading />}>
    {tree}
  </Suspense>
)
```

---

## 关键代码解析

### 1. Flight Encoder (server/flight-encoder.ts)

#### 核心方法：encodeElement

```javascript
encodeElement(element) {
  const { type, props, key } = element

  // Case 1: HTML 元素 'div'
  if (typeof type === 'string') {
    return [
      '$',                      // React 元素标记
      type,                     // 'div'
      key,                      // key (通常为 null)
      this.encodeProps(props)   // 递归编码 props
    ]
  }

  // Case 2: Client Component
  if (this.isClientComponent(type)) {
    const moduleRef = this.createModuleReference(type)
    // moduleRef = '@1'

    return ['$', moduleRef, key, this.encodeProps(props)]
  }

  // Case 3: Server Component
  // 在服务端执行，获取渲染结果
  const rendered = type(props)
  return this.encodeValue(rendered)
}
```

#### createModuleReference

```javascript
createModuleReference(component) {
  // 检查缓存
  if (this.moduleReferences.has(component)) {
    return this.moduleReferences.get(component)
  }

  const moduleInfo = this.clientComponentMap.get(component)
  const moduleId = this.moduleId++

  // 写入 M chunk
  this.output.push(
    `M${moduleId}:${JSON.stringify(moduleInfo)}`
  )

  // 创建引用 '@1'
  const reference = `@${moduleId}`
  this.moduleReferences.set(component, reference)

  return reference
}
```

### 2. Flight Decoder (client/module-map.ts)

#### 核心方法：resolveElement

```javascript
resolveElement([marker, type, key, props]) {
  const resolvedProps = this.resolveValue(props) || {}

  // Case 1: Client Component 引用 "@1"
  if (typeof type === 'string' && type.startsWith('@')) {
    const moduleId = type.replace('@', 'M')  // '@1' → 'M1'
    const Component = this.resolveChunk(moduleId)

    return React.createElement(Component, { ...resolvedProps, key })
  }

  // Case 2: HTML 元素 "div"
  if (typeof type === 'string') {
    return React.createElement(type, { ...resolvedProps, key })
  }
}
```

#### loadClientComponent

```javascript
loadClientComponent(moduleInfo) {
  const { id, name } = moduleInfo
  const loader = this.moduleMap[id]

  // 使用 React.lazy 动态加载
  const LazyComponent = React.lazy(async () => {
    const module = await loader()
    const Component = module[name] || module.default

    return { default: Component }
  })

  return LazyComponent
}
```

---

## 与真实 Next.js 对比

### 实现对比

| 特性 | Mini 实现 | 真实 Next.js | 说明 |
|------|----------|-------------|------|
| **Flight Protocol** | ✅ 完整 | ✅ 完整 | M/J/S chunks |
| **Server Components** | ✅ 核心 | ✅ 完整 | 服务端执行 |
| **Client Components** | ✅ 'use client' | ✅ 完整 | Hydration |
| **嵌套 Layout** | ✅ 基础 | ✅ 完整 | 共享布局 |
| **Streaming SSR** | ⚠️ 简化 | ✅ 完整 | React 18 Suspense |
| **Flight 序列化** | ✅ JSON | ✅ Binary | 性能优化 |
| **Module Reference** | ✅ 字符串 | ✅ Symbol | 类型安全 |
| **缓存策略** | ❌ 无 | ✅ 多层 | fetch cache, router cache |
| **Parallel Routes** | ❌ 无 | ✅ 支持 | @folder 语法 |
| **Intercepting Routes** | ❌ 无 | ✅ 支持 | (..) 语法 |

### 简化之处

1. **Flight Protocol**:
   - Mini: JSON 格式，易读但体积大
   - Next.js: 二进制格式，性能更优

2. **Module Reference**:
   - Mini: 字符串 '@1'
   - Next.js: Symbol.for('react.module.reference')

3. **Streaming**:
   - Mini: 简化实现，不支持嵌套 Suspense
   - Next.js: 完整支持，Selective Hydration

4. **缓存**:
   - Mini: 无缓存
   - Next.js: Router Cache, Full Route Cache, Data Cache

### 保留的核心

✅ **Flight Protocol 编码/解码完整实现**
✅ **Server/Client 组件边界识别**
✅ **嵌套 Layout 系统**
✅ **动态模块加载**

---

## 总结

通过这个 Mini 实现，你已经深入理解了：

1. **RSC 架构** - Server/Client 组件如何协作
2. **Flight Protocol** - React 树的序列化与传输
3. **模块引用系统** - Client Component 的动态加载
4. **Layout 嵌套** - 共享布局的实现原理

这些核心概念是 Next.js App Router 的基础，掌握它们后，你可以：
- 更好地使用 Next.js
- 理解 RSC 的性能优势
- 设计更优的应用架构

---

**推荐阅读**：
- [React RFC: Server Components](https://github.com/reactjs/rfcs/blob/main/text/0188-server-components.md)
- [Next.js App Router Documentation](https://nextjs.org/docs/app)
- [Understanding RSC Wire Format](https://github.com/facebook/react/blob/main/packages/react-server/README.md)
