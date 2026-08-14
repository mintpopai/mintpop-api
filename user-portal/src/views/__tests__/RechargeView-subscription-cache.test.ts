// 订阅购买成功后必须让订阅缓存失效。
//
// 订阅 store 有 60 秒缓存。用户看到「订阅成功」后最自然的下一步就是点进「我的套餐」，
// 若不主动失效，那 60 秒里刚买的套餐不在列表里——这是支付后最强的「我的钱是不是打水漂了」信号。
// 覆盖两条会走到这里的成功路径：弹窗内直接付成功，以及跳转型支付（支付宝等）跳回本页恢复确认。
import { vi } from 'vitest'

vi.mock('@/api/payment', () => ({
  getCheckoutInfo: vi.fn(),
  createOrder: vi.fn(),
  verifyOrder: vi.fn(),
  getPlans: vi.fn().mockResolvedValue([])
}))

vi.mock('@/api/subscriptions', () => ({
  getMySubscriptions: vi.fn()
}))

vi.mock('@/api/settings', () => ({
  getPublicSettings: vi.fn()
}))

vi.mock('@/api/user', () => ({
  getProfile: vi.fn()
}))

vi.mock('@/api/redeem', () => ({
  redeem: vi.fn()
}))

// 轮询原语有独立契约测试（utils/__tests__/orderPolling.test.ts），这里只测视图编排
vi.mock('@/utils/orderPolling', () => ({
  pollOrderUntilSettled: vi.fn()
}))

import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import RechargeView from '@/views/RechargeView.vue'
import { getCheckoutInfo } from '@/api/payment'
import { getMySubscriptions } from '@/api/subscriptions'
import { getPublicSettings } from '@/api/settings'
import { getProfile } from '@/api/user'
import { pollOrderUntilSettled } from '@/utils/orderPolling'
import type {
  CheckoutInfoResponse,
  PaymentOrder,
  PublicSettings,
  User
} from '@/api/types'

const mockCheckout = vi.mocked(getCheckoutInfo)
const mockGetSubs = vi.mocked(getMySubscriptions)
const mockSettings = vi.mocked(getPublicSettings)
const mockProfile = vi.mocked(getProfile)
const mockPoll = vi.mocked(pollOrderUntilSettled)

const CHECKOUT = {
  methods: { wxpay: { daily_limit: 0, single_min: 1, single_max: 0 } },
  min_amount: 1,
  max_amount: 0,
  global_min: 1,
  global_max: 0,
  plans: [],
  balance_disabled: false,
  balance_recharge_multiplier: 1,
  recharge_fee_rate: 0,
  stripe_publishable_key: ''
} as unknown as CheckoutInfoResponse

const PortalLayoutStub = { template: '<div><slot /></div>' }
// 弹窗内部会真发起支付请求，替换成只暴露 paid 事件的壳
const PaymentResultModalStub = {
  name: 'PaymentResultModal',
  template: '<div />',
  emits: ['paid', 'close']
}

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/recharge', name: 'Recharge', component: RechargeView },
      { path: '/:pathMatch(.*)*', component: { template: '<div/>' } }
    ]
  })
}

async function mountView(query = '') {
  const router = makeRouter()
  router.push(`/recharge${query}`)
  await router.isReady()
  const wrapper = mount(RechargeView, {
    global: {
      plugins: [router, i18n],
      stubs: { PortalLayout: PortalLayoutStub, PaymentResultModal: PaymentResultModalStub }
    }
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  mockCheckout.mockReset()
  mockGetSubs.mockReset()
  mockSettings.mockReset()
  mockProfile.mockReset()
  mockPoll.mockReset()

  mockCheckout.mockResolvedValue(CHECKOUT)
  mockGetSubs.mockResolvedValue([])
  // 线上默认口径：后端 purchase_subscription_enabled 默认 false 且无管理端入口（详见文件末尾 describe）
  mockSettings.mockResolvedValue({ purchase_subscription_enabled: false } as PublicSettings)
  mockProfile.mockResolvedValue({ id: 1, username: 'u', email: 'u@x.com', balance: 1 } as User)
})

describe('RechargeView：订阅支付成功后失效订阅缓存', () => {
  it('订阅 tab 内付款成功 → 重新拉取订阅（绕过 60 秒缓存）', async () => {
    const wrapper = await mountView()
    // 挂载时页面已按「续费文案」需要拉过一次订阅
    const callsAfterMount = mockGetSubs.mock.calls.length
    expect(callsAfterMount).toBeGreaterThan(0)

    // 切到订阅 tab，让弹窗的 paid 事件走 handleSubPaid 分支
    const subTab = wrapper
      .findAll('button')
      .find((b) => b.text() === i18n.global.t('recharge.tabSubscription'))
    expect(subTab, '未找到订阅 tab').toBeTruthy()
    await subTab!.trigger('click')

    wrapper.findComponent(PaymentResultModalStub).vm.$emit('paid')
    await flushPromises()

    expect(mockGetSubs.mock.calls.length).toBe(callsAfterMount + 1)
  })

  it('跳转型支付跳回本页确认到账（订阅单）→ 重新拉取订阅', async () => {
    mockPoll.mockResolvedValue({
      kind: 'SETTLED',
      order: { status: 'PAID', order_type: 'subscription' } as unknown as PaymentOrder
    })

    await mountView('?pay_return=T123')
    await flushPromises()

    expect(mockPoll).toHaveBeenCalledWith('T123', expect.anything())
    // 一次来自挂载时的预取，一次来自恢复确认后的失效重拉
    expect(mockGetSubs).toHaveBeenCalledTimes(2)
  })

  it('余额充值成功不去动订阅缓存（避免无谓请求）', async () => {
    const wrapper = await mountView()
    const callsAfterMount = mockGetSubs.mock.calls.length

    // 不切 tab，activeTab 保持 0（充值），paid 走 handlePaid 分支
    wrapper.findComponent(PaymentResultModalStub).vm.$emit('paid')
    await flushPromises()

    expect(mockGetSubs.mock.calls.length).toBe(callsAfterMount)
  })
})

// 订阅 tab 曾挂在 settings.purchase_subscription_enabled 上，导致用户「在购买页看不到套餐」。
// 那是个 legacy 开关：后端语义是「侧边栏是否展示外链『购买订阅』菜单项」（配 purchase_subscription_url），
// 默认 false、migration 098 迁到自定义菜单后强制置 false，管理端也没有 UI 能打开它 —— 于是订阅 tab
// 恒不渲染、深链也直接 bail。门禁已废除：tab 恒显示，有没有套餐由列表自己出空态，
// 与旧版用户中心（frontend PaymentView 无条件 push 订阅 tab）对齐。
describe('RechargeView：订阅 tab 不受 legacy 购买开关影响', () => {
  const PLAN = {
    id: 7,
    name: '月度套餐',
    group_id: 42,
    group_name: 'Claude Pro',
    price: 20,
    validity_days: 30
  }

  it('purchase_subscription_enabled 为 false（线上默认）时，订阅 tab 仍渲染', async () => {
    const wrapper = await mountView()
    const subTab = wrapper
      .findAll('button')
      .find((b) => b.text() === i18n.global.t('recharge.tabSubscription'))
    expect(subTab, '订阅 tab 不该被 legacy 开关挡掉').toBeTruthy()
  })

  it('开关为 false 时，切到订阅 tab 照样能看到在售套餐', async () => {
    mockCheckout.mockResolvedValue({
      ...CHECKOUT,
      plans: [PLAN]
    } as unknown as CheckoutInfoResponse)

    const wrapper = await mountView()
    const subTab = wrapper
      .findAll('button')
      .find((b) => b.text() === i18n.global.t('recharge.tabSubscription'))
    await subTab!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('月度套餐')
  })

  it('开关为 false 时，?tab=subscription 深链照样落到订阅 tab 并渲染套餐', async () => {
    mockCheckout.mockResolvedValue({
      ...CHECKOUT,
      plans: [PLAN]
    } as unknown as CheckoutInfoResponse)

    const wrapper = await mountView('?tab=subscription&group=42')
    await flushPromises()

    expect(wrapper.text()).toContain('月度套餐')
  })
})
