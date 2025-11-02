# Flight Protocol 深入解析

> React Server Components 的核心通信协议

---

## 核心本质

**Flight Protocol 的出现，是为了解决"如何最高效地将服务器端的 React UI 树传送到客户端"这个问题。**

### 核心优势

**唯一真正的优势：流式传输 + 流式解析**

```
传统方案的问题:
- renderToString: 只传 HTML，丢失组件信息
- JSON: 只传数据，需要客户端重建 UI 树
- 完整 JSON: 必须等待完整生成，无法流式

Flight Protocol 的解决:
- 传输 React UI 树结构（不是 HTML，不是纯数据）
- 逐行发送，边生成边传输
- 客户端逐行解析，渐进式渲染
```

### 与 JSON 对比

| 能力 | JSON | Flight Protocol |
|------|------|-----------------|
| 表达组件引用 | ✅ 可以（自定义标记） | ✅ Module Reference |
| 流式传输 | ⚠️ 需要 NDJSON 等自定义协议 | ✅ 天然支持 |
| 流式解析 | ⚠️ 需要自己设计 | ✅ 逐行解析 |
| 标准化 | ❌ 每个项目自己设计 | ✅ React 官方标准 |

**结论**：JSON 理论上也能做到，但 Flight Protocol 是 React 官方标准化的流式协议。

### 关键优化点

```javascript
// 服务端
export default function Page() {
  const user = db.users.find()  // 服务端查询

  return (
    <div>
      <h1>Welcome {user.name}</h1>  {/* Server Component */}
      <Counter />                    {/* Client Component */}
    </div>
  )
}

// Flight Protocol 传输
M1:{"id":"./Counter.jsx","name":"default"}
J0:["$","div",null,{"children":[
  ["$","h1",null,{"children":["Welcome ","Alice"]}],
  ["$","@1",null,{}]
]}]

传输内容:
✅ UI 树结构 (div > h1 + Counter)
✅ 服务端执行结果 ("Welcome Alice")
✅ Client Component 引用 (@1)
❌ Server Component 代码不发送
❌ 数据库查询逻辑不发送

流式效果:
0ms   → 立即发送 M1, J0
50ms  → 客户端渲染框架 ✅
200ms → 发送更多数据
220ms → 客户端更新内容 ✅
```

---

## 什么是 Flight Protocol

### 核心问题

**传统 SSR 的局限**：
```javascript
// 服务端渲染
const html = ReactDOMServer.renderToString(<App />)

// 客户端 Hydration
hydrateRoot(container, <App />)

问题:
1. 服务端和客户端都要执行相同的组件代码
2. 所有组件代码都要发送到客户端
3. 无法表达"这部分只在服务端运行"
```

**Flight Protocol 的解决方案**：
```
一种序列化格式，能够表达:
1. React 元素树结构
2. Server Component 和 Client Component 的边界
3. Client Component 的引用 (不是完整代码)
4. Props 数据传递
```

### 设计目标

1. **最小传输**：只传输必要的信息
2. **流式传输**：支持 Streaming SSR
3. **类型安全**：保留 React 元素的类型信息
4. **向后兼容**：与现有 React 生态兼容

---

## 协议格式详解

### Chunk 类型

Flight Protocol 由多种 Chunk 组成，每行一个 Chunk：

```
M<id>:<json>    Module Reference chunk (Client Component 引用)
J<id>:<json>    JSON chunk (React 元素树 / 数据)
S<id>:<symbol>  Symbol chunk (特殊值: Infinity, undefined 等)
E<id>:<error>   Error chunk (错误信息)
```

### 示例：完整 Flight Payload

```javascript
M1:{"id":"./components/Counter.jsx","chunks":["Counter"],"name":"default"}
M2:{"id":"./components/LoginButton.jsx","chunks":["LoginButton"],"name":"default"}
J0:["$","div",null,{"children":[["$","h1",null,{"children":"Home"}],["$","@1",null,{"initialCount":0}],["$","@2",null,{}]]}]
```

**解释**：
- `M1`: Counter 组件的模块引用
- `M2`: LoginButton 组件的模块引用
- `J0`: React 树结构，`@1` 和 `@2` 指向 M1 和 M2

---

## Module Reference 机制

### Module Reference 的作用

```javascript
// Server Component (服务端)
export default function Page() {
  return (
    <div>
      <h1>Home</h1>
      <Counter initialCount={0} />  {/* Client Component */}
    </div>
  )
}

// 编码为 Flight Protocol:

M1:{"id":"./components/Counter.jsx","chunks":["Counter"],"name":"default"}
J0:["$","div",null,{
  "children":[
    ["$","h1",null,{"children":"Home"}],
    ["$","@1",null,{"initialCount":0}]  ← @1 指向 M1
  ]
}]
```

### Module Reference 结构

```typescript
interface ModuleReference {
  id: string       // 模块路径: "./components/Counter.jsx"
  chunks: string[] // 代码块名称: ["Counter"]
  name: string     // 导出名称: "default"
}
```

### 客户端解析流程

```javascript
// 1. 解析 Module Reference
const moduleRef = JSON.parse('{"id":"./components/Counter.jsx",...}')

// 2. 动态导入
const module = await import(moduleRef.id)

// 3. 获取导出
const Component = module[moduleRef.name]  // module.default

// 4. 创建 React 元素
return React.createElement(Component, props)
```

---

## 编码器实现

### FlightEncoder 核心代码

```javascript
// server/flight-encoder.ts
export class FlightEncoder {
  constructor(clientComponentMap) {
    this.clientComponentMap = clientComponentMap
    this.chunks = []
    this.moduleId = 0
  }

  /**
   * 编码 React 元素树
   */
  encode(element) {
    const rootChunk = this.encodeValue(element)
    const rootId = this.writeJSONChunk(rootChunk)

    // 生成 Flight Protocol 字符串
    return this.chunks.join('\n')
  }

  /**
   * 编码值（递归）
   */
  encodeValue(value) {
    // null, undefined
    if (value === null || value === undefined) {
      return value
    }

    // 数组
    if (Array.isArray(value)) {
      return value.map(item => this.encodeValue(item))
    }

    // React 元素
    if (typeof value === 'object' && value.$$typeof === Symbol.for('react.element')) {
      return this.encodeElement(value)
    }

    // 普通对象
    if (typeof value === 'object') {
      const encoded = {}
      for (const key in value) {
        encoded[key] = this.encodeValue(value[key])
      }
      return encoded
    }

    // 原始值
    return value
  }

  /**
   * 编码 React 元素
   */
  encodeElement(element) {
    const { type, props, key } = element

    // Case 1: HTML 元素 "div", "h1" 等
    if (typeof type === 'string') {
      return [
        '$',                          // 元素标记
        type,                         // "div"
        key,                          // null
        this.encodeProps(props)       // { children: [...] }
      ]
    }

    // Case 2: Client Component
    if (this.isClientComponent(type)) {
      const moduleRef = this.createModuleReference(type)

      return [
        '$',
        moduleRef,                    // "@1"
        key,
        this.encodeProps(props)
      ]
    }

    // Case 3: Server Component - 执行并继续编码
    const rendered = type(props)
    return this.encodeValue(rendered)
  }

  /**
   * 检查是否为 Client Component
   */
  isClientComponent(type) {
    // 检查组件是否有 'use client' 标记
    return this.clientComponentMap.has(type)
  }

  /**
   * 创建 Module Reference
   */
  createModuleReference(component) {
    const componentInfo = this.clientComponentMap.get(component)
    const moduleId = `M${this.moduleId++}`

    // 写入 Module chunk
    this.writeModuleChunk(moduleId, componentInfo)

    // 返回引用符号 "@1"
    return `@${this.moduleId - 1}`
  }

  /**
   * 写入 Module chunk
   */
  writeModuleChunk(id, componentInfo) {
    const chunk = `${id}:${JSON.stringify({
      id: componentInfo.path,
      chunks: [componentInfo.name],
      name: 'default'
    })}`

    this.chunks.push(chunk)
  }

  /**
   * 写入 JSON chunk
   */
  writeJSONChunk(value) {
    const id = `J${this.chunks.filter(c => c.startsWith('J')).length}`
    const chunk = `${id}:${JSON.stringify(value)}`

    this.chunks.push(chunk)

    return id
  }

  /**
   * 编码 Props
   */
  encodeProps(props) {
    if (!props) return null

    const encoded = {}

    for (const key in props) {
      if (key === 'children') {
        encoded.children = this.encodeChildren(props.children)
      } else {
        encoded[key] = this.encodeValue(props[key])
      }
    }

    return encoded
  }

  /**
   * 编码 Children
   */
  encodeChildren(children) {
    if (children === null || children === undefined) {
      return null
    }

    if (Array.isArray(children)) {
      return children.map(child => this.encodeValue(child))
    }

    return this.encodeValue(children)
  }
}
```

### 编码示例

```javascript
// 输入：React 树
const element = (
  <div>
    <h1>Home</h1>
    <Counter initialCount={0} />
    <LoginButton />
  </div>
)

// FlightEncoder 处理过程:

1. encodeElement(<div>)
   ├─ type = "div" → HTML 元素
   ├─ 编码 children
   └─ 返回: ["$", "div", null, { children: [...] }]

2. encodeElement(<h1>)
   ├─ type = "h1" → HTML 元素
   └─ 返回: ["$", "h1", null, { children: "Home" }]

3. encodeElement(<Counter>)
   ├─ type = Counter → Client Component ✅
   ├─ 创建 Module Reference: M1
   ├─ 写入: M1:{"id":"./components/Counter.jsx",...}
   └─ 返回: ["$", "@1", null, { initialCount: 0 }]

4. encodeElement(<LoginButton>)
   ├─ type = LoginButton → Client Component ✅
   ├─ 创建 Module Reference: M2
   ├─ 写入: M2:{"id":"./components/LoginButton.jsx",...}
   └─ 返回: ["$", "@2", null, {}]

5. 组装最终 Payload
   ├─ M1:{"id":"./components/Counter.jsx",...}
   ├─ M2:{"id":"./components/LoginButton.jsx",...}
   └─ J0:["$","div",null,{"children":[...]}]

// 输出：Flight Protocol 字符串
M1:{"id":"./components/Counter.jsx","chunks":["Counter"],"name":"default"}
M2:{"id":"./components/LoginButton.jsx","chunks":["LoginButton"],"name":"default"}
J0:["$","div",null,{"children":[["$","h1",null,{"children":"Home"}],["$","@1",null,{"initialCount":0}],["$","@2",null,{}]]}]
```

---

## 解码器实现

### FlightDecoder 核心代码

```javascript
// client/module-map.ts
// 注：FlightDecoder 现在位于 module-map.ts 文件中，与模块映射逻辑整合

export class FlightDecoder {
  private moduleMap: ModuleMap

  constructor(moduleMap: ModuleMap = {}) {
    this.moduleMap = moduleMap
  }

  /**
   * 解码 Flight Protocol 字符串
   *
   * 设计特点：
   * - 使用局部变量而非实例状态，避免并发问题
   * - 可安全地在多次调用间复用同一实例
   */
  decode(flightString: string) {
    if (!flightString?.trim()) throw new Error('Invalid flight data')

    // 使用局部变量存储状态，避免并发冲突
    const modules = new Map()
    const chunks = new Map()

    const lines = flightString.split('\n')

    // 1. 解析所有 chunks
    for (const line of lines) {
      if (!line.trim()) continue
      this.parseLine(line, modules, chunks)
    }

    // 2. 构建 React 树
    return this.resolveChunk('J0', modules, chunks)
  }

  /**
   * 解析一行 chunk
   */
  private parseLine(line: string, modules: Map<string, any>, chunks: Map<string, any>) {
    const type = line[0]
    const colonIndex = line.indexOf(':')

    if (colonIndex === -1) return

    const id = line.substring(1, colonIndex)
    const dataStr = line.substring(colonIndex + 1)

    if (type === 'M') {
      // Module Reference chunk
      try {
        modules.set(`M${id}`, {
          type: 'module',
          info: JSON.parse(dataStr)
        })
      } catch (error) {
        console.error('Failed to parse module chunk:', error)
      }
    } else if (type === 'J') {
      // JSON chunk
      try {
        chunks.set(`J${id}`, {
          type: 'json',
          data: JSON.parse(dataStr)
        })
      } catch (error) {
        console.error('Failed to parse JSON chunk:', error)
      }
    }
  }

  /**
   * 解析 chunk（递归）
   */
  private resolveChunk(chunkId: string, modules: Map<string, any>, chunks: Map<string, any>): any {
    const chunk = chunks.get(chunkId)

    if (chunk) {
      if (chunk.type === 'json') return this.resolveValue(chunk.data, modules, chunks)
      if (chunk.type === 'error') throw new Error(chunk.data.message)
    }

    const module = modules.get(chunkId)
    if (module) return this.loadClientComponent(module.info)

    return null
  }

  /**
   * 解析值（递归）
   */
  private resolveValue(value: any, modules: Map<string, any>, chunks: Map<string, any>): any {
    // null, undefined
    if (value == null || typeof value !== 'object') return value

    // 数组
    if (Array.isArray(value)) {
      // 检查是否为 React 元素 ["$", type, key, props]
      return value[0] === '$'
        ? this.resolveElement(value, modules, chunks)
        : value.map(item => this.resolveValue(item, modules, chunks))
    }

    // 普通对象
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => [key, this.resolveValue(val, modules, chunks)])
    )
  }

  /**
   * 解析 React 元素
   */
  private resolveElement([marker, type, key, props]: any[], modules: Map<string, any>, chunks: Map<string, any>) {
    const resolvedProps = this.resolveValue(props, modules, chunks) || {}

    // Case 1: Client Component reference "@1"
    if (typeof type === 'string' && type.startsWith('@')) {
      const moduleId = type.replace('@', 'M')
      const Component = this.resolveChunk(moduleId, modules, chunks)

      return React.createElement(Component, { ...resolvedProps, key })
    }

    // Case 2: HTML element "div"
    if (typeof type === 'string') {
      return React.createElement(type, { ...resolvedProps, key })
    }

    return null
  }

  /**
   * 加载 Client Component
   */
  private loadClientComponent({ id, name }: { id: string; name: string }) {
    const loader = this.moduleMap[id]

    if (!loader) {
      return () => React.createElement('div', {}, `[Missing: ${id}]`)
    }

    if (typeof window === 'undefined') {
      return (props: any) => React.createElement('div', props, `[Client: ${id}]`)
    }

    // 使用 React.lazy 动态导入
    return React.lazy(async () => {
      const module = await loader()
      const Component = module[name] || module.default

      if (!Component) {
        throw new Error(`Export "${name}" not found in ${id}`)
      }

      return { default: Component }
    })
  }
}

// 导出共享的 FlightDecoder 实例
// 由于 decode() 方法使用局部变量存储状态，可以安全地在多次调用间复用同一实例
export const flightDecoder = new FlightDecoder(moduleMap)
```

### 解码示例

```javascript
// 输入：Flight Protocol 字符串
const flight = `
M1:{"id":"./components/Counter.jsx","chunks":["Counter"],"name":"default"}
M2:{"id":"./components/LoginButton.jsx","chunks":["LoginButton"],"name":"default"}
J0:["$","div",null,{"children":[["$","h1",null,{"children":"Home"}],["$","@1",null,{"initialCount":0}],["$","@2",null,{}]]}]
`

// FlightDecoder 处理过程:

1. parseLine('M1:...')
   chunks.set('M1', {
     type: 'module',
     value: { id: './components/Counter.jsx', ... }
   })

2. parseLine('M2:...')
   chunks.set('M2', {
     type: 'module',
     value: { id: './components/LoginButton.jsx', ... }
   })

3. parseLine('J0:...')
   chunks.set('J0', {
     type: 'json',
     value: ["$","div",null,...]
   })

4. resolveChunk('J0')
   ├─ chunk.type = 'json'
   └─ resolveValue(["$","div",null,...])

5. resolveElement(["$","div",null,...])
   ├─ type = "div" → HTML 元素
   ├─ resolveValue(props.children)
   │  ├─ resolveElement(["$","h1",...])
   │  │  └─ React.createElement("h1", ...)
   │  ├─ resolveElement(["$","@1",...])
   │  │  ├─ type = "@1" → Client Component
   │  │  ├─ moduleId = "M1"
   │  │  ├─ resolveChunk('M1')
   │  │  ├─ loadClientComponent({ id: './components/Counter.jsx' })
   │  │  └─ React.createElement(CounterLazy, ...)
   │  └─ resolveElement(["$","@2",...])
   │     └─ React.createElement(LoginButtonLazy, ...)
   └─ React.createElement("div", ...)

// 输出：React 树
<div>
  <h1>Home</h1>
  <Counter initialCount={0} />  {/* React.lazy 包裹 */}
  <LoginButton />               {/* React.lazy 包裹 */}
</div>
```

---

## 与 JSON 的对比

### 传统 JSON 序列化的问题

```javascript
// ❌ 问题：无法表达组件引用
const tree = {
  type: 'div',
  props: {
    children: [
      { type: 'h1', props: { children: 'Home' } },
      { type: Counter, props: { initialCount: 0 } }  // ← Counter 是函数，无法序列化
    ]
  }
}

JSON.stringify(tree)  // ❌ 报错或丢失组件信息
```

### Flight Protocol 的优势

```javascript
// ✅ Flight Protocol 使用 Module Reference
M1:{"id":"./components/Counter.jsx","chunks":["Counter"],"name":"default"}
J0:["$","div",null,{
  "children":[
    ["$","h1",null,{"children":"Home"}],
    ["$","@1",null,{"initialCount":0}]  // ← @1 引用 M1
  ]
}]

// 客户端解码时:
const Counter = await import('./components/Counter.jsx')
return React.createElement(Counter.default, { initialCount: 0 })
```

### 对比表

| 特性 | JSON | Flight Protocol |
|------|------|-----------------|
| **组件引用** | ❌ 无法表达 | ✅ Module Reference |
| **函数序列化** | ❌ 不支持 | ✅ 转为模块引用 |
| **流式传输** | ❌ 需完整 JSON | ✅ 逐行解析 |
| **类型安全** | ⚠️ 类型丢失 | ✅ 保留元素类型 |
| **文件大小** | 中等 | 稍大（包含元数据） |

---

## 实际案例

### 案例 1：嵌套组件

```javascript
// 输入：React 树
<Layout>
  <Header>
    <Logo />
    <Nav>
      <NavItem />
    </Nav>
  </Header>
  <Main>
    <Article />
    <Sidebar>
      <Widget />
    </Sidebar>
  </Main>
</Layout>

// 假设：
// - Layout, Header, Main, Sidebar: Server Components
// - Logo, Nav, NavItem, Article, Widget: Client Components

// Flight Protocol 输出:
M1:{"id":"./Logo.jsx","name":"default"}
M2:{"id":"./Nav.jsx","name":"default"}
M3:{"id":"./NavItem.jsx","name":"default"}
M4:{"id":"./Article.jsx","name":"default"}
M5:{"id":"./Widget.jsx","name":"default"}
J0:["$","div",null,{"className":"layout","children":[
  ["$","header",null,{"children":[
    ["$","@1",null,{}],
    ["$","@2",null,{"children":[["$","@3",null,{}]]}]
  ]}],
  ["$","main",null,{"children":[
    ["$","@4",null,{}],
    ["$","aside",null,{"children":[["$","@5",null,{}]]}]
  ]}]
]}]

// 解释：
// - Server Components (Layout, Header, Main, Sidebar) 已执行，输出为 HTML 标签
// - Client Components (Logo, Nav, NavItem, Article, Widget) 保留为 @1-@5 引用
```

### 案例 2：Props 传递

```javascript
// 输入：带复杂 Props 的组件
<UserCard
  user={{ id: 1, name: 'Alice', avatar: '/alice.jpg' }}
  onFollow={() => console.log('follow')}  // ⚠️ 函数无法序列化
  config={{ theme: 'dark', lang: 'en' }}
/>

// Flight Protocol 输出:
M1:{"id":"./UserCard.jsx","name":"default"}
J0:["$","@1",null,{
  "user": {
    "id": 1,
    "name": "Alice",
    "avatar": "/alice.jpg"
  },
  "config": {
    "theme": "dark",
    "lang": "en"
  }
}]

// 注意：
// - onFollow 函数被忽略（无法序列化）
// - Client Component 需要自己定义事件处理逻辑
```

### 案例 3：Server Action

```javascript
// 输入：Server Action
'use server'
async function createPost(formData) {
  await db.posts.create({ title: formData.get('title') })
}

<form action={createPost}>
  <input name="title" />
  <button>Submit</button>
</form>

// Flight Protocol 输出:
A1:{"id":"./actions.js","name":"createPost"}
J0:["$","form",null,{
  "action": "$A1",  // ← $A1 引用 Server Action
  "children": [
    ["$","input",null,{"name":"title"}],
    ["$","button",null,{"children":"Submit"}]
  ]
}]

// 客户端解码:
const action = (formData) => {
  return fetch('/api/rsc-action', {
    method: 'POST',
    headers: { 'RSC-Action': 'A1' },
    body: formData
  })
}

return <form action={action}>...</form>
```

---

## 总结

### Flight Protocol 核心特性

1. **Module Reference**：用引用代替完整组件代码
2. **流式传输**：逐行解析，支持 Streaming
3. **类型安全**：保留 React 元素类型信息
4. **高效传输**：只传输必要数据

### 关键优势

- ✅ Server Components 代码不发送到客户端
- ✅ Client Components 按需加载
- ✅ 支持复杂的嵌套结构
- ✅ 与现有 React 生态兼容

### 实现要点

**编码器**：
1. 识别 Client Components
2. 创建 Module Reference
3. 递归编码 React 树

**解码器**：
1. 解析 Flight chunks
2. 动态加载 Client Components
3. 重建 React 树

---

**相关文档**：
- [CLIENT_COMPONENT_LOADING.md](./CLIENT_COMPONENT_LOADING.md) - Client Component 加载机制
- [server/flight-encoder.ts](./server/flight-encoder.ts) - 编码器实现
- [client/module-map.ts](./client/module-map.ts) - 解码器实现（FlightDecoder 类）与模块映射
