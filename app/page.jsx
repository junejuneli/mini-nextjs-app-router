import React from 'react'
import Link from '../client/Link.jsx'

/**
 * 首页 - Server Component
 *
 * 演示特性：
 * - Server Component (默认)
 * - 服务端渲染
 * - 不发送到客户端 (Zero Bundle)
 * - 可以使用 Client Components (如 Link)
 */

export default function HomePage() {
  return (
    <div>
      <h1>🎉 欢迎使用 Mini Next.js App Router</h1>

      <div className="card">
        <h2>✨ 核心特性</h2>
        <ul style={{ paddingLeft: '1.5rem', marginTop: '1rem' }}>
          <li><strong>React Server Components (RSC)</strong> - Server/Client 组件混用</li>
          <li><strong>Flight Protocol</strong> - 自定义序列化格式传输 React 树</li>
          <li><strong>嵌套 Layout</strong> - 自动布局嵌套 + 软导航</li>
          <li><strong>文件系统路由</strong> - app/ 目录约定式路由</li>
          <li><strong>Streaming SSR</strong> - 结合 Suspense 的流式渲染</li>
        </ul>
      </div>

      <div className="card">
        <h2>🖥️ Server Component 特性</h2>
        <p className="badge">Server Component</p>
        <p style={{ marginTop: '1rem' }}>
          这是一个 <strong>Server Component</strong>，它的特点：
        </p>
        <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
          <li>只在服务端执行</li>
          <li>可以直接访问数据库、文件系统</li>
          <li>代码不会发送到客户端（Zero Bundle）</li>
          <li>可以嵌入 Client Component</li>
        </ul>
      </div>

      <div className="card">
        <h2>📚 快速导航</h2>
        <p>点击导航栏探索不同页面：</p>
        <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
          <li><Link href="/about">关于页面</Link> - 另一个 Server Component</li>
          <li><Link href="/dashboard">仪表盘</Link> - 演示 Client Component</li>
        </ul>
      </div>

      <div style={{
        marginTop: '2rem',
        padding: '1rem',
        background: '#fffbeb',
        borderLeft: '4px solid #f59e0b',
        borderRadius: '4px'
      }}>
        <strong>🎓 学习建议</strong>
        <p style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
          1. 打开浏览器控制台，查看 Flight Protocol 数据<br/>
          2. 查看 Network 面板，观察 RSC Payload<br/>
          3. 阅读源代码，理解 Server/Client 组件如何协作
        </p>
      </div>
    </div>
  )
}
