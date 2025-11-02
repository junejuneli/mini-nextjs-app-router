import React from 'react'
import Link from '../client/Link.tsx'

/**
 * Not Found 页面 - 404 错误处理
 *
 * Next.js 特性：
 * - not-found.jsx 是特殊文件，处理 404 错误
 * - 当路由不匹配时自动显示
 * - Server Component（默认）
 * - 可以通过 notFound() 函数主动触发
 *
 * 使用场景：
 * - 用户访问不存在的路由
 * - 动态路由参数无效
 * - 数据未找到时主动调用 notFound()
 */

export default function NotFound(): JSX.Element {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      textAlign: 'center',
      padding: '20px'
    }}>
      <div style={{
        fontSize: '120px',
        fontWeight: 'bold',
        color: '#ddd',
        marginBottom: '20px'
      }}>
        404
      </div>

      <h1 style={{
        fontSize: '32px',
        marginBottom: '16px',
        color: '#333'
      }}>
        页面未找到
      </h1>

      <p style={{
        fontSize: '18px',
        color: '#666',
        marginBottom: '32px',
        maxWidth: '500px'
      }}>
        抱歉，您访问的页面不存在。可能已被删除、重命名或暂时不可用。
      </p>

      <div style={{
        display: 'flex',
        gap: '16px',
        flexWrap: 'wrap',
        justifyContent: 'center'
      }}>
        <Link href="/">
          <button style={{
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: 'bold'
          }}>
            🏠 返回首页
          </button>
        </Link>

        <Link href="/blog">
          <button style={{
            padding: '12px 24px',
            fontSize: '16px',
            backgroundColor: '#f5f5f5',
            color: '#333'
          }}>
            📚 查看博客
          </button>
        </Link>
      </div>

      <div className="card" style={{
        marginTop: '48px',
        maxWidth: '600px',
        textAlign: 'left'
      }}>
        <h3>💡 关于 not-found.jsx</h3>
        <ul style={{ fontSize: '14px', lineHeight: '1.8' }}>
          <li><strong>自动触发</strong>：访问不存在的路由时自动显示</li>
          <li><strong>手动触发</strong>：在 Server Component 中调用 <code>notFound()</code></li>
          <li><strong>层级化</strong>：可以在不同路由段定义不同的 404 页面</li>
          <li><strong>Server Component</strong>：默认在服务端渲染</li>
        </ul>
      </div>
    </div>
  )
}
