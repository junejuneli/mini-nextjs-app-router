'use client'

import React, { useState } from 'react'

/**
 * 仪表盘页面 - Client Component
 *
 * 演示特性：
 * - Client Component ('use client' 指令)
 * - 可以使用 useState, useEffect 等 Hooks
 * - 可以绑定事件处理器
 * - 会发送到客户端 (有 JS Bundle)
 */

export default function DashboardPage() {
  const [count, setCount] = useState(0)
  const [message, setMessage] = useState('')

  return (
    <div>
      <h1>📊 仪表盘 <span className="badge">Client Component</span></h1>

      <div className="card">
        <h2>🎛️ 交互演示</h2>
        <p>这是一个 Client Component，可以使用 React Hooks 和事件处理器。</p>

        <div style={{ marginTop: '1.5rem' }}>
          <h3>计数器</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: '1rem 0' }}>{count}</p>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={() => setCount(count + 1)}>增加</button>
            <button onClick={() => setCount(count - 1)}>减少</button>
            <button onClick={() => setCount(0)}>重置</button>
          </div>
        </div>

        <div style={{ marginTop: '2rem' }}>
          <h3>输入框</h3>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="输入一些文字..."
            style={{
              padding: '0.75rem',
              fontSize: '1rem',
              border: '2px solid #ddd',
              borderRadius: '4px',
              width: '100%',
              maxWidth: '400px'
            }}
          />
          {message && (
            <p style={{ marginTop: '1rem' }}>你输入了: <strong>{message}</strong></p>
          )}
        </div>
      </div>

      <div className="card">
        <h2>🔍 Client Component 特性</h2>
        <ul style={{ paddingLeft: '1.5rem' }}>
          <li>✅ 可以使用 useState, useEffect 等 Hooks</li>
          <li>✅ 可以绑定事件处理器 (onClick, onChange 等)</li>
          <li>✅ 可以访问浏览器 API (window, document 等)</li>
          <li>✅ 可以使用第三方客户端库</li>
          <li>❌ 不能直接访问服务端资源 (数据库, 文件系统等)</li>
          <li>❌ 代码会发送到客户端 (增加 Bundle 大小)</li>
        </ul>
      </div>

      <div style={{
        marginTop: '2rem',
        padding: '1rem',
        background: '#eff6ff',
        borderLeft: '4px solid #0070f3',
        borderRadius: '4px'
      }}>
        <strong>💡 原理说明</strong>
        <p style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
          1. 这个组件在服务端<strong>预渲染</strong>为静态 HTML<br/>
          2. Flight Protocol 将其标记为 Client Component 引用<br/>
          3. 客户端接收后，动态加载组件 JS 代码<br/>
          4. React 执行 <strong>Hydration</strong>，绑定事件处理器<br/>
          5. 现在可以交互了！
        </p>
      </div>
    </div>
  )
}
