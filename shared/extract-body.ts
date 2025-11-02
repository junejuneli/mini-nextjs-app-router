import React from 'react'

/**
 * 从 React 树中提取 <body> 和 <head> 元素的工具函数
 *
 * ⭐ 服务端和客户端共享此逻辑，确保一致性
 */

/**
 * HTML 部分提取结果
 */
export interface HTMLParts {
  bodyElement: React.ReactElement | null
  headElement: React.ReactElement | null
}

/**
 * 从 React 树中提取 <body> 和 <head> 元素
 *
 * @param tree - 完整的 React 树（<html> 根元素）
 * @returns 包含 bodyElement 和 headElement 的对象
 */
export function extractHTMLParts(tree: React.ReactElement | null): HTMLParts {
  let bodyElement: React.ReactElement | null = null
  let headElement: React.ReactElement | null = null

  if (tree?.type === 'html') {
    const props = tree.props as any
    if (Array.isArray(props?.children)) {
      headElement = props.children.find((child: any) => child?.type === 'head') ?? null
      bodyElement = props.children.find((child: any) => child?.type === 'body') ?? null
    }
  }

  return { bodyElement, headElement }
}

/**
 * 从 <body> 元素中提取子元素
 *
 * @param bodyElement - <body> React 元素
 * @returns <body> 的子元素
 */
export function getBodyChildren(bodyElement: React.ReactElement | null): React.ReactNode {
  if (!bodyElement) {
    return null
  }

  const props = bodyElement.props as any
  return props?.children ?? null
}

/**
 * 从 <head> 元素中提取所有 <style> 元素
 *
 * @param headElement - <head> React 元素
 * @returns <style> 元素数组
 */
export function getStyleElements(headElement: React.ReactElement | null): React.ReactElement[] {
  if (!headElement) {
    return []
  }

  const props = headElement.props as any
  if (!props?.children) {
    return []
  }

  const headChildren = Array.isArray(props.children)
    ? props.children
    : [props.children]

  return headChildren.filter((child: any) => child?.type === 'style')
}

/**
 * 从完整的 React 树中提取 <body> 的子元素
 *
 * 用于客户端水合时提取与服务端相同的内容
 *
 * @param tree - 完整的 React 树
 * @returns <body> 的子元素
 */
export function extractBodyChildren(tree: React.ReactElement): React.ReactElement {
  const { bodyElement } = extractHTMLParts(tree)

  if (!bodyElement) {
    console.warn('⚠️ 没有找到 body 元素，返回原树')
    return tree
  }

  const bodyChildren = getBodyChildren(bodyElement)

  if (!bodyChildren) {
    console.warn('⚠️ body 元素没有子元素，返回原树')
    return tree
  }

  // 如果是数组，包装在 Fragment 中；否则直接返回
  if (Array.isArray(bodyChildren)) {
    return React.createElement(React.Fragment, null, ...bodyChildren)
  }

  return bodyChildren as React.ReactElement
}

/**
 * 规范化 body 子元素（将数组包装为 Fragment）
 *
 * @param bodyChildren - body 的子元素
 * @returns 规范化后的元素
 */
export function normalizeBodyChildren(bodyChildren: React.ReactNode): React.ReactElement | null {
  if (!bodyChildren) {
    return null
  }

  if (Array.isArray(bodyChildren)) {
    return React.createElement(React.Fragment, null, ...bodyChildren)
  }

  return bodyChildren as React.ReactElement
}
