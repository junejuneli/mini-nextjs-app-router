/**
 * RSC Flight Protocol 数据类型定义
 *
 * Flight Protocol 是 React 设计的序列化格式，用于传输包含 Server/Client 组件的 React 树
 *
 * 格式说明：
 * - 每行一个 chunk
 * - 格式: TYPE + ID + ':' + DATA
 * - 示例: M1:{"id":"./Button.jsx","chunks":["Button"],"name":"default"}
 */

// Chunk 类型
export const CHUNK_TYPES = {
  MODULE_REFERENCE: 'M',   // Client Component 模块引用
  JSON: 'J',                // 普通 JSON 数据
  SYMBOL: 'S',              // Symbol 或字符串
  ERROR: 'E',               // 错误对象
  HINT: 'H'                 // 预加载提示 (Preload Hint)
}

// React 特殊符号
export const REACT_SYMBOLS = {
  ELEMENT: Symbol.for('react.element'),
  LAZY: Symbol.for('react.lazy'),
  SERVER_CONTEXT: Symbol.for('react.server.context')
}

// Flight 特殊标记
export const FLIGHT_MARKERS = {
  MODULE_REF: '$',          // 表示这是一个 React 元素
  CLIENT_REF: '@'           // 引用 Client Component (如 @1)
}

/**
 * 创建模块引用
 *
 * 用于标识 Client Component，客户端根据此信息动态加载模块
 *
 * @param {string} id - 模块 ID（相对路径）
 * @param {string} name - 导出名称（通常是 'default'）
 * @param {Array<string>} chunks - 对应的 chunk 文件名
 * @returns {Object} 模块引用对象
 */
export function createModuleReference(id, name = 'default', chunks = []) {
  return {
    $$typeof: REACT_SYMBOLS.LAZY,  // React Lazy 类型
    id,                             // 模块路径
    name,                           // 导出名称
    chunks                          // chunk 文件列表
  }
}

/**
 * 序列化 React 元素为数组格式
 *
 * React 元素格式：
 * {
 *   $$typeof: Symbol(react.element),
 *   type: 'div',
 *   props: { children: 'Hello' },
 *   key: null,
 *   ref: null
 * }
 *
 * Flight 数组格式：
 * ["$", "div", null, { children: "Hello" }]
 * [  标记, 类型,  key, props             ]
 *
 * @param {Object} element - React 元素
 * @returns {Array} 序列化数组
 */
export function serializeElement(element) {
  return [
    FLIGHT_MARKERS.MODULE_REF,  // '$'
    element.type,                // 'div' 或 Component
    element.key,                 // key (通常为 null)
    element.props                // props 对象
  ]
}

/**
 * 检查是否为有效的 React 元素
 */
export function isReactElement(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    value.$$typeof === REACT_SYMBOLS.ELEMENT
  )
}
