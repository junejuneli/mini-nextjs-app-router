'use client'

import React from 'react'

/**
 * 全局错误处理 - Global Error Boundary
 *
 * Next.js 特性：
 * - global-error.jsx 是最顶层的错误边界
 * - 捕获 root layout.jsx 中的错误
 * - 必须是 Client Component ('use client')
 * - 必须包含自己的 <html> 和 <body> 标签
 * - 会完全替换整个应用
 *
 * 与 error.jsx 的区别：
 * - error.jsx 不能捕获同级 layout 的错误
 * - global-error.jsx 可以捕获 root layout 的错误
 * - global-error.jsx 是"最后的防线"
 *
 * 注意：
 * - 生产环境才会触发（开发环境会显示错误覆盖层）
 * - 很少会用到，因为 root layout 通常很稳定
 */

export default function GlobalError({ error, reset }) {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>应用错误 - Mini Next.js</title>
        <style>{`
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: system-ui, -apple-system, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
          }

          .error-container {
            max-width: 600px;
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
          }

          .error-icon {
            fontSize: 64px;
            marginBottom: 20px;
            textAlign: center;
          }

          h1 {
            color: #d00;
            marginBottom: 16px;
            textAlign: center;
          }

          .error-message {
            background: #fee;
            padding: 16px;
            borderRadius: 8px;
            border: 2px solid #fcc;
            marginBottom: 24px;
          }

          .error-message code {
            fontFamily: monospace;
            fontSize: 14px;
            color: #c00;
            display: block;
            marginTop: 8px;
          }

          .button-group {
            display: flex;
            gap: 12px;
            justifyContent: center;
            flexWrap: wrap;
          }

          button {
            padding: 12px 24px;
            fontSize: 16px;
            fontWeight: 600;
            border: none;
            borderRadius: 6px;
            cursor: pointer;
            transition: transform 0.2s;
          }

          button:hover {
            transform: translateY(-2px);
          }

          .btn-primary {
            backgroundColor: #4CAF50;
            color: white;
          }

          .btn-secondary {
            backgroundColor: #2196F3;
            color: white;
          }

          .info-box {
            marginTop: 32px;
            padding: 20px;
            backgroundColor: #f9f9f9;
            borderRadius: 8px;
            fontSize: 14px;
          }

          .info-box h3 {
            marginBottom: 12px;
            fontSize: 16px;
          }

          .info-box ul {
            paddingLeft: 20px;
            lineHeight: 1.8;
          }
        `}</style>
      </head>
      <body>
        <div className="error-container">
          <div className="error-icon">💥</div>

          <h1>应用遇到了严重错误</h1>

          <p style={{
            textAlign: 'center',
            color: '#666',
            marginBottom: '24px'
          }}>
            很抱歉，应用程序遇到了无法恢复的错误。
          </p>

          <div className="error-message">
            <strong>错误信息：</strong>
            <code>{error?.message || '未知错误'}</code>
          </div>

          <div className="button-group">
            <button
              onClick={reset}
              className="btn-primary"
            >
              🔄 重试
            </button>

            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.location.href = '/'
                }
              }}
              className="btn-secondary"
            >
              🏠 返回首页
            </button>
          </div>

          <div className="info-box">
            <h3>💡 关于 global-error.jsx</h3>
            <ul>
              <li><strong>最后防线</strong>：捕获整个应用的错误</li>
              <li><strong>包含 HTML</strong>：必须提供完整的 html/body 标签</li>
              <li><strong>替换应用</strong>：错误时完全替换整个页面</li>
              <li><strong>生产环境</strong>：只在生产环境生效</li>
              <li><strong>很少触发</strong>：通常只有 root layout 错误时才会用到</li>
            </ul>
          </div>

          <div style={{
            marginTop: '32px',
            paddingTop: '20px',
            borderTop: '1px solid #e0e0e0',
            textAlign: 'center',
            fontSize: '13px',
            color: '#999'
          }}>
            Mini Next.js App Router © 2025
          </div>
        </div>
      </body>
    </html>
  )
}
