/**
 * 模块映射表与 Flight 解码器（客户端版本）
 *
 * 使用 import.meta.glob() eager 模式实现同步加载以支持 SSG + Hydration
 */

import React from 'react'
import { FlightDecoder } from '../shared/flight-decoder.js'

type ModuleMap = Record<string, any>

// ==================== 模块映射表 ====================

/**
 * 路径规范化函数
 */
function normalizeAppPath(path: string): string {
  return path.replace(/^\.\.\/app\//, './app/')
}

function normalizeClientPath(path: string): string {
  // Vite's import.meta.glob returns paths like: ../client/Link.jsx
  // We need to convert to: ./client/Link.jsx
  // But if the path doesn't have '../client/', just prepend './client/'
  if (path.startsWith('../client/')) {
    return path.replace(/^\.\.\/client\//, './client/')
  }
  // Handle case where glob returns relative path without ../client/ prefix
  if (!path.startsWith('./')) {
    return './client/' + path
  }
  // If path starts with ./ but not ./client/, prepend client/
  if (path.startsWith('./') && !path.startsWith('./client/')) {
    return './client/' + path.substring(2)
  }
  return path
}

/**
 * 使用 import.meta.glob() 实现代码分割
 *
 * eager: false (默认) - 返回 loader 函数，实现按需加载和代码分割
 * 每个组件会被 Vite 打包为独立的 chunk
 *
 * 对于 SSG + Hydration:
 * - 服务端在 HTML 中注入 __CLIENT_MODULES__，标记页面需要的组件
 * - 客户端在 hydration 前预加载这些组件
 * - 其他组件在导航时按需加载
 */
const appModules = import.meta.glob<any>('../app/**/*.{jsx,js,tsx,ts}')

const clientModules = import.meta.glob<any>('../client/**/*.{jsx,js,tsx,ts}')

/**
 * 模块映射表
 *
 * 将路径规范化，使其与 Flight Protocol 中的模块 ID 匹配
 * eager: true 时，module 是实际导入的模块对象，不是 loader 函数
 */
export const moduleMap: ModuleMap = {
  ...Object.fromEntries(
    Object.entries(appModules).map(([path, module]) => [normalizeAppPath(path), module])
  ),
  ...Object.fromEntries(
    Object.entries(clientModules).map(([path, module]) => [normalizeClientPath(path), module])
  )
}

// ==================== Flight 解码器（客户端） ====================

/**
 * 客户端 FlightDecoder 扩展
 *
 * 继承自 shared/flight-decoder.js 的基础实现
 * 添加客户端特定的模块加载逻辑（支持动态 import）
 *
 * ⭐ 关键: 完全覆盖父类的 loadClientComponent() 方法
 * - 不依赖父类的环境检测逻辑
 * - 在浏览器中直接加载实际的 Client Components
 */
class ClientFlightDecoder extends FlightDecoder {
  // TypeScript: 声明 moduleMap 属性类型
  declare moduleMap: ModuleMap

  loadClientComponent({ id, name }: { id: string; name: string }) {
    const loader = this.moduleMap[id]

    if (!loader) {
      // 模块未找到: 返回占位组件
      return this.createPlaceholderComponent(id)
    }

    // ⭐ Lazy loader（函数）：使用 React.lazy 实现代码分割
    // 这是 Vite import.meta.glob() 默认行为
    if (typeof loader === 'function') {
      const LazyComponent = React.lazy(async () => {
        const module = await loader()
        const Component = module[name] || module.default

        if (!Component) {
          throw new Error(`Export "${name}" not found in ${id}`)
        }

        // React.lazy 需要 default export
        return { default: Component }
      })

      return LazyComponent
    }

    // ⭐ Eager 模式: 同步模块（已经加载的模块对象）
    // 这种情况发生在 import.meta.glob('...', { eager: true }) 时
    // loader 是实际的模块对象,而不是加载函数
    const Component = loader[name] || loader.default

    if (Component) {
      return Component
    }

    // 未找到导出: 返回占位组件
    return this.createPlaceholderComponent(id)
  }

  /**
   * 创建占位组件
   * 当模块未找到或加载失败时使用
   */
  private createPlaceholderComponent(id: string) {
    return (props: any) => {
      return React.createElement('div', {
        'data-client-component': id,
        'data-error': 'Component not found in client',
        style: { border: '2px dashed red', padding: '10px', color: 'red' },
        ...props,
        children: `[Client Component Not Found: ${id}]`
      })
    }
  }
}

/**
 * 共享的 FlightDecoder 实例
 *
 * 由于 decode() 方法使用局部变量存储状态，
 * 可以安全地在多次调用间复用同一实例
 */
export const flightDecoder = new ClientFlightDecoder(moduleMap)
