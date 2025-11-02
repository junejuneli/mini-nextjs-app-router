'use client'

import React, { useState } from 'react'

/**
 * 设置页面 - Client Component
 *
 * 演示特性：
 * - Client Component（'use client'）
 * - 使用 React hooks (useState)
 * - 表单交互
 * - 嵌套在 Dashboard 布局中
 *
 * 注意：
 * - 标记为 'use client' 才能使用 hooks 和浏览器 API
 * - 嵌套布局（dashboard/layout.jsx）会保持不变
 */

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    theme: 'light',
    language: 'zh-CN',
    notifications: true,
    autoSave: true,
    showTips: true
  })

  const [saved, setSaved] = useState(false)

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleSave = () => {
    // 模拟保存操作
    console.log('保存设置:', settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div>
      <h1 style={{ marginBottom: '8px' }}>⚙️ 系统设置</h1>
      <p style={{ color: '#666', marginBottom: '32px' }}>
        管理您的应用偏好和配置
      </p>

      {/* 外观设置 */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>
          🎨 外观设置
        </h2>

        <div style={{ marginBottom: '16px' }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '600',
            marginBottom: '8px'
          }}>
            主题
          </label>
          <select
            value={settings.theme}
            onChange={(e) => handleChange('theme', e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              fontSize: '14px',
              width: '200px'
            }}
          >
            <option value="light">浅色</option>
            <option value="dark">深色</option>
            <option value="auto">跟随系统</option>
          </select>
        </div>

        <div>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '600',
            marginBottom: '8px'
          }}>
            语言
          </label>
          <select
            value={settings.language}
            onChange={(e) => handleChange('language', e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              fontSize: '14px',
              width: '200px'
            }}
          >
            <option value="zh-CN">简体中文</option>
            <option value="en-US">English</option>
            <option value="ja-JP">日本語</option>
          </select>
        </div>
      </div>

      {/* 通知设置 */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>
          🔔 通知设置
        </h2>

        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '12px',
          cursor: 'pointer'
        }}>
          <input
            type="checkbox"
            checked={settings.notifications}
            onChange={(e) => handleChange('notifications', e.target.checked)}
            style={{
              width: '18px',
              height: '18px',
              cursor: 'pointer'
            }}
          />
          <span style={{ fontSize: '14px' }}>启用通知</span>
        </label>

        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          cursor: 'pointer'
        }}>
          <input
            type="checkbox"
            checked={settings.showTips}
            onChange={(e) => handleChange('showTips', e.target.checked)}
            style={{
              width: '18px',
              height: '18px',
              cursor: 'pointer'
            }}
          />
          <span style={{ fontSize: '14px' }}>显示提示</span>
        </label>
      </div>

      {/* 编辑器设置 */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>
          📝 编辑器设置
        </h2>

        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          cursor: 'pointer'
        }}>
          <input
            type="checkbox"
            checked={settings.autoSave}
            onChange={(e) => handleChange('autoSave', e.target.checked)}
            style={{
              width: '18px',
              height: '18px',
              cursor: 'pointer'
            }}
          />
          <span style={{ fontSize: '14px' }}>自动保存</span>
        </label>
      </div>

      {/* 保存按钮 */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <button
          onClick={handleSave}
          style={{
            padding: '12px 24px',
            fontSize: '15px',
            fontWeight: '600',
            backgroundColor: saved ? '#4CAF50' : '#0070f3',
            transition: 'background-color 0.3s'
          }}
        >
          {saved ? '✓ 已保存' : '💾 保存设置'}
        </button>

        {saved && (
          <span style={{
            color: '#4CAF50',
            fontSize: '14px',
            fontWeight: '600'
          }}>
            设置已成功保存！
          </span>
        )}
      </div>

      {/* 技术说明 */}
      <div className="card" style={{ marginTop: '48px' }}>
        <h3>💡 技术实现</h3>
        <ul style={{ fontSize: '14px', lineHeight: '1.8' }}>
          <li><strong>Client Component</strong>：使用 'use client' 指令</li>
          <li><strong>React Hooks</strong>：useState 管理表单状态</li>
          <li><strong>嵌套布局</strong>：继承 dashboard/layout.jsx 的侧边栏</li>
          <li><strong>交互性</strong>：实时响应用户输入</li>
        </ul>
      </div>
    </div>
  )
}
