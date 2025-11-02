# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **~700-line educational implementation** of Next.js App Router with React Server Components and Flight Protocol. It's designed for learning core concepts, not production use.

**Core Features Implemented**:
- ✅ React Server Components (RSC) with custom Flight Protocol
- ✅ SSG (Static Site Generation) + ISR (Incremental Static Regeneration)
- ✅ Streaming SSR with Suspense
- ✅ Nested layouts and file-system routing
- ✅ Client-side navigation with soft routing

**Not Implemented** (see FEATURE_COMPARISON_AND_ROADMAP.md):
- ❌ Dynamic routes with `generateStaticParams` (detected but not pre-rendered)
- ❌ API Routes (`route.js`)
- ❌ Request Memoization and Data Cache layers
- ❌ Parallel Routes, Intercepting Routes, Middleware
- ❌ Route-level error.jsx boundaries (only global ErrorBoundary exists)

## Commands

### Essential Commands

```bash
# Build the project (scans app/, generates routes, pre-renders static pages)
npm run build

# Start production server
npm start

# Development workflow (build + start)
npm run dev

# Clean build artifacts
npm run clean

# Full rebuild
npm run rebuild

# Type checking (no-emit)
npm run typecheck
```

### Build Process Details

When you run `npm run build`, the following happens in sequence:

1. **Route Scanning** (`build/scan-app.js`)
   - Recursively scans `app/` directory
   - Identifies special files: page.jsx, layout.jsx, loading.jsx, error.jsx
   - Detects dynamic routes: `[id]`, `[...slug]` (but doesn't pre-render them)
   - Extracts page configs: `revalidate`, `dynamic` (via regex on file content)
   - Marks components as Server/Client (checks for `'use client'` directive)

2. **Client Component Map** (`server/index.js:44-112`)
   - Imports all Client Components (from `app/` and `client/`)
   - Registers to `Map<Component, {id, chunks, name}>`
   - Used by Flight Encoder to generate module references

3. **SSG Pre-rendering** (`build/render-static.js`)
   - Collects static routes (excludes dynamic routes and `force-dynamic` pages)
   - For each static route:
     - Calls `renderRSC()` → generates Flight Protocol string
     - Calls `generateHTMLTemplate()` → creates full HTML with embedded Flight
     - Saves to `.next/static/pages/*.html` and `.next/static/flight/*.txt`
     - Saves metadata to `.next/cache/metadata/*.json` (for ISR)

4. **Generate Manifest** (`build/index.js`)
   - Saves route tree and pre-render info to `.next/manifest.json`

### Testing Pages

Visit these routes to test different features:
- `/` - SSR (dynamic rendering on each request)
- `/about` - SSG (pre-rendered at build time)
- `/dashboard` - Client Component demo
- `/async-test` - Async Server Component with loading.jsx
- `/isr-test` - ISR demo (revalidate: 10 seconds)
- `/error-test` - Error boundary test

## Architecture Deep Dive

### Core Rendering Pipeline

```
Request → Route Matching → Pre-rendered?
                          ├─ Yes → Serve static file
                          │        ├─ Check revalidate time
                          │        ├─ Expired? → Stale-while-revalidate
                          │        │             (return old + regenerate in background)
                          │        └─ Not expired? → Return cached
                          │
                          └─ No → Dynamic SSR
                                  ├─ matchRoute() → find route path
                                  ├─ buildClientComponentMap()
                                  ├─ renderRSC() → generate Flight
                                  └─ Return HTML or Flight (if ?_rsc=1)
```

### Flight Protocol Architecture

**The Flight Protocol is the heart of this implementation.** It serializes React trees containing both Server and Client Components.

#### Encoding (Server-side)

**File**: `shared/flight-encoder.js`

```javascript
// Core algorithm:
encodeValue(value) {
  if (isReactElement(value)) {
    if (typeof type === 'string') {
      // HTML element: ['$', 'div', key, props]
      return ['$', type, key, encodeProps(props)]
    }
    if (isClientComponent(type)) {
      // Client Component: generate M chunk + return reference
      const ref = createModuleReference(type)  // '@1'
      return ['$', ref, key, encodeProps(props)]
    }
    // Server Component: execute and encode result
    let rendered = type(props)
    if (rendered.then) rendered = await rendered  // async support
    return encodeValue(rendered)
  }
}
```

**Output Format**:
```
M1:{"id":"./Button.jsx","chunks":["Button"],"name":"default"}
J0:["$","div",null,{"children":["$","@1",null,{"text":"Click"}]}]
```

- `M{id}:{moduleInfo}` - Client Component module reference
- `J{id}:{json}` - JSON data (React tree structure)
- `@{id}` - Reference to module M{id}

#### Decoding (Client-side)

**Files**: `shared/flight-decoder.js` (base), `client/module-map.ts` (client override)

**Key Design**: The decoder has different behavior for server SSG vs client hydration:

```javascript
// Base class (used in SSG pre-rendering):
loadClientComponent({id, name}) {
  // Return placeholder component
  if (props.href) return <a>  // Link → <a> tag for SEO
  return <div>                // Other → <div> placeholder
}

// Client subclass (used in browser):
loadClientComponent({id, name}) {
  // Return React.lazy() for dynamic loading
  return React.lazy(() => import(/* @vite-ignore */ id))
}
```

This dual-mode design allows:
- **SSG**: Generate valid HTML with `<a>` tags for SEO
- **Client**: Load actual interactive components

### ISR Implementation

**Files**: `server/index.js:128-177`, `server/regenerate.js`, `shared/metadata.js`

**Strategy**: Stale-while-revalidate

```javascript
// server/index.js:136
if (shouldRevalidate(url, prerenderInfo.revalidate)) {
  // Trigger background regeneration (non-blocking)
  regenerateInBackground(url, {
    routePathNodes, clientComponentMap, htmlPath, flightPath
  })
}

// Immediately return stale cache (user gets fast response)
return fs.readFileSync(filePath)
```

**Concurrency Safety** (`server/regenerate.js:103`):
```javascript
const regenerationLocks = new Map()  // Prevent duplicate regeneration

if (regenerationLocks.has(routePath)) {
  return regenerationLocks.get(routePath)  // Reuse existing promise
}
```

**Atomic File Writes** (`server/regenerate.js:75`):
```javascript
// Write to temp file first, then rename (atomic operation)
fs.writeFileSync(htmlPath + '.tmp', html)
fs.renameSync(htmlPath + '.tmp', htmlPath)
```

### Nested Layout System

**File**: `shared/rsc-renderer.js:82`

**Algorithm**: Collect layouts from route path, then wrap from inside-out

```javascript
// Route path: [rootNode, dashboardNode, settingsNode]
// ↓
// Layouts: [RootLayout, DashboardLayout]
// ↓
// Build tree from inner to outer:

let tree = await loadAndRenderComponent(settingsPage)

// Wrap with loading.jsx if exists
if (targetRoute.loading) {
  tree = <Suspense fallback={<LoadingComponent />}>{tree}</Suspense>
}

// Wrap with layouts (inner to outer)
for (let i = layouts.length - 1; i >= 0; i--) {
  tree = await renderLayout(layouts[i], tree, params)
}

// Result: <RootLayout><DashboardLayout><SettingsPage /></DashboardLayout></RootLayout>
```

### Client-Side Navigation

**File**: `client/router.jsx`

```javascript
// On Link click:
const navigate = async (href) => {
  // 1. Fetch RSC Payload
  const flight = await fetch(`${href}?_rsc=1`).then(r => r.text())

  // 2. Decode Flight Protocol
  const root = flightDecoder.decode(flight)

  // 3. Update UI (React 18 transition)
  startTransition(() => {
    setRoot(root)
    setPathname(href)
  })

  // 4. Update browser history
  window.history.pushState({}, '', href)
}
```

**Note**: No Router Cache implemented - each navigation fetches from server.

### Hydration Architecture

**Dual Provider System** for SSG/SSR compatibility:

```javascript
// Server-side (SSG pre-rendering): shared/client-root.jsx
<ClientRoot flight={flight} pathname={pathname}>
  {decodedTree}  // Placeholder components (<a>, <div>)
</ClientRoot>

// Client-side (Hydration): client/index.jsx
<Router initialTree={initialTree} initialPathname={pathname}>
  {initialTree}  // Real components (React.lazy)
</Router>

// Both render: <Provider><Suspense>{children}</Suspense></Provider>
// → React 18 concurrent hydration matches them correctly
```

## Key Implementation Details

### Route Scanning

**File**: `build/scan-app.js`

**Dynamic Route Detection**:
```javascript
// Matches: [id], [...slug]
const dynamicMatch = segment.match(/^\[([^\]]+)\]$/)
if (dynamicMatch) {
  const param = dynamicMatch[1]

  // Catch-all: [...slug]
  const catchAllMatch = param.match(/^\.\.\.(.+)$/)
  if (catchAllMatch) {
    return { dynamic: true, catchAll: true, param: catchAllMatch[1] }
  }

  // Regular dynamic: [id]
  return { dynamic: true, param }
}
```

**Config Extraction** (via regex, not AST parsing):
```javascript
// Extract: export const revalidate = 60
const match = content.match(/export\s+const\s+revalidate\s*=\s*(\d+|false)/)

// Extract: export const dynamic = 'force-dynamic'
const match = content.match(/export\s+const\s+dynamic\s*=\s*['"]([^'"]+)['"]/)
```

### Server/Client Component Detection

**File**: `shared/detect-client.js`

```javascript
export function isClientComponent(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')

  // Check first 100 lines for 'use client' directive
  const lines = content.split('\n').slice(0, 100)
  return lines.some(line => {
    const trimmed = line.trim()
    return trimmed === "'use client'" || trimmed === '"use client"'
  })
}
```

### Suspense Handling

**Encoder** (`shared/flight-encoder.js:131`):
```javascript
// Special handling for React.Suspense symbol
if (symbolName === 'react.suspense') {
  return [
    '$',
    'Suspense',  // Custom marker
    key,
    {
      fallback: await encodeValue(props.fallback),
      children: await encodeValue(props.children)
    }
  ]
}
```

**Decoder** (`shared/flight-decoder.js:261`):
```javascript
// Restore React.Suspense on decode
if (type === 'Suspense') {
  const { fallback, children, ...otherProps } = resolvedProps
  return React.createElement(
    React.Suspense,
    { ...otherProps, key, fallback },
    children
  )
}
```

## Important Constraints

### What Works
- ✅ Static routes (/, /about)
- ✅ Nested layouts (app/dashboard/layout.jsx)
- ✅ loading.jsx (via Suspense)
- ✅ Async Server Components
- ✅ Client Components with 'use client'
- ✅ ISR with time-based revalidation
- ✅ Client-side navigation (Link component)

### What Doesn't Work
- ❌ Dynamic route pre-rendering (/blog/[slug])
- ❌ API routes (app/api/route.js)
- ❌ Parallel routes (@slot)
- ❌ Intercepting routes ((.)folder)
- ❌ Middleware
- ❌ Route-level error.jsx (only global ErrorBoundary)
- ❌ generateMetadata, generateStaticParams
- ❌ Router Cache (client navigation always fetches)
- ❌ Data Cache, Request Memoization

## Code Style and Patterns

### When Adding Features

**Route-related changes** require modifications in 3 places:
1. `build/scan-app.js` - Detect new file types or patterns
2. `shared/rsc-renderer.js` - Handle rendering logic
3. `server/index.js` - Handle runtime requests

**Example: Adding error.jsx support**
```javascript
// 1. build/scan-app.js - Already scans error.jsx
// 2. shared/rsc-renderer.js - Wrap page with ErrorBoundary
if (targetRoute.error) {
  tree = <ErrorBoundary errorComponent={...}>{tree}</ErrorBoundary>
}
// 3. server/index.js - Already passes error info via route tree
```

### Async Component Pattern

All Server Components can be async:
```javascript
// This works automatically:
export default async function Page() {
  const data = await fetchData()
  return <div>{data}</div>
}

// Flight Encoder handles it:
let rendered = type(props)
if (rendered && typeof rendered.then === 'function') {
  rendered = await rendered  // Wait for async component
}
```

### Client Component Registration

Client Components must be in `clientComponentMap` before encoding:
```javascript
// server/index.js:44
const clientComponentMap = new Map()

// Scan client/ directory
const Component = await import('./client/Button.jsx')
clientComponentMap.set(Component.default, {
  id: './client/Button.jsx',
  chunks: ['Button'],
  name: 'default'
})

// Now can encode Client Components
const { flight } = await renderRSC(routePath, {}, clientComponentMap)
```

## File Organization

### Build System (`build/`)
- `index.js` - Orchestrates build process
- `scan-app.js` - Route scanning (257 lines)
- `render-static.js` - SSG pre-rendering (213 lines)
- `vite-build.js` - Vite client bundle build

### Server (`server/`)
- `index.js` - Express server + ISR logic (304 lines)
- `regenerate.js` - Background regeneration (144 lines)

### Shared (`shared/`)
- `rsc-renderer.js` - RSC rendering (202 lines)
- `flight-encoder.js` - Flight encoding (314 lines)
- `flight-decoder.js` - Flight decoding (323 lines)
- `metadata.js` - ISR metadata management (169 lines)
- `html-template.js` - HTML generation

### Client (`client/`)
- `index.jsx` - Hydration entry (44 lines)
- `router.jsx` - Client router (102 lines)
- `Link.jsx` - Link component (34 lines)
- `module-map.ts` - Decoder with dynamic imports (26 lines)
- `ErrorBoundary.jsx` - Global error boundary (137 lines)

### Build Output (`.next/`)
```
.next/
├── manifest.json              # Route tree + pre-render list
├── cache/metadata/            # ISR metadata (generatedAt, revalidate)
│   ├── index.json            # For /
│   └── about.json            # For /about
├── static/
│   ├── pages/                # Pre-rendered HTML
│   │   ├── index.html
│   │   └── about.html
│   └── flight/               # Pre-rendered Flight payloads
│       ├── index.txt
│       └── about.txt
└── dist/                     # Vite bundled JS (unused in current impl)
```

## Debugging Tips

### Enable Detailed Logs

Check console output during:
- **Build**: Route scanning results, pre-rendering progress
- **Server**: Request handling, ISR triggers, Flight generation
- **Client**: Hydration mode (SSG/SSR), navigation events

### Inspect Flight Protocol

```javascript
// In browser console after navigation:
const flightData = document.getElementById('__FLIGHT_DATA__')
const { flight } = JSON.parse(flightData.textContent)
console.log(flight)  // See raw Flight Protocol

// Example output:
// M1:{"id":"./client/Link.jsx","chunks":["Link"],"name":"default"}
// J0:["$","div",null,{"children":["$","@1",null,{"href":"/about"}]}]
```

### Check ISR Metadata

```bash
# View ISR metadata for /about page
cat .next/cache/metadata/about.json

# Output:
# {
#   "generatedAt": 1699999999999,
#   "revalidate": 60,
#   "path": "/about"
# }
```

### Common Issues

**"Missing flight data"**
- Ensure `__FLIGHT_DATA__` script exists in HTML template
- Check `shared/html-template.js` embeds Flight correctly

**Client Component not loading**
- Verify component is in `clientComponentMap`
- Check `'use client'` directive at top of file
- Ensure component is imported in `server/index.js:buildClientComponentMap()`

**ISR not regenerating**
- Check `export const revalidate = N` in page.jsx
- Verify metadata exists in `.next/cache/metadata/`
- Check server logs for "ISR: 开始重新生成" message

## Documentation

Read in this order for best understanding:

1. **README.md** - Quick start and overview
2. **ARCHITECTURE.md** - Overall architecture (if exists, else check docs/)
3. **FLIGHT_PROTOCOL_DEEP_DIVE.md** - Flight Protocol internals (docs/)
4. **ROUTE_SCANNING_AND_CONFIG.md** - Route system details (docs/)
5. **NEXTJS_CACHING_STRATEGIES.md** - Caching comparison
6. **CACHING_COMPARISON.md** - Detailed cache implementation comparison
7. **FEATURE_COMPARISON_AND_ROADMAP.md** - Full feature matrix + implementation guides

## Educational Focus

This codebase prioritizes:
- **Readability** over performance
- **Core concepts** over edge cases
- **Minimal code** over feature completeness
- **Learning value** over production readiness

When extending this project, maintain these principles. If adding complexity, document extensively with inline comments explaining the "why" behind architectural decisions.
