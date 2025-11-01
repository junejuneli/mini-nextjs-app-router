import React from 'react'
import { CHUNK_TYPES, FLIGHT_MARKERS } from './flight-types.js'

/**
 * RSC Flight Protocol 解码器
 *
 * 将 Flight Protocol 字符串解析为可渲染的 React 树
 *
 * ⭐ 核心原则 (服务端/客户端共享):
 * - 服务端: Client Component 永远不执行,渲染为占位组件
 * - 客户端: 子类覆盖 loadClientComponent() 动态加载实际组件
 *
 * 设计特点：
 * - decode() 方法使用局部变量存储状态，避免并发问题
 * - 可安全地在多次调用间复用同一实例
 */
export class FlightDecoder {
  /**
   * @param {Object} moduleMap - 模块映射表
   */
  constructor(moduleMap = {}) {
    this.moduleMap = moduleMap
  }

  /**
   * 解码 Flight Protocol 数据
   *
   * @param {string} flightData - RSC Flight Protocol 字符串数据
   * @returns {React.Element} 解析后的 React 元素树
   *
   * Flight Protocol 格式示例:
   * M1:{"id":"./app/components/counter.jsx","name":"Counter"}
   * J0:["$","div",null,{"children":[["$","@1",null,{"count":0}]]}]
   *
   * 格式说明:
   * - M{id}:{moduleInfo}  - 模块引用（Client Component）
   * - J{id}:{json}        - JSON 数据（包含 React 元素结构）
   * - S{id}:{symbol}      - Symbol 类型
   * - E{id}:{error}       - 错误信息
   *
   * 解析流程:
   * 1. 按行分割 Flight 数据
   * 2. 解析每行，存入 modules/chunks Map
   * 3. 从根 chunk (J0) 开始递归解析
   */
  decode(flightData) {
    if (!flightData?.trim()) {
      throw new Error('Invalid flight data')
    }

    // modules: 存储 Client Component 模块引用 (M 开头)
    // chunks: 存储其他数据块 (J/S/E 开头)
    const modules = new Map()
    const chunks = new Map()

    // 逐行解析 Flight 数据
    flightData
      .trim()
      .split('\n')
      .filter(line => line.trim())
      .forEach(line => this.parseLine(line, modules, chunks))

    // 从根 chunk (J0) 开始解析整个 React 树
    return this.resolveChunk('J0', modules, chunks)
  }

  /**
   * 解析单行 Flight Protocol 数据
   *
   * @param {string} line - 单行数据，格式: {type}{id}:{data}
   * @param {Map} modules - 模块存储 Map
   * @param {Map} chunks - 数据块存储 Map
   *
   * 例如:
   * - "M1:{"id":"./app/counter.jsx"}" -> type='M', id='1', data='{"id":...}'
   * - "J0:["$","div",null,{}]" -> type='J', id='0', data='["$","div",...]'
   */
  parseLine(line, modules, chunks) {
    const type = line[0]  // 获取类型标记 (M/J/S/E)
    const colonIndex = line.indexOf(':')

    if (colonIndex === -1) return  // 无效格式，跳过

    const id = line.substring(1, colonIndex)  // 提取 ID
    const dataStr = line.substring(colonIndex + 1)  // 提取数据部分

    switch (type) {
      case CHUNK_TYPES.MODULE_REFERENCE:
        this.parseModuleChunk(id, dataStr, modules)
        break;
      case CHUNK_TYPES.JSON:
        this.parseJSONChunk(id, dataStr, chunks)
        break;
      case CHUNK_TYPES.SYMBOL:
        this.parseSymbolChunk(id, dataStr, chunks)
        break;
      case CHUNK_TYPES.ERROR:
        this.parseErrorChunk(id, dataStr, chunks)
        break;
      default:
        console.warn(`Unknown chunk type: ${type}`)
        break;
    }
  }

  /**
   * 解析模块引用 chunk (M 类型)
   *
   * @param {string} id - chunk ID
   * @param {string} dataStr - JSON 字符串，包含模块信息 {id, name}
   * @param {Map} modules - 模块存储 Map
   *
   * 示例: M1:{"id":"./app/counter.jsx","name":"Counter"}
   * 存储为: modules.set('M1', {type: 'module', info: {id: '...', name: 'Counter'}})
   */
  parseModuleChunk(id, dataStr, modules) {
    try {
      modules.set(`M${id}`, {
        type: 'module',
        info: JSON.parse(dataStr)
      })
    } catch (error) {
      console.error('Failed to parse module chunk:', error)
    }
  }

  /**
   * 解析 JSON chunk (J 类型)
   *
   * @param {string} id - chunk ID
   * @param {string} dataStr - JSON 字符串，包含 React 元素结构或其他数据
   * @param {Map} chunks - 数据块存储 Map
   *
   * 示例: J0:["$","div",null,{"children":"Hello"}]
   * 存储为: chunks.set('J0', {type: 'json', data: ['$', 'div', null, {...}]})
   */
  parseJSONChunk(id, dataStr, chunks) {
    try {
      chunks.set(`J${id}`, {
        type: 'json',
        data: JSON.parse(dataStr)
      })
    } catch (error) {
      console.error('Failed to parse JSON chunk:', error)
    }
  }

  /**
   * 解析 Symbol chunk (S 类型)
   *
   * @param {string} id - chunk ID
   * @param {string} dataStr - Symbol 字符串
   * @param {Map} chunks - 数据块存储 Map
   */
  parseSymbolChunk(id, dataStr, chunks) {
    chunks.set(`S${id}`, {
      type: 'symbol',
      data: dataStr
    })
  }

  /**
   * 解析错误 chunk (E 类型)
   *
   * @param {string} id - chunk ID
   * @param {string} dataStr - JSON 字符串，包含错误信息
   * @param {Map} chunks - 数据块存储 Map
   */
  parseErrorChunk(id, dataStr, chunks) {
    const error = JSON.parse(dataStr)
    console.error('Server error:', error)
    chunks.set(`E${id}`, {
      type: 'error',
      data: error
    })
  }

  /**
   * 根据 chunk ID 解析对应的数据
   *
   * @param {string} chunkId - chunk ID (如 'J0', 'M1', 'S1' 等)
   * @param {Map} modules - 模块存储 Map
   * @param {Map} chunks - 数据块存储 Map
   * @returns {*} 解析后的数据（可能是 React 元素、原始值、组件等）
   *
   * 解析优先级:
   * 1. 先查找 chunks (J/S/E 类型)
   * 2. 再查找 modules (M 类型)
   * 3. 都找不到返回 null
   */
  resolveChunk(chunkId, modules, chunks) {
    const chunk = chunks.get(chunkId)

    if (chunk) {
      if (chunk.type === 'json') return this.resolveValue(chunk.data, modules, chunks)
      if (chunk.type === 'symbol') return chunk.data
      if (chunk.type === 'error') throw new Error(chunk.data.message)
    }

    const module = modules.get(chunkId)
    if (module) return this.loadClientComponent(module.info)

    return null
  }

  /**
   * 递归解析值（支持基本类型、数组、对象、React 元素）
   *
   * @param {*} value - 要解析的值
   * @param {Map} modules - 模块存储 Map
   * @param {Map} chunks - 数据块存储 Map
   * @returns {*} 解析后的值
   *
   * 解析规则:
   * - null/undefined/基本类型 -> 直接返回
   * - 数组:
   *   - 如果是 React 元素数组 (首元素为 '$') -> 调用 resolveElement
   *   - 否则递归解析数组每个元素
   * - 对象 -> 递归解析对象每个属性
   */
  resolveValue(value, modules, chunks) {
    // 基本类型直接返回
    if (value == null || typeof value !== 'object') return value

    if (Array.isArray(value)) {
      // 检测 React 元素标记 ['$', type, key, props]
      return value[0] === FLIGHT_MARKERS.MODULE_REF
        ? this.resolveElement(value, modules, chunks)
        : value.map(item => this.resolveValue(item, modules, chunks))
    }

    // 递归解析对象的每个属性
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => [key, this.resolveValue(val, modules, chunks)])
    )
  }

  /**
   * 解析 React 元素
   *
   * @param {Array} element - React 元素数组 ['$', type, key, props]
   * @param {Map} modules - 模块存储 Map
   * @param {Map} chunks - 数据块存储 Map
   * @returns {React.Element} React 元素
   *
   * 元素格式:
   * - ['$', 'div', null, {children: 'Hello'}] -> <div>Hello</div>
   * - ['$', '@1', null, {count: 0}] -> <Counter count={0} />
   *
   * 处理逻辑:
   * 1. 递归解析 props（可能包含嵌套的 React 元素）
   * 2. 如果 type 以 '@' 开头 -> Client Component，需要加载组件
   * 3. 如果 type 是字符串 -> HTML 标签或 Server Component
   */
  resolveElement([, type, key, props], modules, chunks) {
    // 递归解析 props（props 中可能包含嵌套的 React 元素）
    const resolvedProps = this.resolveValue(props, modules, chunks) || {}

    // ⭐ 特殊处理：Suspense 边界
    // Flight Encoder 将 Suspense 编码为 ['$', 'Suspense', key, {fallback, children}]
    if (type === 'Suspense') {
      // 注意：children 不应该在 props 中，而应该作为 createElement 的第三个参数
      const { fallback, children, ...otherProps } = resolvedProps
      return React.createElement(
        React.Suspense,
        {
          ...otherProps,
          key,
          fallback
        },
        children
      )
    }

    // Client Component 引用 (如 '@1' -> 'M1')
    if (typeof type === 'string' && type.startsWith(FLIGHT_MARKERS.CLIENT_REF)) {
      const moduleId = type.replace('@', 'M')  // '@1' -> 'M1'
      const Component = this.resolveChunk(moduleId, modules, chunks)
      return React.createElement(Component, { ...resolvedProps, key })
    }

    // HTML 标签 (如 'div', 'span') 或 Server Component
    if (typeof type === 'string') {
      return React.createElement(type, { ...resolvedProps, key })
    }

    return null
  }

  /**
   * 加载 Client Component（基类实现，返回占位组件）
   *
   * @param {Object} moduleInfo - 模块信息 {id, name}
   * @returns {Function} React 组件函数
   *
   * ⭐ 设计原则:
   * - 基类实现：服务端 SSG 预渲染时使用，返回占位组件
   * - 子类覆盖：客户端通过 ClientFlightDecoder 覆盖，返回 React.lazy()
   *
   * 占位组件逻辑:
   * - Link 组件 -> 渲染为 <a> 标签（保留 SEO 和可访问性）
   * - 其他组件 -> 渲染为 <div>（占位符）
   *
   * 为什么需要占位组件？
   * - Client Component 不能在服务端执行（可能依赖浏览器 API）
   * - SSG 预渲染时需要生成有效的 HTML 结构
   * - 客户端 hydration 时会替换为真实组件
   */
  loadClientComponent({ id, name }) {
    return (props) => {
      // 特殊处理 Link 组件：渲染为 <a> 标签
      // 这样 SSG 生成的 HTML 包含正确的链接，有利于 SEO
      if (props.href) {
        const { children, href, ...restProps} = props
        return React.createElement('a', { href, ...restProps }, children)
      }

      // 其他 Client Component 渲染为 <div> 占位符
      return React.createElement('div', props)
    }
  }
}
