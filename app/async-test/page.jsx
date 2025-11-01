import React from 'react'

/**
 * 异步 Server Component 测试页面
 *
 * 演示：
 * 1. 在 Server Component 中使用 async/await
 * 2. 异步获取数据
 * 3. Flight Protocol 正确序列化异步组件的结果
 */

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

      <div className="card">
        <h2>👤 用户信息</h2>
        <p><strong>姓名:</strong> {userData.name}</p>
        <p><strong>角色:</strong> {userData.role}</p>
        <p><strong>时间:</strong> {userData.timestamp}</p>
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
        <ul style={{ paddingLeft: '1.5rem' }}>
          <li>页面组件是 <code>async function</code></li>
          <li>使用 <code>await</code> 获取数据</li>
          <li>Flight Encoder 正确等待异步组件执行</li>
          <li>数据正确显示，说明异步流程工作正常</li>
        </ul>
      </div>
    </div>
  )
}
