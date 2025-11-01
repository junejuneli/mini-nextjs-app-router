import fs from 'fs'

/**
 * 检测文件是否为 Client Component
 *
 * 原理：
 * - Client Component 必须在文件顶部声明 'use client' 指令
 * - 类似 'use strict'，是一个字符串字面量
 * - 必须在任何 import 之前（注释除外）
 *
 * @param {string} filePath - 文件路径
 * @returns {boolean} 是否为 Client Component
 */
export function isClientComponent(filePath) {
  if (!fs.existsSync(filePath)) {
    return false
  }

  const content = fs.readFileSync(filePath, 'utf-8')

  // 移除 BOM 和前导空白
  const trimmed = content.replace(/^\uFEFF/, '').trimStart()

  // 检查是否以 'use client' 或 "use client" 开头
  return (
    trimmed.startsWith("'use client'") ||
    trimmed.startsWith('"use client"')
  )
}

/**
 * 提取文件的导出信息
 *
 * 简化实现：只检测 export default
 * 真实 Next.js 会使用 AST 解析
 *
 * @param {string} filePath - 文件路径
 * @returns {Object} 导出信息
 */
export function extractExports(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')

  return {
    hasDefaultExport: /export\s+default\s+/.test(content),
    hasNamedExports: /export\s+(const|function|class)\s+/.test(content)
  }
}
