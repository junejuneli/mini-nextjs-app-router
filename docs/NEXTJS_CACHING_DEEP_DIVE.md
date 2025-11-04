# Next.js 缓存机制深度剖析

> 四层缓存架构原理与实现细节

---

## 一、四层缓存架构

### 架构总览

```
┌─────────────────────────────────────────────────────┐
│                   Client (浏览器)                    │
│  ┌───────────────────────────────────────────────┐  │
│  │  Router Cache (内存)                          │  │
│  │  - 静态路由: 5 分钟                            │  │
│  │  - 动态路由: 0 秒 (Next.js 15+)               │  │
│  │  - 前进/后退: 永久缓存                         │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                        ↕ HTTP
┌─────────────────────────────────────────────────────┐
│                   Server (服务器)                    │
│  ┌───────────────────────────────────────────────┐  │
│  │  Full Route Cache (.next/server/pages/)      │  │
│  │  - 缓存 RSC Payload + HTML                   │  │
│  │  - 静态路由预渲染                             │  │
│  │  - 新部署清空                                 │  │
│  └───────────────────────────────────────────────┘  │
│                        ↕                            │
│  ┌───────────────────────────────────────────────┐  │
│  │  Data Cache (.next/cache/fetch/)             │  │
│  │  - 持久化 fetch 结果                          │  │
│  │  - 跨部署保留                                 │  │
│  │  - Tag/Time-based Revalidation               │  │
│  └───────────────────────────────────────────────┘  │
│                        ↕                            │
│  ┌───────────────────────────────────────────────┐  │
│  │  Request Memoization (内存)                  │  │
│  │  - 单次渲染内去重                             │  │
│  │  - 仅限 GET 请求                              │  │
│  │  - 生命周期: 单次请求                         │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 缓存交互流程

```
用户请求 /blog/post-1
  ↓
1. Router Cache (客户端)
   ├─ 命中 → 立即渲染 (< 1ms)
   └─ 未命中 → 向服务器请求
       ↓
2. Full Route Cache (服务器)
   ├─ 命中 → 返回缓存 (< 10ms)
   │   └─ 检查 revalidate → 触发后台 ISR
   └─ 未命中 → 动态渲染
       ↓
3. 渲染过程中需要数据
   ↓
4. Request Memoization
   ├─ 同一 URL 已请求 → 复用内存结果
   └─ 首次请求 → 继续
       ↓
5. Data Cache
   ├─ 命中 → 返回缓存数据
   └─ 未命中 → 实际请求数据源
```

---

## 二、Request Memoization (请求去重)

### 核心原理

```typescript
// Next.js 内部实现 (简化)
const requestCache = new Map<string, Promise<any>>()

function memoizedFetch(url: string, options: RequestInit) {
  // 生成缓存键
  const cacheKey = `${url}:${JSON.stringify(options)}`

  // 检查是否已请求
  if (requestCache.has(cacheKey)) {
    console.log('🔄 Request Memoization 命中')
    return requestCache.get(cacheKey)!
  }

  // 首次请求，存入缓存
  const promise = fetch(url, options)
  requestCache.set(cacheKey, promise)

  return promise
}
```

### 作用域

```typescript
// 单次渲染内有效
export async function Page() {
  // 请求 1
  const user = await fetch('/api/user/1')  // 实际请求

  return (
    <>
      <UserProfile />  {/* 请求 2: 去重 */}
      <UserStats />    {/* 请求 3: 去重 */}
    </>
  )
}

async function UserProfile() {
  const user = await fetch('/api/user/1')  // ✅ 复用请求 1
  return <div>{user.name}</div>
}

async function UserStats() {
  const user = await fetch('/api/user/1')  // ✅ 复用请求 1
  return <div>{user.posts}</div>
}

// 实际网络请求: 1 次
```

### 与 React.cache() 配合

```typescript
import { cache } from 'react'

// 用于非 fetch 请求 (数据库、ORM)
const getUser = cache(async (id: number) => {
  console.log('DB Query')
  return db.user.findUnique({ where: { id } })
})

async function Component1() {
  const user = await getUser(1)  // DB Query
  return <div>{user.name}</div>
}

async function Component2() {
  const user = await getUser(1)  // ✅ 复用结果
  return <div>{user.email}</div>
}
```

### 关键特性

| 特性 | 值 |
|------|---|
| **生命周期** | 单次请求 |
| **存储位置** | 服务器内存 |
| **支持方法** | 仅 GET |
| **跨请求** | ❌ |
| **持久化** | ❌ |

---

## 三、Data Cache (数据缓存)

### 磁盘存储结构

```
.next/cache/fetch/
├── GET/
│   ├── api_example_com_posts/
│   │   ├── 1a2b3c4d.body    # 响应体
│   │   ├── 1a2b3c4d.meta    # 元数据
│   │   └── tags.json        # 标签映射
│   └── api_example_com_user_1/
│       ├── 5e6f7g8h.body
│       └── 5e6f7g8h.meta
```

### 缓存键生成

```typescript
// Next.js 内部实现
function generateCacheKey(url: string, init?: RequestInit): string {
  const normalizedUrl = new URL(url).href
  const method = init?.method || 'GET'
  const headers = JSON.stringify(init?.headers || {})
  const body = init?.body || ''

  // SHA-256 hash
  return crypto
    .createHash('sha256')
    .update(`${method}:${normalizedUrl}:${headers}:${body}`)
    .digest('hex')
    .substring(0, 16)
}
```

### Revalidation 机制

#### Time-based (时间)

```typescript
// 每 60 秒重新验证
fetch('/api/posts', {
  next: { revalidate: 60 }
})

// 存储的元数据
{
  "generatedAt": 1699999999999,
  "revalidate": 60,
  "tags": []
}

// 检查逻辑
if (Date.now() - generatedAt > revalidate * 1000) {
  // 过期，重新请求
}
```

#### Tag-based (标签)

```typescript
// 设置标签
fetch('/api/posts', {
  next: { tags: ['posts'] }
})

// 失效缓存
import { revalidateTag } from 'next/cache'
revalidateTag('posts')  // 所有带 'posts' 标签的缓存失效
```

### 标签映射存储

```json
// .next/cache/fetch/tags.json
{
  "posts": [
    "1a2b3c4d",  // 缓存 key
    "5e6f7g8h"
  ],
  "users": [
    "9i0j1k2l"
  ]
}
```

---

## 四、Full Route Cache (完整路由缓存)

### ISR 实现原理

#### Stale-While-Revalidate 策略

```typescript
// server/index.ts
async function handleRequest(url: string) {
  const cached = loadCache(url)

  if (cached) {
    // 检查是否过期
    if (isExpired(cached)) {
      // 1. 立即返回旧缓存 (用户快速响应)
      respondWith(cached)

      // 2. 后台重新生成 (不阻塞)
      regenerateInBackground(url)
    } else {
      // 未过期，直接返回
      respondWith(cached)
    }
  } else {
    // 无缓存，动态渲染
    const fresh = await renderPage(url)
    respondWith(fresh)
  }
}
```

#### 时间线对比

```
传统方案:
用户请求 → 检测过期 → 重新生成 → 返回
0ms       10ms       500ms       完成
├──────────┼──────────┼──────────┼──>
                                [用户等待 500ms] 🔴

Stale-While-Revalidate:
用户请求 → 检测过期 → 返回旧缓存
0ms       10ms       20ms
├──────────┼──────────┼──>
                     [用户得到响应] 🟢
                     └─ 后台重新生成 (不阻塞)
```

### 并发锁机制

```typescript
// server/regenerate.ts
const regenerationLocks = new Map<string, Promise<void>>()

async function regenerateWithLock(path: string) {
  // 防止重复生成
  if (regenerationLocks.has(path)) {
    console.log('⏳ 等待现有任务...')
    return regenerationLocks.get(path)!
  }

  // 创建任务
  const task = regeneratePage(path)
  regenerationLocks.set(path, task)

  try {
    await task
  } finally {
    // 任务完成，释放锁
    regenerationLocks.delete(path)
  }
}
```

### 原子性文件写入

```typescript
// server/regenerate.ts
async function regeneratePage(path: string) {
  const html = await renderHTML(path)

  // 1. 写入临时文件
  fs.writeFileSync(`${htmlPath}.tmp`, html)

  // 2. 原子性重命名 (避免读到半写状态)
  fs.renameSync(`${htmlPath}.tmp`, htmlPath)
}
```

**为什么需要原子性？**

```
❌ 直接写入:
时刻 1: 用户读取 (读到一半内容) → 崩溃
时刻 2: 写入完成

✅ 临时文件 + 重命名:
时刻 1: 写入 .tmp (用户读取旧文件) → 正常
时刻 2: rename() (原子操作) → 瞬间切换
时刻 3: 用户读取 (新文件完整) → 正常
```

---

## 五、Router Cache (路由器缓存)

### 缓存时长规则

| 路由类型 | Next.js 14 | Next.js 15+ | 说明 |
|---------|-----------|------------|------|
| **静态路由** | 5 分钟 | 5 分钟 | 预渲染页面 |
| **动态路由** | 30 秒 | **0 秒** | 默认不缓存 |
| **前进/后退** | 永久 | 永久 | 保留滚动位置 |
| **prefetch** | 5 分钟 | 5 分钟 | Link 预取 |

### 配置缓存时长

```javascript
// next.config.js (Next.js 15+)
module.exports = {
  experimental: {
    staleTimes: {
      dynamic: 30,   // 动态路由缓存 30 秒
      static: 180,   // 静态路由缓存 3 分钟
    },
  },
}
```

### 预取机制

```typescript
// client/Link.tsx
export function Link({ href, prefetch = true }) {
  useEffect(() => {
    if (prefetch) {
      // 视口内自动预取
      const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          // 预取 RSC Payload
          fetch(`${href}?_rsc=1`)
            .then(res => res.text())
            .then(flight => {
              // 存入 Router Cache
              routerCache.set(href, { flight })
            })
        }
      })

      observer.observe(linkRef.current)
    }
  }, [href, prefetch])
}
```

### 软导航流程

```
点击 Link
  ↓
1. 检查 Router Cache
   ├─ 命中 → 立即渲染 (< 1ms)
   └─ 未命中 → 继续
       ↓
2. 请求 RSC Payload
   GET /about?_rsc=1
   ↓
3. 解码 Flight Protocol
   ↓
4. React Transition 更新 UI
   startTransition(() => {
     setRoot(newTree)
   })
   ↓
5. 更新 URL (不刷新页面)
   history.pushState({}, '', '/about')
```

---

## 六、缓存失效机制

### revalidatePath 原理

```typescript
import { revalidatePath } from 'next/cache'

// Server Action 中调用
export async function updatePost(id: string) {
  await db.posts.update({ id })

  // 失效指定路径
  revalidatePath('/blog/[slug]', 'page')
}
```

**失效链**:

```
revalidatePath('/blog')
  ↓
1. 标记 Full Route Cache 为过期
   └─ .next/server/pages/blog.html (删除)
  ↓
2. 标记相关 Data Cache 为过期
   └─ fetch('/api/posts', { tags: ['blog'] })
  ↓
3. 客户端 Router Cache 失效
   └─ 下次导航重新请求
```

### revalidateTag 原理

```typescript
import { revalidateTag } from 'next/cache'

// 设置标签
fetch('/api/posts', {
  next: { tags: ['posts', 'blog'] }
})

// 失效所有带该标签的缓存
revalidateTag('posts')
```

**实现机制**:

```typescript
// Next.js 内部实现
const tagToKeys = new Map<string, Set<string>>()

// 记录标签映射
function cacheFetch(url, { next: { tags } }) {
  const key = generateKey(url)

  tags?.forEach(tag => {
    if (!tagToKeys.has(tag)) {
      tagToKeys.set(tag, new Set())
    }
    tagToKeys.get(tag)!.add(key)
  })

  // 存储数据...
}

// 失效标签
function revalidateTag(tag: string) {
  const keys = tagToKeys.get(tag) || []

  keys.forEach(key => {
    deleteCache(key)  // 删除缓存
  })
}
```

### 失效范围对比

| 方法 | 失效范围 | 使用场景 |
|------|---------|---------|
| **revalidatePath** | 特定路径 | 更新单个页面 |
| **revalidateTag** | 所有带标签的数据 | 更新跨多个页面的数据 |
| **router.refresh()** | 当前路由 (客户端) | 强制刷新 |

---

## 七、缓存配置策略

### 路由级配置

```typescript
// app/dashboard/page.tsx

// 1. 完全静态 (最大缓存)
export const dynamic = 'force-static'
export const revalidate = false

// 2. ISR (定时更新)
export const revalidate = 60  // 60 秒

// 3. 完全动态 (无缓存)
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function Page() {
  return <div>Dashboard</div>
}
```

### fetch 级配置

```typescript
// 1. 默认缓存 (Next.js 14)
fetch('/api/posts')

// 2. Next.js 15 默认不缓存
fetch('/api/posts')  // 等同于 cache: 'no-store'

// 3. 显式启用缓存
fetch('/api/posts', {
  cache: 'force-cache',
  next: { revalidate: 3600 }
})

// 4. 显式禁用缓存
fetch('/api/posts', {
  cache: 'no-store'
})

// 5. 标签缓存
fetch('/api/posts', {
  next: {
    tags: ['posts'],
    revalidate: 60
  }
})
```

### 决策树

```
需要实时数据?
  ├─ Yes → dynamic = 'force-dynamic' / cache: 'no-store'
  └─ No → 数据更新频率?
          ├─ 从不更新 → revalidate = false
          ├─ 定时更新 → revalidate = 60 (秒)
          └─ 按需更新 → tags + revalidateTag()
```

---

## 八、调试技巧

### 检查缓存命中

```typescript
// 添加日志
export async function GET() {
  const data = await fetch('/api/posts', {
    next: { tags: ['posts'], revalidate: 60 }
  })

  console.log('Cache Status:', data.headers.get('x-nextjs-cache'))
  // HIT: 缓存命中
  // MISS: 缓存未命中
  // STALE: 过期缓存
}
```

### 清空缓存

```bash
# 清空所有缓存
rm -rf .next/cache

# 只清空 fetch 缓存
rm -rf .next/cache/fetch

# 清空路由缓存
rm -rf .next/server
```

### 常见问题

**问题 1: ISR 不生效**

```typescript
// ❌ 错误: 有查询参数会跳过缓存
fetch('/api/posts?page=2')

// ✅ 正确: 参数作为 fetch 配置
fetch('/api/posts', {
  next: { revalidate: 60 },
  body: JSON.stringify({ page: 2 })
})
```

**问题 2: 缓存不更新**

```typescript
// 检查是否正确调用
revalidatePath('/blog')  // ✅ 正确

// 确保在 Server Action 中调用
'use server'
export async function updatePost() {
  revalidatePath('/blog')
}
```

**问题 3: 动态路由缓存**

```typescript
// ❌ 动态路由默认不预渲染
// app/blog/[slug]/page.tsx

// ✅ 使用 generateStaticParams
export async function generateStaticParams() {
  const posts = await fetchAllPosts()
  return posts.map(post => ({ slug: post.slug }))
}
```

---

## 总结

### 缓存层级对比

| 缓存 | 位置 | 生命周期 | 失效方式 |
|------|------|---------|---------|
| **Request Memoization** | 服务器内存 | 单次请求 | 自动清除 |
| **Data Cache** | 服务器磁盘 | 跨部署 | revalidateTag |
| **Full Route Cache** | 服务器磁盘 | 新部署清空 | revalidatePath |
| **Router Cache** | 客户端内存 | 5min/0s | router.refresh() |

### 最佳实践

1. **默认策略**: Next.js 15+ 默认不缓存，按需启用
2. **ISR 优先**: 静态内容使用 `revalidate`
3. **标签管理**: 相关数据使用相同 tag
4. **显式声明**: 明确 `cache` 和 `revalidate` 配置
5. **监控缓存**: 使用 `x-nextjs-cache` header 调试

---

**相关资源**:
- [Next.js Caching 官方文档](https://nextjs.org/docs/app/deep-dive/caching)
- [ISR 指南](https://nextjs.org/docs/app/guides/incremental-static-regeneration)
- [本项目 ISR 实现](../server/regenerate.ts)
