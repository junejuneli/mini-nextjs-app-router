import React from 'react'
import Link from '../client/Link.tsx'

/**
 * Root Layout (必需)
 *
 * 这是一个 Server Component
 * - 在服务端执行
 * - 包裹所有页面
 * - 可以定义全局样式、字体等
 * - 可以使用 Client Components (如 Link)
 */

interface RootLayoutProps {
  children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps): JSX.Element {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Mini Next.js App Router</title>
        <style>{`
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: system-ui, -apple-system, sans-serif;
            line-height: 1.6;
            color: #333;
          }

          .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
          }

          nav {
            background: #0070f3;
            color: white;
            padding: 1rem 0;
            margin-bottom: 2rem;
          }

          nav ul {
            list-style: none;
            display: flex;
            gap: 2rem;
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
          }

          nav a {
            color: white;
            text-decoration: none;
            font-weight: 500;
          }

          nav a:hover {
            text-decoration: underline;
          }

          h1 {
            color: #0070f3;
            margin-bottom: 1rem;
          }

          .card {
            background: #f5f5f5;
            padding: 1.5rem;
            border-radius: 8px;
            margin: 1rem 0;
          }

          button {
            background: #0070f3;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 4px;
            cursor: pointer;
            font-size: 1rem;
            font-weight: 500;
          }

          button:hover {
            background: #0051cc;
          }

          .badge {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            background: #10b981;
            color: white;
            border-radius: 12px;
            font-size: 0.875rem;
            font-weight: 600;
          }

          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }

          .spinner {
            animation: spin 1s linear infinite;
          }
        `}</style>
      </head>
      <body>
        <nav>
          <ul>
            <li><Link href="/">首页</Link></li>
            <li><Link href="/about">关于</Link></li>
            <li><Link href="/users">用户 (服务端分页)</Link></li>
            <li><Link href="/blog">博客 (动态路由)</Link></li>
            <li><Link href="/pricing">定价 (路由组)</Link></li>
            <li><Link href="/dashboard">仪表盘 (嵌套布局)</Link></li>
            <li><Link href="/async-test">异步测试</Link></li>
            <li><Link href="/isr-test">ISR 测试</Link></li>
            <li><Link href="/error-test">错误测试</Link></li>
            <li><Link href="/404-test">404 测试</Link></li>
          </ul>
        </nav>

        <div className="container">
          {children}
        </div>
      </body>
    </html>
  )
}
