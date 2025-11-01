import React from 'react'

/**
 * 关于页面 - Server Component
 */

export default function AboutPage() {
  return (
    <div>
      <h1>📖 关于 Mini Next.js App Router</h1>

      <div className="card">
        <h2>🎯 项目目标</h2>
        <p>
          这是一个教学向的 Next.js App Router 实现，旨在深入理解以下核心概念：
        </p>
        <ul style={{ paddingLeft: '1.5rem', marginTop: '1rem' }}>
          <li><strong>RSC 架构</strong> - Server/Client 组件如何协作</li>
          <li><strong>Flight Protocol</strong> - React 树的序列化传输</li>
          <li><strong>Streaming SSR</strong> - 渐进式内容传输</li>
          <li><strong>嵌套 Layout</strong> - 共享布局 + 状态保留</li>
        </ul>
      </div>

      <div className="card">
        <h2>🏗️ 技术栈</h2>
        <ul style={{ paddingLeft: '1.5rem' }}>
          <li>React 18 (Server Components + Suspense)</li>
          <li>Vite (构建工具)</li>
          <li>Express (HTTP 服务器)</li>
          <li>Node.js (ESM)</li>
        </ul>
      </div>

      <div className="card">
        <h2>📂 核心模块</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
          <thead>
            <tr style={{ background: '#f0f0f0' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>模块</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>职责</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['flight-encoder.js', '服务端：编码 React 树为 Flight Protocol'],
              ['flight-decoder.jsx', '客户端：解码 Flight 重建 React 树'],
              ['rsc-renderer.js', '服务端：渲染 Server Components'],
              ['scan-app.js', '构建时：扫描 app/ 目录构建路由树'],
              ['detect-client.js', '分析组件类型 (Server/Client)']
            ].map(([module, desc], i) => (
              <tr key={i}>
                <td style={{ padding: '0.75rem', borderBottom: '1px solid #eee', fontFamily: 'monospace' }}>{module}</td>
                <td style={{ padding: '0.75rem', borderBottom: '1px solid #eee' }}>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>💡 与真实 Next.js 的区别</h2>
        <p><strong>简化之处：</strong></p>
        <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
          <li>不支持完整的 Streaming SSR (使用简化版)</li>
          <li>不支持 API Routes</li>
          <li>不支持 Middleware</li>
          <li>不支持完整的缓存策略</li>
        </ul>

        <p style={{ marginTop: '1rem' }}><strong>核心保留：</strong></p>
        <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
          <li>✅ Flight Protocol 完整实现</li>
          <li>✅ Server/Client 组件边界</li>
          <li>✅ 嵌套 Layout 系统</li>
          <li>✅ 文件系统路由</li>
        </ul>
      </div>
    </div>
  )
}
