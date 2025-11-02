import React from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { Router } from './router.tsx'
import { flightDecoder } from './module-map.ts'
import { extractBodyChildren } from '../shared/extract-body.ts'

/**
 * Mini Next.js App Router 客户端入口
 *
 * 水合架构：
 * - 服务端使用 ClientRoot（静态 Provider）包裹内容
 * - 客户端使用 Router（有状态管理）水合
 * - 两者结构完全一致（Provider + Suspense），React 18 智能水合
 */

console.log('🚀 [Client] 客户端入口开始执行')

// Flight 数据结构
interface FlightData {
  flight: string
  pathname: string
}

// 读取 Flight 数据
const flightDataElement = document.getElementById('__FLIGHT_DATA__')
if (!flightDataElement) throw new Error('Missing flight data')

const flightData: FlightData = JSON.parse(flightDataElement.textContent || '{}')
const { flight, pathname } = flightData

console.log(`📦 [Client] 读取 Flight 数据: pathname=${pathname}, flight 长度=${flight.length}`)

// 解码并提取 body 子元素
const decodedTree = flightDecoder.decode(flight)
const initialTree = extractBodyChildren(decodedTree)

// 获取容器并创建 Router 组件
const container = document.getElementById('__next')
if (!container) throw new Error('Missing __next container')
const app = <Router initialTree={initialTree} initialPathname={pathname} />

// 根据是否有预渲染内容决定水合或渲染
const hasPrerendered = container.innerHTML.trim().length > 0
if (hasPrerendered) {
  console.log('🌊 [Client] 模式: SSG - 水合预渲染的 HTML')
  hydrateRoot(container, app)
} else {
  console.log('🎨 [Client] 模式: SSR - 客户端渲染')
  createRoot(container).render(app)
}

console.log('✅ [Client] 客户端入口执行完成')
