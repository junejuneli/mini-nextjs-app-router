import React from 'react'
import Link from '../../../client/Link.jsx'

/**
 * 定价页面 - 路由组示例
 *
 * Next.js 路由组特性：
 * - (marketing) 是路由组，括号不会出现在 URL 中
 * - URL 路径：/pricing（不是 /(marketing)/pricing）
 * - 用于组织代码，共享布局，不影响路由结构
 *
 * 路由组用途：
 * 1. 代码组织：按功能分组（marketing、admin、app）
 * 2. 共享布局：在组内共享特定布局
 * 3. 多根布局：创建多个 root-level 布局
 *
 * 示例场景：
 * - (marketing)/pricing, (marketing)/features - 营销页面布局
 * - (app)/dashboard, (app)/settings - 应用页面布局
 * - (admin)/users, (admin)/logs - 管理后台布局
 */

const pricingPlans = [
  {
    name: '免费版',
    price: '￥0',
    period: '/月',
    description: '适合个人开发者和小型项目',
    features: [
      '✓ 基础功能',
      '✓ 1 个项目',
      '✓ 社区支持',
      '✓ 基础文档',
      '✗ 高级功能',
      '✗ 优先支持'
    ],
    highlighted: false
  },
  {
    name: '专业版',
    price: '￥99',
    period: '/月',
    description: '适合成长型团队和中小企业',
    features: [
      '✓ 所有基础功能',
      '✓ 10 个项目',
      '✓ 优先支持',
      '✓ 高级文档',
      '✓ API 访问',
      '✗ 企业级功能'
    ],
    highlighted: true
  },
  {
    name: '企业版',
    price: '定制',
    period: '',
    description: '适合大型企业和复杂需求',
    features: [
      '✓ 所有专业版功能',
      '✓ 无限项目',
      '✓ 专属客服',
      '✓ 定制开发',
      '✓ SLA 保障',
      '✓ 私有化部署'
    ],
    highlighted: false
  }
]

export default function PricingPage() {
  return (
    <div>
      {/* 页面头部 */}
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <h1 style={{ fontSize: '40px', marginBottom: '16px' }}>
          💰 定价方案
        </h1>
        <p style={{ fontSize: '18px', color: '#666', maxWidth: '600px', margin: '0 auto' }}>
          选择最适合您的方案，随时可以升级或降级
        </p>
      </div>

      {/* 定价卡片 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '24px',
        marginBottom: '48px'
      }}>
        {pricingPlans.map((plan) => (
          <div
            key={plan.name}
            className="card"
            style={{
              position: 'relative',
              border: plan.highlighted ? '3px solid #0070f3' : '1px solid #e0e0e0',
              transform: plan.highlighted ? 'scale(1.05)' : 'scale(1)',
              transition: 'transform 0.3s'
            }}
          >
            {plan.highlighted && (
              <div style={{
                position: 'absolute',
                top: '-12px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: '#0070f3',
                color: 'white',
                padding: '4px 16px',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: '600'
              }}>
                推荐
              </div>
            )}

            <h3 style={{ fontSize: '24px', marginBottom: '8px' }}>
              {plan.name}
            </h3>

            <div style={{ marginBottom: '16px' }}>
              <span style={{
                fontSize: '36px',
                fontWeight: 'bold',
                color: plan.highlighted ? '#0070f3' : '#333'
              }}>
                {plan.price}
              </span>
              <span style={{ fontSize: '16px', color: '#999' }}>
                {plan.period}
              </span>
            </div>

            <p style={{ color: '#666', marginBottom: '24px', minHeight: '48px' }}>
              {plan.description}
            </p>

            <ul style={{
              listStyle: 'none',
              padding: 0,
              marginBottom: '24px'
            }}>
              {plan.features.map((feature, index) => (
                <li
                  key={index}
                  style={{
                    padding: '8px 0',
                    fontSize: '14px',
                    color: feature.startsWith('✗') ? '#999' : '#333'
                  }}
                >
                  {feature}
                </li>
              ))}
            </ul>

            <button style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              fontWeight: '600',
              backgroundColor: plan.highlighted ? '#0070f3' : '#f5f5f5',
              color: plan.highlighted ? 'white' : '#333'
            }}>
              {plan.price === '定制' ? '联系我们' : '开始使用'}
            </button>
          </div>
        ))}
      </div>

      {/* 常见问题 */}
      <div className="card" style={{ marginTop: '48px' }}>
        <h2 style={{ marginBottom: '24px' }}>❓ 常见问题</h2>

        <div style={{ display: 'grid', gap: '20px' }}>
          <div>
            <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>
              可以随时更改方案吗？
            </h3>
            <p style={{ fontSize: '14px', color: '#666', lineHeight: '1.6' }}>
              是的，您可以随时升级或降级。升级立即生效，降级将在当前周期结束后生效。
            </p>
          </div>

          <div>
            <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>
              是否提供退款？
            </h3>
            <p style={{ fontSize: '14px', color: '#666', lineHeight: '1.6' }}>
              我们提供 7 天无理由退款保证。如果您在购买后 7 天内不满意，可以申请全额退款。
            </p>
          </div>

          <div>
            <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>
              企业版如何定价？
            </h3>
            <p style={{ fontSize: '14px', color: '#666', lineHeight: '1.6' }}>
              企业版根据您的具体需求定制，包括用户数量、功能需求和服务级别。请联系我们获取报价。
            </p>
          </div>
        </div>
      </div>

      {/* 技术说明 */}
      <div className="card" style={{ marginTop: '48px' }}>
        <h3>💡 路由组 (Route Groups) 技术说明</h3>
        <ul style={{ fontSize: '14px', lineHeight: '1.8' }}>
          <li>
            <strong>当前文件路径</strong>：<code>app/(marketing)/pricing/page.jsx</code>
          </li>
          <li>
            <strong>实际 URL</strong>：<code>/pricing</code>（括号不出现在 URL 中）
          </li>
          <li>
            <strong>用途 1 - 代码组织</strong>：按功能分组文件，不影响路由结构
          </li>
          <li>
            <strong>用途 2 - 共享布局</strong>：可以在 <code>(marketing)/layout.jsx</code> 中定义共享布局
          </li>
          <li>
            <strong>用途 3 - 多根布局</strong>：不同的路由组可以有不同的根级布局
          </li>
        </ul>
      </div>

      <div style={{
        marginTop: '32px',
        textAlign: 'center'
      }}>
        <Link href="/">
          <button style={{
            padding: '12px 24px',
            fontSize: '15px',
            backgroundColor: '#f5f5f5',
            color: '#333'
          }}>
            ← 返回首页
          </button>
        </Link>
      </div>
    </div>
  )
}
