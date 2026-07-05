import { describe, it, expect } from 'vitest'
import { routes } from '@/router'

// 后端 CanonicalizeReturnURL 强制 return_url 路径必须是 /payment/result（canonical 内部回流页）。
// 本门户必须注册这个路径，跳转型支付（支付宝 H5 等）付完才能回到门户站内确认结果。
describe('payment/result 回流路由', () => {
  it('注册了 PaymentReturn 命名路由，路径为 /payment/result 且需登录', () => {
    const r = routes.find((x) => x.name === 'PaymentReturn')
    expect(r).toBeTruthy()
    expect(r?.path).toBe('/payment/result')
    expect(r?.meta?.requiresAuth).toBe(true)
    expect(r?.meta?.title).toBe('nav.paymentResult')
  })
})
