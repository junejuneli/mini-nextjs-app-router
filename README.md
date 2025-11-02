# Mini Next.js App Router

> A minimal educational implementation of Next.js App Router with React Server Components and Flight Protocol

English | [中文文档](./README_CN.md)

## 🎯 Learning Goals

Understand how modern React Server Components and Next.js App Router work through a simplified implementation:

- ✅ **React Server Components (RSC)** - Server/Client component composition
- ✅ **Flight Protocol** - Custom serialization format for React trees
- ✅ **Streaming SSR** - Progressive rendering with Suspense
- ✅ **Nested Layouts** - Automatic layout nesting with soft navigation
- ✅ **File-system Routing** - Convention-based routing from `app/` directory
- ✅ **Special Files** - loading.jsx, error.jsx, not-found.jsx
- ✅ **SSG & ISR** - Static generation with Incremental Static Regeneration
- ✅ **Dynamic Routes** - [param] syntax with generateStaticParams()
- ✅ **Route Groups** - (folder) syntax for code organization

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Build the project
npm run build

# 3. Start the server
npm start
```

Visit http://localhost:3000

**Example pages to explore**:
- `/` - Home (Server Component)
- `/about` - About page (Server Component)
- `/blog` - Blog list (Dynamic routes demo)
- `/blog/react-server-components` - Blog post ([slug] dynamic route)
- `/pricing` - Pricing page (Route groups demo)
- `/dashboard` - Dashboard (Nested layouts + Client Component)
- `/dashboard/settings` - Settings (Nested route)
- `/async-test` - Async data fetching (with loading.jsx)
- `/isr-test` - ISR demo (10 second revalidate)
- `/error-test` - Error handling (with error.jsx)
- `/404-test` - Not found handling (with not-found.jsx)

## 📁 Project Structure

```
mini-nextjs-app-router/
├── app/                    # Application directory
│   ├── layout.jsx         # Root Layout (required)
│   ├── page.jsx           # Home page
│   ├── loading.jsx        # Loading UI
│   ├── error.jsx          # Error boundary
│   └── .../               # More routes
│
├── build/                  # Build system
│   ├── index.js           # Build orchestrator
│   ├── scan-app.js        # Scan app/ directory
│   ├── generate-routes.js # Generate route tree
│   ├── render-static.js   # Pre-render static routes
│   └── vite-build.js      # Vite build for client bundles
│
├── server/                 # Server runtime
│   ├── index.js           # Express server entry
│   ├── router.js          # Route matcher
│   ├── render-ssr.js      # SSR renderer
│   ├── render-ssg.js      # SSG file server
│   └── regenerate.js      # ISR regeneration logic
│
├── shared/                 # Server/Client shared code
│   ├── flight-encoder.js  # Flight Protocol encoder
│   ├── flight-decoder.js  # Flight Protocol decoder
│   ├── rsc-renderer.js    # RSC renderer
│   ├── metadata.js        # ISR metadata manager
│   └── html-template.js   # HTML template generator
│
├── client/                 # Client runtime
│   ├── index.jsx          # Client entry (Hydration)
│   ├── router.jsx         # Client-side router
│   ├── Link.jsx           # Link component
│   ├── ErrorBoundary.jsx  # Error boundary
│   └── module-map.ts      # Client component module map
│
└── .next/                  # Build output
    ├── manifest.json      # Route manifest
    ├── dist/              # Vite bundled assets
    └── static/            # Pre-rendered pages
        ├── pages/         # HTML files
        └── flight/        # Flight payloads
```

## 💡 Core Concepts

### React Server Components

**Server Component** (default):
- Executes only on the server
- Direct access to databases, file systems
- Not sent to the client (Zero Bundle)
- Cannot use hooks or browser APIs

**Client Component** (`'use client'`):
- Pre-rendered on server + Hydrated on client
- Can use useState, useEffect, event handlers
- Sent to client for interactivity

### Flight Protocol

A serialization format for transmitting React trees with Server/Client components:

```
M1:{"id":"./Button.jsx","chunks":["Button"],"name":"default"}
J0:["$","div",null,{"children":["$","@1",null,{"text":"Click"}]}]
```

- `M` = Module Reference (Client Component reference)
- `J` = JSON (regular data)
- `@1` = Reference to module ID 1

### Streaming SSR

Progressive content delivery using React 18 Suspense:

```
100ms → Send Shell (Layout + Loading)
500ms → Stream content (Suspense resolved)
User sees framework immediately, no need to wait for all data
```

### ISR (Incremental Static Regeneration)

```jsx
// app/isr-test/page.jsx
export const revalidate = 60  // Revalidate every 60 seconds

export default function Page() {
  return <div>{new Date().toISOString()}</div>
}
```

**How it works**:
1. First request → Generate and cache
2. Subsequent requests → Serve cached version (fast)
3. After revalidate time → Return stale cache + regenerate in background
4. Next request → Serve fresh content

## 🔍 How It Works

### Build Process

```
1. Scan app/ directory → Extract routes and metadata
2. Generate route tree → Create route matching rules
3. Vite build → Bundle client components
4. Pre-render static routes → Generate HTML + Flight payloads
5. Save manifest.json → Route config for runtime
```

### Server Request Handling

```
Request → Route matching → Check pre-rendered?
                          ├─ Yes → Serve static file (SSG/ISR)
                          │        └─ Check revalidate → Regenerate in background
                          └─ No  → Dynamic render (SSR)
                                   └─ Render RSC → Generate HTML/Flight
```

### Client Hydration

```
1. Browser receives HTML
2. Load bundled JS
3. Parse __NEXT_DATA__ (initial props)
4. hydrateRoot() → Attach event listeners
5. Interactive!
```

### Client-Side Navigation

```
Link click → Intercept → Fetch ?_rsc=1 → Get Flight payload
                                        → Parse Flight
                                        → Load client components
                                        → Update DOM (React transition)
                                        → pushState (update URL)
```

## 📖 Documentation

**Core Documentation** (Recommended reading order):

1. **[FEATURE_COMPARISON_AND_ROADMAP.md](./docs/FEATURE_COMPARISON_AND_ROADMAP.md)** ⭐ Start Here
   - Complete feature comparison with Next.js 15
   - Core architecture and data flow
   - 6 核心技术详解 (RSC, Flight Protocol, ISR, 动态路由, 路由组, 错误处理)
   - Recommended learning path

2. **[FLIGHT_PROTOCOL_DEEP_DIVE.md](./docs/FLIGHT_PROTOCOL_DEEP_DIVE.md)** ⭐ Deep Dive
   - Complete Flight Protocol format specification
   - Module Reference mechanism
   - Encoder/Decoder implementation
   - Dual-mode decoding (SSG vs Client)
   - Real-world examples

3. **[CLIENT_COMPONENT_LOADING.md](./docs/CLIENT_COMPONENT_LOADING.md)** ⭐ Essential
   - 5 loading scenarios for Client Components
   - SSR initial load, client navigation, prefetch, dynamic import, React.lazy
   - Network request timeline analysis
   - Caching mechanisms
   - Performance optimization tips

4. **[SERVER_RUNTIME_AND_ISR.md](./docs/SERVER_RUNTIME_AND_ISR.md)**
   - Server runtime architecture
   - Request handling pipeline
   - ISR implementation (Stale-while-revalidate)
   - Route matching algorithm
   - Concurrent safety and atomic writes

5. **[ROUTE_SCANNING_AND_CONFIG.md](./docs/ROUTE_SCANNING_AND_CONFIG.md)**
   - Route scanning system implementation
   - Configuration extraction (revalidate, dynamic)
   - Config flow: build time → runtime
   - Dynamic routes and generateStaticParams

6. **[NEXTJS_CACHING_STRATEGIES.md](./docs/NEXTJS_CACHING_STRATEGIES.md)**
   - Next.js 15 caching strategies
   - Four-layer cache architecture
   - Mini Next.js implementation comparison
   - Best practices

## 🎓 Learning Path

**Beginner**:
1. Read this README to understand the project overview
2. Run the project and explore example pages
3. Read `FEATURE_COMPARISON_AND_ROADMAP.md` for architecture and feature comparison
4. Observe browser DevTools and console logs

**Intermediate**:
5. Read `FLIGHT_PROTOCOL_DEEP_DIVE.md` for protocol internals
6. Read `CLIENT_COMPONENT_LOADING.md` for loading mechanisms
7. Read `SERVER_RUNTIME_AND_ISR.md` for server runtime
8. Examine source code implementation
9. Check `.next/` build output files

**Advanced**:
10. Modify `app/` examples and observe changes
11. Create your own Server/Client Components
12. Implement new features and trace Flight Protocol data
13. Compare with real Next.js source code

## 🆚 Comparison with Real Next.js

### Implementation Status

| Category | Mini Next.js | Notes |
|----------|--------------|-------|
| **Core Features** | 95% | RSC, Flight Protocol, SSG, ISR, Streaming SSR |
| **Routing** | 90% | File-system, dynamic routes, route groups, catch-all |
| **Data Fetching** | 85% | async components, params, searchParams, generateStaticParams |
| **Error Handling** | 100% | error.tsx, global-error.tsx, not-found.tsx |
| **Advanced Features** | 25% | No API routes, middleware, parallel routes |
| **Caching** | 60% | Full Route Cache (SSG/ISR), basic router cache |

**Overall Implementation**: **65%** (Core: 95%, Advanced: 25%)

> See [FEATURE_COMPARISON_AND_ROADMAP.md](./docs/FEATURE_COMPARISON_AND_ROADMAP.md) for detailed feature comparison

## 💡 What You'll Learn

**Core Principles**:
- How React Server Components separate server/client execution
- Flight Protocol serialization and deserialization
- Streaming SSR and progressive hydration
- Client-side routing in RSC architecture
- ISR implementation and cache strategies

**Implementation Details**:
- Route scanning and manifest generation
- RSC rendering pipeline
- Client component loading and lazy loading
- Error boundaries and Suspense integration
- Build-time vs runtime behavior

**Tech Stack**: React 18 + Vite + Express + ESM

## 📝 Educational Note

This is an **educational project** focused on core concepts, intentionally omitting production complexities:

**✅ Implemented**:
- Core RSC and Flight Protocol mechanics
- Complete SSG/ISR implementation with Stale-while-revalidate
- File-system routing with dynamic routes and route groups
- generateStaticParams for static generation
- Async Server Components with Suspense
- Complete error handling (error.tsx, global-error.tsx, not-found.tsx)
- Client-side navigation with soft routing

**❌ Not Implemented**:
- API Routes (route.ts)
- Middleware
- Parallel Routes / Intercepting Routes
- Data Cache / Request Memoization
- Metadata API
- Client Hooks (useRouter, usePathname, etc.)

**Goal**: Understand Next.js App Router fundamentals with clean, TypeScript code

## 📚 References

- [React Server Components RFC](https://github.com/reactjs/rfcs/blob/main/text/0188-server-components.md)
- [Next.js App Router Documentation](https://nextjs.org/docs/app)
- [React 18 Streaming SSR](https://react.dev/reference/react-dom/server/renderToReadableStream)

## 📄 License

MIT

---

**Happy Learning! 🎉**

Understand Next.js App Router by building it from scratch!
