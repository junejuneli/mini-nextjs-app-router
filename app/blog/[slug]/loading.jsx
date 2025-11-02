import React from 'react'

/**
 * 博客详情页加载状态 - Loading UI
 *
 * Next.js loading.jsx 特性：
 * - 自动创建 Suspense 边界
 * - 包裹同级 page.jsx 组件
 * - 在数据加载时显示
 * - Server Component（默认）
 *
 * 使用场景：
 * - 异步数据获取
 * - 动态路由参数处理
 * - 提升用户体验
 */

export default function Loading() {
  return (
    <div>
      {/* 返回按钮占位 */}
      <div style={{
        width: '120px',
        height: '20px',
        backgroundColor: '#f0f0f0',
        borderRadius: '4px',
        marginBottom: '24px',
        animation: 'pulse 1.5s ease-in-out infinite'
      }} />

      {/* 文章头部骨架屏 */}
      <div style={{ marginBottom: '32px' }}>
        {/* 分类和阅读时间 */}
        <div style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '16px'
        }}>
          <div style={{
            width: '80px',
            height: '24px',
            backgroundColor: '#f0f0f0',
            borderRadius: '12px',
            animation: 'pulse 1.5s ease-in-out infinite'
          }} />
          <div style={{
            width: '60px',
            height: '24px',
            backgroundColor: '#f0f0f0',
            borderRadius: '4px',
            animation: 'pulse 1.5s ease-in-out infinite'
          }} />
        </div>

        {/* 标题 */}
        <div style={{
          width: '80%',
          height: '48px',
          backgroundColor: '#f0f0f0',
          borderRadius: '8px',
          marginBottom: '16px',
          animation: 'pulse 1.5s ease-in-out infinite'
        }} />

        {/* 作者和日期 */}
        <div style={{
          display: 'flex',
          gap: '16px'
        }}>
          <div style={{
            width: '100px',
            height: '20px',
            backgroundColor: '#f0f0f0',
            borderRadius: '4px',
            animation: 'pulse 1.5s ease-in-out infinite'
          }} />
          <div style={{
            width: '120px',
            height: '20px',
            backgroundColor: '#f0f0f0',
            borderRadius: '4px',
            animation: 'pulse 1.5s ease-in-out infinite'
          }} />
        </div>
      </div>

      {/* 文章内容骨架屏 */}
      <div className="card" style={{ minHeight: '400px' }}>
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            style={{
              width: i % 3 === 0 ? '60%' : '90%',
              height: '16px',
              backgroundColor: '#f0f0f0',
              borderRadius: '4px',
              marginBottom: '12px',
              animation: 'pulse 1.5s ease-in-out infinite',
              animationDelay: `${i * 0.1}s`
            }}
          />
        ))}
      </div>

      {/* 技术说明骨架屏 */}
      <div className="card" style={{ marginTop: '48px' }}>
        <div style={{
          width: '200px',
          height: '24px',
          backgroundColor: '#f0f0f0',
          borderRadius: '4px',
          marginBottom: '16px',
          animation: 'pulse 1.5s ease-in-out infinite'
        }} />
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            style={{
              width: '80%',
              height: '16px',
              backgroundColor: '#f0f0f0',
              borderRadius: '4px',
              marginBottom: '8px',
              animation: 'pulse 1.5s ease-in-out infinite',
              animationDelay: `${i * 0.1}s`
            }}
          />
        ))}
      </div>

      {/* CSS 动画 */}
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>

      {/* 加载提示 */}
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '12px 20px',
        backgroundColor: '#fff',
        border: '2px solid #0070f3',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '14px',
        fontWeight: '600',
        color: '#0070f3',
        zIndex: 1000
      }}>
        <div style={{
          width: '16px',
          height: '16px',
          border: '2px solid #0070f3',
          borderTop: '2px solid transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        加载文章中...
      </div>

      <style>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  )
}
