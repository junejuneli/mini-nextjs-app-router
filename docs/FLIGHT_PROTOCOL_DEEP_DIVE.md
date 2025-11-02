# Flight Protocol 深入解析

> React Server Components 的核心通信协议

---

## 核心本质

**Flight Protocol 解决的问题**：如何高效地将服务器端的 React UI 树传送到客户端。

### 核心优势

**流式传输 + 流式解析**

```
传统方案的问题:
- renderToString: 只传 HTML，丢失组件信息
- JSON: 必须等待完整生成，无法流式

Flight Protocol:
- 传输 React UI 树结构（不是 HTML，不是纯数据）
- 逐行发送，边生成边传输
- 客户端逐行解析，渐进式渲染
```

### 示例

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
```

---

## 协议格式

### Chunk 类型

每行一个 Chunk：

```
M<id>:<json>    Module Reference (Client Component 引用)
J<id>:<json>    JSON chunk (React 元素树)
S<id>:<symbol>  Symbol chunk (特殊值)
E<id>:<error>   Error chunk (错误信息)
```

### 完整示例

```javascript
M1:{"id":"./components/Counter.jsx","chunks":["Counter"],"name":"default"}
M2:{"id":"./components/LoginButton.jsx","chunks":["LoginButton"],"name":"default"}
J0:["$","div",null,{"children":[["$","h1",null,{"children":"Home"}],["$","@1",null,{"initialCount":0}],["$","@2",null,{}]]}]
```

**解释**：
- `M1`, `M2`: Client Component 模块引用
- `J0`: React 树结构
- `@1`, `@2`: 指向 M1, M2

---

## Module Reference 机制

### 结构定义

```typescript
interface ModuleReference {
  id: string       // 模块路径: "./components/Counter.jsx"
  chunks: string[] // 代码块名称: ["Counter"]
  name: string     // 导出名称: "default"
}
```

### Module ID 生成规则

使用 **文件相对路径** 作为唯一标识：

```typescript
// server/index.ts
const absolutePath = '/Users/june/.../components/Counter.jsx'

// 转换为相对于项目根目录的路径
const relativePath = './' + path.relative(projectRoot, absolutePath)
// → "./components/Counter.jsx"

const moduleInfo: ModuleInfo = {
  id: relativePath,  // ← 唯一标识
  chunks: ['Counter'],
  name: 'default'
}
```

**关键点**：
- ✅ 路径相对于项目根目录，确保一致性
- ✅ 使用 `path.relative()` 自动规范化
- ✅ 同一文件总是生成相同的 ID

---

### 跨页面模块复用

**场景**：多个页面引用同一个组件

```javascript
// app/page.jsx
import Counter from '../components/Counter.jsx'
// Module ID: "./components/Counter.jsx" ✅

// app/dashboard/page.jsx
import Counter from '../../components/Counter.jsx'
// Module ID: "./components/Counter.jsx" ✅ (相同！)
```

**浏览器模块缓存**：

```javascript
// 首次访问 /
await import('./components/Counter.jsx')
// → 网络请求下载 (150ms)

// 导航到 /dashboard
await import('./components/Counter.jsx')  // ← 相同 ID
// → ✅ 从浏览器模块缓存读取 (< 1ms)

```

---

### 服务端编码缓存

单次请求内，同一组件只生成一次 M chunk：

```javascript
// app/page.jsx
export default function Page() {
  return (
    <div>
      <Counter />  {/* 第 1 次 */}
      <Counter />  {/* 第 2 次 */}
      <Counter />  {/* 第 3 次 */}
    </div>
  )
}

// Flight Protocol 输出
M1:{"id":"./components/Counter.jsx",...}  ← 只生成一次
J0:["$","div",null,{
  "children":[
    ["$","@1",null,{}],  ← 都引用 @1
    ["$","@1",null,{}],
    ["$","@1",null,{}]
  ]
}]
```

**关键点**：
- ✅ 避免重复生成 M chunk
- ✅ 减少 Flight Payload 大小
- ⚠️ 仅在单次 `encode()` 调用内有效

---

### 完整复用流程

```
┌─────────────────────────────────────────┐
│ 服务端（每次请求）                       │
├─────────────────────────────────────────┤
│ 1. 渲染页面，遇到 Counter 组件           │
│ 2. 检查 moduleReferences Map            │
│    ├─ 已存在 → 返回 '@1'                │
│    └─ 不存在 → 生成 M1，缓存             │
│ 3. 输出 Flight Protocol                 │
└─────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────┐
│ 客户端（整个会话）                       │
├─────────────────────────────────────────┤
│ 1. FlightDecoder 解析 M1                │
│ 2. import('./components/Counter.jsx')  │
│    └─ 浏览器模块系统检查缓存             │
│       ├─ 命中 → 立即返回 ✅             │
│       └─ 未命中 → 下载 + 缓存           │
│ 3. 创建 React.lazy 组件                 │
└─────────────────────────────────────────┘
```

---

## 编码器核心逻辑

### 核心流程

```javascript
class FlightEncoder {
  async encodeElement(element) {
    const { type, props, key } = element

    // Case 1: HTML 元素 "div", "h1"
    if (typeof type === 'string') {
      return ['$', type, key, await this.encodeProps(props)]
    }

    // Case 2: Client Component
    if (this.isClientComponent(type)) {
      const moduleRef = this.createModuleReference(type)
      return ['$', moduleRef, key, await this.encodeProps(props)]
    }

    // Case 3: Server Component - 执行并继续编码
    let rendered = type(props)
    if (rendered?.then) rendered = await rendered  // 支持异步
    return await this.encodeValue(rendered)
  }

  createModuleReference(component) {
    // 检查缓存
    if (this.moduleReferences.has(component)) {
      return this.moduleReferences.get(component)
    }

    const moduleId = this.moduleId++
    this.writeModuleChunk(moduleId, moduleInfo)

    const reference = `@${moduleId}`
    this.moduleReferences.set(component, reference)

    return reference
  }
}
```

### 编码示例

```javascript
输入:
<div>
  <h1>Home</h1>
  <Counter initialCount={0} />
  <LoginButton />
</div>

处理过程:
1. <div> → HTML 元素
2. <h1> → HTML 元素
3. <Counter> → Client Component → 生成 M1
4. <LoginButton> → Client Component → 生成 M2

输出:
M1:{"id":"./components/Counter.jsx","chunks":["Counter"],"name":"default"}
M2:{"id":"./components/LoginButton.jsx","chunks":["LoginButton"],"name":"default"}
J0:["$","div",null,{"children":[["$","h1",null,{"children":"Home"}],["$","@1",null,{"initialCount":0}],["$","@2",null,{}]]}]
```

---

## 解码器核心逻辑

### 核心流程

```javascript
class FlightDecoder {
  decode(flightString) {
    // 使用局部变量，避免并发冲突
    const modules = new Map()
    const chunks = new Map()

    // 1. 解析所有 chunks
    for (const line of flightString.split('\n')) {
      this.parseLine(line, modules, chunks)
    }

    // 2. 构建 React 树
    return this.resolveChunk('J0', modules, chunks)
  }

  private resolveElement([marker, type, key, props], modules, chunks) {
    const resolvedProps = this.resolveValue(props, modules, chunks)

    // Case 1: Client Component "@1"
    if (typeof type === 'string' && type.startsWith('@')) {
      const moduleId = type.replace('@', 'M')
      const Component = this.resolveChunk(moduleId, modules, chunks)
      return React.createElement(Component, { ...resolvedProps, key })
    }

    // Case 2: HTML 元素 "div"
    return React.createElement(type, { ...resolvedProps, key })
  }

  private loadClientComponent({ id, name }) {
    const loader = this.moduleMap[id]

    // 使用 React.lazy 动态导入
    return React.lazy(async () => {
      const module = await loader()
      return { default: module[name] || module.default }
    })
  }
}
```

### 解码示例

```javascript
输入:
M1:{"id":"./components/Counter.jsx","chunks":["Counter"],"name":"default"}
J0:["$","div",null,{"children":[["$","@1",null,{"initialCount":0}]]}]

处理过程:
1. 解析 M1 → 存入 modules Map
2. 解析 J0 → 存入 chunks Map
3. resolveChunk('J0')
4. resolveElement(["$","div",...])
   └─ resolveElement(["$","@1",...])
      ├─ type = "@1" → Client Component
      ├─ resolveChunk('M1')
      ├─ loadClientComponent({ id: './components/Counter.jsx' })
      └─ React.lazy(() => import('./components/Counter.jsx'))

输出:
<div>
  <Counter initialCount={0} />  {/* React.lazy 包裹 */}
</div>
```

---

## 总结

### 核心特性

1. **Module Reference**：用引用代替完整组件代码
2. **流式传输**：逐行解析，支持 Streaming
3. **类型安全**：保留 React 元素类型信息
4. **高效传输**：只传输必要数据，可控性高

### 关键优势

- ✅ Server Components 代码不发送到客户端
- ✅ Client Components 按需加载
- ✅ 支持复杂的嵌套结构
- ✅ 跨页面模块复用（浏览器缓存）
- ✅ 与现有 React 生态兼容

### 实现要点

**编码器**：
1. 识别 Client Components
2. 创建 Module Reference（带缓存）
3. 递归编码 React 树

**解码器**：
1. 解析 Flight chunks
2. 动态加载 Client Components
3. 重建 React 树

---

**相关文档**：
- [CLIENT_COMPONENT_LOADING.md](./CLIENT_COMPONENT_LOADING.md) - Client Component 加载机制
- [shared/flight-encoder.ts](../shared/flight-encoder.ts) - 编码器完整实现
