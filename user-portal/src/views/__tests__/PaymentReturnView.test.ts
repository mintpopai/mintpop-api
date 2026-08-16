import { vi } from 'vitest'

// 轮询原语已有独立契约测试（utils/__tests__/orderPolling.test.ts），此处 mock 掉只测视图编排
vi.mock('@/utils/orderPolling', () => ({
  pollOrderUntilSettled: vi.fn()
}))
// 成功后会刷新余额（authStore.fetchUser → getProfile），mock 掉避免 jsdom 真实 XHR
vi.mock('@/api/user', () => ({
  getProfile: vi.fn().mockResolvedValue({ id: 1, username: 'u', email: 'u@x.com', balance: 1 })
}))

import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import PaymentReturnView from '@/views/PaymentReturnView.vue'
import { pollOrderUntilSettled } from '@/utils/orderPolling'
import type { PaymentOrder } from '@/api/types'

const mockPoll = vi.mocked(pollOrderUntilSettled)

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/payment/result', name: 'PaymentReturn', component: PaymentReturnView },
      { path: '/:pathMatch(.*)*', component: { template: '<div/>' } }
    ]
  })
}

async function mountView(query: string) {
  const router = makeRouter()
  router.push(`/payment/result${query}`)
  await router.isReady()
  const wrapper = mount(PaymentReturnView, {
    global: { plugins: [router, i18n] }
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  mockPoll.mockReset()
})

describe('PaymentReturnView', () => {
  it('带 out_trade_no 时轮询该订单；SETTLED（余额单）展示支付成功', async () => {
    mockPoll.mockResolvedValue({
      kind: 'SETTLED',
      order: { status: 'PAID', order_type: 'balance' } as unknown as PaymentOrder
    })
    const wrapper = await mountView('?out_trade_no=T123&order_id=9')
    expect(mockPoll).toHaveBeenCalledWith('T123', expect.anything())
    expect(wrapper.text()).toContain(i18n.global.t('payment.returnSuccess'))
  })

  it('SETTLED 订阅单展示订阅生效文案', async () => {
    mockPoll.mockResolvedValue({
      kind: 'SETTLED',
      order: { status: 'PAID', order_type: 'subscription' } as unknown as PaymentOrder
    })
    const wrapper = await mountView('?out_trade_no=T123')
    expect(wrapper.text()).toContain(i18n.global.t('payment.returnSubscribed'))
  })

  it('TIMEOUT/TERMINAL 展示「暂未确认」并引导核实订单', async () => {
    mockPoll.mockResolvedValue({ kind: 'TIMEOUT' })
    const wrapper = await mountView('?out_trade_no=T123')
    expect(wrapper.text()).toContain(i18n.global.t('payment.returnUnknown'))
  })

  it('缺少 out_trade_no 时不发起轮询，提示参数缺失', async () => {
    const wrapper = await mountView('')
    expect(mockPoll).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain(i18n.global.t('payment.returnMissing'))
  })
})
