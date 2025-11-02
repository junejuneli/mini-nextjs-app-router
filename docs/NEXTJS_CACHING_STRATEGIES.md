# Next.js App Router 缓存机制

> Next.js 15 四层缓存架构详解

---

## 概述

Next.js App Router 实现了四层缓存系统，在不同阶段优化性能：

```
┌─────────────────────────────────────────┐
│  Client (浏览器)                         │
│  ┌────────────────────────────────────┐ │
│  │ 4. Router Cache                    │ │
│  │    - 缓存 RSC Payload              │ │
│  │    - 客户端导航                     │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────┐
│  Server (服务器)                         │
│  ┌────────────────────────────────────┐ │
│  │ 3. Full Route Cache                │ │
│  │    - 缓存渲染结果                   │ │
│  │    - SSG/ISR                       │ │
│  └────────────────────────────────────┘ │
│                    ↕                     │
│  ┌────────────────────────────────────┐ │
│  │ 2. Data Cache                      │ │
│  │    - 持久化 fetch 结果              │ │
│  │    - 支持重新验证                   │ │
│  └────────────────────────────────────┘ │
│                    ↕                     │
│  ┌────────────────────────────────────┐ │
│  │ 1. Request Memoization             │ │
│  │    - 单次请求去重                   │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

## Next.js 15 重大变化

从 **默认缓存一切** → **默认不缓存** (Opt-in 策略)

| 缓存类型 | Next.js 14 | Next.js 15 |
|---------|-----------|-----------|
| **fetch() 请求** | 默认 `cache: 'force-cache'` | 默认 `cache: 'no-store'` |
| **GET Route Handlers** | 默认缓存 | 默认不缓存 |
| **Client Router Cache** | 动态路由 30s | 动态路由 0s (不缓存) |

**为什么改变？**
1. 避免过度缓存导致数据陈旧
2. 更符合直觉的默认行为
3. 开发者显式选择缓存策略
4. 缓存问题更易定位

---

## 1. Request Memoization

### 定义

React 扩展的 `fetch` API，在**单次渲染周期内**自动去重相同请求。

### 工作原理

```jsx
async function UserProfile() {
  const user = await fetch('https://api.example.com/user/1') // 实际请求
  return <div>{user.name}</div>
}

async function UserStats() {
  const user = await fetch('https://api.example.com/user/1') // 去重，不发起新请求
  return <div>{user.posts} posts</div>
}

export default function Page() {
  return (
    <div>
      <UserProfile />
      <UserStats />
    </div>
  )
}
```

### 特性

- ✅ 自动工作，无需配置
- ✅ 跨越 `generateMetadata`、Layouts、Pages、Server Components
- ✅ 仅限 GET 请求
- ❌ 不跨请求（每次新用户请求都会重新执行）
- ❌ 仅限 fetch（ORM/数据库需要 `React.cache()`）

### 非 fetch 场景

```jsx
import { cache } from 'react'

// 包装数据库查询
export const getUser = cache(async (id) => {
  const user = await db.user.findUnique({ where: { id } })
  return user
})

// 多个组件调用，自动去重
async function UserProfile() {
  const user = await getUser(1) // 实际查询
  return <div>{user.name}</div>
}

async function UserStats() {
  const user = await getUser(1) // 去重
  return <div>{user.posts}</div>
}
```

---

## 2. Data Cache

### 定义

持久化的服务器端数据缓存，跨请求和部署保存 `fetch` 请求结果。

### Next.js 15 配置

```jsx
// ❌ 默认不缓存
fetch('https://api.example.com/posts')

// ✅ 显式启用缓存
fetch('https://api.example.com/posts', {
  cache: 'force-cache'
})

// ✅ 显式禁用缓存
fetch('https://api.example.com/posts', {
  cache: 'no-store'
})
```

### 重新验证策略

#### 时间基础 (ISR)

```jsx
// 每小时重新验证
fetch('https://api.example.com/posts', {
  next: { revalidate: 3600 }
})
```

**工作流程**：
```
第一次请求 (t=0)
  → 未命中 → 获取数据 → 缓存 → 返回

后续请求 (0 < t < 3600s)
  → 命中缓存 → 返回缓存数据 (快)

请求 (t > 3600s)
  → 返回旧缓存（stale-while-revalidate）
  → 后台获取新数据 → 更新缓存
  → 下一个请求返回新数据
```

#### 按需重新验证

```jsx
'use server'
import { revalidatePath, revalidateTag } from 'next/cache'

export async function updatePost() {
  // 按路径重新验证
  revalidatePath('/blog/[slug]')

  // 按标签重新验证
  revalidateTag('posts')
}

// fetch 中使用标签
fetch('https://api.example.com/posts', {
  next: {
    tags: ['posts'],
    revalidate: 3600
  }
})
```

---

## 3. Full Route Cache

### 定义

服务器端缓存**路由的完整渲染结果**（RSC Payload + HTML）。

### 静态 vs 动态路由

| 路由类型 | 是否缓存 | 何时渲染 |
|---------|---------|---------|
| 静态路由 | ✅ 缓存 | 构建时 / 重新验证时 |
| 动态路由 | ❌ 不缓存 | 每次请求时 |

**示例**：

```jsx
// ✅ 静态路由 - 会被缓存
export default async function Page() {
  const data = await fetch('https://api.example.com/posts', {
    next: { revalidate: 3600 }
  })
  return <div>{data}</div>
}

// ❌ 动态路由 - 不缓存
export const dynamic = 'force-dynamic'

export default async function Page() {
  const data = await fetch('https://api.example.com/posts', {
    cache: 'no-store'
  })
  return <div>{data}</div>
}
```

### 缓存失效

Full Route Cache 在以下情况失效：

1. Data Cache 重新验证时
2. 新部署（与 Data Cache 不同）
3. 调用 `revalidatePath` 或 `revalidateTag`

---

## 4. Router Cache

### 定义

客户端缓存，存储用户已访问路由的 **RSC Payload**。

### 工作原理

```
用户访问 /about
  ↓ 获取 RSC Payload
  ↓ 存储到 Router Cache
  ↓
用户导航到 /contact
  ↓
用户返回 /about
  ↓ 从 Router Cache 恢复（即时，无网络请求）
```

### Next.js 15 staleTime 配置

```javascript
// next.config.js
module.exports = {
  experimental: {
    staleTimes: {
      dynamic: 0,      // 动态路由：不缓存
      static: 300,     // 静态路由：5 分钟
    },
  },
}
```

| 配置 | Next.js 14 | Next.js 15 |
|-----|-----------|-----------|
| `dynamic` | 30 秒 | **0 秒** |
| `static` | 5 分钟 | 5 分钟 |
| `prefetch: true` | 5 分钟 | 5 分钟 |

### 预取 (Prefetching)

```jsx
import Link from 'next/link'

// 默认自动预取（视口内的 Link）
<Link href="/about">About</Link>

// 禁用预取
<Link href="/about" prefetch={false}>About</Link>

// 编程式预取
import { useRouter } from 'next/navigation'

function Component() {
  const router = useRouter()

  useEffect(() => {
    router.prefetch('/dashboard')
  }, [])
}
```

### 缓存行为

| 场景 | 行为 |
|-----|-----|
| **前进/后退导航** | 从缓存恢复（保留滚动位置） |
| **普通导航 (Next.js 15)** | 动态路由不缓存，始终获取最新数据 |
| **共享 Layout** | 不重新获取，支持部分渲染 |
| **loading.js** | 缓存 5 分钟 |

### 手动清除缓存

```jsx
import { useRouter } from 'next/navigation'

function Component() {
  const router = useRouter()

  // 刷新当前路由
  router.refresh()
}
```

---

## 缓存交互

### 优先级流程

```
用户请求
  ↓
Router Cache (客户端)
  ↓ 未命中
Full Route Cache (服务器)
  ↓ 未命中
Data Cache
  ↓ 未命中
Request Memoization
  ↓ 未命中
实际数据源
```

### 失效链

```
revalidatePath() / revalidateTag()
  ↓
Data Cache 失效
  ↓
Full Route Cache 失效
  ↓
Router Cache 失效
```

---

## 使用示例

### 静态页面首次访问

```
1. 用户访问 /blog
2. Full Route Cache 命中
3. 返回预渲染 HTML
4. 客户端 Hydration
5. 存储到 Router Cache

响应时间: < 50ms
```

### 动态页面访问

```
1. 用户访问 /dashboard
2. Full Route Cache 未命中
3. 检查 Data Cache
4. Request Memoization 去重
5. 渲染 RSC → 返回 HTML
6. Next.js 15: 不存储到 Router Cache

响应时间: 200-500ms
```

### ISR 重新验证

```
1. 用户访问 /blog (revalidate: 60)
2. 检测页面过期 (age > 60s)
3. 立即返回旧缓存
4. 后台重新渲染
5. 更新 Full Route Cache 和 Data Cache
6. 下一个用户获得新内容

用户体验: 始终快速响应
```

---

## 最佳实践

### 1. 显式声明缓存策略

```jsx
// Next.js 15: 明确缓存意图
fetch('/api/posts', { cache: 'force-cache' })           // 缓存
fetch('/api/user', { cache: 'no-store' })              // 不缓存
fetch('/api/data', { next: { revalidate: 3600 } })    // ISR
```

### 2. 使用标签管理缓存

```jsx
// 为相关数据分组
fetch('/api/posts', {
  next: { tags: ['posts', 'blog'] }
})

fetch('/api/post/1', {
  next: { tags: ['posts', 'post-1'] }
})

// 统一重新验证
revalidateTag('posts')
```

### 3. 选择合适的 revalidate 时间

```jsx
// 高频更新（新闻、股票）
{ next: { revalidate: 60 } }        // 1 分钟

// 中频更新（博客、产品）
{ next: { revalidate: 3600 } }      // 1 小时

// 低频更新（文档、关于页）
{ next: { revalidate: 86400 } }     // 1 天

// 几乎不变（法律条款）
{ cache: 'force-cache' }            // 永久缓存
```

### 4. 配置 Router Cache

```javascript
// next.config.js
module.exports = {
  experimental: {
    staleTimes: {
      dynamic: 30,     // 动态路由缓存 30 秒
      static: 180,     // 静态路由缓存 3 分钟
    },
  },
}
```

### 5. 使用 React.cache() 包装数据库查询

```jsx
import { cache } from 'react'

// ✅ 正确：自动去重
const getUser = cache(async (id) => {
  return db.user.findUnique({ where: { id } })
})

// ❌ 错误：不会去重
async function getUser(id) {
  return db.user.findUnique({ where: { id } })
}
```

---

## 常见错误

### 1. 冲突的缓存选项

```jsx
// ❌ 错误：冲突配置会被忽略
fetch('/api/data', {
  cache: 'no-store',
  next: { revalidate: 60 }
})

// ✅ 正确
fetch('/api/data', {
  next: { revalidate: 60 }
})
```

### 2. 依赖隐式默认行为

```jsx
// ❌ 不清晰（Next.js 15 默认不缓存）
fetch('/api/data')

// ✅ 显式声明
fetch('/api/data', { cache: 'no-store' })
```

### 3. Static Export 使用 ISR

```jsx
// ❌ Static Export 不支持 ISR
export const dynamic = 'force-static'
fetch('/api/data', { next: { revalidate: 60 } })

// ✅ 使用 Node.js 运行时或完全静态
```

---

## 总结

### 核心要点

1. **Next.js 15 采用 Opt-in 策略**：默认不缓存，显式启用
2. **四层缓存各司其职**：
   - Request Memoization: 单次请求去重
   - Data Cache: 持久化数据
   - Full Route Cache: 渲染结果
   - Router Cache: 客户端导航
3. **ISR 是性能关键**：静态生成 + 后台重新验证
4. **统一管理失效**：`revalidatePath` 和 `revalidateTag`

### 相关资源

- [Next.js 官方文档 - Caching](https://nextjs.org/docs/app/guides/caching)
- [Next.js 15 发布博客](https://nextjs.org/blog/next-15)
- [ISR 指南](https://nextjs.org/docs/app/guides/incremental-static-regeneration)
