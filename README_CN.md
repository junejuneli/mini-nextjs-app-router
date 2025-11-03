# Mini Next.js App Router

> 教学向的 Next.js App Router 实现，深入理解 React Server Components 和 Flight Protocol

[English](./README.md) | 中文文档

## 🎯 学习目标

通过简化实现理解现代 React Server Components 和 Next.js App Router 的工作原理：

- ✅ **React Server Components (RSC)** - Server/Client 组件混用
- ✅ **Flight Protocol** - React 树的自定义序列化格式
- ✅ **Streaming SSR** - 结合 Suspense 的流式渲染
- ✅ **Server Actions** - 'use server' 指令的 RPC 机制（📖 文档已完成）
- ✅ **嵌套布局** - 自动布局嵌套 + 软导航
- ✅ **文件系统路由** - 基于 `app/` 目录的约定式路由
- ✅ **特殊文件** - loading.jsx, error.jsx, not-found.jsx
- ✅ **SSG & ISR** - 静态生成与增量静态再生成
- ✅ **动态路由** - [param] 语法，支持 generateStaticParams()
- ✅ **路由组** - (folder) 语法用于代码组织

## 🚀 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 构建项目
npm run build

# 3. 启动服务器
npm start
```

访问 http://localhost:3000

**示例页面**:
- `/` - 首页（Server Component）
- `/about` - 关于页面（Server Component）
- `/blog` - 博客列表（动态路由演示）
- `/blog/react-server-components` - 博客文章（[slug] 动态路由）
- `/pricing` - 定价页面（路由组演示）
- `/dashboard` - 仪表盘（嵌套布局 + Client Component）
- `/dashboard/settings` - 设置页面（嵌套路由）
- `/async-test` - 异步数据获取（含 loading.jsx）
- `/isr-test` - ISR 演示（10 秒 revalidate）
- `/error-test` - 错误处理（含 error.jsx）
- `/404-test` - 404 处理（含 not-found.jsx）

## 📁 项目结构

```
mini-nextjs-app-router/
├── app/                    # 应用目录
│   ├── layout.jsx         # Root Layout（必需）
│   ├── page.jsx           # 首页
│   ├── loading.jsx        # Loading UI
│   ├── error.jsx          # 错误边界
│   └── .../               # 更多路由
│
├── build/                  # 构建系统
│   ├── index.js           # 构建编排器
│   ├── scan-app.js        # 扫描 app/ 目录
│   ├── generate-routes.js # 生成路由树
│   ├── render-static.js   # 预渲染静态路由
│   └── vite-build.js      # Vite 构建客户端 bundles
│
├── server/                 # 服务端运行时
│   ├── index.js           # Express 服务器入口
│   ├── router.js          # 路由匹配器
│   ├── render-ssr.js      # SSR 渲染器
│   ├── render-ssg.js      # SSG 文件服务器
│   └── regenerate.js      # ISR 重新生成逻辑
│
├── shared/                 # 服务端/客户端共享代码
│   ├── flight-encoder.js  # Flight Protocol 编码器
│   ├── flight-decoder.js  # Flight Protocol 解码器
│   ├── rsc-renderer.js    # RSC 渲染器
│   ├── metadata.js        # ISR 元数据管理器
│   └── html-template.js   # HTML 模板生成器
│
├── client/                 # 客户端运行时
│   ├── index.jsx          # 客户端入口（Hydration）
│   ├── router.jsx         # 客户端路由
│   ├── Link.jsx           # Link 组件
│   ├── ErrorBoundary.jsx  # 错误边界
│   └── module-map.ts      # 客户端组件模块映射
│
└── .next/                  # 构建输出
    ├── manifest.json      # 路由清单
    ├── dist/              # Vite 打包资源
    └── static/            # 预渲染页面
        ├── pages/         # HTML 文件
        └── flight/        # Flight payloads
```

## 💡 核心概念

### React Server Components

**Server Component**（默认）:
- 仅在服务端执行
- 可直接访问数据库、文件系统
- 不发送到客户端（Zero Bundle）
- 无法使用 Hooks 或浏览器 API

**Client Component**（`'use client'`）:
- 服务端预渲染 + 客户端 Hydration
- 可使用 useState、useEffect、事件处理
- 发送到客户端，可交互

### Flight Protocol

传输包含 Server/Client 组件的 React 树的序列化格式：

```
M1:{"id":"./Button.jsx","chunks":["Button"],"name":"default"}
J0:["$","div",null,{"children":["$","@1",null,{"text":"点击"}]}]
```

- `M` = Module Reference（Client Component 引用）
- `J` = JSON（普通数据）
- `@1` = 引用 ID 为 1 的模块

### Streaming SSR

使用 React 18 Suspense 实现渐进式内容传输：

```
100ms → 发送 Shell（Layout + Loading）
500ms → 流式传输内容（Suspense 完成）
用户立即看到框架，无需等待所有数据
```

### ISR（增量静态再生成）

```jsx
// app/isr-test/page.jsx
export const revalidate = 60  // 每 60 秒重新验证

export default function Page() {
  return <div>{new Date().toISOString()}</div>
}
```

**工作原理**:
1. 首次请求 → 生成并缓存
2. 后续请求 → 返回缓存版本（快速）
3. 超过 revalidate 时间 → 返回旧缓存 + 后台重新生成
4. 下次请求 → 返回新内容

## 🔍 工作原理

### 构建流程

```
1. 扫描 app/ 目录 → 提取路由和元数据
2. 生成路由树 → 创建路由匹配规则
3. Vite 构建 → 打包 Client Components
4. 预渲染静态路由 → 生成 HTML + Flight payloads
5. 保存 manifest.json → 运行时路由配置
```

### 服务器请求处理

```
请求 → 路由匹配 → 检查是否预渲染？
                 ├─ 是 → 提供静态文件（SSG/ISR）
                 │      └─ 检查 revalidate → 后台重新生成
                 └─ 否 → 动态渲染（SSR）
                        └─ 渲染 RSC → 生成 HTML/Flight
```

### 客户端 Hydration

```
1. 浏览器接收 HTML
2. 加载打包的 JS
3. 解析 __NEXT_DATA__（初始 props）
4. hydrateRoot() → 附加事件监听器
5. 可交互！
```

### 客户端导航

```
Link 点击 → 拦截 → 获取 ?_rsc=1 → 获取 Flight payload
                                 → 解析 Flight
                                 → 加载 Client Components
                                 → 更新 DOM（React transition）
                                 → pushState（更新 URL）
```

## 📖 文档

**核心文档**（推荐阅读顺序）：

1. **[FEATURE_COMPARISON_AND_ROADMAP.md](./docs/FEATURE_COMPARISON_AND_ROADMAP.md)** ⭐ 从这里开始
   - 与 Next.js 15 的完整功能对比
   - 核心架构和数据流
   - 6 大核心技术详解（RSC、Flight Protocol、ISR、动态路由、路由组、错误处理）
   - 推荐学习路径

2. **[FLIGHT_PROTOCOL_DEEP_DIVE.md](./docs/FLIGHT_PROTOCOL_DEEP_DIVE.md)** ⭐ 深度解析
   - Flight Protocol 协议格式完整规范
   - Module Reference 机制
   - 编码器/解码器实现
   - 双模式解码（SSG vs 客户端）
   - 实际案例分析

3. **[SERVER_ACTIONS_IMPLEMENTATION.md](./docs/SERVER_ACTIONS_IMPLEMENTATION.md)** ⭐ 新增
   - Server Actions ('use server') 完整实现指南
   - 构建时扫描 → Action Manifest → 运行时 RPC
   - Flight Protocol 集成 Server Actions
   - 安全性考虑（闭包加密、CSRF 防护）
   - Next.js 真实实现原理对比

4. **[CLIENT_COMPONENT_LOADING.md](./docs/CLIENT_COMPONENT_LOADING.md)** ⭐ 必读
   - Client Component 的 5 种加载场景详解
   - SSR 初次加载、客户端导航、预加载、动态导入、React.lazy
   - 网络请求时间线分析
   - 缓存机制详解
   - 性能优化建议

5. **[SERVER_RUNTIME_AND_ISR.md](./docs/SERVER_RUNTIME_AND_ISR.md)**
   - 服务端运行时架构
   - 请求处理管道
   - ISR 实现（Stale-while-revalidate）
   - 路由匹配算法
   - 并发安全和原子写入

6. **[ROUTE_SCANNING_AND_CONFIG.md](./docs/ROUTE_SCANNING_AND_CONFIG.md)**
   - 路由扫描系统实现
   - 配置提取机制（revalidate、dynamic）
   - 配置传递流程（构建时 → 运行时）
   - 动态路由和 generateStaticParams

7. **[NEXTJS_CACHING_STRATEGIES.md](./docs/NEXTJS_CACHING_STRATEGIES.md)**
   - Next.js 15 缓存策略
   - 四层缓存架构
   - Mini Next.js 实现对比
   - 最佳实践

## 🎓 学习路径

**入门**:
1. 阅读本 README 了解项目概况
2. 运行项目并探索示例页面
3. 阅读 `FEATURE_COMPARISON_AND_ROADMAP.md` 理解架构和功能对比
4. 观察浏览器 DevTools 和控制台日志

**进阶**:
5. 阅读 `FLIGHT_PROTOCOL_DEEP_DIVE.md` 深入协议原理
6. 阅读 `CLIENT_COMPONENT_LOADING.md` 理解加载机制
7. 阅读 `SERVER_RUNTIME_AND_ISR.md` 理解服务端运行时
8. 查看源码实现细节
9. 检查 `.next/` 构建输出文件

**高级**:
10. 修改 `app/` 示例并观察变化
11. 创建自己的 Server/Client Components
12. 实现新功能并追踪 Flight Protocol 数据
13. 对比真实 Next.js 源码

## 🆚 与真实 Next.js 对比

### 实现状态

| 类别 | Mini Next.js | 说明 |
|------|--------------|------|
| **核心功能** | 95% | RSC、Flight Protocol、SSG、ISR、Streaming SSR |
| **路由系统** | 90% | 文件系统路由、动态路由、路由组、catch-all |
| **数据获取** | 85% | 异步组件、params、searchParams、generateStaticParams |
| **错误处理** | 100% | error.tsx、global-error.tsx、not-found.tsx |
| **高级功能** | 25% | 无 API 路由、中间件、并行路由 |
| **缓存系统** | 60% | Full Route Cache（SSG/ISR）、基础路由缓存 |

**总体实现度**: **65%**（核心功能: 95%，高级功能: 25%）

> 详见 [FEATURE_COMPARISON_AND_ROADMAP.md](./docs/FEATURE_COMPARISON_AND_ROADMAP.md) 了解详细功能对比

## 💡 你将学到

**核心原理**:
- React Server Components 如何分离服务端/客户端执行
- Flight Protocol 序列化和反序列化
- Streaming SSR 和渐进式 Hydration
- RSC 架构中的客户端路由
- ISR 实现和缓存策略

**实现细节**:
- 路由扫描和 manifest 生成
- RSC 渲染管道
- Client Component 加载和懒加载
- Error Boundaries 和 Suspense 集成
- 构建时 vs 运行时行为

**技术栈**: React 18 + Vite + Express + ESM

## 📝 教学说明

这是一个**教学项目**，专注核心概念，有意省略生产环境复杂性：

**✅ 已实现**:
- 核心 RSC 和 Flight Protocol 机制
- 完整的 SSG/ISR 实现（Stale-while-revalidate）
- 文件系统路由（动态路由 + 路由组）
- generateStaticParams 静态生成
- 异步 Server Components + Suspense
- 完整错误处理（error.tsx、global-error.tsx、not-found.tsx）
- 客户端软路由导航

**📖 已文档化（实现指南）**:
- Server Actions ('use server') - 详见 [SERVER_ACTIONS_IMPLEMENTATION.md](./docs/SERVER_ACTIONS_IMPLEMENTATION.md)

**❌ 未实现**:
- API 路由（route.ts）
- 中间件（Middleware）
- 并行路由 / 拦截路由
- Data Cache / Request Memoization
- Metadata API
- 客户端 Hooks（useRouter、usePathname 等）

**目标**: 用简洁的 TypeScript 代码理解 Next.js App Router 核心原理

## 📚 参考资料

- [React Server Components RFC](https://github.com/reactjs/rfcs/blob/main/text/0188-server-components.md)
- [Next.js App Router 文档](https://nextjs.org/docs/app)
- [React 18 Streaming SSR](https://react.dev/reference/react-dom/server/renderToReadableStream)

## 📄 许可证

MIT

---

**愉快学习！🎉**

通过从零构建来理解 Next.js App Router！
