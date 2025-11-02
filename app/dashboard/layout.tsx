import React from 'react'
import Link from '../../client/Link.tsx'

/**
 * Dashboard 嵌套布局 - Nested Layout
 *
 * Next.js 嵌套布局特性：
 * - layout.jsx 会包裹同级和子级的 page.jsx
 * - 继承父级布局（root layout.jsx）
 * - 提供共享 UI（侧边栏、导航等）
 * - 导航时保持布局不重新渲染
 * - Server Component（默认）
 *
 * 布局层级：
 * RootLayout (app/layout.jsx)
 *   └── DashboardLayout (app/dashboard/layout.jsx) ← 当前文件
 *       ├── Dashboard 主页 (app/dashboard/page.jsx)
 *       ├── Settings 页面 (app/dashboard/settings/page.jsx)
 *       └── Profile 页面 (app/dashboard/profile/page.jsx)
 */

interface NavItem {
  href: string
  label: string
  icon: string
}

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps): JSX.Element {
  const navItems: NavItem[] = [
    { href: '/dashboard', label: '📊 概览', icon: '📊' },
    { href: '/dashboard/profile', label: '👤 个人资料', icon: '👤' },
    { href: '/dashboard/settings', label: '⚙️ 设置', icon: '⚙️' }
  ]

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '250px 1fr',
      gap: '32px',
      minHeight: '70vh'
    }}>
      {/* 侧边栏 */}
      <aside style={{
        backgroundColor: '#f9f9f9',
        padding: '24px',
        borderRadius: '8px',
        height: 'fit-content',
        position: 'sticky',
        top: '20px'
      }}>
        <h2 style={{
          fontSize: '20px',
          marginBottom: '24px',
          color: '#333'
        }}>
          🎛️ Dashboard
        </h2>

        <nav>
          <ul style={{
            listStyle: 'none',
            padding: 0,
            margin: 0
          }}>
            {navItems.map(item => (
              <li key={item.href} style={{ marginBottom: '8px' }}>
                <Link
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    color: '#333',
                    transition: 'all 0.2s',
                    fontSize: '15px',
                    fontWeight: '500'
                  }}
                >
                  <span style={{ fontSize: '20px' }}>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div style={{
          marginTop: '32px',
          padding: '16px',
          backgroundColor: '#fff',
          borderRadius: '6px',
          border: '1px solid #e0e0e0'
        }}>
          <h4 style={{
            fontSize: '14px',
            marginBottom: '8px',
            color: '#666'
          }}>
            💡 嵌套布局说明
          </h4>
          <p style={{
            fontSize: '12px',
            color: '#999',
            lineHeight: '1.6'
          }}>
            这个侧边栏由 dashboard/layout.jsx 提供，在 Dashboard 子页面间导航时保持不变。
          </p>
        </div>
      </aside>

      {/* 主内容区域 */}
      <main>
        {children}
      </main>

      {/* 响应式样式 */}
      <style>{`
        @media (max-width: 768px) {
          .dashboard-grid {
            grid-template-columns: 1fr;
          }
        }

        a:hover {
          background-color: #e8f4ff !important;
          color: #0070f3 !important;
        }
      `}</style>
    </div>
  )
}
