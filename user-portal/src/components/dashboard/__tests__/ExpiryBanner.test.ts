// 到期横幅的五条契约：
// 1. 没有临期订阅就不能渲染——空横幅会白占仪表盘顶部；
// 2. 多条临期时展示最紧急的那条 + 「另有 N 个」；
// 3. 关闭后本次会话不再出现（写 sessionStorage），否则每次切页都被打断；
// 4. 「立即续费」按钮恒显示，不受 legacy 的 purchase_subscription_enabled 开关影响（详见该 describe 的注释）；
// 5. 英文文案在 n=1 时必须是单数（横幅只在最后 7 天出现，n=1 恰恰是最常见的渲染）。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { setActivePinia, createPinia } from 'pinia'
import type { UserSubscription, PublicSettings } from '@/api/types'
import zhCN from '@/i18n/locales/zh-CN'
import enUS from '@/i18n/locales/en-US'

vi.mock('@/api/subscriptions', () => ({
  getMySubscriptions: vi.fn()
}))

// 横幅曾按 settings.purchase_subscription_enabled 决定是否给续费 CTA（已废除，见下方 describe）。
// 这里仍 mock 掉，一是挡真实请求，二是让「开关为假也照常给按钮」的回归用例能构造该场景。
vi.mock('@/api/settings', () => ({
  getPublicSettings: vi.fn()
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() })
}))

import { getMySubscriptions } from '@/api/subscriptions'
import { getPublicSettings } from '@/api/settings'
import ExpiryBanner from '../ExpiryBanner.vue'

const mockGet = vi.mocked(getMySubscriptions)
const mockSettings = vi.mocked(getPublicSettings)
const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: false,
  missingWarn: false,
  fallbackWarn: false,
  messages: { 'zh-CN': zhCN }
})
const enI18n = createI18n({
  legacy: false,
  locale: 'en-US',
  fallbackLocale: false,
  missingWarn: false,
  fallbackWarn: false,
  messages: { 'en-US': enUS }
})
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
    group: { id: 42, name: 'Claude Pro' },
    ...over
  }
}

async function mountBanner(plugin: typeof i18n | typeof enI18n = i18n) {
  const wrapper = mount(ExpiryBanner, { global: { plugins: [plugin] } })
  await new Promise((r) => setTimeout(r, 0))
  await wrapper.vm.$nextTick()
  return wrapper
}

/** 续费 CTA（横幅右侧的主按钮）；关闭按钮只带 aria-label，不含文案 */
function renewButton(wrapper: Awaited<ReturnType<typeof mountBanner>>, label: string) {
  return wrapper.findAll('button').find((b) => b.text().includes(label))
}

beforeEach(() => {
  setActivePinia(createPinia())
  mockGet.mockReset()
  mockSettings.mockReset()
  // 线上默认口径：后端 purchase_subscription_enabled 默认为 false 且无管理端入口，
  // 故默认 mock 成 false，保证各用例都在「真实最坏情况」下跑
  mockSettings.mockResolvedValue({ purchase_subscription_enabled: false } as PublicSettings)
  sessionStorage.clear()
})

describe('ExpiryBanner', () => {
  it('没有临期订阅时不渲染', async () => {
    mockGet.mockResolvedValue([makeSub()])
    const wrapper = await mountBanner()
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })

  it('多条临期时展示最紧急的一条与「另有 N 个」', async () => {
    mockGet.mockResolvedValue([
      makeSub({ id: 1, group_id: 1, group: { id: 1, name: '套餐A' }, expires_at: new Date(Date.now() + 5 * DAY).toISOString() }),
      makeSub({ id: 2, group_id: 2, group: { id: 2, name: '套餐B' }, expires_at: new Date(Date.now() + 2 * DAY).toISOString() })
    ])
    const wrapper = await mountBanner()
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('套餐B')
    expect(wrapper.text()).not.toContain('套餐A')
    expect(wrapper.text()).toContain('另有 1 个')
  })

  it('关闭后不再渲染并写入 sessionStorage', async () => {
    mockGet.mockResolvedValue([
      makeSub({ expires_at: new Date(Date.now() + 2 * DAY).toISOString() })
    ])
    const wrapper = await mountBanner()
    const buttons = wrapper.findAll('button')
    await buttons[buttons.length - 1].trigger('click')
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(sessionStorage.getItem('subscriptionExpiryBannerDismissed')).toBe('1')
  })

  it('sessionStorage 已标记关闭时，挂载即不渲染', async () => {
    sessionStorage.setItem('subscriptionExpiryBannerDismissed', '1')
    mockGet.mockResolvedValue([
      makeSub({ expires_at: new Date(Date.now() + 2 * DAY).toISOString() })
    ])
    const wrapper = await mountBanner()
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })
})

// 续费 CTA 曾挂在 settings.purchase_subscription_enabled 上。那是个 legacy 开关：后端语义是
// 「侧边栏是否展示外链『购买订阅』菜单项」（配 purchase_subscription_url），默认 false、
// migration 098 迁到自定义菜单后强制置 false，管理端也没有任何 UI 能打开它 —— 于是续费按钮
// 恒不显示。本门禁已废除：按钮恒显示，与旧版用户中心（frontend PaymentView 无条件给订阅入口）对齐。
describe('ExpiryBanner：续费 CTA 不受 legacy 购买开关影响', () => {
  it('purchase_subscription_enabled 为 false（线上默认）时照样给「立即续费」按钮', async () => {
    mockGet.mockResolvedValue([
      makeSub({ expires_at: new Date(Date.now() + 2 * DAY).toISOString() })
    ])
    const wrapper = await mountBanner()
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Claude Pro')
    expect(renewButton(wrapper, zhCN.subscriptions.expiryBannerAction)).toBeDefined()
  })

  it('公开设置整体缺失时也给「立即续费」按钮', async () => {
    mockSettings.mockResolvedValue({} as PublicSettings)
    mockGet.mockResolvedValue([
      makeSub({ expires_at: new Date(Date.now() + 2 * DAY).toISOString() })
    ])
    const wrapper = await mountBanner()
    expect(renewButton(wrapper, zhCN.subscriptions.expiryBannerAction)).toBeDefined()
  })
})

describe('ExpiryBanner：英文单复数', () => {
  it('n=1 时用单数（不是 "1 days" / "1 more plans"）', async () => {
    mockGet.mockResolvedValue([
      // 当天到期：组件把剩余天数下限钳到 1，正是最常见的 n=1 渲染
      makeSub({ id: 1, group_id: 1, group: { id: 1, name: 'Plan A' }, expires_at: new Date(Date.now() + 3600_000).toISOString() }),
      makeSub({ id: 2, group_id: 2, group: { id: 2, name: 'Plan B' }, expires_at: new Date(Date.now() + 5 * DAY).toISOString() })
    ])
    const wrapper = await mountBanner(enI18n)
    const text = wrapper.text()
    expect(text).toContain('expires in 1 day')
    expect(text).not.toContain('expires in 1 days')
    expect(text).toContain('1 more plan expiring soon')
    expect(text).not.toContain('1 more plans')
  })

  it('n>1 时用复数', async () => {
    mockGet.mockResolvedValue([
      makeSub({ id: 1, group_id: 1, group: { id: 1, name: 'Plan A' }, expires_at: new Date(Date.now() + 3 * DAY).toISOString() }),
      makeSub({ id: 2, group_id: 2, group: { id: 2, name: 'Plan B' }, expires_at: new Date(Date.now() + 5 * DAY).toISOString() }),
      makeSub({ id: 3, group_id: 3, group: { id: 3, name: 'Plan C' }, expires_at: new Date(Date.now() + 6 * DAY).toISOString() })
    ])
    const wrapper = await mountBanner(enI18n)
    expect(wrapper.text()).toContain('expires in 3 days')
    expect(wrapper.text()).toContain('2 more plans expiring soon')
  })
})
