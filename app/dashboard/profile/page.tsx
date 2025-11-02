'use client'

import React, { useState } from 'react'

/**
 * 个人资料页面 - Client Component
 *
 * 演示特性：
 * - Client Component（'use client'）
 * - 表单状态管理
 * - 图片上传模拟
 * - 嵌套布局
 */

interface Profile {
  name: string
  email: string
  bio: string
  avatar: string
  location: string
  website: string
  github: string
}

export default function ProfilePage(): JSX.Element {
  const [profile, setProfile] = useState<Profile>({
    name: '张三',
    email: 'zhangsan@example.com',
    bio: 'Full Stack Developer | React 爱好者',
    avatar: '👨‍💻',
    location: '北京',
    website: 'https://example.com',
    github: 'zhangsan'
  })

  const [editing, setEditing] = useState(false)
  const [tempProfile, setTempProfile] = useState<Profile>(profile)

  const handleEdit = (): void => {
    setEditing(true)
    setTempProfile(profile)
  }

  const handleSave = (): void => {
    setProfile(tempProfile)
    setEditing(false)
  }

  const handleCancel = (): void => {
    setTempProfile(profile)
    setEditing(false)
  }

  const handleChange = (field: keyof Profile, value: string): void => {
    setTempProfile(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '32px'
      }}>
        <div>
          <h1 style={{ marginBottom: '8px' }}>👤 个人资料</h1>
          <p style={{ color: '#666' }}>
            管理您的个人信息和公开资料
          </p>
        </div>

        {!editing && (
          <button
            onClick={handleEdit}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              backgroundColor: '#f5f5f5',
              color: '#333'
            }}
          >
            ✏️ 编辑资料
          </button>
        )}
      </div>

      {/* 头像和基本信息 */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{
          display: 'flex',
          gap: '24px',
          alignItems: 'start'
        }}>
          {/* 头像 */}
          <div>
            <div style={{
              width: '120px',
              height: '120px',
              fontSize: '64px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#f0f0f0',
              borderRadius: '12px',
              border: '2px solid #e0e0e0'
            }}>
              {editing ? (
                <input
                  type="text"
                  value={tempProfile.avatar}
                  onChange={(e) => handleChange('avatar', e.target.value)}
                  style={{
                    width: '80px',
                    textAlign: 'center',
                    fontSize: '64px',
                    border: 'none',
                    background: 'transparent'
                  }}
                />
              ) : (
                profile.avatar
              )}
            </div>
            {editing && (
              <p style={{
                fontSize: '12px',
                color: '#999',
                marginTop: '8px',
                textAlign: 'center'
              }}>
                输入 emoji
              </p>
            )}
          </div>

          {/* 基本信息 */}
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                marginBottom: '8px',
                color: '#666'
              }}>
                姓名
              </label>
              {editing ? (
                <input
                  type="text"
                  value={tempProfile.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  style={{
                    padding: '8px 12px',
                    fontSize: '16px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    width: '100%',
                    maxWidth: '300px'
                  }}
                />
              ) : (
                <p style={{ fontSize: '18px', fontWeight: '600' }}>
                  {profile.name}
                </p>
              )}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                marginBottom: '8px',
                color: '#666'
              }}>
                邮箱
              </label>
              {editing ? (
                <input
                  type="email"
                  value={tempProfile.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  style={{
                    padding: '8px 12px',
                    fontSize: '14px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    width: '100%',
                    maxWidth: '300px'
                  }}
                />
              ) : (
                <p style={{ fontSize: '14px', color: '#666' }}>
                  {profile.email}
                </p>
              )}
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                marginBottom: '8px',
                color: '#666'
              }}>
                简介
              </label>
              {editing ? (
                <textarea
                  value={tempProfile.bio}
                  onChange={(e) => handleChange('bio', e.target.value)}
                  rows={3}
                  style={{
                    padding: '8px 12px',
                    fontSize: '14px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    width: '100%',
                    maxWidth: '500px',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              ) : (
                <p style={{ fontSize: '14px', color: '#666', lineHeight: '1.6' }}>
                  {profile.bio}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 详细信息 */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>
          📍 详细信息
        </h2>

        <div style={{ display: 'grid', gap: '16px' }}>
          {/* 位置 */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              marginBottom: '8px'
            }}>
              位置
            </label>
            {editing ? (
              <input
                type="text"
                value={tempProfile.location}
                onChange={(e) => handleChange('location', e.target.value)}
                style={{
                  padding: '8px 12px',
                  fontSize: '14px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  width: '100%',
                  maxWidth: '300px'
                }}
              />
            ) : (
              <p style={{ fontSize: '14px', color: '#666' }}>{profile.location}</p>
            )}
          </div>

          {/* 网站 */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              marginBottom: '8px'
            }}>
              个人网站
            </label>
            {editing ? (
              <input
                type="url"
                value={tempProfile.website}
                onChange={(e) => handleChange('website', e.target.value)}
                style={{
                  padding: '8px 12px',
                  fontSize: '14px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  width: '100%',
                  maxWidth: '400px'
                }}
              />
            ) : (
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '14px', color: '#0070f3' }}
              >
                {profile.website}
              </a>
            )}
          </div>

          {/* GitHub */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              marginBottom: '8px'
            }}>
              GitHub
            </label>
            {editing ? (
              <input
                type="text"
                value={tempProfile.github}
                onChange={(e) => handleChange('github', e.target.value)}
                placeholder="username"
                style={{
                  padding: '8px 12px',
                  fontSize: '14px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  width: '100%',
                  maxWidth: '300px'
                }}
              />
            ) : (
              <a
                href={`https://github.com/${profile.github}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '14px', color: '#0070f3' }}
              >
                @{profile.github}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      {editing && (
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleSave}
            style={{
              padding: '12px 24px',
              fontSize: '15px',
              fontWeight: '600'
            }}
          >
            💾 保存修改
          </button>
          <button
            onClick={handleCancel}
            style={{
              padding: '12px 24px',
              fontSize: '15px',
              backgroundColor: '#f5f5f5',
              color: '#333'
            }}
          >
            取消
          </button>
        </div>
      )}

      {/* 技术说明 */}
      <div className="card" style={{ marginTop: '48px' }}>
        <h3>💡 技术实现</h3>
        <ul style={{ fontSize: '14px', lineHeight: '1.8' }}>
          <li><strong>Client Component</strong>：使用 React hooks 管理编辑状态</li>
          <li><strong>双向绑定</strong>：受控组件实现表单输入</li>
          <li><strong>编辑模式</strong>：临时状态 + 保存/取消操作</li>
          <li><strong>嵌套布局</strong>：继承 dashboard/layout.jsx</li>
        </ul>
      </div>
    </div>
  )
}
