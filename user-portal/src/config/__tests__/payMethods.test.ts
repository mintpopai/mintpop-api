// 拍平支付选项构建契约：后端存在 stripe 方式时按部署约定展开为微信/支付宝/银行卡，
// 与直连同名通道去重（直连优先），本门户不支持的通道一律不渲染。
import { describe, it, expect } from 'vitest'
import type { MethodLimit } from '@/api/types'
import { buildPayOptions, pickDefaultPayOption } from '@/config/payMethods'

function limit(paymentType: string): MethodLimit {
  return {
    payment_type: paymentType,
    currency: 'USD',
    fee_rate: 0,
    daily_limit: 0,
    single_min: 0,
    single_max: 0
  }
}

describe('buildPayOptions', () => {
  it('仅 stripe 时展开为微信/支付宝/银行卡（固定顺序，限额共享 stripe 键）', () => {
    const options = buildPayOptions({ stripe: limit('stripe') })
    expect(options).toEqual([
      { key: 'stripe:wxpay', paymentType: 'stripe', subMethod: 'wxpay', limitsKey: 'stripe' },
      { key: 'stripe:alipay', paymentType: 'stripe', subMethod: 'alipay', limitsKey: 'stripe' },
      { key: 'stripe:card', paymentType: 'stripe', subMethod: 'card', limitsKey: 'stripe' }
    ])
  })

  it('直连微信/支付宝优先，Stripe 同名子方式去重、仅补银行卡', () => {
    const options = buildPayOptions({
      wxpay: limit('wxpay'),
      alipay: limit('alipay'),
      stripe: limit('stripe')
    })
    expect(options.map((o) => o.key)).toEqual(['wxpay', 'alipay', 'stripe:card'])
  })

  it('只有直连通道时不出现 Stripe 子选项', () => {
    const options = buildPayOptions({ wxpay: limit('wxpay') })
    expect(options.map((o) => o.key)).toEqual(['wxpay'])
  })

  it('本门户不支持的通道（easypay/airwallex）不渲染', () => {
    const options = buildPayOptions({ easypay: limit('easypay'), airwallex: limit('airwallex') })
    expect(options).toEqual([])
  })
})

describe('pickDefaultPayOption', () => {
  it('取列表首项，空列表返回空串', () => {
    expect(pickDefaultPayOption(buildPayOptions({ stripe: limit('stripe') }))).toBe('stripe:wxpay')
    expect(pickDefaultPayOption([])).toBe('')
  })
})
