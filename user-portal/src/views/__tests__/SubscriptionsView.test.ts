// 「我的套餐」页的错误反馈契约。
//
// 这个页面的加载失败有两条**互斥**的呈现路径，容易写错成只剩一条：
// 1. 首次加载失败 → 整页错误块（条件含 !loaded），带重试按钮；
// 2. 已加载成功后刷新失败 → 整页错误块不再出现（loaded 已为 true），只能靠 toast。
//    刷新是本页唯一动作，这条路径若无反馈，按钮看起来就像点成功了——比没有按钮更糟。
import { vi } from 'vitest'

vi.mock('@/api/subscriptions', () => ({
  getMySubscriptions: vi.fn()
}))

// 页面挂载会拉公开设置（决定是否给「去订阅」按钮与卡片续费按钮），挡掉真实请求
vi.mock('@/api/settings', () => ({
  getPublicSettings: vi.fn()
}))

import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import SubscriptionsView from '@/views/SubscriptionsView.vue'
import { getMySubscriptions } from '@/api/subscriptions'
import { getPublicSettings } from '@/api/settings'
import { useToast } from '@/composables/useToast'
import type { PublicSettings, UserSubscription } from '@/api/types'

const mockGet = vi.mocked(getMySubscriptions)
const mockSettings = vi.mocked(getPublicSettings)
const { toasts } = useToast()

const DAY = 86_400_000

function makeSub(over: Partial<UserSubscription> = {}): UserSubscription {
  return {
    id: 1,
    user_id: 1,
    group_id: 42,
    starts_at: '2026-08-01T00:00:00Z',
    expires_at: new Date(Date.now() + 30 * DAY).toISOString(),
    status: 'active',
    daily_window_start: null,
    weekly_window_start: null,
    monthly_window_start: null,
    daily_usage_usd: 0,
    weekly_usage_usd: 0,
    monthly_usage_usd: 0,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    group: { id: 42, name: 'Claude Pro', platform: 'anthropic' },
    ...over
  }
}

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/subscriptions', name: 'Subscriptions', component: SubscriptionsView },
      { path: '/:pathMatch(.*)*', component: { template: '<div/>' } }
    ]
  })
}

async function mountView() {
  const router = makeRouter()
  router.push('/subscriptions')
  await router.isReady()
  const wrapper = mount(SubscriptionsView, {
    global: { plugins: [router, i18n] }
  })
  await flushPromises()
  return wrapper
}

/** 页头 actions 里的刷新按钮（整页错误块里的是「重试」，两者文案不同） */
function refreshButton(wrapper: Awaited<ReturnType<typeof mountView>>) {
  const btn = wrapper
    .findAll('button')
    .find((b) => b.text() === i18n.global.t('common.refresh'))
  expect(btn, '未找到刷新按钮').toBeTruthy()
  return btn!
}

beforeEach(() => {
  setActivePinia(createPinia())
  mockGet.mockReset()
  mockSettings.mockReset()
  // 线上默认口径：后端 purchase_subscription_enabled 默认 false 且无管理端入口（详见下方购买入口用例）
  mockSettings.mockResolvedValue({ purchase_subscription_enabled: false } as PublicSettings)
  // toasts 是模块级单例，跨用例会串
  toasts.value.splice(0, toasts.value.length)
})

// 购买/续费入口曾挂在 settings.purchase_subscription_enabled 上。那是个 legacy 开关：后端语义是
// 「侧边栏是否展示外链『购买订阅』菜单项」，默认 false、migration 098 迁到自定义菜单后强制置 false，
// 管理端也没有 UI 能打开它 —— 于是这两个入口恒不显示。门禁已废除，入口恒显示。
describe('SubscriptionsView：购买入口不受 legacy 购买开关影响', () => {
  it('空态下照样给「去订阅」按钮', async () => {
    mockGet.mockResolvedValue([])
    const wrapper = await mountView()

    expect(wrapper.text()).toContain(i18n.global.t('subscriptions.empty'))
    expect(wrapper.text()).toContain(i18n.global.t('subscriptions.emptyAction'))
  })

  it('已有生效套餐时照样给卡片上的「续费」按钮', async () => {
    mockGet.mockResolvedValue([makeSub()])
    const wrapper = await mountView()

    expect(wrapper.text()).toContain(i18n.global.t('subscriptions.renew'))
  })
})

describe('SubscriptionsView：加载失败的反馈', () => {
  it('首次加载失败：出整页错误块，不弹 toast', async () => {
    mockGet.mockRejectedValue(new Error('boom'))
    const wrapper = await mountView()

    expect(wrapper.text()).toContain(i18n.global.t('common.retry'))
    expect(wrapper.text()).not.toContain(i18n.global.t('subscriptions.empty'))
    expect(toasts.value).toHaveLength(0)
  })

  it('已加载成功后刷新失败：弹错误 toast，卡片仍在，不出整页错误块', async () => {
    mockGet.mockResolvedValueOnce([makeSub()])
    const wrapper = await mountView()
    expect(wrapper.text()).toContain('Claude Pro')

    mockGet.mockRejectedValueOnce(new Error('boom'))
    await refreshButton(wrapper).trigger('click')
    await flushPromises()

    expect(toasts.value).toHaveLength(1)
    expect(toasts.value[0].type).toBe('ERROR')
    // 旧数据仍在，且没有退化成整页错误块
    expect(wrapper.text()).toContain('Claude Pro')
    expect(wrapper.text()).not.toContain(i18n.global.t('common.retry'))
  })

  it('刷新成功不弹 toast', async () => {
    mockGet.mockResolvedValueOnce([makeSub()])
    const wrapper = await mountView()

    mockGet.mockResolvedValueOnce([makeSub({ id: 2, group: { id: 7, name: '新套餐' } })])
    await refreshButton(wrapper).trigger('click')
    await flushPromises()

    expect(toasts.value).toHaveLength(0)
    expect(wrapper.text()).toContain('新套餐')
  })
})
