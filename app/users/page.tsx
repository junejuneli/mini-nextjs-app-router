import React from 'react'
import Link from '../../client/Link.tsx'

/**
 * 用户列表页 - 服务端分页示例
 *
 * 演示特性:
 * - Server Component 服务端分页
 * - 通过 searchParams 接收查询参数 (?page=2&pageSize=10)
 * - 在服务端执行数据查询和分页逻辑
 * - 每次切换页码触发完整的服务端渲染
 * - 可配合 ISR 缓存不同的页码
 */

interface User {
  id: number
  name: string
  email: string
  role: string
  department: string
  joinedDate: string
  status: 'active' | 'inactive'
}

// 模拟用户数据库 (100 条数据)
const MOCK_USERS: User[] = Array.from({ length: 100 }, (_, i) => ({
  id: i + 1,
  name: `User ${i + 1}`,
  email: `user${i + 1}@example.com`,
  role: ['Developer', 'Designer', 'Manager', 'Admin'][i % 4],
  department: ['Engineering', 'Design', 'Product', 'Marketing'][i % 4],
  joinedDate: new Date(2020 + (i % 5), (i % 12), (i % 28) + 1).toISOString().split('T')[0],
  status: i % 5 === 0 ? 'inactive' : 'active'
}))

interface PageProps {
  params: Record<string, string | string[]>
  searchParams: {
    page?: string
    pageSize?: string
    role?: string
  }
}

/**
 * 模拟服务端数据获取 (可替换为真实的数据库查询)
 */
async function fetchUsers(
  page: number,
  pageSize: number,
  role?: string
): Promise<{ users: User[]; total: number }> {
  // 模拟异步查询延迟
  await new Promise(resolve => setTimeout(resolve, 100))

  // 过滤数据
  let filteredUsers = MOCK_USERS

  if (role && role !== 'all') {
    filteredUsers = filteredUsers.filter(user => user.role === role)
  }

  // 计算分页
  const total = filteredUsers.length
  const start = (page - 1) * pageSize
  const end = start + pageSize
  const users = filteredUsers.slice(start, end)

  return { users, total }
}

export default async function UsersPage({ searchParams }: PageProps): Promise<JSX.Element> {
  // 解析查询参数
  const page = parseInt(searchParams.page || '1', 10)
  const pageSize = parseInt(searchParams.pageSize || '10', 10)
  const role = searchParams.role || 'all'

  // 服务端获取数据
  const { users, total } = await fetchUsers(page, pageSize, role !== 'all' ? role : undefined)

  // 计算分页信息
  const totalPages = Math.ceil(total / pageSize)
  const hasNextPage = page < totalPages
  const hasPrevPage = page > 1

  return (
    <div>
      <h1>👥 用户列表 (服务端分页)</h1>

      <div className="card" style={{ marginBottom: '24px', backgroundColor: '#f0f9ff' }}>
        <h3>📊 分页信息</h3>
        <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
          <p><strong>当前页:</strong> {page} / {totalPages}</p>
          <p><strong>每页显示:</strong> {pageSize} 条</p>
          <p><strong>总记录数:</strong> {total} 条</p>
          <p><strong>当前显示:</strong> {users.length} 条</p>
          <p><strong>过滤条件:</strong> {role === 'all' ? '全部' : role}</p>
        </div>
      </div>

      {/* 筛选器 */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3>🔍 筛选</h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {['all', 'Developer', 'Designer', 'Manager', 'Admin'].map(r => (
            <Link
              key={r}
              href={`/users?page=1&pageSize=${pageSize}&role=${r}`}
              style={{
                padding: '8px 16px',
                backgroundColor: role === r ? '#0070f3' : '#e0e0e0',
                color: role === r ? '#fff' : '#333',
                borderRadius: '6px',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: role === r ? '600' : '400',
                transition: 'all 0.2s'
              }}
            >
              {r === 'all' ? '全部' : r}
            </Link>
          ))}
        </div>
      </div>

      {/* 用户列表 */}
      <div style={{ marginBottom: '24px' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          backgroundColor: '#fff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '2px solid #e0e0e0' }}>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>ID</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>姓名</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>邮箱</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>角色</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>部门</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>加入日期</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>状态</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, index) => (
              <tr
                key={user.id}
                style={{
                  borderBottom: '1px solid #f0f0f0',
                  backgroundColor: index % 2 === 0 ? '#fff' : '#fafafa'
                }}
              >
                <td style={{ padding: '12px' }}>{user.id}</td>
                <td style={{ padding: '12px', fontWeight: '500' }}>{user.name}</td>
                <td style={{ padding: '12px', color: '#666' }}>{user.email}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{
                    padding: '4px 8px',
                    backgroundColor: '#e3f2fd',
                    color: '#1976d2',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    {user.role}
                  </span>
                </td>
                <td style={{ padding: '12px', color: '#666' }}>{user.department}</td>
                <td style={{ padding: '12px', color: '#666' }}>{user.joinedDate}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{
                    padding: '4px 8px',
                    backgroundColor: user.status === 'active' ? '#e8f5e9' : '#ffebee',
                    color: user.status === 'active' ? '#2e7d32' : '#c62828',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    {user.status === 'active' ? '在职' : '离职'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {users.length === 0 && (
          <div style={{
            padding: '48px',
            textAlign: 'center',
            color: '#999',
            backgroundColor: '#f9f9f9',
            borderRadius: '8px'
          }}>
            没有找到用户数据
          </div>
        )}
      </div>

      {/* 分页控制 */}
      <div className="card" style={{ backgroundColor: '#f9f9f9' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          {/* 上一页/下一页 */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {hasPrevPage ? (
              <Link
                href={`/users?page=${page - 1}&pageSize=${pageSize}&role=${role}`}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#0070f3',
                  color: '#fff',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  fontWeight: '600',
                  fontSize: '14px'
                }}
              >
                ← 上一页
              </Link>
            ) : (
              <div style={{
                padding: '10px 20px',
                backgroundColor: '#e0e0e0',
                color: '#999',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                ← 上一页
              </div>
            )}

            {hasNextPage ? (
              <Link
                href={`/users?page=${page + 1}&pageSize=${pageSize}&role=${role}`}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#0070f3',
                  color: '#fff',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  fontWeight: '600',
                  fontSize: '14px'
                }}
              >
                下一页 →
              </Link>
            ) : (
              <div style={{
                padding: '10px 20px',
                backgroundColor: '#e0e0e0',
                color: '#999',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                下一页 →
              </div>
            )}
          </div>

          {/* 页码跳转 */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', color: '#666' }}>跳转到:</span>
            {[1, 2, 3, 4, 5].map(p => (
              p <= totalPages ? (
                <Link
                  key={p}
                  href={`/users?page=${p}&pageSize=${pageSize}&role=${role}`}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: p === page ? '#0070f3' : '#fff',
                    color: p === page ? '#fff' : '#333',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    fontSize: '14px',
                    fontWeight: p === page ? '600' : '400',
                    border: '1px solid #e0e0e0'
                  }}
                >
                  {p}
                </Link>
              ) : null
            ))}
            {totalPages > 5 && (
              <span style={{ fontSize: '14px', color: '#666' }}>... {totalPages}</span>
            )}
          </div>

          {/* 每页显示数量 */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', color: '#666' }}>每页:</span>
            {[5, 10, 20, 50].map(size => (
              <Link
                key={size}
                href={`/users?page=1&pageSize=${size}&role=${role}`}
                style={{
                  padding: '8px 12px',
                  backgroundColor: size === pageSize ? '#0070f3' : '#fff',
                  color: size === pageSize ? '#fff' : '#333',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: size === pageSize ? '600' : '400',
                  border: '1px solid #e0e0e0'
                }}
              >
                {size}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* 技术说明 */}
      <div className="card" style={{ marginTop: '24px' }}>
        <h3>💡 服务端分页实现原理</h3>
        <ul style={{ fontSize: '14px', lineHeight: '1.8', marginBottom: '16px' }}>
          <li><strong>Server Component</strong>: 整个组件在服务端执行，可直接访问数据库</li>
          <li><strong>searchParams</strong>: 通过 <code>searchParams</code> prop 接收 URL 查询参数</li>
          <li><strong>服务端渲染</strong>: 每次切换页码都会触发完整的服务端渲染 (SSR)</li>
          <li><strong>数据查询</strong>: <code>fetchUsers()</code> 在服务端执行，可替换为真实的数据库查询</li>
          <li><strong>SEO 友好</strong>: 每个页码都是完整的 HTML，利于搜索引擎索引</li>
        </ul>

        <h3>🔧 代码示例</h3>
        <pre style={{
          backgroundColor: '#f5f5f5',
          padding: '16px',
          borderRadius: '8px',
          overflow: 'auto',
          fontSize: '13px',
          lineHeight: '1.6'
        }}>
{`// app/users/page.tsx
interface PageProps {
  searchParams: {
    page?: string
    pageSize?: string
  }
}

export default async function UsersPage({ searchParams }: PageProps) {
  // 解析参数
  const page = parseInt(searchParams.page || '1', 10)
  const pageSize = parseInt(searchParams.pageSize || '10', 10)

  // 服务端查询数据
  const { users, total } = await fetchUsers(page, pageSize)

  // 返回 JSX
  return <div>...</div>
}`}
        </pre>

        <h3>⚡ 性能优化建议</h3>
        <ul style={{ fontSize: '14px', lineHeight: '1.8' }}>
          <li>可以添加 <code>export const revalidate = 60</code> 启用 ISR，缓存不同页码</li>
          <li>对于热门页码 (如第 1 页)，可以在构建时预渲染</li>
          <li>使用数据库索引优化查询性能</li>
          <li>考虑添加 loading.tsx 显示加载状态</li>
        </ul>
      </div>

      <div style={{ marginTop: '24px', textAlign: 'center' }}>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            padding: '12px 24px',
            backgroundColor: '#f5f5f5',
            color: '#333',
            borderRadius: '6px',
            textDecoration: 'none',
            fontWeight: '600'
          }}
        >
          ← 返回首页
        </Link>
      </div>
    </div>
  )
}
