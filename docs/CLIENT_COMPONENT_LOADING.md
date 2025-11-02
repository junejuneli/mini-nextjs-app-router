# Client Component 加载机制

## 核心链路

### 问题：浏览器如何获取 Client Component 的 JS 文件？

```
构建时 (npm run build):
  client/Link.jsx  ──[Vite]──>  .next/static/Link-SZPJjZx3.js

运行时 (npm start):
  浏览器 GET /Link-SZPJjZx3.js  ──>  express.static  ──>  返回文件
```

---

### 1. 构建阶段

**配置** (`vite.config.js`):
```javascript
build: {
  outDir: '.next/static',           // 输出目录
  rollupOptions: {
    output: {
      chunkFileNames: '[name]-[hash].js',  // 带 hash 的文件名
    }
  }
}
```

**生成的文件**:
```bash
.next/static/
├── client.js              # 入口
├── Link-SZPJjZx3.js       # 组件 chunks
└── Button-xA8B.js
```

**为什么带 hash？**
内容不变 → hash 不变 → 浏览器永久缓存
内容改变 → hash 改变 → 自动下载新版本

---

### 2. 静态文件服务

**Express 配置** (`server/index.ts:76-78`):
```javascript
app.use(express.static(path.join(projectRoot, '.next/static')))

app.get('*', (req, res, next) => {
  // 静态资源跳过动态路由，交给 express.static 处理
  if (req.path.match(/\.(js|css|json|png|...)$/)) {
    return next()
  }
  // 动态路由逻辑...
})
```

**请求流程**:
```
浏览器: GET /Link-SZPJjZx3.js
  ↓
Express: 匹配 .js 扩展名 → next()
  ↓
express.static: 返回 .next/static/Link-SZPJjZx3.js
```

---

### 3. 模块映射机制

**编译前** (`client/module-map.ts`):
```typescript
const clientModules = import.meta.glob('../client/**/*.{jsx,tsx}')
```

**编译后** (Vite 转换):
```javascript
const clientModules = {
  '../client/Link.jsx': () => import('./Link-SZPJjZx3.js'),
  '../client/Button.jsx': () => import('./Button-xA8B.js'),
}

// 路径规范化后
export const moduleMap = {
  './client/Link.jsx': () => import('./Link-SZPJjZx3.js'),
}
```

**映射关系**:
```
Flight Protocol:            moduleMap:               实际文件:
M1:{"id":"./client/Link.jsx"} → './client/Link.jsx' → Link-SZPJjZx3.js
```

---

### 4. 动态加载流程

```
1. 服务端生成 Flight Protocol
   M1:{"id":"./client/Link.jsx",...}
   J0:["$","@1",null,{"href":"/about"}]

2. 浏览器解码 Flight
   flightDecoder.decode(flight)
   → 发现引用 @1 → 查找 M1

3. 加载组件
   loadClientComponent({id: "./client/Link.jsx"})
   → moduleMap['./client/Link.jsx']
   → () => import('./Link-SZPJjZx3.js')

4. React.lazy 触发 import
   React.lazy(async () => {
     const module = await import('./Link-SZPJjZx3.js')  // ⭐ HTTP 请求
     return { default: module.default }
   })

5. 浏览器请求
   GET /Link-SZPJjZx3.js → express.static 返回

6. 组件渲染
   JS 执行 → 组件可用 → React 渲染
```

---

## 加载场景

### 场景 1: 初次加载

```
1. 浏览器收到 HTML (包含 Flight Payload)
2. GET /client.js (express.static 返回)
3. 解析 Flight → 发现 3 个 Client Components
4. 并行请求 JS 文件:
   ├─ GET /Link-SZPJjZx3.js
   ├─ GET /Button-xA8B.js
   └─ GET /Counter-pQ2N.js
5. 组件下载完成 → hydrateRoot() → 页面可交互
```

### 场景 2: 客户端导航

```
1. 点击 Link → GET /about?_rsc=1 (返回 Flight)
2. 解码 Flight → 发现新组件 Chart
3. GET /Chart-zB9C.js (express.static 返回)
4. 已加载的组件使用浏览器模块缓存 (无请求)
5. React 更新 → 导航完成
```

### 场景 3: React.lazy 懒加载

```javascript
const HeavyChart = lazy(() => import('./HeavyChart.jsx'))

// 首次渲染时:
<Suspense fallback={<Loading />}>
  <HeavyChart />  // → GET /HeavyChart-nP5Q.js
</Suspense>
```

---

## 缓存机制

**多层缓存**:
```
1. 浏览器模块缓存 (当前会话)
   同一页面会话内，import() 只请求一次

2. HTTP 缓存 (持久化)
   Cache-Control: public, max-age=31536000
   刷新页面后从磁盘缓存读取

3. Router Cache (客户端导航)
   Link 预加载缓存，有效期 30 秒
```

**缓存示例**:
```
首次访问 /
  ├─ GET /Link-SZPJjZx3.js (网络请求)
  └─ GET /Button-xA8B.js   (网络请求)

导航到 /about
  ├─ Link-SZPJjZx3.js  ✅ 模块缓存
  ├─ Button-xA8B.js    ✅ 模块缓存
  └─ GET /Chart-zB9C.js (网络请求，新组件)

刷新页面
  ├─ 模块缓存清空
  └─ express.static 返回 304 Not Modified (HTTP 缓存)
```

---

## 性能优化

### 1. 减少首屏组件
```javascript
// ❌ 不好：首屏 500 KB
<HeavyMap /> <RichEditor /> <DataViz />

// ✅ 好：首屏 5 KB
<StaticMap /> <ContentPreview /> <SubscribeButton />
```

### 2. 懒加载大组件
```javascript
const Chart = lazy(() => import('./Chart'))

{showChart && (
  <Suspense fallback={<Loading />}>
    <Chart />
  </Suspense>
)}
```

### 3. 选择性预加载
```javascript
// 高频页面：启用预加载
<Link href="/products">Products</Link>

// 低频页面：禁用预加载
<Link href="/terms" prefetch={false}>Terms</Link>
```

---

## 常见问题

**Q: 为什么不在运行时动态打包？**
A: 性能考虑。构建时打包一次，运行时直接提供文件，启动快。

**Q: 刷新页面会重新下载所有组件吗？**
A: 不会。express.static 利用 HTTP 缓存，返回 304 Not Modified。

**Q: 文件 hash 何时改变？**
A: 组件代码改变时 → 内容 hash 改变 → 文件名改变 → 浏览器下载新文件。

---

**相关文档**：
- [FLIGHT_PROTOCOL_DEEP_DIVE.md](./FLIGHT_PROTOCOL_DEEP_DIVE.md) - Flight Protocol 详解
- [ARCHITECTURE.md](../ARCHITECTURE.md) - 完整架构说明
