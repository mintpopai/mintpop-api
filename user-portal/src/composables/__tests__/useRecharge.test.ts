// 默认支付方式选择契约：后端 checkout-info 的 methods 是 Go map（键序不稳定），且可能包含
// 本门户 UI 不渲染的通道（easypay/airwallex 等）。默认选中必须落在「本门户支持的通道」上，
// 否则界面上无任何选中项、提交按钮却可点，用户会对着不可见的方式下单。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CheckoutInfoResponse, MethodLimit } from '@/api/types'

vi.mock('@/api/payment', () => ({
  getCheckoutInfo: vi.fn(),
  createOrder: vi.fn(),
  verifyOrder: vi.fn()
}))
vi.mock('@/api/redeem', () => ({
  redeem: vi.fn()
}))

import { getCheckoutInfo } from '@/api/payment'
import { useRecharge } from '@/composables/useRecharge'

const mockCheckout = vi.mocked(getCheckoutInfo)

function limit(paymentType: string): MethodLimit {
  return { payment_type: paymentType, currency: 'CNY', fee_rate: 0, daily_limit: 0, single_min: 0, single_max: 0 }
}

function checkoutWith(methods: Record<string, MethodLimit>): CheckoutInfoResponse {
  return {
    methods,
    min_amount: 0,
    max_amount: 0,
    global_min: 0,
    global_max: 0,
    plans: [],
    balance_disabled: false,
    balance_recharge_multiplier: 1,
    recharge_fee_rate: 0,
    stripe_publishable_key: ''
  }
}

beforeEach(() => {
  mockCheckout.mockReset()
})

describe('useRecharge 默认支付方式', () => {
  it('首个键是本门户不渲染的通道时，跳过它选中首个受支持的通道', async () => {
    mockCheckout.mockResolvedValue(
      checkoutWith({ easypay: limit('easypay'), alipay: limit('alipay'), stripe: limit('stripe') })
    )
    const r = useRecharge()
    await r.load()
    expect(r.method.value).toBe('alipay')
  })

  it('全部通道都不受支持时不选中任何方式（提交守卫据此拦截）', async () => {
    mockCheckout.mockResolvedValue(checkoutWith({ easypay: limit('easypay'), airwallex: limit('airwallex') }))
    const r = useRecharge()
    await r.load()
    expect(r.method.value).toBe('')
  })

  it('受支持通道按固定优先级选择，不受后端键序影响', async () => {
    mockCheckout.mockResolvedValue(checkoutWith({ stripe: limit('stripe'), wxpay: limit('wxpay') }))
    const r = useRecharge()
    await r.load()
    expect(r.method.value).toBe('wxpay')
  })
})
