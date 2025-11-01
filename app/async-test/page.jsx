import React from 'react'

/**
 * 异步 Server Component 测试页面
 *
 * 演示：
 * 1. 在 Server Component 中使用 async/await
 * 2. 异步获取数据
 * 3. Flight Protocol 正确序列化异步组件的结果
 * 4. 使用 SSR 而非 SSG，每次访问都重新获取数据
 */

// 强制使用 SSR，不进行静态预渲染
export const dynamic = 'force-dynamic'

// 模拟异步数据获取
async function fetchUserData() {
  await new Promise(resolve => setTimeout(resolve, 100))
  return {
    name: 'Alice',
    role: 'Developer',
    timestamp: new Date().toISOString()
  }
}

async function fetchPosts() {
  await new Promise(resolve => setTimeout(resolve, 1500))
  return [
    { id: 1, title: 'First Post', content: 'Hello async world!' },
    { id: 2, title: 'Second Post', content: 'React Server Components are awesome!' },
    { id: 3, title: 'Third Post', content: 'Flight Protocol handles async components!' }
  ]
}

// 异步 Server Component ⭐
export default async function AsyncTestPage() {
  console.log('🔄 AsyncTestPage 开始执行（异步）')

  // 并行获取数据
  const [userData, posts] = await Promise.all([
    fetchUserData(),
    fetchPosts()
  ])

  console.log('✅ AsyncTestPage 数据获取完成')

  return (
    <div>
      <h1>🧪 异步 Server Component 测试</h1>

      <div className="card" style={{
        backgroundColor: '#e3f2fd',
        border: '2px solid #2196F3'
      }}>
        <h2>⏱️ 渲染时间戳</h2>
        <p style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#1976d2' }}>
          {userData.timestamp}
        </p>
        <p style={{ fontSize: '0.9rem', color: '#666' }}>
          ✅ 每次刷新页面，时间戳都会更新（SSR）
        </p>
      </div>

      <div className="card">
        <h2>👤 用户信息</h2>
        <p><strong>姓名:</strong> {userData.name}</p>
        <p><strong>角色:</strong> {userData.role}</p>
        <p><strong>数据获取时间:</strong> {userData.timestamp}</p>
      </div>

      <div className="card">
        <h2>📝 文章列表</h2>
        {posts.map(post => (
          <div key={post.id} style={{
            marginBottom: '1rem',
            padding: '1rem',
            background: '#f9f9f9',
            borderRadius: '4px'
          }}>
            <h3>{post.title}</h3>
            <p>{post.content}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>✅ 验证要点</h2>
        <ul style={{ paddingLeft: '1.5rem', lineHeight: '1.8' }}>
          <li>✅ 页面使用 <code>export const dynamic = 'force-dynamic'</code></li>
          <li>✅ 页面组件是 <code>async function</code></li>
          <li>✅ 使用 <code>await</code> 异步获取数据（模拟 1.5 秒延迟）</li>
          <li>✅ Flight Encoder 正确等待异步组件执行完成</li>
          <li>✅ 每次刷新页面，时间戳都会更新（证明是 SSR）</li>
          <li>✅ 数据正确显示，说明异步流程工作正常</li>
        </ul>
      </div>

      <div className="card" style={{
        backgroundColor: '#fff3cd',
        border: '2px solid #ffc107'
      }}>
        <h2>🔍 测试步骤</h2>
        <ol style={{ lineHeight: '1.8' }}>
          <li>观察页面顶部的时间戳</li>
          <li>刷新页面（Ctrl+R / Cmd+R）</li>
          <li>时间戳应该更新为新的时间</li>
          <li>说明页面使用 SSR，每次都重新获取数据</li>
        </ol>
      </div>
    </div>
  )
}
