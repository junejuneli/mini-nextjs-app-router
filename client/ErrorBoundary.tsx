'use client'

import React from 'react'

/**
 * ErrorBoundary Props
 */
interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>
}

/**
 * ErrorBoundary State
 */
interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * 全局错误边界组件 - Client Component
 *
 * 捕获渲染错误，防止整个应用白屏
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    console.error('❌ [ErrorBoundary] 捕获到错误:', error)
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('❌ [ErrorBoundary] 错误详情:', error, errorInfo)
  }

  reset = (): void => {
    console.log('🔄 [ErrorBoundary] 重置错误状态')
    this.setState({ hasError: false, error: null })
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      // 如果提供了自定义 fallback 组件，使用它
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback
        return <FallbackComponent error={this.state.error!} reset={this.reset} />
      }

      // 否则使用默认错误 UI
      return (
        <div style={{
          padding: '40px',
          maxWidth: '800px',
          margin: '0 auto',
          fontFamily: 'system-ui, sans-serif'
        }}>
          <div style={{
            backgroundColor: '#fee',
            border: '2px solid #f66',
            borderRadius: '8px',
            padding: '30px'
          }}>
            <h1 style={{ color: '#d00', marginBottom: '20px' }}>❌ 页面渲染出错</h1>

            <div style={{
              backgroundColor: '#fff',
              padding: '20px',
              borderRadius: '5px',
              marginBottom: '20px',
              border: '1px solid #ddd'
            }}>
              <h3 style={{ marginTop: 0 }}>错误信息：</h3>
              <pre style={{
                color: '#d00',
                fontFamily: 'monospace',
                fontSize: '14px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {this.state.error?.message || '未知错误'}
              </pre>

              {this.state.error?.stack && (
                <>
                  <h3>堆栈跟踪：</h3>
                  <pre style={{
                    fontSize: '12px',
                    color: '#666',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: '200px',
                    overflow: 'auto'
                  }}>
                    {this.state.error.stack}
                  </pre>
                </>
              )}
            </div>

            <button
              onClick={this.reset}
              style={{
                padding: '12px 24px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                marginRight: '10px'
              }}
            >
              🔄 重试
            </button>

            <button
              onClick={() => window.location.href = '/'}
              style={{
                padding: '12px 24px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              🏠 返回首页
            </button>

            <div style={{
              marginTop: '30px',
              padding: '20px',
              backgroundColor: '#f9f9f9',
              borderRadius: '5px',
              fontSize: '14px'
            }}>
              <h3>💡 关于错误边界</h3>
              <ul style={{ lineHeight: '1.8' }}>
                <li>错误边界捕获了子组件树中的渲染错误</li>
                <li>防止整个应用因为局部错误而崩溃</li>
                <li>提供友好的错误提示和恢复机制</li>
                <li>错误信息已记录到浏览器控制台</li>
              </ul>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
