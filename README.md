# Mini Next.js App Router

> 教学向的 Next.js App Router 实现，深入理解 React Server Components 和 Flight Protocol 原理

## 核心特性

- ✅ **React Server Components (RSC)** - Server/Client 组件混用
- ✅ **RSC Flight Protocol** - 自定义序列化格式传输 React 树
- ✅ **Streaming SSR** - 结合 Suspense 的流式渲染
- ✅ **嵌套 Layout** - 自动布局嵌套 + 软导航
- ✅ **文件系统路由** - app/ 目录约定式路由
- ✅ **特殊文件** - loading.jsx, error.jsx, not-found.jsx
- ✅ **动态路由** - [param] 和 [...catchAll]

## 快速开始

```bash
# 安装依赖
npm install

# 构建项目
npm run build

# 启动服务器
npm start
```

访问 http://localhost:3000

## 项目结构

```
mini-nextjs-app-router/
├── app/                    # 用户应用目录
│   ├── layout.jsx         # Root Layout (必需)
│   ├── page.jsx           # 首页
│   └── ...
│
├── build/                  # 构建系统
│   ├── scan-app.js        # 扫描 app/ 目录
│   └── ...
│
├── server/                 # 服务端运行时
│   ├── flight-encoder.js  # Flight Protocol 编码器
│   ├── rsc-renderer.js    # RSC 渲染器
│   └── ...
│
└── client/                 # 客户端运行时
    ├── module-map.ts      # 模块映射 + Flight Protocol 解码器
    └── ...
```

## 核心原理

### 1. React Server Components

**Server Component** (默认):
- 只在服务端执行
- 可以直接访问数据库、文件系统
- 不发送到客户端（Zero Bundle）

**Client Component** (`'use client'`):
- 服务端预渲染 + 客户端 Hydration
- 可以使用 useState, useEffect 等 Hooks
- 发送到客户端，可交互

### 2. Flight Protocol

序列化格式，用于传输包含 Server/Client 组件的 React 树：

```
M1:{"id":"./Button.jsx","chunks":["Button"],"name":"default"}
J0:["$","div",null,{"children":["$","@1",null,{"text":"Click"}]}]
```

- `M` = Module Reference (Client Component 引用)
- `J` = JSON (普通数据)
- `@1` = 引用 ID 为 1 的模块

### 3. Streaming SSR

结合 React 18 Suspense，实现渐进式内容传输：

```
100ms → 发送 Shell (Layout + Loading)
500ms → 发送部分内容 (Suspense 完成)
用户立即看到框架，无需等待所有数据
```

## 学习资源

### 📚 核心文档

**必读文档** (建议按顺序阅读):

1. **[CLIENT_COMPONENT_LOADING.md](./CLIENT_COMPONENT_LOADING.md)** ⭐ 重点
   - Client Component 的 5 种加载时机详解
   - SSR 初次加载、客户端导航、Link 预加载、动态导入、React.lazy
   - 网络请求时间线分析
   - 缓存机制详解
   - 性能优化建议

2. **[FLIGHT_PROTOCOL_DEEP_DIVE.md](./FLIGHT_PROTOCOL_DEEP_DIVE.md)**
   - Flight Protocol 协议格式完整解析
   - Module Reference 机制
   - 编码器/解码器实现原理
   - 与 JSON 序列化的对比
   - 实际案例分析

3. **[THEME_SWITCHING_COMPARISON.md](./THEME_SWITCHING_COMPARISON.md)**
   - 主题切换功能在 Page Router 和 App Router 下的完整实现
   - 运行逻辑详细对比
   - 状态管理最佳实践
   - 性能对比分析

4. **[FIXES.md](./FIXES.md)**
   - 关键问题修复说明
   - 嵌套 Layout 系统修复
   - Hydration Mismatch 解决方案

### 📖 代码实现

**核心源码**:
- [server/flight-encoder.js](./server/flight-encoder.js) - Flight Protocol 编码器实现
- [client/module-map.ts](./client/module-map.ts) - 模块映射与 Flight Protocol 解码器实现
- [server/rsc-renderer.js](./server/rsc-renderer.js) - RSC 渲染器
- [build/scan-app.js](./build/scan-app.js) - app/ 目录扫描

### 🎯 学习路径

**入门**:
1. 阅读本 README 了解项目概况
2. 运行项目体验功能
3. 阅读 `CLIENT_COMPONENT_LOADING.md` 理解加载机制

**进阶**:
4. 阅读 `FLIGHT_PROTOCOL_DEEP_DIVE.md` 深入协议原理
5. 阅读 `THEME_SWITCHING_COMPARISON.md` 学习实战对比
6. 查看源码实现细节

**实践**:
7. 修改 app/ 目录下的示例代码
8. 创建自己的 Server/Client Components
9. 实现新功能并观察 Flight Protocol 数据

## License

MIT
