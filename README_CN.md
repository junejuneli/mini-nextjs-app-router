# Mini Next.js App Router

> 教学向的 Next.js App Router 实现，深入理解 React Server Components 和 Flight Protocol

[English](./README.md) | 中文文档

## 🎯 学习目标

通过简化实现理解现代 React Server Components 和 Next.js App Router 的工作原理：

- ✅ **React Server Components (RSC)** - Server/Client 组件混用
- ✅ **Flight Protocol** - React 树的自定义序列化格式
- ✅ **Streaming SSR** - 结合 Suspense 的流式渲染
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

1. **[CLIENT_COMPONENT_LOADING.md](./docs/CLIENT_COMPONENT_LOADING.md)** ⭐ 必读
   - Client Component 的 5 种加载场景详解
   - SSR 初次加载、客户端导航、预加载、动态导入、React.lazy
   - 网络请求时间线分析
   - 缓存机制详解
   - 性能优化建议

2. **[FLIGHT_PROTOCOL_DEEP_DIVE.md](./docs/FLIGHT_PROTOCOL_DEEP_DIVE.md)** ⭐ 深度解析
   - Flight Protocol 协议格式完整规范
   - Module Reference 机制
   - 编码器/解码器实现
   - 与 JSON 序列化对比
   - 实际案例分析

3. **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)**
   - 项目整体架构说明
   - React Server Components 核心概念
   - 渲染管道详解
   - 与真实 Next.js 对比

4. **[ROUTE_SCANNING_AND_CONFIG.md](./docs/ROUTE_SCANNING_AND_CONFIG.md)**
   - 路由扫描系统实现
   - 配置提取机制（revalidate, dynamic）
   - 配置传递流程（构建时 → 运行时）
   - ISR 生命周期详解

5. **[NEXTJS_CACHING_STRATEGIES.md](./docs/NEXTJS_CACHING_STRATEGIES.md)**
   - Next.js 15 缓存策略
   - 四层缓存架构
   - Mini Next.js 实现对比
   - 最佳实践

## 🎓 学习路径

**入门**:
1. 阅读本 README 了解项目概况
2. 运行项目并探索示例页面
3. 阅读 `CLIENT_COMPONENT_LOADING.md` 理解加载机制
4. 观察浏览器 DevTools 和控制台日志

**进阶**:
5. 阅读 `FLIGHT_PROTOCOL_DEEP_DIVE.md` 深入协议原理
6. 阅读 `ARCHITECTURE.md` 理解渲染管道
7. 查看源码实现细节
8. 检查 `.next/` 构建输出文件

**高级**:
9. 修改 `app/` 示例并观察变化
10. 创建自己的 Server/Client Components
11. 实现新功能并追踪 Flight Protocol 数据
12. 对比真实 Next.js 源码

## 🆚 与真实 Next.js 对比

### 功能对比

| 功能 | Mini Next.js | Next.js 15 |
|------|--------------|------------|
| **代码量** | ~2000 行 | 50 万+ 行 |
| **React Server Components** | ✅ 核心实现 | ✅ 完整实现 |
| **Flight Protocol** | ✅ 基础编解码器 | ✅ 优化的流式传输 |
| **文件系统路由** | ✅ app/ 目录 | ✅ + 高级模式 |
| **Streaming SSR** | ✅ 带 Suspense | ✅ + 选择性 Hydration |
| **ISR** | ✅ 时间基础重新验证 | ✅ + 按需重新验证 |
| **客户端路由** | ✅ 基础导航 | ✅ + 智能预取 |
| **缓存** | ⚠️ 基础（仅 SSG/ISR） | ✅ 四层缓存系统 |
| **动态路由** | ✅ [param] + generateStaticParams | ✅ [param] 和 [...slug] |
| **中间件** | ❌ 未实现 | ✅ 完整中间件支持 |
| **图片/字体优化** | ❌ 未实现 | ✅ 自动优化 |

### 缓存层级

| 缓存层 | Mini Next.js | Next.js 15 |
|--------|--------------|------------|
| Request Memoization | ❌ 0% | ✅ 100% |
| Data Cache | ❌ 0% | ✅ 100% |
| Full Route Cache | ⚠️ 60%（SSG/ISR） | ✅ 100% |
| Router Cache | ⚠️ 40%（基础路由） | ✅ 100% |

> 详见 `NEXTJS_CACHING_STRATEGIES.md`

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

- ✅ 核心 RSC 和 Flight Protocol 机制
- ✅ 基础 SSG/ISR 实现
- ✅ 基本路由和导航
- ✅ 带 [param] 语法的动态路由
- ✅ 用于代码组织的路由组
- ❌ 生产级优化
- ❌ 完整错误处理
- ❌ 高级缓存策略
- ❌ Catch-all 路由 [...slug]
- ❌ 中间件和 API 路由

**目标**: 用最少、最易读的代码理解 Next.js App Router 核心原理

## 📚 参考资料

- [React Server Components RFC](https://github.com/reactjs/rfcs/blob/main/text/0188-server-components.md)
- [Next.js App Router 文档](https://nextjs.org/docs/app)
- [React 18 Streaming SSR](https://react.dev/reference/react-dom/server/renderToReadableStream)

## 📄 许可证

MIT

---

**愉快学习！🎉**

通过从零构建来理解 Next.js App Router！
