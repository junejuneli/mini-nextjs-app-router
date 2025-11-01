import React from 'react'

/**
 * 从 React 树中提取 <body> 和 <head> 元素的工具函数
 *
 * ⭐ 服务端和客户端共享此逻辑，确保一致性
 */

/**
 * 从 React 树中提取 <body> 和 <head> 元素
 *
 * @param {React.Element} tree - 完整的 React 树（<html> 根元素）
 * @returns {{bodyElement: React.Element|null, headElement: React.Element|null}}
 */
export function extractHTMLParts(tree) {
  let bodyElement = null
  let headElement = null

  if (tree?.type === 'html' && Array.isArray(tree.props?.children)) {
    headElement = tree.props.children.find(child => child?.type === 'head')
    bodyElement = tree.props.children.find(child => child?.type === 'body')
  }

  return { bodyElement, headElement }
}

/**
 * 从 <body> 元素中提取子元素
 *
 * @param {React.Element|null} bodyElement - <body> React 元素
 * @returns {React.Element|React.Element[]|null} <body> 的子元素
 */
export function getBodyChildren(bodyElement) {
  if (!bodyElement?.props?.children) {
    return null
  }

  return bodyElement.props.children
}

/**
 * 从 <head> 元素中提取所有 <style> 元素
 *
 * @param {React.Element|null} headElement - <head> React 元素
 * @returns {React.Element[]} <style> 元素数组
 */
export function getStyleElements(headElement) {
  if (!headElement?.props?.children) {
    return []
  }

  const headChildren = Array.isArray(headElement.props.children)
    ? headElement.props.children
    : [headElement.props.children]

  return headChildren.filter(child => child?.type === 'style')
}

/**
 * 从完整的 React 树中提取 <body> 的子元素
 *
 * 用于客户端水合时提取与服务端相同的内容
 *
 * @param {React.Element} tree - 完整的 React 树
 * @returns {React.Element | React.Fragment} <body> 的子元素
 */
export function extractBodyChildren(tree) {
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

  return bodyChildren
}

/**
 * 规范化 body 子元素（将数组包装为 Fragment）
 *
 * @param {React.Element|React.Element[]|null} bodyChildren - body 的子元素
 * @returns {React.Element|null} 规范化后的元素
 */
export function normalizeBodyChildren(bodyChildren) {
  if (!bodyChildren) {
    return null
  }

  if (Array.isArray(bodyChildren)) {
    return React.createElement(React.Fragment, null, ...bodyChildren)
  }

  return bodyChildren
}
