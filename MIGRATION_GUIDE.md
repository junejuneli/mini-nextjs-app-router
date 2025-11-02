# TypeScript Migration Continuation Guide

This guide helps you continue the TypeScript migration of the remaining files.

## Quick Status Check

```bash
# Check which files still need migration
find build server client -name "*.js" -o -name "*.jsx" | grep -v node_modules

# Current type check status
npm run typecheck

# Count remaining JavaScript files
find build server client -name "*.js" -o -name "*.jsx" | wc -l
```

---

## Phase 3: Build System Migration

### Priority Order
1. `build/scan-app.js` → `build/scan-app.ts`
2. `build/render-static.js` → `build/render-static.ts`
3. `build/index.js` → `build/index.ts`

### `build/scan-app.ts` Template

```typescript
import fs from 'fs'
import path from 'path'
import { isClientComponent } from '../shared/detect-client.js'
import type { RouteNode, PageConfig, FileInfo } from '../shared/types.js'

// Special file mappings
const SPECIAL_FILES: Record<string, keyof Omit<RouteNode, 'segment' | 'path' | 'children'>> = {
  'page.jsx': 'page',
  'page.js': 'page',
  'layout.jsx': 'layout',
  'layout.js': 'layout',
  'loading.jsx': 'loading',
  'loading.js': 'loading',
  'error.jsx': 'error',
  'error.js': 'error',
  'not-found.jsx': 'notFound',
  'not-found.js': 'notFound'
}

export function scanAppDirectory(appDir: string): RouteNode {
  // Implementation...
}

function scanDirectory(dir: string, appDir: string, urlPath: string): RouteNode {
  // Implementation...
}

function parseSegment(segment: string): {
  segment: string
  dynamic: boolean
  param?: string
  catchAll?: boolean
} {
  // Implementation...
}

function extractRevalidateConfig(filePath: string): number | false | undefined {
  // Implementation...
}

function extractDynamicConfig(filePath: string): PageConfig['dynamic'] {
  // Implementation...
}
```

### Key Types to Use
- `RouteNode` - Main route tree structure
- `FileInfo` - File metadata with config
- `PageConfig` - Page-level configuration
- `SegmentInfo` - Segment parsing results

---

## Phase 4: Server Migration

### Priority Order
1. `server/index.js` → `server/index.ts`
2. `server/regenerate.js` → `server/regenerate.ts`

### `server/index.ts` Template

```typescript
import express, { Request, Response, NextFunction } from 'express'
import type {
  RouteNode,
  RouteMatch,
  ClientComponentMap,
  RenderResult,
  PrerenderInfo
} from '../shared/types.js'

interface AppRequest extends Request {
  // Add custom properties if needed
}

export function createServer(options: {
  routeTree: RouteNode
  prerenderedPages: PrerenderInfo[]
}): express.Application {
  const app = express()

  // Middleware setup...

  return app
}

function matchRoute(url: string, routeTree: RouteNode): RouteMatch | null {
  // Implementation...
}

function buildClientComponentMap(): Promise<ClientComponentMap> {
  // Implementation...
}
```

### Key Types to Use
- `Request`, `Response`, `NextFunction` from Express
- `RouteMatch` - Route matching with params
- `RenderResult` - SSR/SSG render output
- `ClientComponentMap` - Component registry

### `server/regenerate.ts` Template

```typescript
import type {
  RouteNode,
  ClientComponentMap,
  PageMetadata
} from '../shared/types.js'

interface RegenerationOptions {
  routePathNodes: RouteNode[]
  clientComponentMap: ClientComponentMap
  htmlPath: string
  flightPath: string
}

const regenerationLocks = new Map<string, Promise<void>>()

export async function regenerateInBackground(
  url: string,
  options: RegenerationOptions
): Promise<void> {
  // Implementation...
}
```

---

## Phase 5: Client Migration

### Priority Order
1. `client/ErrorBoundary.jsx` → `client/ErrorBoundary.tsx`
2. `client/Link.jsx` → `client/Link.tsx`
3. `client/router.jsx` → `client/router.tsx`
4. `client/index.jsx` → `client/index.tsx`

### `client/ErrorBoundary.tsx` Template

```typescript
import React from 'react'

interface ErrorBoundaryProps {
  children: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo })
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return <div>Error occurred: {this.state.error?.message}</div>
    }
    return this.props.children
  }
}
```

### `client/Link.tsx` Template

```typescript
import React, { useContext } from 'react'
import { RouterContext } from '../shared/router-context.js'

export interface LinkProps {
  href: string
  children: React.ReactNode
  className?: string
  [key: string]: any
}

export function Link({ href, children, ...props }: LinkProps): React.ReactElement {
  const { navigate, isPending } = useContext(RouterContext)

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    navigate(href)
  }

  return (
    <a href={href} onClick={handleClick} {...props}>
      {children}
    </a>
  )
}
```

### `client/router.tsx` Template

```typescript
import React, { useState, startTransition } from 'react'
import { RouterContext } from '../shared/router-context.js'
import { flightDecoder } from './module-map.js'

export interface RouterProps {
  initialTree: React.ReactElement
  initialPathname: string
  children?: React.ReactNode
}

export function Router({
  initialTree,
  initialPathname,
  children
}: RouterProps): React.ReactElement {
  const [root, setRoot] = useState<React.ReactElement>(initialTree)
  const [pathname, setPathname] = useState<string>(initialPathname)
  const [isPending, setIsPending] = useState<boolean>(false)

  const navigate = async (href: string): Promise<void> => {
    // Implementation...
  }

  return (
    <RouterContext.Provider value={{ navigate, isPending }}>
      {children}
    </RouterContext.Provider>
  )
}
```

---

## Common Patterns & Solutions

### 1. Handling Dynamic Imports

```typescript
// Use dynamic import type
type ModuleLoader = () => Promise<{ default: any; [key: string]: any }>

// In Vite glob imports
const modules = import.meta.glob<ModuleLoader>('../app/**/*.{jsx,tsx}')
```

### 2. Express Middleware Typing

```typescript
import { Request, Response, NextFunction } from 'express'

function middleware(req: Request, res: Response, next: NextFunction): void {
  // Implementation
  next()
}

// With custom properties
interface CustomRequest extends Request {
  user?: { id: string }
}

function authMiddleware(req: CustomRequest, res: Response, next: NextFunction): void {
  req.user = { id: '123' }
  next()
}
```

### 3. React Component Props

```typescript
// Function component
interface MyComponentProps {
  title: string
  count?: number
  children?: React.ReactNode
}

export function MyComponent({ title, count = 0, children }: MyComponentProps) {
  return <div>{title} - {count}</div>
}

// With generics
interface ListProps<T> {
  items: T[]
  renderItem: (item: T) => React.ReactNode
}

export function List<T>({ items, renderItem }: ListProps<T>) {
  return <ul>{items.map(renderItem)}</ul>
}
```

### 4. File System Operations

```typescript
import fs from 'fs'
import path from 'path'

// Read file with error handling
function readFileSync(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch (error) {
    throw new Error(`Failed to read ${filePath}: ${(error as Error).message}`)
  }
}

// Check file exists
function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath)
}
```

### 5. Async/Await with Types

```typescript
// Return explicit Promise types
async function fetchData(): Promise<{ data: string }> {
  const response = await fetch('/api/data')
  return response.json()
}

// Handle errors
async function safeAsyncOperation(): Promise<string | null> {
  try {
    const result = await someAsyncFunction()
    return result
  } catch (error) {
    console.error('Error:', error)
    return null
  }
}
```

### 6. Map and Set Operations

```typescript
// Typed Map
const componentMap = new Map<React.ComponentType<any>, ModuleInfo>()
componentMap.set(MyComponent, { id: './MyComponent.jsx', chunks: [], name: 'default' })

// Typed Set
const visitedPaths = new Set<string>()
visitedPaths.add('/about')
```

---

## Troubleshooting Common Errors

### Error: Cannot find module 'fs'
**Solution**: Add `"node"` to `types` array in `tsconfig.json`

```json
{
  "compilerOptions": {
    "types": ["vite/client", "node"]
  }
}
```

### Error: Property 'children' does not exist
**Solution**: Use type assertion or type guard

```typescript
// Type assertion
const props = element.props as any
const children = props.children

// Better: Define interface
interface PropsWithChildren {
  children?: React.ReactNode
  [key: string]: any
}
const props = element.props as PropsWithChildren
```

### Error: Type 'unknown' is not assignable
**Solution**: Add proper type narrowing

```typescript
// Before
const value = someFunction()  // unknown
doSomething(value)  // Error

// After
const value = someFunction()
if (typeof value === 'string') {
  doSomething(value)  // OK
}
```

### Error: Cannot call type that might be a class
**Solution**: Check for class vs function

```typescript
if (typeof Component === 'function') {
  if (Component.prototype && Component.prototype.isReactComponent) {
    // Class component
    const instance = new (Component as any)(props)
    return instance.render()
  } else {
    // Function component
    return (Component as Function)(props)
  }
}
```

---

## Testing Strategy

After migrating each file:

1. **Type Check**
   ```bash
   npm run typecheck
   ```

2. **Build Test**
   ```bash
   npm run build
   ```

3. **Runtime Test**
   ```bash
   npm start
   # Visit http://localhost:3000
   ```

4. **Feature Tests**
   - Test SSG pages (/, /about)
   - Test SSR pages (/async-test)
   - Test ISR (/isr-test)
   - Test dynamic routes (/blog/1)
   - Test client navigation (click links)
   - Test error boundaries (/error-test)

---

## Completion Checklist

- [ ] Phase 3: Build System
  - [ ] `build/scan-app.ts`
  - [ ] `build/render-static.ts`
  - [ ] `build/index.ts`
  - [ ] `npm run build` succeeds

- [ ] Phase 4: Server
  - [ ] `server/index.ts`
  - [ ] `server/regenerate.ts`
  - [ ] `npm start` succeeds

- [ ] Phase 5: Client
  - [ ] `client/ErrorBoundary.tsx`
  - [ ] `client/Link.tsx`
  - [ ] `client/router.tsx`
  - [ ] `client/index.tsx`
  - [ ] Review `client/module-map.ts`

- [ ] Testing
  - [ ] All pages render correctly
  - [ ] Client navigation works
  - [ ] ISR regeneration works
  - [ ] Error boundaries catch errors
  - [ ] No hydration warnings

- [ ] Documentation
  - [ ] Update CLAUDE.md if needed
  - [ ] Add TSDoc comments to complex functions
  - [ ] Document any breaking changes
  - [ ] Update README if needed

---

## When You're Done

1. Remove old `.js` and `.jsx` files from migrated directories
2. Run full test suite
3. Update documentation
4. Commit with meaningful message:
   ```bash
   git add .
   git commit -m "feat: complete TypeScript migration

   - Migrated all build, server, and client files
   - Added comprehensive type safety
   - Maintained zero runtime behavior changes
   - All tests passing"
   ```

---

## Getting Help

- Check `TYPESCRIPT_MIGRATION_SUMMARY.md` for completed examples
- Refer to `shared/types.ts` for all available types
- Look at migrated files for patterns (e.g., `flight-encoder.ts`)
- TypeScript Playground: https://www.typescriptlang.org/play

---

**Remember**: The goal is type safety without changing runtime behavior. If something seems hard to type, it might indicate a design issue worth reconsidering.
