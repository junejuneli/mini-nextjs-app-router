# Client Component 加载机制详解

> 深入理解 App Router 中 Client Component 的加载时机、网络请求、缓存机制

---

## 目录

1. [核心概念](#核心概念)
2. [加载时机总览](#加载时机总览)
3. [时机 1: SSR 初次加载](#时机-1-ssr-初次加载)
4. [时机 2: 客户端导航](#时机-2-客户端导航)
5. [时机 3: Link 预加载](#时机-3-link-预加载)
6. [时机 4: 动态导入](#时机-4-动态导入)
7. [时机 5: React.lazy 懒加载](#时机-5-reactlazy-懒加载)
8. [缓存机制](#缓存机制)
9. [性能优化建议](#性能优化建议)
10. [常见问题](#常见问题)

---

## 核心概念

### Server Component vs Client Component

```
Server Components:
├─ 只在服务端执行
├─ 代码永远不发送到客户端
├─ 可以直接访问数据库、文件系统
└─ 无法使用 useState、useEffect 等客户端 hooks

Client Components:
├─ 需要在客户端执行
├─ 代码必须发送到浏览器
├─ 可以使用所有 React hooks
└─ 用 'use client' 指令标记
```

### 关键问题

**本文档回答的核心问题**：
1. Client Component 的代码什么时候发送到浏览器？
2. 如何避免重复加载相同的组件？
3. 预加载是如何工作的？
4. 如何优化 Client Component 的加载性能？

---

## 加载时机总览

| 时机 | 触发条件 | 加载方式 | 缓存 |
|------|----------|----------|------|
| **SSR 初次加载** | 用户访问页面 | 立即并行加载所有 Client Components | ✅ |
| **客户端导航** | 点击 Link | 仅加载新出现的 Client Components | ✅ |
| **Link 预加载** | Link 进入视口 | 后台低优先级加载 | ✅ |
| **动态导入** | 代码执行 `import()` | 按需加载 | ✅ |
| **React.lazy** | 组件首次渲染 | 懒加载 + Suspense | ✅ |

**核心原则**：
- ✅ 已加载的组件永远不会重复请求（除非刷新页面）
- ✅ 所有加载都是并行的，不会串行阻塞
- ✅ 组件代码会被浏览器缓存

---

## 时机 1: SSR 初次加载

### 场景描述

用户第一次访问页面（例如直接在浏览器输入 `http://localhost:3000/`）

### 示例代码

```javascript
// app/layout.tsx (Server Component)
import ThemeProvider from '@/components/ThemeProvider'
import Header from '@/components/Header'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ThemeProvider>  {/* ← Client Component */}
          <Header />     {/* ← Server Component */}
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}

// components/ThemeProvider.jsx
'use client'  // ⭐ Client Component 标记

import { useState, createContext } from 'react'

export const ThemeContext = createContext()

export default function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light')

  return (
    <ThemeContext.Provider value={{ theme }}>
      <div className={theme}>
        {children}
      </div>
    </ThemeContext.Provider>
  )
}

// components/Header.jsx (Server Component)
import LoginButton from './LoginButton'

export default async function Header() {
  const user = await db.users.current()

  return (
    <header>
      <h1>My App</h1>
      {user ? (
        <p>Welcome {user.name}</p>
      ) : (
        <LoginButton />  {/* ← Client Component */}
      )}
    </header>
  )
}

// components/LoginButton.jsx
'use client'  // ⭐ Client Component

import { useState } from 'react'

export default function LoginButton() {
  const [loading, setLoading] = useState(false)

  const handleLogin = () => {
    setLoading(true)
    // 登录逻辑...
  }

  return (
    <button onClick={handleLogin} disabled={loading}>
      {loading ? 'Loading...' : 'Login'}
    </button>
  )
}

// app/page.tsx (Server Component)
import Counter from '@/components/Counter'

export default function HomePage() {
  return (
    <div>
      <h1>Welcome to Home Page</h1>
      <Counter />  {/* ← Client Component */}
    </div>
  )
}

// components/Counter.jsx
'use client'  // ⭐ Client Component

import { useState } from 'react'

export default function Counter() {
  const [count, setCount] = useState(0)

  return (
    <button onClick={() => setCount(c => c + 1)}>
      Count: {count}
    </button>
  )
}
```

### 服务端执行流程

```
1. 用户请求: GET /

2. Next.js 服务器开始渲染
   ├─ 执行 RootLayout (Server Component)
   │  ├─ 渲染 <html>, <body> 等 HTML 标签
   │  ├─ 遇到 <ThemeProvider>
   │  │  └─ 检测到 'use client' → 标记为 Client Component
   │  │  └─ 记录 Module Reference: M1
   │  └─ 继续处理 children
   │
   ├─ 执行 Header (Server Component)
   │  ├─ await db.users.current() → 查询数据库
   │  ├─ 渲染 <header>, <h1> 等
   │  ├─ 遇到 <LoginButton>
   │  │  └─ 检测到 'use client' → 标记为 Client Component
   │  │  └─ 记录 Module Reference: M2
   │  └─ 返回渲染结果
   │
   └─ 执行 HomePage (Server Component)
      ├─ 渲染 <div>, <h1> 等
      ├─ 遇到 <Counter>
      │  └─ 检测到 'use client' → 标记为 Client Component
      │  └─ 记录 Module Reference: M3
      └─ 返回渲染结果

3. 收集到的 Client Components:
   ├─ M1: ThemeProvider (./components/ThemeProvider.jsx)
   ├─ M2: LoginButton (./components/LoginButton.jsx)
   └─ M3: Counter (./components/Counter.jsx)

4. 生成 Flight Protocol Payload:

M1:{"id":"./components/ThemeProvider.jsx","chunks":["ThemeProvider"],"name":"default"}
M2:{"id":"./components/LoginButton.jsx","chunks":["LoginButton"],"name":"default"}
M3:{"id":"./components/Counter.jsx","chunks":["Counter"],"name":"default"}
J0:["$","html",null,{
  "children":["$","body",null,{
    "children":["$","@1",null,{
      "children":[
        ["$","header",null,{
          "children":[
            ["$","h1",null,{"children":"My App"}],
            ["$","@2",null,{}]
          ]
        }],
        ["$","div",null,{
          "children":[
            ["$","h1",null,{"children":"Welcome to Home Page"}],
            ["$","@3",null,{}]
          ]
        }]
      ]
    }]
  }]
}]

解释:
- M1, M2, M3: Module Reference chunks (Client Component 引用)
- J0: JSON chunk (React 元素树结构)
- @1, @2, @3: 指针，指向 M1, M2, M3
- ["$", ...]: React 元素的序列化格式

5. 生成 HTML 响应:

<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Mini Next.js App Router</title>
  </head>
  <body>
    <div id="__next"></div>

    <!-- ⭐ Flight Payload 嵌入到 HTML -->
    <script id="__FLIGHT_DATA__" type="application/json">
      {
        "flight": "M1:{...}\nM2:{...}\nM3:{...}\nJ0:[...]",
        "pathname": "/"
      }
    </script>

    <!-- ⭐ Client Component 模块列表 -->
    <script>
      window.__CLIENT_MODULES__ = [
        "ThemeProvider",
        "LoginButton",
        "Counter"
      ];
    </script>

    <!-- ⭐ 客户端入口脚本 -->
    <script type="module" src="/client.js"></script>
  </body>
</html>

6. 返回 HTML 给浏览器
```

### 浏览器执行流程

```
1. 浏览器接收 HTML (假设耗时 100ms)

2. 解析 HTML (10ms)
   ├─ 创建 DOM: <div id="__next"></div>
   ├─ 读取 <script id="__FLIGHT_DATA__">
   │  └─ Flight Payload 已经在内存中 ✅
   └─ 遇到 <script type="module" src="/client.js">
      └─ 发起请求

3. 加载客户端入口 (20ms)

   GET /client.js

   HTTP/1.1 200 OK
   Content-Type: application/javascript

   // client/index.tsx
   import { hydrateRoot } from 'react-dom/client'
   import { FlightDecoder } from './flight-decoder.js'

   // 读取 Flight Payload
   const flightData = JSON.parse(
     document.getElementById('__FLIGHT_DATA__').textContent
   )

   // 创建解码器
   const decoder = new FlightDecoder(clientComponentMap)

   // ⭐ 解码 Flight Protocol
   const tree = decoder.decode(flightData.flight)

   // Hydration
   hydrateRoot(document.getElementById('__next'), tree)

4. ⭐ FlightDecoder 解码过程 (30ms)

   // client/module-map.ts
   // 注：FlightDecoder 现在位于 module-map.ts 中，与模块映射逻辑整合
   class FlightDecoder {
     private moduleMap: ModuleMap

     constructor(moduleMap: ModuleMap = {}) {
       this.moduleMap = moduleMap
     }

     decode(flightString: string) {
       if (!flightString?.trim()) throw new Error('Invalid flight data')

       // 使用局部变量存储状态，避免并发冲突
       const modules = new Map()
       const chunks = new Map()

       const lines = flightString.split('\n')

       for (const line of lines) {
         if (!line.trim()) continue

         const type = line[0]
         if (type === 'M') {
           // Module Reference chunk
           this.parseModuleChunk(line, modules)  // ← 记录模块信息
         } else if (type === 'J') {
           // JSON chunk
           this.parseJSONChunk(line, chunks)
         }
       }

       // 解析完成后，递归构建 React 树
       return this.resolveChunk('J0', modules, chunks)
     }

     private parseModuleChunk(line: string, modules: Map<string, any>) {
       // M1:{"id":"./components/ThemeProvider.jsx",...}
       const colonIndex = line.indexOf(':')
       const id = line.substring(1, colonIndex)
       const dataStr = line.substring(colonIndex + 1)

       try {
         modules.set(`M${id}`, {
           type: 'module',
           info: JSON.parse(dataStr)
         })
       } catch (error) {
         console.error('Failed to parse module chunk:', error)
       }
     }

     private resolveChunk(chunkId: string, modules: Map<string, any>, chunks: Map<string, any>): any {
       const chunk = chunks.get(chunkId)

       if (chunk) {
         if (chunk.type === 'json') return this.resolveValue(chunk.data, modules, chunks)
         if (chunk.type === 'error') throw new Error(chunk.data.message)
       }

       const module = modules.get(chunkId)
       if (module) {
         // ⭐ 这里触发组件加载！
         return this.loadClientComponent(module.info)
       }

       return null
     }

     private loadClientComponent({ id, name }: { id: string; name: string }) {
       const loader = this.moduleMap[id]

       if (!loader) {
         return () => React.createElement('div', {}, `[Missing: ${id}]`)
       }

       // ⭐ 关键：React.lazy + 动态 import
       return React.lazy(async () => {
         const module = await loader()
         const Component = module[name] || module.default

         if (!Component) {
           throw new Error(`Export "${name}" not found in ${id}`)
         }

         return { default: Component }
       })
     }

     private resolveElement([marker, type, key, props]: any[], modules: Map<string, any>, chunks: Map<string, any>) {
       const resolvedProps = this.resolveValue(props, modules, chunks) || {}

       // 如果 type 是 "@1"、"@2" 等，表示 Client Component
       if (typeof type === 'string' && type.startsWith('@')) {
         const moduleId = type.replace('@', 'M')
         const Component = this.resolveChunk(moduleId, modules, chunks)

         return React.createElement(Component, { ...resolvedProps, key })
       }

       // 普通 HTML 元素 "div", "h1" 等
       if (typeof type === 'string') {
         return React.createElement(type, { ...resolvedProps, key })
       }

       return null
     }
   }

   // 导出共享的 FlightDecoder 实例
   export const flightDecoder = new FlightDecoder(moduleMap)

5. ⭐ 动态 import 触发网络请求 (40ms - 并行)

   当 FlightDecoder 解析到 @1, @2, @3 时，会触发:

   await import('./components/ThemeProvider.jsx')
   await import('./components/LoginButton.jsx')
   await import('./components/Counter.jsx')

   浏览器并行发起请求:

   GET /components/ThemeProvider.jsx
   GET /components/LoginButton.jsx
   GET /components/Counter.jsx

   ✅ 并行请求，不是串行！

6. 服务器响应组件代码 (150ms)

   HTTP/1.1 200 OK
   Content-Type: application/javascript

   // ThemeProvider.jsx (经过 Vite 编译)
   import { useState, createContext } from 'react'

   export const ThemeContext = createContext()

   export default function ThemeProvider({ children }) {
     const [theme, setTheme] = useState('light')

     return (
       React.createElement(ThemeContext.Provider,
         { value: { theme } },
         React.createElement('div', { className: theme }, children)
       )
     )
   }

7. React.lazy 加载完成，Hydration 开始 (160ms)

   所有 Client Components 加载完成后:

   hydrateRoot(rootElement, tree)

   React 执行:
   ├─ ThemeProvider: useState('light') → 激活状态
   ├─ LoginButton: useState(false) → 激活状态
   ├─ Counter: useState(0) → 激活状态
   └─ 绑定事件监听器 (onClick 等)

8. ✅ Hydration 完成，页面可交互 (170ms)
```

### 网络请求时间线

```
时间轴（从浏览器发起请求开始）:

0ms     ┬─ 用户访问 /
        │
100ms   ├─ 收到 HTML
        │  ├─ <div id="__next"></div>
        │  ├─ <script id="__FLIGHT_DATA__"> (已包含)
        │  └─ <script src="/client.js">
        │
110ms   ├─ 解析 HTML
        │
120ms   ├─ 请求: GET /client.js
        │
140ms   ├─ 收到 client.js
        │  └─ 执行: FlightDecoder.decode()
        │
150ms   ├─ FlightDecoder 解析 Flight Payload
        │  └─ 发现 3 个 Client Components
        │
160ms   ├─ ⭐ 并行请求（同时发起）:
        │  ├─ GET /components/ThemeProvider.jsx
        │  ├─ GET /components/LoginButton.jsx
        │  └─ GET /components/Counter.jsx
        │
310ms   ├─ ⭐ 3 个组件代码下载完成
        │
320ms   ├─ React.lazy 加载完成
        │
330ms   ├─ ⭐ hydrateRoot() 开始
        │  ├─ ThemeProvider: useState('light')
        │  ├─ LoginButton: useState(false)
        │  ├─ Counter: useState(0)
        │  └─ 绑定事件监听器
        │
340ms   └─ ✅ Hydration 完成
               ✅ 页面可交互
               ✅ 按钮可点击
```

### 关键要点

1. **并行加载**：所有 Client Components 同时请求，不是串行
2. **Flight Payload 已在 HTML 中**：无需额外请求
3. **React.lazy + Suspense**：自动处理加载状态
4. **首屏性能关键**：Client Component 数量直接影响加载时间

### 优化建议

```javascript
// ❌ 不好：首页加载大量 Client Components
export default function HomePage() {
  return (
    <div>
      <HeavyChart />      {/* 100 KB */}
      <RichTextEditor />  {/* 200 KB */}
      <VideoPlayer />     {/* 150 KB */}
      <Analytics />       {/* 80 KB */}
    </div>
  )
}
// 首屏需要下载 530 KB，慢！

// ✅ 好：按需加载
export default function HomePage() {
  return (
    <div>
      <h1>Welcome</h1>
      {/* 只加载必要的交互组件 */}
      <LoginButton />  {/* 10 KB */}
    </div>
  )
}
// 首屏只需 10 KB，快！
```

---

## 时机 2: 客户端导航

### 场景描述

用户在应用内点击链接，从一个页面导航到另一个页面（例如从 `/` 到 `/about`）

### 示例代码

```javascript
// app/page.tsx (首页)
import Link from 'next/link'
import Counter from '@/components/Counter'

export default function HomePage() {
  return (
    <div>
      <h1>Home Page</h1>
      <Counter />  {/* ← Client Component，已在时机1加载 */}
      <Link href="/about">Go to About</Link>
    </div>
  )
}

// app/about/page.tsx (关于页)
import Chart from '@/components/Chart'

export default function AboutPage() {
  return (
    <div>
      <h1>About Page</h1>
      <Chart />  {/* ← Client Component，首页没用过，需要新加载 */}
    </div>
  )
}

// components/Chart.jsx
'use client'

import { useEffect, useRef } from 'react'

export default function Chart() {
  const canvasRef = useRef(null)

  useEffect(() => {
    // 渲染图表逻辑
    const ctx = canvasRef.current.getContext('2d')
    // ... 绘制图表
  }, [])

  return <canvas ref={canvasRef} />
}
```

### 客户端导航流程

```
1. 用户在首页，点击 <Link href="/about">

2. Next.js Router 拦截点击事件

   // 内部实现（简化）
   <a href="/about" onClick={(e) => {
     e.preventDefault()  // 阻止默认跳转
     router.push('/about')  // 使用客户端导航
   }}>

3. ⭐ Router 发起 RSC 请求

   GET /about?_rsc=1

   请求头:
   Accept: text/x-component
   RSC: 1  ← 标识这是 RSC 请求

   查询参数:
   ?_rsc=1  ← 告诉服务器返回 Flight Payload，不要返回 HTML

4. 服务器处理 RSC 请求

   // server/index.ts
   app.get('*', async (req, res) => {
     const isRSCRequest = req.query._rsc === '1'

     if (isRSCRequest) {
       // ✅ 只返回 Flight Payload
       const { flight, clientModules } = await renderRSC(routePath, {}, clientComponentMap)

       res.setHeader('Content-Type', 'text/x-component')
       res.send(flight)
       return
     }

     // ❌ 非 RSC 请求，返回完整 HTML
     // ...
   })

5. 服务器执行 AboutPage

   ├─ 执行 AboutPage (Server Component)
   │  ├─ 渲染 <div>, <h1> 等
   │  ├─ 遇到 <Chart>
   │  │  └─ 检测到 'use client' → 标记为 Client Component
   │  │  └─ 记录 Module Reference: M4
   │  └─ 返回渲染结果
   │
   └─ 生成 Flight Payload (只包含新页面内容):

M4:{"id":"./components/Chart.jsx","chunks":["Chart"],"name":"default"}
J0:["$","div",null,{
  "children":[
    ["$","h1",null,{"children":"About Page"}],
    ["$","@4",null,{}]
  ]
}]

注意:
- ✅ 只包含 About 页面的内容
- ✅ 不包含 Layout (已经在客户端了)
- ✅ M4 是新的 Client Component (Chart)

6. 服务器返回 Flight Payload

   HTTP/1.1 200 OK
   Content-Type: text/x-component

   M4:{"id":"./components/Chart.jsx","chunks":["Chart"],"name":"default"}
   J0:["$","div",null,{"children":[...]}]

7. ⭐ 客户端接收并解码 Flight Payload

   // Next.js Router 内部逻辑
   const response = await fetch('/about?_rsc=1')
   const flightText = await response.text()

   // FlightDecoder 解码
   const decoder = new FlightDecoder(clientComponentMap)
   const newTree = decoder.decode(flightText)

8. ⭐ FlightDecoder 检测到新的 Client Component

   // client/module-map.ts
   // 注：由于使用局部变量，组件加载通过 moduleMap 查找 loader
   private loadClientComponent({ id, name }: { id: string; name: string }) {
     const loader = this.moduleMap[id]

     if (!loader) {
       return () => React.createElement('div', {}, `[Missing: ${id}]`)
     }

     // 使用 React.lazy 动态导入
     const component = React.lazy(async () => {
       const module = await loader()  // ← 触发请求
       const Component = module[name] || module.default

       if (!Component) {
         throw new Error(`Export "${name}" not found in ${id}`)
       }

       return { default: Component }
     })

     return component
   }

9. ⭐ 浏览器请求新组件

   GET /components/Chart.jsx

   ✅ 只请求 Chart.jsx
   ❌ 不请求已加载的 ThemeProvider, LoginButton, Counter

10. 服务器返回 Chart 组件代码

   HTTP/1.1 200 OK
   Content-Type: application/javascript

   import { useEffect, useRef } from 'react'

   export default function Chart() {
     // 组件代码...
   }

11. React 更新页面

   React 组件树变化:

   RootLayout (保持不变)
   └─ ThemeProvider (保持不变, ✅ state 保留)
      ├─ Header (保持不变)
      │  └─ LoginButton (保持不变)
      └─ main
         ├─ HomePage ❌ 卸载
         └─ AboutPage ✅ 新挂载
            └─ Chart ✅ 加载并挂载

12. ✅ 导航完成
```

### 网络请求时间线

```
时间轴（从点击链接开始）:

0ms     ┬─ 用户点击 <Link href="/about">
        │
10ms    ├─ Router 拦截，阻止默认跳转
        │
20ms    ├─ ⭐ 请求: GET /about?_rsc=1
        │
120ms   ├─ 收到 Flight Payload
        │  ├─ M4:{"id":"./components/Chart.jsx",...}
        │  └─ J0:[...]
        │
130ms   ├─ FlightDecoder 解码
        │  └─ 发现新组件 M4 (Chart)
        │
140ms   ├─ ⭐ 请求: GET /components/Chart.jsx
        │     (仅请求新组件！)
        │
240ms   ├─ Chart.jsx 下载完成
        │
250ms   ├─ React 更新页面
        │  ├─ HomePage → 卸载
        │  ├─ AboutPage → 挂载
        │  └─ Chart → 挂载
        │
260ms   └─ ✅ 导航完成
               ✅ 页面更新
               ✅ Chart 渲染
```

### 与 SSR 对比

**SSR 初次加载**:
```
GET /                           ← 1 个请求 (HTML)
GET /client.js                  ← 1 个请求
GET /components/ThemeProvider.jsx   ← 3 个请求 (并行)
GET /components/LoginButton.jsx
GET /components/Counter.jsx

总计: 5 个请求
总时间: ~340ms
```

**客户端导航**:
```
GET /about?_rsc=1               ← 1 个请求 (Flight Payload)
GET /components/Chart.jsx       ← 1 个请求 (仅新组件)

总计: 2 个请求
总时间: ~260ms (快 23%)

✅ 不重新请求 HTML
✅ 不重新请求已加载的组件
✅ Layout 状态保持
```

### 关键要点

1. **Flight Protocol 替代完整 HTML**：`?_rsc=1` 请求只返回页面内容
2. **智能组件缓存**：已加载的组件不会重复请求
3. **状态保持**：ThemeProvider 的状态不会丢失
4. **更快的导航**：减少了大量不必要的请求

### 实际对比示例

```javascript
// 首页已加载的组件
loadedModules = {
  'M1': ThemeProvider,
  'M2': LoginButton,
  'M3': Counter
}

// 导航到 /about 后，Flight Payload 包含:
M4:{"id":"./components/Chart.jsx",...}

// FlightDecoder 检查:
'M4' in loadedModules → false  ← 需要加载
'M1' in loadedModules → true   ← 跳过
'M2' in loadedModules → true   ← 跳过
'M3' in loadedModules → true   ← 跳过

// 结果：只请求 Chart.jsx ✅
```

---

## 时机 3: Link 预加载

### 场景描述

当 `<Link>` 组件出现在视口内时，Next.js 会自动预加载目标页面的内容，包括 Client Components。

### 示例代码

```javascript
// app/page.tsx
import Link from 'next/link'

export default function HomePage() {
  return (
    <div>
      <h1>Home Page</h1>

      {/* ⭐ 这个 Link 会被预加载 */}
      <Link href="/about">
        About
      </Link>

      {/* ⭐ prefetch={false} 禁用预加载 */}
      <Link href="/contact" prefetch={false}>
        Contact
      </Link>

      {/* ⭐ 页面底部的 Link，暂时不预加载 */}
      <div style={{ marginTop: '2000px' }}>
        <Link href="/settings">
          Settings (在视口外)
        </Link>
      </div>
    </div>
  )
}
```

### 预加载流程

```
1. Link 组件渲染

   // Next.js Link 内部实现（简化）
   function Link({ href, prefetch = true, children }) {
     const ref = useRef(null)
     const router = useRouter()

     useEffect(() => {
       if (!prefetch) return

       // ⭐ 使用 Intersection Observer 检测可见性
       const observer = new IntersectionObserver((entries) => {
         entries.forEach(entry => {
           if (entry.isIntersecting) {
             // Link 进入视口
             router.prefetch(href)  // ← 触发预加载
             observer.unobserve(entry.target)
           }
         })
       }, {
         rootMargin: '200px'  // 提前 200px 开始预加载
       })

       observer.observe(ref.current)

       return () => observer.disconnect()
     }, [href, prefetch])

     return (
       <a ref={ref} href={href} onClick={(e) => {
         e.preventDefault()
         router.push(href)
       }}>
         {children}
       </a>
     )
   }

2. ⭐ router.prefetch() 执行

   // Router 内部实现（简化）
   prefetch(href) {
     // 检查缓存
     if (this.prefetchCache.has(href)) {
       return  // 已预加载，跳过
     }

     // ⭐ 发起低优先级请求
     fetch(href + '?_rsc=1', {
       priority: 'low',  // 低优先级，不影响当前页面
       credentials: 'same-origin'
     })
     .then(res => res.text())
     .then(flight => {
       // 解码 Flight Payload
       const decoder = new FlightDecoder(this.clientComponentMap)
       const tree = decoder.decode(flight)

       // ⭐ 缓存结果
       this.prefetchCache.set(href, {
         tree,
         timestamp: Date.now()
       })
     })
   }

3. 服务器处理预加载请求

   GET /about?_rsc=1

   // 与正常导航请求完全相同
   ├─ 执行 AboutPage (Server Component)
   ├─ 识别 Client Components
   └─ 返回 Flight Payload:

M4:{"id":"./components/Chart.jsx","chunks":["Chart"],"name":"default"}
J0:[...]

4. ⭐ FlightDecoder 解码并加载组件

   // client/module-map.ts
   decode(flight) {
     // 使用局部变量存储状态
     const modules = new Map()
     const chunks = new Map()

     // 解析 Flight Payload
     // ...

     // 遇到 M4 (Chart) - 通过 moduleMap 查找 loader
     const loader = this.moduleMap['./components/Chart.jsx']

     // ⭐ 触发动态导入
     const component = React.lazy(async () => {
       const module = await loader()
       return { default: module.default }
     })
   }

5. ⭐ 浏览器预加载组件代码

   GET /components/Chart.jsx

   请求优先级: low  ← 后台加载，不影响当前页面

6. 缓存到内存

   Router Cache:
   ├─ '/about' → { tree, clientModules: [Chart], timestamp }
   └─ loadedModules: { M1, M2, M3, M4 }  ← Chart 已加载！

7. 用户真正点击时

   用户点击 <Link href="/about">
   ├─ Router 检查缓存: prefetchCache.has('/about') → true ✅
   ├─ 从缓存读取 tree
   ├─ 所有组件已加载完成
   └─ ✅ 瞬间渲染 (< 50ms)
```

### 预加载时间线

```
// 预加载阶段（后台，用户无感知）

0ms     ┬─ Link 进入视口
        │
100ms   ├─ Intersection Observer 触发
        │
110ms   ├─ ⭐ 请求: GET /about?_rsc=1
        │     Priority: low (低优先级)
        │
300ms   ├─ 收到 Flight Payload
        │  └─ M4:{"id":"./components/Chart.jsx",...}
        │
310ms   ├─ FlightDecoder 解码
        │  └─ 发现 Chart 组件
        │
320ms   ├─ ⭐ 请求: GET /components/Chart.jsx
        │     Priority: low (低优先级)
        │
500ms   ├─ Chart.jsx 下载完成
        │
510ms   └─ ✅ 缓存到 Router Cache
               ✅ Chart 组件已加载
               ✅ 等待用户点击

─────────────────────────────────────────

// 用户点击阶段（瞬间）

0ms     ┬─ 用户点击 Link
        │
10ms    ├─ Router 检查缓存
        │  └─ prefetchCache.has('/about') → true ✅
        │
20ms    ├─ 从缓存读取 tree 和组件
        │
30ms    ├─ React 更新页面
        │
40ms    └─ ✅ 导航完成 (超快！)
```

### 预加载策略对比

| 配置 | 行为 | 适用场景 |
|------|------|----------|
| `<Link href="/about">` | 默认预加载 | 高频访问的页面 |
| `<Link href="/contact" prefetch={false}>` | 不预加载 | 低频访问的页面 |
| `<Link href="/admin" prefetch={true}>` | 强制预加载 | 必定会访问的页面 |

### 优化建议

```javascript
// ❌ 不好：所有 Link 都预加载
export default function HomePage() {
  return (
    <div>
      {/* 100 个链接，全部预加载 */}
      {links.map(link => (
        <Link key={link.id} href={link.href}>
          {link.title}
        </Link>
      ))}
    </div>
  )
}
// 问题：预加载 100 个页面的 Client Components，浪费带宽

// ✅ 好：选择性预加载
export default function HomePage() {
  return (
    <div>
      {/* 重要页面：预加载 */}
      <Link href="/about">About</Link>
      <Link href="/products">Products</Link>

      {/* 次要页面：禁用预加载 */}
      {links.map(link => (
        <Link key={link.id} href={link.href} prefetch={false}>
          {link.title}
        </Link>
      ))}
    </div>
  )
}
```

### 预加载缓存管理

```javascript
// Router 缓存有过期时间
const CACHE_TTL = 30 * 1000  // 30 秒

router.prefetch(href) {
  const cached = this.prefetchCache.get(href)

  // 检查缓存是否过期
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return  // 使用缓存
  }

  // 缓存过期或不存在，重新预加载
  // ...
}
```

### 实际效果对比

**不预加载**:
```
用户点击 Link
├─ 0ms: 发起请求
├─ 120ms: 收到 Flight Payload
├─ 140ms: 请求 Chart.jsx
├─ 260ms: Chart.jsx 下载完成
└─ 270ms: ✅ 导航完成

总耗时: 270ms
```

**预加载**:
```
用户点击 Link
├─ 0ms: 检查缓存 ✅
├─ 10ms: 从缓存读取
├─ 20ms: React 更新
└─ 30ms: ✅ 导航完成

总耗时: 30ms (提升 89%)
```

---

## 时机 4: 动态导入

### 场景描述

使用 JavaScript 的 `import()` 语法在运行时动态加载组件，通常用于按需加载大型组件。

### 示例代码

```javascript
// app/page.tsx
'use client'

import { useState } from 'react'

export default function HomePage() {
  const [showModal, setShowModal] = useState(false)
  const [ModalComponent, setModalComponent] = useState(null)

  const handleOpenModal = async () => {
    // ⭐ 点击时才加载 Modal 组件
    const { default: Modal } = await import('@/components/Modal')
    setModalComponent(() => Modal)
    setShowModal(true)
  }

  return (
    <div>
      <h1>Home Page</h1>
      <button onClick={handleOpenModal}>
        Open Modal
      </button>

      {showModal && ModalComponent && (
        <ModalComponent onClose={() => setShowModal(false)} />
      )}
    </div>
  )
}

// components/Modal.jsx
'use client'

export default function Modal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content">
        <h2>This is a Modal</h2>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  )
}
```

### 动态导入流程

```
1. 页面初次加载

   GET /
   └─ 返回 HTML

   GET /client.js

   GET /app/page.tsx  ← HomePage 组件

   ✅ 不加载 Modal.jsx

   loadedModules:
   ├─ ThemeProvider ✅
   ├─ HomePage ✅
   └─ Modal ❌ (未加载)

2. 用户点击"Open Modal"按钮

   onClick → handleOpenModal()

3. ⭐ 执行 dynamic import

   const { default: Modal } = await import('@/components/Modal')

   JavaScript 引擎执行:
   ├─ 检查模块缓存
   │  └─ '@/components/Modal' in cache? → false
   ├─ ⭐ 发起 HTTP 请求
   │  └─ GET /components/Modal.jsx
   └─ 等待响应

4. 浏览器请求 Modal 组件

   GET /components/Modal.jsx

   请求优先级: high  ← 用户操作触发，高优先级

5. 服务器返回 Modal 代码

   HTTP/1.1 200 OK
   Content-Type: application/javascript
   Cache-Control: public, max-age=31536000  ← 缓存 1 年

   'use client'

   export default function Modal({ onClose }) {
     // 组件代码...
   }

6. JavaScript 引擎加载模块

   ├─ 解析 Modal.jsx 代码
   ├─ 执行模块
   ├─ 返回 { default: Modal }
   └─ 缓存到模块系统

7. React 状态更新

   setModalComponent(() => Modal)
   setShowModal(true)

8. React 重新渲染

   HomePage:
   ├─ showModal = true ✅
   ├─ ModalComponent = Modal ✅
   └─ 渲染 <Modal onClose={...} />

9. ✅ Modal 显示
```

### 时间线

```
时间轴（从点击按钮开始）:

0ms     ┬─ 用户点击"Open Modal"
        │
10ms    ├─ onClick → handleOpenModal()
        │
20ms    ├─ ⭐ 执行: import('@/components/Modal')
        │
30ms    ├─ ⭐ 请求: GET /components/Modal.jsx
        │
150ms   ├─ Modal.jsx 下载完成
        │
160ms   ├─ JavaScript 解析模块
        │
170ms   ├─ setModalComponent(Modal)
        │  └─ React 重新渲染
        │
180ms   └─ ✅ Modal 显示

总耗时: 180ms
```

### 与静态导入对比

**静态导入**:
```javascript
// ❌ 静态导入：Modal 在首次加载时就下载
import Modal from '@/components/Modal'

export default function HomePage() {
  const [showModal, setShowModal] = useState(false)

  return (
    <div>
      <button onClick={() => setShowModal(true)}>
        Open Modal
      </button>
      {showModal && <Modal />}
    </div>
  )
}

初次加载:
GET /app/page.tsx        ← 15 KB
GET /components/Modal.jsx ← 80 KB  ← 即使不使用也要下载
总计: 95 KB
```

**动态导入**:
```javascript
// ✅ 动态导入：Modal 只在需要时下载
export default function HomePage() {
  const [ModalComponent, setModalComponent] = useState(null)

  const handleOpenModal = async () => {
    const { default: Modal } = await import('@/components/Modal')
    setModalComponent(() => Modal)
  }

  return (
    <div>
      <button onClick={handleOpenModal}>
        Open Modal
      </button>
      {ModalComponent && <ModalComponent />}
    </div>
  )
}

初次加载:
GET /app/page.tsx        ← 15 KB
总计: 15 KB (减少 84%)

点击按钮时:
GET /components/Modal.jsx ← 80 KB  ← 按需加载
```

### 常见使用场景

#### 1. 大型编辑器组件

```javascript
// ❌ 不好：首次加载 500 KB 编辑器
import RichTextEditor from '@/components/RichTextEditor'  // 500 KB

export default function PostEditor() {
  return <RichTextEditor />
}

// ✅ 好：按需加载
export default function PostEditor() {
  const [Editor, setEditor] = useState(null)

  useEffect(() => {
    import('@/components/RichTextEditor').then(mod => {
      setEditor(() => mod.default)
    })
  }, [])

  if (!Editor) return <div>Loading editor...</div>

  return <Editor />
}
```

#### 2. 条件渲染组件

```javascript
// 根据用户权限加载不同组件
export default function Dashboard() {
  const [DashboardComponent, setDashboardComponent] = useState(null)
  const { user } = useAuth()

  useEffect(() => {
    if (user.role === 'admin') {
      import('@/components/AdminDashboard').then(mod => {
        setDashboardComponent(() => mod.default)
      })
    } else {
      import('@/components/UserDashboard').then(mod => {
        setDashboardComponent(() => mod.default)
      })
    }
  }, [user.role])

  if (!DashboardComponent) return <Loading />

  return <DashboardComponent />
}
```

#### 3. 路由级代码分割

```javascript
// 根据路由动态加载页面组件
export default function App() {
  const [page, setPage] = useState('home')
  const [PageComponent, setPageComponent] = useState(null)

  useEffect(() => {
    switch (page) {
      case 'home':
        import('@/pages/Home').then(mod => setPageComponent(() => mod.default))
        break
      case 'about':
        import('@/pages/About').then(mod => setPageComponent(() => mod.default))
        break
      case 'contact':
        import('@/pages/Contact').then(mod => setPageComponent(() => mod.default))
        break
    }
  }, [page])

  if (!PageComponent) return <Loading />

  return <PageComponent />
}
```

### 缓存机制

```javascript
// 动态导入的模块会被浏览器缓存

// 第 1 次调用
const { default: Modal } = await import('@/components/Modal')
// → 发起网络请求，下载 Modal.jsx

// 第 2 次调用（同一页面会话）
const { default: Modal } = await import('@/components/Modal')
// → 从内存缓存读取，无网络请求 ✅

// 刷新页面后
const { default: Modal } = await import('@/components/Modal')
// → 从浏览器 HTTP 缓存读取 (Cache-Control)
// → 无网络请求或 304 Not Modified ✅
```

### 优化建议

```javascript
// ⭐ 使用 React.lazy + Suspense (推荐)
import { lazy, Suspense } from 'react'

const Modal = lazy(() => import('@/components/Modal'))

export default function HomePage() {
  const [showModal, setShowModal] = useState(false)

  return (
    <div>
      <button onClick={() => setShowModal(true)}>
        Open Modal
      </button>

      {showModal && (
        <Suspense fallback={<div>Loading...</div>}>
          <Modal onClose={() => setShowModal(false)} />
        </Suspense>
      )}
    </div>
  )
}

优势:
✅ 自动处理加载状态 (fallback)
✅ 错误边界支持
✅ 代码更简洁
```

---

## 时机 5: React.lazy 懒加载

### 场景描述

使用 `React.lazy` 创建懒加载组件，配合 `Suspense` 处理加载状态。

### 示例代码

```javascript
// app/page.tsx
'use client'

import { lazy, Suspense, useState } from 'react'

// ⭐ React.lazy 包裹动态导入
const HeavyChart = lazy(() => import('@/components/HeavyChart'))
const VideoPlayer = lazy(() => import('@/components/VideoPlayer'))

export default function HomePage() {
  const [showChart, setShowChart] = useState(false)
  const [showVideo, setShowVideo] = useState(false)

  return (
    <div>
      <h1>Home Page</h1>

      {/* 按钮：显示图表 */}
      <button onClick={() => setShowChart(true)}>
        Show Chart
      </button>

      {/* ⭐ Suspense 包裹懒加载组件 */}
      {showChart && (
        <Suspense fallback={<div>Loading chart...</div>}>
          <HeavyChart />
        </Suspense>
      )}

      {/* 按钮：显示视频 */}
      <button onClick={() => setShowVideo(true)}>
        Show Video
      </button>

      {showVideo && (
        <Suspense fallback={<div>Loading video player...</div>}>
          <VideoPlayer src="/video.mp4" />
        </Suspense>
      )}
    </div>
  )
}

// components/HeavyChart.jsx
'use client'

import { useEffect, useRef } from 'react'
import * as d3 from 'd3'  // 假设这是一个大型库

export default function HeavyChart() {
  const svgRef = useRef(null)

  useEffect(() => {
    // 使用 D3.js 渲染图表
    const svg = d3.select(svgRef.current)
    // ... 复杂的图表逻辑
  }, [])

  return <svg ref={svgRef} width={600} height={400} />
}

// components/VideoPlayer.jsx
'use client'

export default function VideoPlayer({ src }) {
  return (
    <video controls width={800}>
      <source src={src} type="video/mp4" />
    </video>
  )
}
```

### React.lazy 工作原理

```javascript
// React.lazy 的内部实现（简化）
function lazy(loader) {
  return {
    $$typeof: REACT_LAZY_TYPE,
    _payload: {
      _status: 'pending',  // pending | resolved | rejected
      _result: null
    },
    _init: function(payload) {
      if (payload._status === 'pending') {
        // ⭐ 调用 loader 函数（即 () => import(...)）
        const modulePromise = loader()

        payload._status = 'loading'

        modulePromise.then(
          module => {
            payload._status = 'resolved'
            payload._result = module.default  // 组件
          },
          error => {
            payload._status = 'rejected'
            payload._result = error
          }
        )
      }

      if (payload._status === 'resolved') {
        return payload._result  // 返回组件
      }

      throw modulePromise  // 抛出 Promise，Suspense 捕获
    }
  }
}

// React 渲染懒加载组件时
function renderLazyComponent(lazyComponent, props) {
  const payload = lazyComponent._payload
  const init = lazyComponent._init

  try {
    const Component = init(payload)
    return <Component {...props} />
  } catch (promiseOrError) {
    if (promiseOrError instanceof Promise) {
      // ⭐ 抛出 Promise，Suspense 捕获
      throw promiseOrError  // Suspense 显示 fallback
    } else {
      // 错误
      throw promiseOrError
    }
  }
}
```

### 加载流程

```
1. 页面初次渲染

   React 渲染 HomePage:
   ├─ showChart = false
   ├─ showVideo = false
   └─ 不渲染 HeavyChart 和 VideoPlayer

   ✅ 不加载 HeavyChart.jsx 和 VideoPlayer.jsx

2. 用户点击"Show Chart"按钮

   onClick → setShowChart(true)

3. React 重新渲染

   HomePage:
   ├─ showChart = true ✅
   └─ 渲染 <Suspense fallback={...}>
      └─ 尝试渲染 <HeavyChart />

4. ⭐ React 尝试渲染 lazy component

   renderLazyComponent(HeavyChart, props):
   ├─ 调用 _init(payload)
   ├─ payload._status = 'pending'
   ├─ 调用 loader: () => import('@/components/HeavyChart')
   │  └─ ⭐ 发起网络请求
   └─ 抛出 Promise ← Suspense 捕获

5. ⭐ Suspense 捕获 Promise

   <Suspense fallback={<div>Loading chart...</div>}>
   ├─ 捕获到 Promise
   ├─ 显示 fallback: "Loading chart..."
   └─ 等待 Promise 完成

6. 浏览器请求组件

   GET /components/HeavyChart.jsx

   请求优先级: high

7. 服务器返回组件代码

   HTTP/1.1 200 OK

   'use client'
   import * as d3 from 'd3'  // 假设 200 KB
   export default function HeavyChart() { ... }

8. ⭐ Promise 完成

   modulePromise.then(module => {
     payload._status = 'resolved'
     payload._result = module.default  // HeavyChart 组件
   })

9. ⭐ React 重新渲染

   Suspense 检测到 Promise 完成:
   ├─ 移除 fallback
   ├─ 重新渲染 children
   └─ <HeavyChart /> ✅ 成功渲染

10. ✅ 图表显示
```

### 时间线

```
时间轴（从点击按钮开始）:

0ms     ┬─ 用户点击"Show Chart"
        │
10ms    ├─ setShowChart(true)
        │  └─ React 重新渲染
        │
20ms    ├─ 尝试渲染 <HeavyChart />
        │  ├─ React.lazy 抛出 Promise
        │  └─ ⭐ Suspense 显示 fallback
        │     "Loading chart..."
        │
30ms    ├─ ⭐ 请求: GET /components/HeavyChart.jsx
        │
230ms   ├─ HeavyChart.jsx 下载完成 (200 KB)
        │  └─ Promise 完成
        │
240ms   ├─ ⭐ React 检测到 Promise 完成
        │  └─ 重新渲染
        │
250ms   ├─ 移除 fallback
        │  └─ 渲染 <HeavyChart />
        │
260ms   └─ ✅ 图表显示

总耗时: 260ms
用户体验: 看到 "Loading chart..." 提示 (230ms)
```

### 并发加载示例

```javascript
// 同时点击"Show Chart"和"Show Video"
export default function HomePage() {
  const [showChart, setShowChart] = useState(false)
  const [showVideo, setShowVideo] = useState(false)

  const handleShowBoth = () => {
    setShowChart(true)
    setShowVideo(true)
  }

  return (
    <div>
      <button onClick={handleShowBoth}>
        Show Both
      </button>

      {showChart && (
        <Suspense fallback={<div>Loading chart...</div>}>
          <HeavyChart />
        </Suspense>
      )}

      {showVideo && (
        <Suspense fallback={<div>Loading video...</div>}>
          <VideoPlayer />
        </Suspense>
      )}
    </div>
  )
}

并发请求:
GET /components/HeavyChart.jsx    ← 同时发起
GET /components/VideoPlayer.jsx   ← 同时发起

✅ 并行下载，不是串行
```

### 错误处理

```javascript
// 使用 Error Boundary 捕获加载错误
import { Component, lazy, Suspense } from 'react'

class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Lazy loading failed:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return <div>Failed to load component. Please try again.</div>
    }

    return this.props.children
  }
}

const HeavyChart = lazy(() => import('@/components/HeavyChart'))

export default function HomePage() {
  const [showChart, setShowChart] = useState(false)

  return (
    <div>
      <button onClick={() => setShowChart(true)}>
        Show Chart
      </button>

      {showChart && (
        <ErrorBoundary>
          <Suspense fallback={<div>Loading...</div>}>
            <HeavyChart />
          </Suspense>
        </ErrorBoundary>
      )}
    </div>
  )
}
```

### 与动态导入对比

| 方式 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| **React.lazy** | 自动 Suspense 集成 | 需要包裹 Suspense | 组件级懒加载 |
| **动态导入** | 灵活控制加载时机 | 需要手动处理加载状态 | 复杂加载逻辑 |

### 最佳实践

```javascript
// ⭐ 推荐：路由级懒加载
const HomePage = lazy(() => import('@/pages/Home'))
const AboutPage = lazy(() => import('@/pages/About'))
const ContactPage = lazy(() => import('@/pages/Contact'))

function App() {
  const [page, setPage] = useState('home')

  return (
    <div>
      <nav>
        <button onClick={() => setPage('home')}>Home</button>
        <button onClick={() => setPage('about')}>About</button>
        <button onClick={() => setPage('contact')}>Contact</button>
      </nav>

      <Suspense fallback={<div>Loading page...</div>}>
        {page === 'home' && <HomePage />}
        {page === 'about' && <AboutPage />}
        {page === 'contact' && <ContactPage />}
      </Suspense>
    </div>
  )
}
```

---

## 缓存机制

### 多层缓存架构

```
App Router Client Component 缓存层级:

1. 内存缓存 (FlightDecoder.loadedModules)
   ├─ 生命周期: 当前页面会话
   ├─ 失效: 刷新页面
   └─ 作用: 避免同一页面重复请求

2. Router Cache (prefetchCache)
   ├─ 生命周期: 30 秒 (默认)
   ├─ 失效: 超时或手动清除
   └─ 作用: 预加载缓存

3. 浏览器 HTTP 缓存
   ├─ 生命周期: Cache-Control 指定
   ├─ 失效: 根据响应头
   └─ 作用: 持久化缓存

4. Service Worker 缓存 (可选)
   ├─ 生命周期: 开发者控制
   ├─ 失效: 手动清除
   └─ 作用: 离线支持
```

### 1. 浏览器模块缓存

```javascript
// client/module-map.ts
// 注：当前实现依赖浏览器的原生模块缓存机制

class FlightDecoder {
  private moduleMap: ModuleMap

  constructor(moduleMap: ModuleMap = {}) {
    this.moduleMap = moduleMap
  }

  // decode() 使用局部变量，每次调用都是新的状态
  decode(flightString: string) {
    const modules = new Map()  // 局部变量，仅在当前 decode() 调用中有效
    const chunks = new Map()
    // ...
  }

  private loadClientComponent({ id, name }: { id: string; name: string }) {
    const loader = this.moduleMap[id]

    // 使用 React.lazy + 动态 import
    // 浏览器会缓存已导入的模块
    return React.lazy(async () => {
      const module = await loader()  // ✅ 浏览器模块缓存生效
      const Component = module[name] || module.default
      return { default: Component }
    })
  }
}

// 示例：导航流程（依赖浏览器原生模块缓存）
用户访问 / (首页):
  await loader()  // 第1次：网络请求下载 ThemeProvider
  await loader()  // 第1次：网络请求下载 LoginButton
  await loader()  // 第1次：网络请求下载 Counter

用户导航到 /about:
  await loader()  // ✅ 从浏览器模块缓存读取 ThemeProvider（无网络请求）
  await loader()  // ✅ 从浏览器模块缓存读取 LoginButton（无网络请求）
  await loader()  // ✅ 从浏览器模块缓存读取 Counter（无网络请求）
  await loader()  // ❌ 第1次：网络请求下载 Chart

用户导航回 /:
  await loader()  // ✅ 从浏览器模块缓存读取（无网络请求）

用户刷新页面:
  浏览器模块缓存清空
  重新加载所有组件（但可能从 HTTP 缓存读取）
```

### 2. Router Cache (预加载缓存)

```javascript
// Router 内部缓存实现
class Router {
  constructor() {
    this.prefetchCache = new Map()  // ⭐ 预加载缓存
  }

  prefetch(href) {
    const cached = this.prefetchCache.get(href)
    const now = Date.now()

    // 检查缓存是否有效
    if (cached && (now - cached.timestamp) < 30000) {
      console.log(`✅ Prefetch cache hit: ${href}`)
      return Promise.resolve(cached.tree)
    }

    // 缓存失效或不存在
    console.log(`❌ Prefetch cache miss: ${href}`)
    return fetch(href + '?_rsc=1')
      .then(res => res.text())
      .then(flight => {
        const decoder = new FlightDecoder()
        const tree = decoder.decode(flight)

        // 存入缓存
        this.prefetchCache.set(href, {
          tree,
          timestamp: now
        })

        return tree
      })
  }

  push(href) {
    // 检查预加载缓存
    const cached = this.prefetchCache.get(href)
    const now = Date.now()

    if (cached && (now - cached.timestamp) < 30000) {
      // ✅ 使用缓存，瞬间导航
      console.log(`✅ Using prefetch cache for ${href}`)
      this.render(cached.tree)
      return
    }

    // ❌ 缓存未命中，正常请求
    fetch(href + '?_rsc=1')
      .then(res => res.text())
      .then(flight => {
        const decoder = new FlightDecoder()
        const tree = decoder.decode(flight)
        this.render(tree)
      })
  }
}

// 示例：预加载流程
0s:  Link 可见 → prefetch('/about')
     prefetchCache.set('/about', { tree, timestamp: 0 })

15s: 用户点击 Link
     cached.timestamp = 0
     now = 15000
     (now - cached.timestamp) = 15000 < 30000 ✅
     使用缓存

35s: 用户再次点击 Link
     cached.timestamp = 0
     now = 35000
     (now - cached.timestamp) = 35000 > 30000 ❌
     缓存过期，重新请求
```

### 3. 浏览器 HTTP 缓存

```javascript
// 服务器设置 Cache-Control
app.get('/components/*.jsx', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  res.sendFile(req.path)
})

// Cache-Control 详解:
// - public: 可被任何缓存存储
// - max-age=31536000: 缓存 1 年
// - immutable: 不会改变，无需重新验证

浏览器缓存流程:

第 1 次请求 /components/Chart.jsx:
├─ 发起网络请求
├─ 服务器返回 Chart.jsx
├─ 浏览器存入缓存
│  └─ Key: /components/Chart.jsx
│  └─ Value: Chart.jsx 代码
│  └─ Expiry: 当前时间 + 1 年
└─ ✅ 渲染组件

第 2 次请求 /components/Chart.jsx (同一会话):
├─ 检查内存缓存: loadedModules.has('M4') → true ✅
└─ ✅ 直接返回，无网络请求

第 2 次请求 /components/Chart.jsx (刷新页面后):
├─ 检查内存缓存: 已清空 ❌
├─ 发起网络请求: GET /components/Chart.jsx
├─ 浏览器检查 HTTP 缓存
│  └─ Cache hit ✅
│  └─ 未过期 ✅
├─ ✅ 从磁盘缓存读取 (< 10ms)
└─ ✅ 渲染组件 (无网络请求)

浏览器 DevTools Network 面板显示:
Status: 200 (from disk cache)  ← 从缓存读取
Size: (disk cache)
Time: 5ms
```

### 缓存失效策略

```javascript
// 1. 版本化文件名（推荐）
// vite.config.js
export default {
  build: {
    rollupOptions: {
      output: {
        entryFileNames: '[name].[hash].js',
        chunkFileNames: '[name].[hash].js'
      }
    }
  }
}

生成的文件名:
Chart.a7b3c9d2.jsx  ← 包含 hash

当组件代码改变:
Chart.e4f5a6b7.jsx  ← hash 改变，URL 改变，缓存失效 ✅

// 2. 手动清除 Router Cache
router.clearPrefetchCache()
router.prefetchCache.clear()

// 3. 强制刷新（用户操作）
Ctrl + Shift + R (Windows/Linux)
Cmd + Shift + R (Mac)
→ 忽略所有缓存，重新请求
```

### 缓存命中率分析

```
典型用户访问流程:

1. 首次访问 /
   ├─ 内存缓存: 0% 命中 (空)
   ├─ HTTP 缓存: 0% 命中 (空)
   └─ 网络请求: 5 个 (HTML + client.js + 3 个组件)

2. 导航到 /about
   ├─ 内存缓存: 75% 命中 (3/4 组件)
   ├─ HTTP 缓存: 0% 命中 (Chart 是新组件)
   └─ 网络请求: 2 个 (Flight Payload + Chart.jsx)

3. 导航回 /
   ├─ 内存缓存: 100% 命中 (4/4 组件)
   ├─ HTTP 缓存: 0% 命中
   └─ 网络请求: 1 个 (Flight Payload)

4. 刷新页面 /
   ├─ 内存缓存: 0% 命中 (已清空)
   ├─ HTTP 缓存: 100% 命中 (4/4 组件)
   └─ 网络请求: 2 个 (HTML + Flight Payload)
      ✅ 组件从 HTTP 缓存读取

总体缓存效率:
├─ 减少网络请求: 67% (8 个请求 → 10 个总请求)
├─ 减少下载量: 80% (组件代码复用)
└─ 提升导航速度: 90% (内存缓存瞬间响应)
```

---

## 性能优化建议

### 1. 减少首屏 Client Components

```javascript
// ❌ 不好：首页包含大量 Client Components
export default function HomePage() {
  return (
    <div>
      <AnimatedHero />      {/* 50 KB */}
      <InteractiveMap />    {/* 200 KB */}
      <RichTextEditor />    {/* 300 KB */}
      <DataVisualization /> {/* 150 KB */}
    </div>
  )
}
// 首屏下载: 700 KB，慢！

// ✅ 好：最小化首屏 Client Components
export default function HomePage() {
  return (
    <div>
      <Hero />              {/* Server Component, 0 KB */}
      <SimpleMap />         {/* Server Component, 0 KB */}
      <ContentPreview />    {/* Server Component, 0 KB */}
      <SubscribeButton />   {/* Client Component, 5 KB */}
    </div>
  )
}
// 首屏下载: 5 KB，快！
```

### 2. 使用 React.lazy 延迟加载

```javascript
// ❌ 不好：所有组件立即加载
import Chart from '@/components/Chart'
import VideoPlayer from '@/components/VideoPlayer'

export default function Dashboard() {
  const [tab, setTab] = useState('overview')

  return (
    <div>
      {tab === 'analytics' && <Chart />}
      {tab === 'media' && <VideoPlayer />}
    </div>
  )
}
// 问题：即使用户不切换到 analytics/media 标签，也会下载组件

// ✅ 好：懒加载
import { lazy, Suspense } from 'react'

const Chart = lazy(() => import('@/components/Chart'))
const VideoPlayer = lazy(() => import('@/components/VideoPlayer'))

export default function Dashboard() {
  const [tab, setTab] = useState('overview')

  return (
    <div>
      {tab === 'analytics' && (
        <Suspense fallback={<Loading />}>
          <Chart />
        </Suspense>
      )}
      {tab === 'media' && (
        <Suspense fallback={<Loading />}>
          <VideoPlayer />
        </Suspense>
      )}
    </div>
  )
}
// ✅ 只在切换到对应标签时才下载组件
```

### 3. 选择性预加载

```javascript
// ❌ 不好：预加载所有链接
export default function Navigation() {
  return (
    <nav>
      {/* 100 个链接，全部预加载 */}
      {links.map(link => (
        <Link key={link.id} href={link.href}>
          {link.title}
        </Link>
      ))}
    </nav>
  )
}

// ✅ 好：只预加载重要页面
export default function Navigation() {
  return (
    <nav>
      {/* 高频页面：预加载 */}
      <Link href="/products">Products</Link>
      <Link href="/about">About</Link>

      {/* 低频页面：禁用预加载 */}
      <Link href="/terms" prefetch={false}>Terms</Link>
      <Link href="/privacy" prefetch={false}>Privacy</Link>
    </nav>
  )
}
```

### 4. 组件代码分割

```javascript
// ❌ 不好：一个大型组件文件
// components/Dashboard.jsx (500 KB)
'use client'

export default function Dashboard() {
  return (
    <div>
      <Analytics />     {/* 200 KB 逻辑在同一文件 */}
      <UserProfile />   {/* 150 KB 逻辑在同一文件 */}
      <Settings />      {/* 150 KB 逻辑在同一文件 */}
    </div>
  )
}

// ✅ 好：拆分成独立组件
// components/Dashboard.jsx (5 KB)
'use client'
import { lazy, Suspense } from 'react'

const Analytics = lazy(() => import('./Analytics'))
const UserProfile = lazy(() => import('./UserProfile'))
const Settings = lazy(() => import('./Settings'))

export default function Dashboard() {
  return (
    <div>
      <Suspense fallback={<Loading />}>
        <Analytics />
      </Suspense>
      <Suspense fallback={<Loading />}>
        <UserProfile />
      </Suspense>
      <Suspense fallback={<Loading />}>
        <Settings />
      </Suspense>
    </div>
  )
}
```

### 5. 优化 Flight Payload 大小

```javascript
// ❌ 不好：传递大量数据到 Client Component
export default async function Page() {
  const allUsers = await db.users.findAll()  // 10,000 条记录

  return <UserTable users={allUsers} />  // 传递 5 MB 数据
}

// ✅ 好：Server Component 预处理数据
export default async function Page() {
  const allUsers = await db.users.findAll()

  // 在服务端分页
  const paginatedUsers = allUsers.slice(0, 20)

  return <UserTable users={paginatedUsers} />  // 只传递 50 KB
}
```

### 性能指标对比

| 优化措施 | 首屏 JS (KB) | 首屏时间 (ms) | 导航时间 (ms) |
|----------|--------------|---------------|---------------|
| **无优化** | 700 | 2000 | 500 |
| **+ 减少首屏组件** | 150 | 800 | 400 |
| **+ React.lazy** | 50 | 400 | 300 |
| **+ 选择性预加载** | 50 | 400 | 100 |
| **+ 代码分割** | 30 | 300 | 80 |

---

## 常见问题

### Q1: Client Component 一定会发送到浏览器吗？

**A**: 是的，标记了 `'use client'` 的组件代码一定会发送到浏览器。但有两个关键点：

1. **仅在需要时加载**：如果组件没有被渲染，代码不会加载
2. **缓存机制**：加载一次后会被缓存，不会重复下载

```javascript
// 组件定义
const Modal = lazy(() => import('@/components/Modal'))

// 场景 1：Modal 未显示
{showModal && <Modal />}  // showModal = false
✅ Modal.jsx 不会下载

// 场景 2：Modal 显示
{showModal && <Modal />}  // showModal = true
✅ Modal.jsx 下载 (第 1 次)

// 场景 3：再次显示 Modal
{showModal && <Modal />}  // showModal = true (再次)
✅ 从缓存读取，无网络请求
```

### Q2: 刷新页面会重新下载所有组件吗？

**A**: 不一定。取决于浏览器 HTTP 缓存：

```
刷新页面流程:

1. 清空内存缓存 (loadedModules)
2. 发起网络请求加载组件
3. 浏览器检查 HTTP 缓存
   ├─ 缓存命中 + 未过期 → 从磁盘缓存读取 ✅ (< 10ms)
   └─ 缓存未命中或过期 → 网络请求 ❌ (> 100ms)

DevTools Network 面板:
Status: 200 (from disk cache)  ← 从缓存读取
```

### Q3: 如何调试 Client Component 加载？

**A**: 使用浏览器 DevTools 的 Network 面板和 console.log：

```javascript
// client/module-map.ts
// 在 FlightDecoder 中添加调试日志

class FlightDecoder {
  decode(flightString: string) {
    console.log('🎨 开始解码 Flight Payload')

    const modules = new Map()
    const chunks = new Map()
    // ...

    console.log(`✅ 解析完成，找到 ${modules.size} 个模块，${chunks.size} 个数据块`)
    return this.resolveChunk('J0', modules, chunks)
  }

  private loadClientComponent({ id, name }: { id: string; name: string }) {
    console.log(`🔄 加载 Client Component: ${id}`)

    const loader = this.moduleMap[id]

    return React.lazy(async () => {
      const start = performance.now()
      const module = await loader()
      const end = performance.now()

      console.log(`✅ 加载完成: ${id} (${(end - start).toFixed(2)}ms)`)

      const Component = module[name] || module.default
      return { default: Component }
    })
  }
}

// 浏览器控制台输出:
// 🎨 开始解码 Flight Payload
// ✅ 解析完成，找到 3 个模块，1 个数据块
// 🔄 加载 Client Component: ./components/ThemeProvider.jsx
// 🔄 加载 Client Component: ./components/LoginButton.jsx
// ✅ 加载完成: ./components/ThemeProvider.jsx (45.23ms)
// ✅ 加载完成: ./components/LoginButton.jsx (32.18ms)

// 同时查看 Network 面板：
// - 查看每个组件的加载时间
// - 检查是否并行加载
// - 查看缓存状态 (from disk cache / from memory cache)
```

### Q4: 为什么有时候导航很慢？

**A**: 可能的原因：

1. **未启用预加载**：`<Link prefetch={false}>`
2. **预加载缓存过期**：超过 30 秒
3. **新的 Client Component**：首次加载需要下载
4. **网络慢**：检查 Network 面板

解决方案：
```javascript
// 1. 启用预加载
<Link href="/about">About</Link>  // 默认预加载

// 2. 手动预加载
const router = useRouter()
router.prefetch('/about')  // 提前预加载

// 3. 减少 Client Components
// 将不需要交互的组件改为 Server Component
```

### Q5: 如何查看组件加载顺序？

**A**: 使用 Chrome DevTools Network 面板：

```
1. 打开 DevTools → Network 标签
2. 刷新页面
3. 观察请求顺序:

┌─────────────────────────────────────┐
│ Name                  │ Status │ Time │
├─────────────────────────────────────┤
│ /                     │ 200    │ 120ms│ ← HTML
│ client.js             │ 200    │ 40ms │ ← 客户端入口
│ ThemeProvider.jsx     │ 200    │ 80ms │ ← Client Component
│ LoginButton.jsx       │ 200    │ 75ms │ ← Client Component
│ Counter.jsx           │ 200    │ 70ms │ ← Client Component
└─────────────────────────────────────┘

注意:
- ThemeProvider, LoginButton, Counter 并行加载 ✅
- Waterfall 图显示它们同时开始 ✅
```

---

## 总结

### Client Component 加载时机

1. **SSR 初次加载**：所有出现的 Client Components 立即并行加载
2. **客户端导航**：仅加载新出现的 Client Components
3. **Link 预加载**：后台提前加载目标页面的 Client Components
4. **动态导入**：`import()` 执行时按需加载
5. **React.lazy**：组件首次渲染时懒加载

### 关键特性

- ✅ **智能缓存**：已加载组件永不重复请求
- ✅ **并行加载**：所有请求同时发起
- ✅ **按需加载**：只加载需要的组件
- ✅ **预加载优化**：Link 自动预加载
- ✅ **HTTP 缓存**：浏览器持久化缓存

### 性能优化核心

1. 减少首屏 Client Components 数量
2. 使用 React.lazy 延迟加载大型组件
3. 选择性启用/禁用 Link 预加载
4. 代码分割，避免单一大文件
5. 优化 Flight Payload 大小

---

**相关文档**：
- [FLIGHT_PROTOCOL_DEEP_DIVE.md](./FLIGHT_PROTOCOL_DEEP_DIVE.md) - Flight Protocol 详解
- [ARCHITECTURE.md](./ARCHITECTURE.md) - 完整架构说明
- [client/module-map.ts](./client/module-map.ts) - FlightDecoder 实现与模块映射
