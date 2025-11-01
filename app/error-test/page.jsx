import React from 'react'

/**
 * 错误测试页面 - Server Component
 *
 * 演示：
 * - 如何触发错误
 * - Error Boundary 的工作机制
 * - 错误恢复功能
 */

export default function ErrorTestPage() {
  // 模拟一个运行时错误
  const shouldThrowError = new Date().getSeconds() % 2 === 0

  if (shouldThrowError) {
    throw new Error('这是一个测试错误！当前秒数是偶数。')
  }

  return (
    <div>
      <h1>🎉 没有错误！</h1>
      <p>当前秒数是奇数，页面正常渲染。</p>
      <p>刷新页面可能会触发错误（50% 概率）。</p>

      <div style={{
        marginTop: '20px',
        padding: '15px',
        backgroundColor: '#f0f0f0',
        borderRadius: '5px'
      }}>
        <h3>💡 说明</h3>
        <ul>
          <li>这个页面会在偶数秒时抛出错误</li>
          <li>奇数秒正常显示</li>
          <li>如果配置了 error.jsx，会显示错误 UI</li>
          <li>刷新页面可以测试错误恢复</li>
        </ul>
      </div>
    </div>
  )
}
