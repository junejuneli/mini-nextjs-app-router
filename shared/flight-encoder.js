import ReactDOMServer from 'react-dom/server'
import { CHUNK_TYPES, FLIGHT_MARKERS, serializeElement, isReactElement } from '../shared/flight-types.js'

/**
 * RSC Flight Protocol 编码器
 *
 * 核心职责：
 * 1. 遍历 React 元素树
 * 2. Server Component → 在服务端执行，继续遍历子树
 * 3. Client Component → 生成模块引用 (M chunk)
 * 4. 普通元素 → 序列化为 JSON (J chunk)
 * 5. 输出 Flight Protocol 格式的字符串
 *
 * Flight 格式示例：
 * M1:{"id":"./Button.jsx","chunks":["Button"],"name":"default"}
 * J0:["$","div",null,{"children":["$","@1",null,{"text":"Click"}]}]
 *
 * 原理说明：
 * - M chunks 定义 Client Component 模块引用
 * - J chunks 包含实际的 React 树结构
 * - @N 引用第 N 个模块（如 @1 引用 M1）
 */

export class FlightEncoder {
  constructor(clientComponentMap = new Map()) {
    this.clientComponentMap = clientComponentMap  // Client Component 模块映射
    this.moduleId = 1                              // 模块 ID 计数器
    this.chunkId = 0                               // Chunk ID 计数器
    this.moduleReferences = new Map()              // 模块引用缓存
    this.output = []                               // 输出的 chunks
  }

  /**
   * 编码 React 元素树
   *
   * @param {*} value - React 元素、组件或任意值
   * @returns {Promise<string>} Flight Protocol 字符串
   */
  async encode(value) {
    // 重置状态
    this.moduleId = 1
    this.chunkId = 0
    this.moduleReferences.clear()
    this.output = []

    // 递归处理值（异步）
    const rootValue = await this.encodeValue(value)

    // 生成根 chunk (J0)
    this.writeJSONChunk(rootValue)

    // 合并所有 chunks
    return this.output.join('\n')
  }

  /**
   * 递归编码值
   *
   * 核心逻辑：
   * - React 元素 → 处理 Server/Client 组件
   * - 数组 → 递归编码每个元素
   * - 对象 → 递归编码每个属性
   * - 原始值 → 直接返回
   *
   * @param {*} value - 待编码的值
   * @returns {Promise<*>} 编码后的值
   */
  async encodeValue(value) {
    // null / undefined / 原始类型
    if (value === null || value === undefined) {
      return value
    }

    if (typeof value !== 'object') {
      return value
    }

    // React 元素
    if (isReactElement(value)) {
      return await this.encodeElement(value)
    }

    // 数组
    if (Array.isArray(value)) {
      return await Promise.all(value.map(item => this.encodeValue(item)))
    }

    // 普通对象
    const encoded = {}
    for (const [key, val] of Object.entries(value)) {
      // 跳过函数（无法序列化）
      if (typeof val === 'function') {
        continue
      }
      encoded[key] = await this.encodeValue(val)
    }
    return encoded
  }

  /**
   * 编码 React 元素
   *
   * 关键判断：
   * 1. 如果 type 是字符串 (如 'div') → 普通 HTML 元素
   * 2. 如果 type 是函数且为 Client Component → 生成模块引用
   * 3. 如果 type 是函数且为 Server Component → 执行并继续编码
   *
   * @param {Object} element - React 元素
   * @returns {Promise<Array|Object>} 编码后的元素
   */
  async encodeElement(element) {
    const { type, props, key } = element

    // Case 1: 普通 HTML 元素 (如 'div', 'span')
    if (typeof type === 'string') {
      return [
        FLIGHT_MARKERS.MODULE_REF,  // '$'
        type,                        // 'div'
        key,                         // key
        await this.encodeProps(props)  // 递归编码 props（异步）
      ]
    }

    // Case 2: Client Component
    if (this.isClientComponent(type)) {
      const moduleRef = this.createModuleReference(type)

      return [
        FLIGHT_MARKERS.MODULE_REF,
        moduleRef,                   // '@1' (引用模块)
        key,
        await this.encodeProps(props)
      ]
    }

    // Case 3: Server Component ⭐ 支持异步组件
    // 在服务端执行组件函数，获取渲染结果，继续编码
    try {
      let rendered = type(props)

      // 如果组件是异步的，等待它执行完成
      if (rendered && typeof rendered.then === 'function') {
        rendered = await rendered
      }

      return await this.encodeValue(rendered)
    } catch (error) {
      console.error(`渲染 Server Component 失败:`, error)
      throw error
    }
  }

  /**
   * 编码 props
   *
   * @param {Object} props - React props
   * @returns {Promise<Object>} 编码后的 props
   */
  async encodeProps(props) {
    if (!props) return null

    const encoded = {}

    for (const [key, value] of Object.entries(props)) {
      // 跳过特殊的 React 内部属性
      if (key === 'key' || key === 'ref') {
        continue
      }

      // 事件处理器：无法序列化，置为 null
      if (typeof value === 'function') {
        encoded[key] = null
        continue
      }

      // 递归编码（异步）
      encoded[key] = await this.encodeValue(value)
    }

    return encoded
  }

  /**
   * 判断组件是否为 Client Component
   *
   * @param {Function} component - 组件函数
   * @returns {boolean}
   */
  isClientComponent(component) {
    // 检查组件是否在 Client Component 映射中
    return this.clientComponentMap.has(component)
  }

  /**
   * 创建 Client Component 模块引用
   *
   * 流程：
   * 1. 检查是否已创建过引用（避免重复）
   * 2. 生成新的模块 ID
   * 3. 写入 M chunk
   * 4. 返回引用标记 '@N'
   *
   * @param {Function} component - Client Component 函数
   * @returns {string} 模块引用（如 '@1'）
   */
  createModuleReference(component) {
    // 检查缓存
    if (this.moduleReferences.has(component)) {
      return this.moduleReferences.get(component)
    }

    const moduleInfo = this.clientComponentMap.get(component)

    if (!moduleInfo) {
      throw new Error(`Client Component 未注册: ${component.name}`)
    }

    const moduleId = this.moduleId++

    // 写入 M chunk
    this.writeModuleChunk(moduleId, moduleInfo)

    // 创建引用标记
    const reference = `${FLIGHT_MARKERS.CLIENT_REF}${moduleId}`

    // 缓存
    this.moduleReferences.set(component, reference)

    return reference
  }

  /**
   * 写入 M chunk (Module Reference)
   *
   * 格式: M1:{"id":"./Button.jsx","chunks":["Button"],"name":"default"}
   *
   * @param {number} id - 模块 ID
   * @param {Object} moduleInfo - 模块信息
   */
  writeModuleChunk(id, moduleInfo) {
    const chunk = `${CHUNK_TYPES.MODULE_REFERENCE}${id}:${JSON.stringify(moduleInfo)}`
    this.output.push(chunk)
  }

  /**
   * 写入 J chunk (JSON Data)
   *
   * 格式: J0:{"type":"div","children":[...]}
   *
   * @param {*} data - JSON 数据
   */
  writeJSONChunk(data) {
    const id = this.chunkId++
    const chunk = `${CHUNK_TYPES.JSON}${id}:${JSON.stringify(data)}`
    this.output.push(chunk)
  }

  /**
   * 获取所有 Client Component 模块列表
   *
   * 用于在 HTML 中注入 <script> 标签预加载
   *
   * @returns {Array<Object>} 模块列表
   */
  getClientModules() {
    return Array.from(this.moduleReferences.entries()).map(([component, reference]) => {
      const moduleInfo = this.clientComponentMap.get(component)
      return {
        id: moduleInfo.id,
        chunks: moduleInfo.chunks,
        name: moduleInfo.name
      }
    })
  }
}
