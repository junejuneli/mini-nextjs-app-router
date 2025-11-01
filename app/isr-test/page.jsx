import React from 'react'

/**
 * ISR 测试页面
 *
 * revalidate: 10 - 每 10 秒重新验证一次
 */

// ISR 配置：每 10 秒重新生成
export const revalidate = 10

export default function ISRTestPage() {
  const currentTime = new Date().toISOString()

  return (
    <div>
      <h1>🔄 ISR (Incremental Static Regeneration) 测试</h1>

      <div className="card">
        <h2>⏰ 生成时间</h2>
        <p style={{ fontSize: '1.5rem', fontFamily: 'monospace', color: '#0070f3' }}>
          {currentTime}
        </p>
        <p style={{ marginTop: '0.5rem', color: '#666' }}>
          这是页面在服务端生成的时间
        </p>
      </div>

      <div className="card">
        <h2>🎯 ISR 工作原理</h2>
        <p>
          本页面配置了 <code style={{ background: '#f0f0f0', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>revalidate = 10</code>
        </p>

        <ol style={{ paddingLeft: '1.5rem', marginTop: '1rem', lineHeight: '1.8' }}>
          <li><strong>首次访问</strong>: 返回构建时预渲染的页面</li>
          <li><strong>10秒内再次访问</strong>: 直接返回缓存</li>
          <li><strong>10秒后访问</strong>:
            <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
              <li>立即返回旧的缓存页面(Stale-while-revalidate)</li>
              <li>后台触发重新生成</li>
            </ul>
          </li>
          <li><strong>重新生成后访问</strong>: 返回新生成的页面</li>
        </ol>
      </div>

      <div className="card">
        <h2>🧪 测试步骤</h2>
        <ol style={{ paddingLeft: '1.5rem', marginTop: '1rem', lineHeight: '1.8' }}>
          <li>记录当前显示的时间</li>
          <li>刷新页面多次 → 时间不变(使用缓存)</li>
          <li>等待 10 秒后刷新 → 返回旧时间 + 后台重新生成</li>
          <li>再次刷新 → 显示新时间</li>
          <li>检查服务器日志，查看重新生成过程</li>
        </ol>
      </div>

      <div style={{
        marginTop: '2rem',
        padding: '1rem',
        background: '#e7f3ff',
        borderLeft: '4px solid #0070f3',
        borderRadius: '4px'
      }}>
        <strong>💡 优化提示</strong>
        <p style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
          ISR 结合了 SSG 的性能和 SSR 的实时性：<br/>
          • 用户始终获得快速响应(使用缓存)<br/>
          • 内容定期更新(后台重新生成)<br/>
          • 服务器负载低(大部分请求使用缓存)
        </p>
      </div>

      <div style={{
        marginTop: '1rem',
        padding: '1rem',
        background: '#fffbeb',
        borderLeft: '4px solid #f59e0b',
        borderRadius: '4px'
      }}>
        <strong>📊 对比其他渲染模式</strong>
        <table style={{ width: '100%', marginTop: '0.5rem', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd' }}>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>模式</th>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>速度</th>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>实时性</th>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>服务器负载</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '0.5rem' }}><strong>SSG</strong></td>
              <td style={{ padding: '0.5rem' }}>⚡⚡⚡</td>
              <td style={{ padding: '0.5rem' }}>❌</td>
              <td style={{ padding: '0.5rem' }}>⚡</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem' }}><strong>ISR (本页)</strong></td>
              <td style={{ padding: '0.5rem' }}>⚡⚡⚡</td>
              <td style={{ padding: '0.5rem' }}>✅</td>
              <td style={{ padding: '0.5rem' }}>⚡</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem' }}><strong>SSR</strong></td>
              <td style={{ padding: '0.5rem' }}>⚡</td>
              <td style={{ padding: '0.5rem' }}>✅✅</td>
              <td style={{ padding: '0.5rem' }}>🔥🔥</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
