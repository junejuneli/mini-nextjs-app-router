'use client'

import React from 'react'

/**
 * 错误边界组件 - Client Component
 *
 * ⚠️ 必须是 Client Component
 * - Error Boundary 需要使用 componentDidCatch
 * - 或使用 React 18 的错误处理机制
 *
 * Props:
 * - error: 错误对象
 * - reset: 重置函数（重新尝试渲染）
 */

export default function ErrorBoundary({ error, reset }) {
  return (
    <div style={{
      padding: '40px',
      maxWidth: '600px',
      margin: '0 auto'
    }}>
      <div style={{
        backgroundColor: '#fee',
        border: '2px solid #fcc',
        borderRadius: '8px',
        padding: '20px'
      }}>
        <h1 style={{ color: '#c00' }}>❌ 出错了！</h1>

        <div style={{
          backgroundColor: '#fff',
          padding: '15px',
          marginTop: '15px',
          borderRadius: '5px',
          border: '1px solid #ddd'
        }}>
          <h3>错误信息：</h3>
          <p style={{
            color: '#c00',
            fontFamily: 'monospace',
            fontSize: '14px'
          }}>
            {error.message || '未知错误'}
          </p>
        </div>

        <button
          onClick={() => reset()}
          style={{
            marginTop: '20px',
            padding: '10px 20px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          🔄 重试
        </button>

        <div style={{
          marginTop: '20px',
          padding: '15px',
          backgroundColor: '#f9f9f9',
          borderRadius: '5px'
        }}>
          <h3>💡 关于 Error Boundary</h3>
          <ul style={{ fontSize: '14px', lineHeight: '1.6' }}>
            <li><strong>error.jsx 必须是 Client Component</strong></li>
            <li>捕获子组件树中的 JavaScript 错误</li>
            <li>显示降级 UI</li>
            <li>提供重试机制（reset 函数）</li>
            <li>不会捕获以下错误：
              <ul>
                <li>事件处理器中的错误</li>
                <li>异步代码（setTimeout、Promise）</li>
                <li>服务端渲染错误</li>
                <li>Error Boundary 自身的错误</li>
              </ul>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
