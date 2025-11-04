# Next.js 资源与 SEO 优化深度解析

> Next.js 在图片、字体、CSS、SEO 等方面的优化原理与最佳实践

---

## 目录

- [一、图片优化 (next/image)](#一图片优化-nextimage)
- [二、字体优化 (next/font)](#二字体优化-nextfont)
- [三、CSS 优化](#三css-优化)
- [四、SEO 优化](#四seo-优化)
- [五、性能指标对比](#五性能指标对比)

---

## 一、图片优化 (next/image)

### 1.1 核心问题

传统图片加载的痛点:
- ❌ 原始图片过大 (4-5MB)
- ❌ 未针对设备优化 (手机加载桌面尺寸)
- ❌ 阻塞渲染 (同步加载所有图片)
- ❌ 格式陈旧 (JPEG/PNG 体积大)
- ❌ 布局偏移 (CLS 高)

### 1.2 自动格式转换 (WebP/AVIF)

#### 工作原理

```
用户请求
  ↓
/_next/image?url=/photo.jpg&w=1200&q=75
  ↓
Next.js 图片优化服务器
  ├─ 检查 Accept Header
  │  └─ Accept: image/avif,image/webp,*/*
  ├─ 选择最佳格式
  │  ├─ 浏览器支持 AVIF → 转换为 AVIF
  │  ├─ 浏览器支持 WebP → 转换为 WebP
  │  └─ 都不支持 → 返回原格式
  ├─ 按需生成指定尺寸
  ├─ 应用质量压缩
  └─ 缓存优化后的图片
```

#### 配置启用

```javascript
// next.config.js
module.exports = {
  images: {
    // 启用 AVIF 支持 (更小的体积)
    formats: ['image/avif', 'image/webp'],

    // 设备尺寸断点 (生成对应尺寸)
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],

    // 图片尺寸 (layout="responsive" 时使用)
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],

    // 最小化缓存时间 (生产环境)
    minimumCacheTTL: 60 * 60 * 24 * 365, // 1 年
  }
}
```

#### 格式对比

| 格式 | 原始 JPEG | WebP | AVIF |
|------|----------|------|------|
| **文件大小** | 4.6 MB | 1.2 MB (-74%) | 800 KB (-83%) |
| **视觉质量** | 100% | 99.5% | 99% |
| **浏览器支持** | 100% | 96%+ | 80%+ |
| **编码速度** | 快 | 中 | 慢 |

**AVIF 优势**:
- 比 WebP 再小 20-30%
- 更好的颜色保真度
- 支持 HDR

**降级策略**:
```html
<!-- Next.js 自动生成 -->
<picture>
  <source srcset="photo.avif" type="image/avif">
  <source srcset="photo.webp" type="image/webp">
  <img src="photo.jpg" alt="fallback">
</picture>
```

---

### 1.3 响应式图片 & 设备适配

#### srcset 自动生成

```jsx
import Image from 'next/image'

<Image
  src="/hero.jpg"
  width={1200}
  height={600}
  alt="Hero"
/>
```

**生成的 HTML**:
```html
<img
  srcset="
    /_next/image?url=/hero.jpg&w=640&q=75 640w,
    /_next/image?url=/hero.jpg&w=750&q=75 750w,
    /_next/image?url=/hero.jpg&w=828&q=75 828w,
    /_next/image?url=/hero.jpg&w=1080&q=75 1080w,
    /_next/image?url=/hero.jpg&w=1200&q=75 1200w,
    /_next/image?url=/hero.jpg&w=1920&q=75 1920w
  "
  sizes="100vw"
  src="/_next/image?url=/hero.jpg&w=1200&q=75"
/>
```

**浏览器选择逻辑**:
```
iPhone 13 Pro (390px, 3x DPR)
  → 需要 390 * 3 = 1170px 宽度
  → 选择最接近的: 1200w

Desktop 1080p (1920px, 1x DPR)
  → 需要 1920px 宽度
  → 选择: 1920w
```

#### sizes 属性优化

```jsx
// ❌ 不好: 移动端加载桌面尺寸
<Image src="/hero.jpg" width={1920} height={1080} />

// ✅ 好: 响应式尺寸
<Image
  src="/hero.jpg"
  width={1920}
  height={1080}
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
/>
```

**sizes 解释**:
- `(max-width: 768px) 100vw` - 手机占满屏幕宽度
- `(max-width: 1200px) 50vw` - 平板占 50% 视口
- `33vw` - 桌面占 33% 视口 (3 列布局)

**带宽节省**:
```
手机 (375px 宽):
  不优化: 加载 1920px 图片 = 1.2 MB
  优化后: 加载 640px 图片 = 150 KB
  节省: 87.5% 🎉
```

---

### 1.4 懒加载机制

#### 原生懒加载 + Intersection Observer

```jsx
// 默认启用懒加载
<Image src="/photo.jpg" width={800} height={600} alt="Lazy" />

// 生成的 HTML
<img
  loading="lazy"  // ← 原生懒加载
  decoding="async"
  src="..."
/>
```

**工作流程**:
```
页面加载
  ↓
1. 仅加载视口内图片 (above the fold)
  ├─ Hero 图片: 立即加载
  └─ 底部图片: 不加载 (节省带宽)
  ↓
2. 用户滚动页面
  ↓
3. Intersection Observer 检测
  ├─ 图片进入视口前 200px → 开始预加载
  └─ 确保用户看到时已加载完成
  ↓
4. 渐进式加载
  └─ Blur placeholder 显示 → 完整图片淡入
```

#### 禁用懒加载 (关键图片)

```jsx
// 首屏关键图片 (Hero, Logo)
<Image
  src="/hero.jpg"
  width={1920}
  height={1080}
  priority  // ← 禁用懒加载,立即加载
  alt="Hero"
/>
```

**何时使用 priority**:
- ✅ 首屏 Hero 图片
- ✅ Logo / 品牌图片
- ✅ LCP (Largest Contentful Paint) 元素
- ❌ 页面底部图片
- ❌ 模态框/抽屉中的图片

---

### 1.5 Blur Placeholder

#### 工作原理

```jsx
<Image
  src="/photo.jpg"
  width={800}
  height={600}
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRg..." // ← 10 字节缩略图
/>
```

**生成流程**:
```
原始图片 (4.6 MB)
  ↓
1. 构建时生成 10x10 缩略图
  ├─ 极度压缩 (quality: 1)
  └─ 转为 Base64 Data URL (< 1 KB)
  ↓
2. 内联到 HTML
  └─ 无额外网络请求
  ↓
3. CSS blur(20px) 模糊处理
  └─ 视觉上类似完整图片
  ↓
4. 完整图片加载完成
  └─ 淡入替换 (0.3s transition)
```

**视觉效果**:
```
加载前 (0ms):    [模糊缩略图] (立即显示)
加载中 (200ms):  [模糊缩略图] (用户无感知等待)
加载后 (300ms):  [完整图片淡入] (丝滑过渡)
```

#### 自动 Blur Placeholder (本地图片)

```jsx
import heroImage from '@/public/hero.jpg'

<Image
  src={heroImage}  // ← 构建时自动生成 blurDataURL
  alt="Hero"
  placeholder="blur"  // 无需手动指定 blurDataURL
/>
```

---

### 1.6 图片优化服务器架构

#### 请求流程

```
浏览器请求
  ↓
GET /_next/image?url=/photo.jpg&w=1200&q=75
  ↓
┌─────────────────────────────────────────┐
│      Next.js Image Optimization         │
├─────────────────────────────────────────┤
│ 1. 验证 URL 白名单                       │
│    └─ 防止滥用 (domains/remotePatterns) │
│                                         │
│ 2. 检查缓存 (.next/cache/images/)       │
│    ├─ 命中 → 直接返回 (< 5ms)           │
│    └─ 未命中 → 继续处理                 │
│                                         │
│ 3. 下载/读取原图                         │
│    ├─ 远程图片: fetch + stream          │
│    └─ 本地图片: fs.readFile             │
│                                         │
│ 4. 图片处理 (Sharp.js)                  │
│    ├─ 调整尺寸 (w 参数)                 │
│    ├─ 格式转换 (Accept header)          │
│    ├─ 质量压缩 (q 参数, 默认 75)        │
│    └─ 优化元数据 (去除 EXIF)            │
│                                         │
│ 5. 缓存优化后的图片                      │
│    └─ 写入 .next/cache/images/          │
│                                         │
│ 6. 返回响应                              │
│    ├─ Content-Type: image/avif          │
│    ├─ Cache-Control: public, max-age... │
│    └─ 流式传输 (边处理边发送)           │
└─────────────────────────────────────────┘
```

#### 缓存策略

```javascript
// 响应头
Cache-Control: public, max-age=31536000, immutable

// 含义:
// - public: 可被 CDN/浏览器缓存
// - max-age=31536000: 缓存 1 年
// - immutable: 永不过期 (URL 带 hash)
```

**缓存层级**:
```
1. 浏览器内存缓存 (当前标签页)
   ├─ 速度: < 1ms
   └─ 大小: ~100 MB

2. 浏览器磁盘缓存 (跨标签页)
   ├─ 速度: < 10ms
   └─ 大小: ~1 GB

3. CDN 边缘缓存 (Vercel Edge)
   ├─ 速度: < 50ms
   └─ 地理分布

4. Next.js 本地缓存 (.next/cache/)
   ├─ 速度: < 100ms
   └─ 避免重复处理
```

---

### 1.7 性能提升数据

#### 真实案例对比

| 指标 | 原始图片 | 优化后 (next/image) | 提升 |
|------|---------|-------------------|------|
| **文件大小** | 4.6 MB | 36 KB | **99.2%** ↓ |
| **加载时间** | 3.2s (3G) | 0.3s | **10x** 🚀 |
| **LCP** | 4.5s | 1.2s | **73%** ↓ |
| **CLS** | 0.25 | 0 | **100%** ↓ |
| **带宽消耗** (100 访客) | 460 MB | 3.6 MB | **99%** ↓ |

#### Web Vitals 改善

```
优化前:
├─ LCP (最大内容绘制): 4.5s 🔴
├─ FID (首次输入延迟): 120ms 🟡
└─ CLS (累积布局偏移): 0.25 🔴

优化后:
├─ LCP: 1.2s 🟢 (目标 < 2.5s)
├─ FID: 50ms 🟢 (目标 < 100ms)
└─ CLS: 0 🟢 (目标 < 0.1)
```

---

## 二、字体优化 (next/font)

### 2.1 核心问题

传统字体加载的痛点:
- ❌ 外部网络请求 (Google Fonts CDN)
- ❌ FOUT (Flash of Unstyled Text) - 字体闪烁
- ❌ FOIT (Flash of Invisible Text) - 文字隐藏
- ❌ 布局偏移 (字体加载前后尺寸不同)
- ❌ 隐私问题 (第三方 CDN 追踪)

### 2.2 Google Fonts 自托管原理

#### 工作流程

```
开发时
  ↓
import { Inter } from 'next/font/google'
  ↓
┌─────────────────────────────────────────┐
│          构建时 (npm run build)          │
├─────────────────────────────────────────┤
│ 1. 解析字体配置                          │
│    ├─ 字体族: Inter                      │
│    ├─ 字重: 400, 700                     │
│    └─ 子集: latin                        │
│                                         │
│ 2. 从 Google Fonts API 下载字体文件      │
│    └─ GET https://fonts.google.com/...  │
│                                         │
│ 3. 保存到 .next/static/media/           │
│    └─ inter-latin-400.woff2             │
│                                         │
│ 4. 生成优化的 CSS                        │
│    ├─ @font-face 声明                   │
│    ├─ size-adjust 属性 (防止布局偏移)    │
│    └─ 内联到 <head> (critical CSS)      │
└─────────────────────────────────────────┘
  ↓
运行时 (用户访问)
  ↓
浏览器加载页面
  ├─ HTML 包含内联 CSS (0ms 延迟)
  ├─ 预加载字体文件 (<link rel="preload">)
  └─ 从自己的域名加载 (无第三方请求)
```

#### 代码示例

```jsx
// app/layout.tsx
import { Inter, Roboto_Mono } from 'next/font/google'

// 配置主字体
const inter = Inter({
  subsets: ['latin'],           // 只下载拉丁字符集 (减少体积)
  weight: ['400', '700'],       // 只下载需要的字重
  display: 'swap',              // 字体加载策略
  variable: '--font-inter',     // CSS 变量名
  preload: true,                // 预加载 (默认 true)
})

// 配置代码字体
const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-roboto-mono',
})

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN" className={`${inter.variable} ${robotoMono.variable}`}>
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
}
```

#### 生成的 CSS

```css
/* Next.js 自动生成并内联到 <head> */
@font-face {
  font-family: '__Inter_123abc';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(/_next/static/media/inter-latin-400.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, ...;

  /* ⭐ 零布局偏移关键属性 */
  size-adjust: 106.25%;
  ascent-override: 90%;
  descent-override: 22%;
  line-gap-override: 0%;
}

:root {
  --font-inter: '__Inter_123abc', sans-serif;
  --font-roboto-mono: '__Roboto_Mono_456def', monospace;
}
```

---

### 2.3 零布局偏移技术 (CSS size-adjust)

#### 问题原因

```
系统字体 (Arial)     自定义字体 (Inter)
┌────────────────┐    ┌──────────────────┐
│ Hello World    │ → │ Hello World      │
│ (高度 16px)     │    │ (高度 18px)       │
└────────────────┘    └──────────────────┘
                         ↑ 布局偏移 2px (CLS++)
```

#### 解决方案: size-adjust

```css
@font-face {
  font-family: 'Inter';
  src: url('/inter.woff2');

  /* ⭐ 调整字体尺寸,匹配系统字体 */
  size-adjust: 106.25%;   /* 缩放整体尺寸 */
  ascent-override: 90%;   /* 调整基线以上高度 */
  descent-override: 22%;  /* 调整基线以下高度 */
  line-gap-override: 0%;  /* 行间距调整 */
}
```

**效果**:
```
优化前:
系统字体 → 自定义字体
┌────────┐   ┌──────────┐
│  Text  │ → │   Text   │  ← 布局跳动
└────────┘   └──────────┘
CLS: 0.15 🔴

优化后:
系统字体 → 自定义字体
┌────────┐   ┌────────┐
│  Text  │ → │  Text  │  ← 无缝切换
└────────┘   └────────┘
CLS: 0 🟢
```

#### 计算公式

```javascript
// Next.js 自动计算,无需手动
size-adjust = (系统字体高度 / 自定义字体高度) * 100%

// 示例:
Arial 高度: 16px
Inter 高度: 15.05px
size-adjust = (16 / 15.05) * 100% = 106.25%
```

---

### 2.4 Local Fonts 加载机制

#### 使用本地字体

```jsx
import localFont from 'next/font/local'

const myFont = localFont({
  src: [
    {
      path: './fonts/CustomFont-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/CustomFont-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-custom',
  display: 'swap',
})

export default function RootLayout({ children }) {
  return (
    <html className={myFont.variable}>
      <body className={myFont.className}>{children}</body>
    </html>
  )
}
```

#### 构建时处理

```
fonts/CustomFont-Regular.woff2
  ↓
npm run build
  ↓
1. 复制到 .next/static/media/
  └─ CustomFont-Regular-abc123.woff2 (带 hash)
  ↓
2. 生成 @font-face CSS
  └─ 内联到 <head>
  ↓
3. 预加载指令
  └─ <link rel="preload" href="/..." as="font">
```

---

### 2.5 Variable Fonts 优势

#### 传统字体 vs 可变字体

```
传统字体 (需要多个文件):
├─ Inter-Light.woff2      (100 KB)
├─ Inter-Regular.woff2    (105 KB)
├─ Inter-Medium.woff2     (108 KB)
├─ Inter-SemiBold.woff2   (110 KB)
└─ Inter-Bold.woff2       (112 KB)
总计: 535 KB

可变字体 (单个文件):
└─ Inter-Variable.woff2   (180 KB) ✅
```

**优势**:
- ✅ 文件更小 (66% 减少)
- ✅ 支持任意字重 (100-900)
- ✅ 流畅动画 (字重渐变)
- ✅ 减少网络请求

#### 使用可变字体

```jsx
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  // 不指定 weight,自动使用 Variable Font
  variable: '--font-inter',
})

// CSS 中使用
.text {
  font-family: var(--font-inter);
  font-weight: 450; /* 任意值 */
}

// 动画
@keyframes weight-change {
  from { font-weight: 300; }
  to { font-weight: 800; }
}
```

---

### 2.6 字体加载策略 (font-display)

#### 五种策略对比

```css
/* 1. auto - 浏览器默认行为 */
font-display: auto;
/* FOIT: 3s 隐藏 → 显示备用 → 字体加载完成替换 */

/* 2. block - 阻塞渲染 */
font-display: block;
/* FOIT: 3s 隐藏 → 字体加载完成显示 (无备用) */

/* 3. swap - 立即显示备用 (推荐) ✅ */
font-display: swap;
/* FOUT: 立即显示备用 → 字体加载完成替换 */

/* 4. fallback - 100ms 妥协 */
font-display: fallback;
/* 100ms 隐藏 → 显示备用 → 3s 内加载完成替换,否则放弃 */

/* 5. optional - 性能优先 */
font-display: optional;
/* 100ms 内加载完成使用,否则本次访问放弃 (下次从缓存加载) */
```

#### Next.js 推荐策略

```jsx
const inter = Inter({
  display: 'swap', // ← 推荐: 立即显示备用字体
  subsets: ['latin'],
})
```

**时间线对比**:
```
font-display: block (传统)
0ms      3000ms        4000ms
├──────────┼────────────┼─────>
[隐藏文字]  [显示备用]   [显示自定义]
用户等待 3s 看不到内容 🔴

font-display: swap (Next.js 默认)
0ms         1000ms
├────────────┼─────>
[显示备用]   [显示自定义]
用户立即看到内容 🟢
```

---

### 2.7 预加载与性能优化

#### 自动预加载

```html
<!-- Next.js 自动生成 -->
<head>
  <!-- 1. 内联 CSS (0ms) -->
  <style data-next-font>
    @font-face { ... }
  </style>

  <!-- 2. 预加载字体文件 -->
  <link
    rel="preload"
    href="/_next/static/media/inter-latin-400.woff2"
    as="font"
    type="font/woff2"
    crossorigin="anonymous"
  />
</head>
```

**预加载效果**:
```
无预加载:
HTML 解析 → CSS 解析 → 发现 @font-face → 下载字体
0ms       100ms      200ms             300ms
├──────────┼──────────┼────────────────┼─────>
                                      [字体加载开始]

有预加载:
HTML 解析 → 并行下载字体
0ms       100ms
├──────────┼─────>
          [字体加载完成] ✅
```

#### 构建时优化

```
next build
  ↓
字体处理:
├─ 下载 Google Fonts (仅构建时一次)
├─ 转换为 WOFF2 (最佳压缩)
├─ 子集化 (只保留使用的字符)
├─ 计算 size-adjust 值
└─ 生成预加载指令

结果:
├─ .next/static/media/*.woff2 (自托管)
└─ 零运行时开销
```

---

## 三、CSS 优化

### 3.1 CSS Modules 原理

#### 作用域隔离机制

```css
/* styles/Button.module.css */
.button {
  background: blue;
  padding: 10px;
}

.primary {
  background: green;
}
```

```jsx
// components/Button.tsx
import styles from './Button.module.css'

export function Button() {
  return <button className={styles.button}>Click</button>
}
```

**编译后**:
```css
/* 生成唯一 hash 类名 */
.Button_button__a1b2c {
  background: blue;
  padding: 10px;
}

.Button_primary__d3e4f {
  background: green;
}
```

```html
<!-- 渲染的 HTML -->
<button class="Button_button__a1b2c">Click</button>
```

#### 工作原理

```
构建时
  ↓
┌─────────────────────────────────────────┐
│          CSS Modules Pipeline           │
├─────────────────────────────────────────┤
│ 1. PostCSS 解析 CSS                      │
│    └─ 提取所有类名选择器                 │
│                                         │
│ 2. 生成唯一 hash                         │
│    └─ .button → .Button_button__a1b2c  │
│                                         │
│ 3. 替换 JS 中的引用                      │
│    └─ styles.button = 'Button_button__a1b2c' │
│                                         │
│ 4. 输出转换后的 CSS                      │
│    └─ .next/static/css/app.css         │
└─────────────────────────────────────────┘
```

#### 优势

✅ **无命名冲突**: 每个组件的类名独立
✅ **作用域隔离**: 样式不会泄漏
✅ **Tree-shaking**: 未使用的类名自动删除
✅ **代码分割**: 按路由分割 CSS
✅ **类型安全** (TypeScript):

```typescript
// 自动生成类型
import styles from './Button.module.css'

styles.button    // ✅ 存在
styles.xyz       // ❌ TypeScript 错误
```

---

### 3.2 Tailwind CSS 零运行时机制

#### 工作原理

```
开发时
  ↓
<div className="flex items-center p-4 bg-blue-500">
  ↓
┌─────────────────────────────────────────┐
│         Tailwind JIT 编译器              │
├─────────────────────────────────────────┤
│ 1. 扫描源代码 (*.tsx, *.jsx)            │
│    └─ 提取所有 className 中的 Tailwind  │
│                                         │
│ 2. 生成对应的 CSS                        │
│    ├─ flex → display: flex;             │
│    ├─ items-center → align-items: center; │
│    ├─ p-4 → padding: 1rem;              │
│    └─ bg-blue-500 → background: #3b82f6; │
│                                         │
│ 3. 输出最小化 CSS                        │
│    └─ 只包含使用的类 (未使用的不生成)    │
└─────────────────────────────────────────┘
  ↓
.next/static/css/app.css (压缩后 < 10 KB)
```

#### 零运行时对比

```javascript
// ❌ CSS-in-JS (Styled Components)
const Button = styled.button`
  background: blue;
  padding: 10px;
`
// 运行时:
// 1. 执行 JS 生成 CSS (10-50ms)
// 2. 插入 <style> 到 <head>
// 3. 触发浏览器重排
// JS Bundle: +15 KB (styled-components runtime)

// ✅ Tailwind CSS
<button className="bg-blue-500 p-4">Click</button>
// 运行时:
// 1. 直接使用现成的 CSS (0ms)
// 2. 无 JS 执行
// 3. 无重排
// JS Bundle: 0 KB (零运行时)
```

#### 性能数据

| 指标 | CSS-in-JS | Tailwind CSS |
|------|-----------|--------------|
| **首次渲染** | 150ms | 10ms ✅ |
| **样式计算** | 每次渲染 | 0 (静态 CSS) ✅ |
| **JS Bundle** | +15-50 KB | 0 KB ✅ |
| **服务端渲染** | 需要额外处理 | 天然支持 ✅ |
| **Hydration** | 样式闪烁风险 | 无风险 ✅ |

---

### 3.3 CSS-in-JS 性能分析

#### 运行时开销

```jsx
// styled-components 示例
import styled from 'styled-components'

const Button = styled.button`
  background: ${props => props.primary ? 'blue' : 'gray'};
  padding: 10px;

  &:hover {
    opacity: 0.8;
  }
`

// 运行时流程:
// 1. 执行 JS 生成 CSS 字符串
// 2. 计算 hash (用于去重)
// 3. 检查是否已插入
// 4. 创建 <style> 元素
// 5. 插入 document.head
// 6. 触发浏览器重排
```

#### SSR 额外复杂度

```jsx
// 服务端需要特殊处理
import { ServerStyleSheet } from 'styled-components'

export async function GET() {
  const sheet = new ServerStyleSheet()

  try {
    // 收集样式
    const html = ReactDOMServer.renderToString(
      sheet.collectStyles(<App />)
    )

    // 提取 CSS
    const styles = sheet.getStyleTags()

    return new Response(`
      <html>
        <head>${styles}</head>
        <body>${html}</body>
      </html>
    `)
  } finally {
    sheet.seal()
  }
}
```

#### Next.js 官方建议

> **不推荐 CSS-in-JS (运行时)**:
> - ❌ 增加 JS Bundle 大小
> - ❌ 运行时性能开销
> - ❌ SSR 复杂度高
> - ❌ React 18 Streaming 支持差
>
> **推荐方案**:
> - ✅ Tailwind CSS (零运行时)
> - ✅ CSS Modules (作用域隔离)
> - ✅ Sass/Less (预处理器)

---

### 3.4 自动代码分割与合并

#### 按路由分割

```
app/
├── page.tsx                → app-page.css
├── about/
│   └── page.tsx           → about-page.css
├── blog/
│   ├── page.tsx           → blog-page.css
│   └── [slug]/
│       └── page.tsx       → blog-slug-page.css
└── dashboard/
    ├── layout.tsx         → dashboard-layout.css (共享)
    ├── page.tsx           → dashboard-page.css
    └── settings/
        └── page.tsx       → dashboard-settings-page.css
```

**构建输出**:
```
.next/static/css/
├── app-layout.css         (全局布局,所有页面共享)
├── app-page.css           (首页独有)
├── about-page.css         (关于页独有)
├── blog-page.css          (博客列表独有)
├── blog-slug-page.css     (博客详情独有)
└── dashboard-layout.css   (仪表盘共享)
```

#### 智能合并算法

```
访问 /dashboard/settings
  ↓
加载 CSS:
├─ app-layout.css (16 KB) - 全局
├─ dashboard-layout.css (8 KB) - 仪表盘共享
└─ dashboard-settings-page.css (4 KB) - 设置页独有
总计: 28 KB

导航到 /dashboard/profile
  ↓
加载 CSS:
├─ app-layout.css ✅ (已缓存)
├─ dashboard-layout.css ✅ (已缓存)
└─ dashboard-profile-page.css (5 KB) - 新下载
新下载: 5 KB (节省 82%)
```

#### 关键 CSS 内联

```html
<!-- 首页 HTML -->
<html>
<head>
  <!-- 1. 内联关键 CSS (首屏必需) -->
  <style id="__next-critical-css">
    .container { max-width: 1200px; }
    .hero { height: 80vh; }
  </style>

  <!-- 2. 预加载完整 CSS -->
  <link rel="preload" href="/app-page.css" as="style">

  <!-- 3. 异步加载完整 CSS -->
  <link rel="stylesheet" href="/app-page.css" media="print" onload="this.media='all'">
</head>
<body>
  <!-- 首屏内容立即渲染 (使用内联 CSS) -->
</body>
</html>
```

**效果**:
```
传统方式:
HTML 加载 → CSS 加载 → 渲染
0ms       200ms      400ms
├──────────┼──────────┼─────>
                     [首屏显示]

优化后:
HTML 加载 → 渲染 (使用内联 CSS)
0ms       50ms
├──────────┼─────>
          [首屏显示] ✅
          (完整 CSS 异步加载)
```

---

### 3.5 生产环境压缩

#### 压缩流程

```
npm run build
  ↓
┌─────────────────────────────────────────┐
│           CSS 优化管道                   │
├─────────────────────────────────────────┤
│ 1. PostCSS 处理                          │
│    ├─ Autoprefixer (浏览器前缀)          │
│    ├─ cssnano (压缩)                     │
│    └─ PurgeCSS (去除未使用)              │
│                                         │
│ 2. 压缩算法                              │
│    ├─ 删除注释                           │
│    ├─ 删除空格/换行                      │
│    ├─ 合并重复规则                       │
│    ├─ 缩短颜色值 (#ffffff → #fff)       │
│    └─ 压缩选择器                         │
│                                         │
│ 3. Brotli/Gzip 压缩                      │
│    └─ 生成 .css.br 和 .css.gz           │
└─────────────────────────────────────────┘
```

#### 压缩效果

```css
/* 开发环境 (未压缩) */
.container {
  max-width: 1200px;
  margin-left: auto;
  margin-right: auto;
  padding-left: 1rem;
  padding-right: 1rem;
}

.button {
  background-color: #3b82f6;
  color: #ffffff;
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
}
```

```css
/* 生产环境 (压缩后) */
.container{max-width:1200px;margin-left:auto;margin-right:auto;padding-left:1rem;padding-right:1rem}.button{background-color:#3b82f6;color:#fff;padding-top:.5rem;padding-bottom:.5rem}
```

**大小对比**:
```
原始 CSS: 285 字节
压缩后:   167 字节 (-41%)
Gzip:     98 字节 (-66%)
Brotli:   85 字节 (-70%) ✅
```

---

## 四、SEO 优化

### 4.1 Metadata API 架构

#### 静态 Metadata

```tsx
// app/about/page.tsx
import type { Metadata } from 'next'

// 导出静态 metadata 对象
export const metadata: Metadata = {
  title: '关于我们',
  description: '了解我们的团队和使命',
  keywords: ['团队', '使命', '关于'],
  authors: [{ name: 'John Doe', url: 'https://example.com' }],
  openGraph: {
    title: '关于我们',
    description: '了解我们的团队',
    url: 'https://example.com/about',
    siteName: 'My Site',
    images: [
      {
        url: 'https://example.com/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'About page image',
      },
    ],
    locale: 'zh_CN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '关于我们',
    description: '了解我们的团队',
    images: ['https://example.com/twitter-image.jpg'],
  },
}

export default function AboutPage() {
  return <div>关于页面内容</div>
}
```

**生成的 HTML**:
```html
<head>
  <!-- 基础 Meta -->
  <title>关于我们</title>
  <meta name="description" content="了解我们的团队和使命" />
  <meta name="keywords" content="团队, 使命, 关于" />
  <meta name="author" content="John Doe" />

  <!-- Open Graph (Facebook, LinkedIn) -->
  <meta property="og:title" content="关于我们" />
  <meta property="og:description" content="了解我们的团队" />
  <meta property="og:url" content="https://example.com/about" />
  <meta property="og:site_name" content="My Site" />
  <meta property="og:image" content="https://example.com/og-image.jpg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:locale" content="zh_CN" />
  <meta property="og:type" content="website" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="关于我们" />
  <meta name="twitter:description" content="了解我们的团队" />
  <meta name="twitter:image" content="https://example.com/twitter-image.jpg" />
</head>
```

---

### 4.2 动态 Metadata (generateMetadata)

#### 基于路由参数生成

```tsx
// app/blog/[slug]/page.tsx
import type { Metadata } from 'next'

interface PageProps {
  params: { slug: string }
}

// ⭐ 动态生成 metadata
export async function generateMetadata(
  { params }: PageProps
): Promise<Metadata> {
  // 1. 获取数据
  const post = await fetchPost(params.slug)

  // 2. 返回 metadata
  return {
    title: post.title,
    description: post.excerpt,
    keywords: post.tags,
    authors: [{ name: post.author }],
    openGraph: {
      title: post.title,
      description: post.excerpt,
      images: [post.coverImage],
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      type: 'article',
    },
    alternates: {
      canonical: `https://example.com/blog/${params.slug}`,
    },
  }
}

export default async function BlogPost({ params }: PageProps) {
  const post = await fetchPost(params.slug)
  return <article>{post.content}</article>
}

async function fetchPost(slug: string) {
  // 模拟数据库查询
  return {
    title: 'Next.js 15 新特性',
    excerpt: '探索 Next.js 15 的新功能',
    tags: ['Next.js', 'React', 'Web Development'],
    author: 'Jane Smith',
    coverImage: 'https://example.com/blog/nextjs-15.jpg',
    publishedAt: '2024-01-15',
    updatedAt: '2024-01-20',
    content: '...',
  }
}
```

#### 工作流程

```
用户访问 /blog/nextjs-15
  ↓
┌─────────────────────────────────────────┐
│          Metadata 生成流程               │
├─────────────────────────────────────────┤
│ 1. 调用 generateMetadata({ params })    │
│    └─ params = { slug: 'nextjs-15' }   │
│                                         │
│ 2. 执行数据获取 (fetch/数据库)           │
│    └─ 自动请求去重 (与 Page 共享缓存)    │
│                                         │
│ 3. 返回 Metadata 对象                    │
│    └─ title, description, openGraph...  │
│                                         │
│ 4. 注入到 HTML <head>                    │
│    └─ 生成对应的 <meta> 标签             │
│                                         │
│ 5. 渲染 Page 组件                        │
│    └─ 复用相同的数据 (无重复请求)        │
└─────────────────────────────────────────┘
```

#### 请求去重优化

```tsx
// ⭐ fetch 请求自动去重
export async function generateMetadata({ params }: PageProps) {
  // 请求 1: generateMetadata 中
  const post = await fetch(`/api/posts/${params.slug}`)
  return { title: post.title }
}

export default async function Page({ params }: PageProps) {
  // 请求 2: Page 组件中
  // ✅ Next.js 自动检测相同 URL,复用请求 1 的结果
  const post = await fetch(`/api/posts/${params.slug}`)
  return <div>{post.content}</div>
}

// 实际网络请求: 1 次 (不是 2 次)
```

---

### 4.3 流式渲染中的 Metadata 注入

#### 问题场景

```tsx
// Streaming SSR 页面
export default function Page() {
  return (
    <>
      <Header />
      <Suspense fallback={<Skeleton />}>
        <SlowContent />  {/* 需要 2 秒加载 */}
      </Suspense>
    </>
  )
}
```

**传统方式问题**:
```
等待所有内容加载完成 → 生成完整 HTML (包括 <head>)
0ms                    2000ms
├──────────────────────┼─────>
                      [返回 HTML]
用户等待 2 秒 🔴
```

#### Next.js 解决方案

```
流式传输 HTML
  ↓
0ms: 发送 <head> + 初始内容
├─ <head>
│   <meta name="description" ...>  ← metadata 立即注入
├─ <body>
│   <div id="__next">
│     <Header />  ← 立即渲染
│     <div>Loading...</div>  ← Suspense fallback
  ↓
2000ms: 流式追加完整内容
│     <template id="B:0">
│       <SlowContent />  ← Suspense 解析后追加
│     </template>
│     <script>
│       // 替换 fallback
│     </script>
```

**工作原理**:
```tsx
// Next.js 内部实现 (简化)
export async function generateHTMLStream(tree, metadata) {
  // 1. 立即发送 <head> (包含 metadata)
  yield `<head>${renderMetadata(metadata)}</head>`

  // 2. 开始流式渲染 body
  const stream = ReactDOMServer.renderToReadableStream(tree, {
    onShellReady() {
      // Shell (Layout + Suspense fallback) 准备好后立即发送
      controller.enqueue(encoder.encode('<body>...'))
    },
    onAllReady() {
      // 所有内容加载完成 (包括 Suspense)
      controller.close()
    }
  })

  // 3. 流式传输
  for await (const chunk of stream) {
    yield chunk
  }
}
```

**效果对比**:
```
传统 SSR:
等待 2s → 返回完整 HTML
├──────────────────────┼─────>
用户白屏 2s 🔴

Streaming SSR:
立即返回 Shell → 追加内容
├─────┼──────────────────┼─────>
0ms   [用户看到框架]      2s [完整内容]
首屏 100ms 🟢
```

---

### 4.4 Sitemap 自动生成

#### 静态 Sitemap

```typescript
// app/sitemap.ts
import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://example.com',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: 'https://example.com/about',
      lastModified: new Date('2024-01-15'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://example.com/blog',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
  ]
}
```

**生成的 XML** (`/sitemap.xml`):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com</loc>
    <lastmod>2024-01-20</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://example.com/about</loc>
    <lastmod>2024-01-15</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://example.com/blog</loc>
    <lastmod>2024-01-20</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>
```

#### 动态 Sitemap

```typescript
// app/sitemap.ts
import type { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 1. 获取动态路由数据
  const posts = await fetchAllPosts()
  const products = await fetchAllProducts()

  // 2. 生成静态路由
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: 'https://example.com',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: 'https://example.com/about',
      lastModified: new Date('2024-01-15'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ]

  // 3. 生成博客路由
  const blogRoutes: MetadataRoute.Sitemap = posts.map(post => ({
    url: `https://example.com/blog/${post.slug}`,
    lastModified: new Date(post.updatedAt),
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  // 4. 生成产品路由
  const productRoutes: MetadataRoute.Sitemap = products.map(product => ({
    url: `https://example.com/products/${product.id}`,
    lastModified: new Date(product.updatedAt),
    changeFrequency: 'daily',
    priority: 0.9,
  }))

  // 5. 合并所有路由
  return [...staticRoutes, ...blogRoutes, ...productRoutes]
}

async function fetchAllPosts() {
  // 从数据库/CMS 获取所有文章
  return [
    { slug: 'nextjs-15', updatedAt: '2024-01-20' },
    { slug: 'react-18', updatedAt: '2024-01-18' },
  ]
}

async function fetchAllProducts() {
  return [
    { id: 'product-1', updatedAt: '2024-01-19' },
    { id: 'product-2', updatedAt: '2024-01-20' },
  ]
}
```

#### 多 Sitemap (大型网站)

```typescript
// app/sitemap.ts (索引文件)
import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://example.com/sitemap/posts.xml',
      lastModified: new Date(),
    },
    {
      url: 'https://example.com/sitemap/products.xml',
      lastModified: new Date(),
    },
  ]
}

// app/sitemap/posts/route.ts
export async function GET() {
  const posts = await fetchAllPosts()

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${posts.map(post => `
        <url>
          <loc>https://example.com/blog/${post.slug}</loc>
          <lastmod>${post.updatedAt}</lastmod>
        </url>
      `).join('')}
    </urlset>`

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
    },
  })
}
```

---

### 4.5 Robots.txt 配置

#### 基础配置

```typescript
// app/robots.ts
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',  // 所有爬虫
        allow: '/',      // 允许抓取所有路径
        disallow: [
          '/admin/',     // 禁止管理后台
          '/api/',       // 禁止 API 路由
          '/private/',   // 禁止私有页面
        ],
      },
      {
        userAgent: 'Googlebot',  // Google 爬虫专用规则
        allow: ['/'],
        disallow: ['/admin/'],
        crawlDelay: 0,  // 无延迟 (优先级最高)
      },
    ],
    sitemap: 'https://example.com/sitemap.xml',  // Sitemap 位置
    host: 'https://example.com',  // 首选域名
  }
}
```

**生成的 robots.txt** (`/robots.txt`):
```
User-Agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /private/

User-Agent: Googlebot
Allow: /
Disallow: /admin/
Crawl-delay: 0

Sitemap: https://example.com/sitemap.xml
Host: https://example.com
```

#### 环境区分

```typescript
// app/robots.ts
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

  // 生产环境: 允许抓取
  if (process.env.NODE_ENV === 'production') {
    return {
      rules: {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/'],
      },
      sitemap: `${baseUrl}/sitemap.xml`,
    }
  }

  // 开发/测试环境: 禁止抓取
  return {
    rules: {
      userAgent: '*',
      disallow: '/',  // 禁止所有路径
    },
  }
}
```

---

### 4.6 Structured Data (JSON-LD)

#### Article Schema

```tsx
// app/blog/[slug]/page.tsx
export default async function BlogPost({ params }: { params: { slug: string } }) {
  const post = await fetchPost(params.slug)

  // JSON-LD 结构化数据
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    image: post.coverImage,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: {
      '@type': 'Person',
      name: post.author,
      url: `https://example.com/authors/${post.authorId}`,
    },
    publisher: {
      '@type': 'Organization',
      name: 'My Blog',
      logo: {
        '@type': 'ImageObject',
        url: 'https://example.com/logo.png',
      },
    },
  }

  return (
    <>
      {/* 注入 JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article>
        <h1>{post.title}</h1>
        <p>{post.content}</p>
      </article>
    </>
  )
}
```

#### Product Schema

```tsx
// app/products/[id]/page.tsx
export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await fetchProduct(params.id)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: product.images,
    description: product.description,
    sku: product.sku,
    brand: {
      '@type': 'Brand',
      name: product.brand,
    },
    offers: {
      '@type': 'Offer',
      url: `https://example.com/products/${params.id}`,
      priceCurrency: 'USD',
      price: product.price,
      availability: product.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Organization',
        name: 'My Store',
      },
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: product.rating,
      reviewCount: product.reviewCount,
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div>
        <h1>{product.name}</h1>
        <p>Price: ${product.price}</p>
      </div>
    </>
  )
}
```

#### Breadcrumb Schema

```tsx
// components/Breadcrumbs.tsx
export function Breadcrumbs({ items }: { items: Array<{ name: string; url: string }> }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav>
        {items.map((item, index) => (
          <span key={index}>
            <a href={item.url}>{item.name}</a>
            {index < items.length - 1 && ' > '}
          </span>
        ))}
      </nav>
    </>
  )
}
```

**Google 搜索结果增强**:
```
使用 JSON-LD 后:
┌────────────────────────────────────────┐
│ 🔍 Google 搜索结果                      │
├────────────────────────────────────────┤
│ Next.js 15 新特性                       │
│ https://example.com/blog/nextjs-15     │
│                                        │
│ ⭐⭐⭐⭐⭐ 4.8 (127 条评论) ← 星级显示   │
│ 作者: Jane Smith · 2024年1月15日       │
│ 探索 Next.js 15 的新功能...             │
│                                        │
│ 首页 > 博客 > Next.js 15  ← 面包屑导航  │
└────────────────────────────────────────┘
```

---

## 总结

### 核心优化策略

1. **图片优化**
   - ✅ 自动格式转换 (WebP/AVIF)
   - ✅ 响应式图片 (srcset)
   - ✅ 懒加载 + 预加载
   - ✅ Blur placeholder

2. **字体优化**
   - ✅ Google Fonts 自托管
   - ✅ 零布局偏移 (size-adjust)
   - ✅ 预加载关键字体
   - ✅ Variable Fonts

3. **CSS 优化**
   - ✅ 零运行时 (Tailwind)
   - ✅ 作用域隔离 (CSS Modules)
   - ✅ 自动代码分割
   - ✅ Critical CSS 内联

4. **SEO 优化**
   - ✅ Metadata API
   - ✅ 自动生成 Sitemap
   - ✅ Robots.txt 配置
   - ✅ JSON-LD 结构化数据

### 性能收益

```
加载速度:    3.2s → 0.8s   (4x 提升)
LCP:        4.5s → 1.2s   (73% 改善)
CLS:        0.25 → 0      (100% 改善)
JS Bundle:  -50 KB        (CSS-in-JS → Tailwind)
带宽消耗:   -99%          (图片优化)
SEO 收录:   7天 → 3天     (2x 提升)
```

### 最佳实践

1. **始终使用 `next/image`** - 自动优化图片
2. **优先 `next/font`** - 避免外部字体请求
3. **选择 Tailwind/CSS Modules** - 避免 CSS-in-JS
4. **使用 Metadata API** - 类型安全的 SEO
5. **启用 Streaming SSR** - 改善首屏体验

---

**相关资源**:
- [Next.js 官方文档 - 图片优化](https://nextjs.org/docs/app/building-your-application/optimizing/images)
- [Next.js 官方文档 - 字体优化](https://nextjs.org/docs/app/building-your-application/optimizing/fonts)
- [Next.js 官方文档 - Metadata](https://nextjs.org/docs/app/building-your-application/optimizing/metadata)
- [Web Vitals](https://web.dev/vitals/)
