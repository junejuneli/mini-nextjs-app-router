import React from 'react'
import Link from '../../../client/Link.jsx'

/**
 * 博客详情页 - 动态路由 Server Component
 *
 * Next.js 动态路由特性：
 * - [slug] 语法表示动态路由参数
 * - params 对象包含路由参数（如 { slug: 'react-server-components' }）
 * - generateStaticParams() 用于 SSG（静态生成所有可能的路径）
 * - 可以在服务端获取数据（数据库、API、文件系统）
 *
 * 路由示例：
 * - /blog/react-server-components → params.slug = 'react-server-components'
 * - /blog/nextjs-app-router → params.slug = 'nextjs-app-router'
 */

// 模拟博客数据库
const blogData = {
  'react-server-components': {
    title: 'React Server Components 深入解析',
    date: '2025-01-15',
    author: '技术团队',
    category: 'React',
    readTime: '8 分钟',
    content: `
## 什么是 React Server Components？

React Server Components (RSC) 是 React 18 引入的新特性，允许组件在服务端渲染，并将渲染结果序列化传输到客户端。

## 核心优势

### 1. Zero Bundle Size
Server Components 的代码不会发送到客户端，减少 JavaScript 包大小。

### 2. 直接访问后端资源
可以直接访问数据库、文件系统，无需 API 层。

### 3. 自动代码分割
每个 Client Component 自动成为代码分割点。

## 工作原理

1. **服务端渲染**: Server Component 在服务端执行
2. **序列化**: 使用 Flight Protocol 将 React 树序列化
3. **传输**: 将序列化数据发送到客户端
4. **重建**: 客户端重建 React 树并渲染

## 最佳实践

- 默认使用 Server Components
- 只在需要交互时使用 'use client'
- 组合使用 Server 和 Client Components
- 利用 Suspense 边界优化加载体验
    `
  },
  'nextjs-app-router': {
    title: 'Next.js App Router 完全指南',
    date: '2025-01-10',
    author: '技术团队',
    category: 'Next.js',
    readTime: '12 分钟',
    content: `
## App Router 简介

Next.js 13 引入的 App Router 基于 React Server Components，提供了全新的路由系统。

## 文件系统路由

### 特殊文件
- \`page.jsx\` - 页面组件
- \`layout.jsx\` - 布局组件
- \`loading.jsx\` - 加载状态
- \`error.jsx\` - 错误处理
- \`not-found.jsx\` - 404 页面

### 动态路由
- \`[slug]\` - 单个参数
- \`[...slug]\` - 捕获所有路由
- \`(group)\` - 路由组（不影响 URL）

## 布局系统

嵌套布局会自动继承，根 layout 包裹所有子路由。

## 加载和错误处理

使用 loading.jsx 和 error.jsx 实现细粒度的 UI 状态管理。
    `
  },
  'flight-protocol-explained': {
    title: 'Flight Protocol 协议详解',
    date: '2025-01-05',
    author: '技术团队',
    category: '技术原理',
    readTime: '10 分钟',
    content: `
## Flight Protocol 是什么？

Flight Protocol 是 React Server Components 使用的序列化协议，用于将 React 树编码为可传输的格式。

## 协议格式

### Chunk 类型
- \`M{id}:{moduleInfo}\` - 模块引用（Client Component）
- \`J{id}:{json}\` - JSON 数据（React 元素结构）
- \`S{id}:{symbol}\` - Symbol 类型
- \`E{id}:{error}\` - 错误信息

### 示例

\`\`\`
M1:{"id":"./Button.jsx","name":"default"}
J0:["$","div",null,{"children":["$","@1",null,{"text":"Click"}]}]
\`\`\`

## 解析流程

1. 按行分割 Flight 数据
2. 解析每行，存入 modules/chunks Map
3. 从根 chunk (J0) 开始递归解析
4. 遇到 Client Component 引用（@N）时加载对应模块

## 优势

- 高效序列化
- 支持流式传输
- 自动代码分割
    `
  },
  'streaming-ssr': {
    title: '流式 SSR 和 Suspense',
    date: '2024-12-28',
    author: '技术团队',
    category: 'Performance',
    readTime: '6 分钟',
    content: `
## 传统 SSR 的问题

传统 SSR 必须等待所有数据加载完成才能发送 HTML，导致首屏时间（TTFB）变长。

## Streaming SSR 解决方案

React 18 的 Streaming SSR 结合 Suspense，可以：

1. **即时发送静态部分**: 不等待所有数据
2. **流式发送动态部分**: 数据就绪后立即发送
3. **渐进式增强**: 页面逐步变得可交互

## 使用方式

### 1. loading.jsx
在路由中添加 loading.jsx 自动创建 Suspense 边界。

### 2. Suspense 组件
在组件中手动使用 Suspense 实现细粒度控制。

## 最佳实践

- 为慢速数据源使用 Suspense
- 提供有意义的 fallback UI
- 避免过度使用（会增加复杂度）
    `
  }
}

/**
 * generateStaticParams - SSG 静态生成
 *
 * 返回所有可能的动态路由参数
 * 构建时会为每个参数生成静态页面
 */
export async function generateStaticParams() {
  // 返回所有博客 slug
  return Object.keys(blogData).map(slug => ({
    slug
  }))
}

export default function BlogPostPage({ params }) {
  const { slug } = params
  const post = blogData[slug]

  // 如果文章不存在，显示 404 提示
  // 在真实项目中，应该调用 notFound() 函数
  if (!post) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
        <h1>📄 文章未找到</h1>
        <p style={{ color: '#666', marginTop: '16px' }}>
          抱歉，文章 &quot;{slug}&quot; 不存在。
        </p>
        <Link href="/blog">
          <button style={{ marginTop: '24px' }}>返回博客列表</button>
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* 返回按钮 */}
      <Link href="/blog" style={{
        display: 'inline-flex',
        alignItems: 'center',
        marginBottom: '24px',
        color: '#0070f3',
        textDecoration: 'none'
      }}>
        ← 返回博客列表
      </Link>

      {/* 文章头部 */}
      <article>
        <header style={{ marginBottom: '32px' }}>
          <div style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <span className="badge">{post.category}</span>
            <span style={{ color: '#999', fontSize: '14px' }}>{post.readTime}</span>
          </div>

          <h1 style={{ fontSize: '36px', marginBottom: '16px' }}>
            {post.title}
          </h1>

          <div style={{
            display: 'flex',
            gap: '16px',
            fontSize: '14px',
            color: '#666'
          }}>
            <span>👤 {post.author}</span>
            <span>📅 {post.date}</span>
          </div>
        </header>

        {/* 文章内容 */}
        <div
          className="card"
          style={{
            fontSize: '16px',
            lineHeight: '1.8',
            whiteSpace: 'pre-wrap'
          }}
        >
          {post.content}
        </div>
      </article>

      {/* 技术说明 */}
      <div className="card" style={{ marginTop: '48px' }}>
        <h3>💡 动态路由技术说明</h3>
        <ul style={{ fontSize: '14px', lineHeight: '1.8' }}>
          <li><strong>路由参数</strong>：当前 slug = &quot;{slug}&quot;</li>
          <li><strong>SSG 生成</strong>：使用 <code>generateStaticParams()</code> 预生成所有文章</li>
          <li><strong>Server Component</strong>：可以直接访问数据库获取文章内容</li>
          <li><strong>SEO 优化</strong>：每篇文章都是完整的 HTML，利于搜索引擎</li>
        </ul>
      </div>
    </div>
  )
}
