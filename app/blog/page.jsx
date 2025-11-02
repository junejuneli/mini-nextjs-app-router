import React from 'react'
import Link from '../../client/Link.jsx'

/**
 * 博客列表页 - Server Component
 *
 * 演示特性：
 * - Server Component（默认）
 * - 静态数据渲染
 * - 链接到动态路由
 * - 可以添加数据获取逻辑
 */

// 模拟博客数据
const blogPosts = [
  {
    slug: 'react-server-components',
    title: 'React Server Components 深入解析',
    description: '了解 RSC 的工作原理、优势和最佳实践。探索服务端组件如何改变 React 应用的架构。',
    date: '2025-01-15',
    category: 'React',
    readTime: '8 分钟'
  },
  {
    slug: 'nextjs-app-router',
    title: 'Next.js App Router 完全指南',
    description: '从基础到高级，全面了解 App Router 的路由系统、布局、加载状态和错误处理。',
    date: '2025-01-10',
    category: 'Next.js',
    readTime: '12 分钟'
  },
  {
    slug: 'flight-protocol-explained',
    title: 'Flight Protocol 协议详解',
    description: 'RSC 使用的序列化协议，了解如何将 React 树编码为可传输的格式。',
    date: '2025-01-05',
    category: '技术原理',
    readTime: '10 分钟'
  },
  {
    slug: 'streaming-ssr',
    title: '流式 SSR 和 Suspense',
    description: '探索如何使用 Suspense 实现渐进式页面加载，提升用户体验。',
    date: '2024-12-28',
    category: 'Performance',
    readTime: '6 分钟'
  }
]

export default function BlogPage() {
  return (
    <div>
      <h1>📚 技术博客</h1>

      <p style={{ fontSize: '18px', color: '#666', marginBottom: '32px' }}>
        探索 React、Next.js 和现代 Web 开发技术
      </p>

      <div style={{
        display: 'grid',
        gap: '24px',
        gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))'
      }}>
        {blogPosts.map(post => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <article className="card" style={{
              height: '100%',
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
              border: '1px solid #e0e0e0'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px'
              }}>
                <span style={{
                  display: 'inline-block',
                  padding: '4px 12px',
                  backgroundColor: '#e3f2fd',
                  color: '#1976d2',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '600'
                }}>
                  {post.category}
                </span>
                <span style={{ fontSize: '13px', color: '#999' }}>
                  {post.readTime}
                </span>
              </div>

              <h2 style={{
                fontSize: '20px',
                marginBottom: '12px',
                color: '#0070f3'
              }}>
                {post.title}
              </h2>

              <p style={{
                fontSize: '14px',
                color: '#666',
                lineHeight: '1.6',
                marginBottom: '16px'
              }}>
                {post.description}
              </p>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '12px',
                borderTop: '1px solid #eee',
                fontSize: '13px',
                color: '#999'
              }}>
                <span>📅 {post.date}</span>
                <span style={{ color: '#0070f3' }}>阅读更多 →</span>
              </div>
            </article>
          </Link>
        ))}
      </div>

      <div className="card" style={{ marginTop: '48px' }}>
        <h3>💡 关于博客列表页</h3>
        <ul style={{ fontSize: '14px', lineHeight: '1.8' }}>
          <li><strong>Server Component</strong>：在服务端渲染，可以直接访问数据库</li>
          <li><strong>静态生成</strong>：构建时预渲染，访问速度快</li>
          <li><strong>动态路由链接</strong>：点击卡片跳转到 <code>/blog/[slug]</code> 动态路由</li>
          <li><strong>SEO 友好</strong>：完整的 HTML 内容，利于搜索引擎索引</li>
        </ul>
      </div>

      <div style={{
        marginTop: '32px',
        padding: '20px',
        backgroundColor: '#f9f9f9',
        borderRadius: '8px'
      }}>
        <h3>🔍 技术实现</h3>
        <p style={{ fontSize: '14px', lineHeight: '1.8', marginBottom: '12px' }}>
          这个页面演示了：
        </p>
        <ul style={{ fontSize: '14px', lineHeight: '1.8' }}>
          <li>使用 <code>map()</code> 渲染列表数据</li>
          <li>通过 <code>Link</code> 组件实现客户端导航</li>
          <li>响应式网格布局（<code>grid-template-columns</code>）</li>
          <li>在实际项目中，可以从数据库或 CMS 获取博客数据</li>
        </ul>
      </div>
    </div>
  )
}
