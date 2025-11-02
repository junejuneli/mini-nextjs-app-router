'use client'

import React, { useState, useEffect } from 'react'

/**
 * 错误测试页面 - Client Component
 *
 * 演示：
 * - 客户端渲染时触发错误
 * - Error Boundary 的工作机制
 * - 错误恢复功能
 *
 * ⚠️ 必须是 Client Component
 * - 错误在客户端渲染时抛出（useEffect）
 * - ErrorBoundary 才能捕获并显示错误 UI
 */

export default function ErrorTestPage(): JSX.Element {
  const [shouldThrowError, setShouldThrowError] = useState(false)
  const [currentSecond, setCurrentSecond] = useState<number | null>(null)

  useEffect(() => {
    // 在客户端挂载后检查是否应该抛出错误
    const second = new Date().getSeconds()
    setCurrentSecond(second)

    if (second % 2 === 0) {
      console.log('🔥 [ErrorTestPage] 即将抛出错误（偶数秒）')
      setShouldThrowError(true)
    } else {
      console.log('✅ [ErrorTestPage] 正常渲染（奇数秒）')
    }
  }, [])

  // 在渲染时抛出错误（会被 ErrorBoundary 捕获）
  if (shouldThrowError) {
    throw new Error(`这是一个测试错误！当前秒数是偶数 (${currentSecond})。`)
  }

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>🎉 没有错误！</h1>
      <p>当前秒数是奇数 ({currentSecond})，页面正常渲染。</p>
      <p>刷新页面可能会触发错误（50% 概率）。</p>

      <div style={{
        marginTop: '30px',
        padding: '20px',
        backgroundColor: '#f0f8ff',
        border: '2px solid #4CAF50',
        borderRadius: '8px'
      }}>
        <h3>💡 ErrorBoundary 工作原理</h3>
        <ul style={{ lineHeight: '1.8' }}>
          <li>✅ 这是一个 <strong>Client Component</strong> (&apos;use client&apos;)</li>
          <li>🔥 在偶数秒时会在客户端渲染时抛出错误</li>
          <li>🛡️ ErrorBoundary 捕获错误并显示降级 UI</li>
          <li>🔄 点击"重试"按钮可以恢复正常渲染</li>
          <li>📝 错误信息会记录到浏览器控制台</li>
        </ul>
      </div>

      <div style={{
        marginTop: '20px',
        padding: '20px',
        backgroundColor: '#fff3cd',
        border: '2px solid #ffc107',
        borderRadius: '8px'
      }}>
        <h3>🔍 测试步骤</h3>
        <ol style={{ lineHeight: '1.8' }}>
          <li>刷新页面多次，直到触发错误（偶数秒）</li>
          <li>观察 ErrorBoundary 显示的红色错误 UI</li>
          <li>点击"🔄 重试"按钮尝试恢复</li>
          <li>查看浏览器控制台的错误日志</li>
        </ol>
      </div>
    </div>
  )
}
