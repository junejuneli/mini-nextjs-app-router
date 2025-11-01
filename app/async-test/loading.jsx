import React from 'react'

/**
 * Loading UI - Server Component
 *
 * 在 Suspense 边界等待时显示
 * - 自动包裹在 Suspense 中
 * - 在页面加载时显示
 * - 在导航时显示
 */

export default function Loading() {
  return (
    <div style={{
      padding: '40px',
      textAlign: 'center'
    }}>
      <div style={{
        display: 'inline-block',
        padding: '30px',
        backgroundColor: '#f0f0f0',
        borderRadius: '10px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '5px solid #ddd',
          borderTop: '5px solid #4CAF50',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 20px'
        }} />

        <h2>⏳ 加载中...</h2>
        <p style={{ color: '#666', fontSize: '14px' }}>
          正在获取数据，请稍候
        </p>
      </div>

      <div style={{
        marginTop: '30px',
        padding: '20px',
        backgroundColor: '#f9f9f9',
        borderRadius: '8px',
        maxWidth: '500px',
        margin: '30px auto 0'
      }}>
        <h3>💡 关于 loading.jsx</h3>
        <ul style={{
          textAlign: 'left',
          fontSize: '14px',
          lineHeight: '1.8'
        }}>
          <li><strong>自动 Suspense</strong>：Next.js 自动用 Suspense 包裹页面</li>
          <li><strong>流式渲染</strong>：配合 Streaming SSR 使用</li>
          <li><strong>即时反馈</strong>：用户立即看到加载状态</li>
          <li><strong>可选文件</strong>：如果没有 loading.jsx，使用默认行为</li>
        </ul>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
