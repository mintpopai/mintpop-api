// 到期横幅的三条契约：
// 1. 没有临期订阅就不能渲染——空横幅会白占仪表盘顶部；
// 2. 多条临期时展示最紧急的那条 + 「另有 N 个」；
// 3. 关闭后本次会话不再出现（写 sessionStorage），否则每次切页都被打断。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { setActivePinia, createPinia } from 'pinia'
import type { UserSubscription } from '@/api/types'
import zhCN from '@/i18n/locales/zh-CN'

vi.mock('@/api/subscriptions', () => ({
  getMySubscriptions: vi.fn()
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() })
}))

import { getMySubscriptions } from '@/api/subscriptions'
import ExpiryBanner from '../ExpiryBanner.vue'

const mockGet = vi.mocked(getMySubscriptions)
const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: false,
  missingWarn: false,
  fallbackWarn: false,
  messages: { 'zh-CN': zhCN }
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

async function mountBanner() {
  const wrapper = mount(ExpiryBanner, { global: { plugins: [i18n] } })
  await new Promise((r) => setTimeout(r, 0))
  await wrapper.vm.$nextTick()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  mockGet.mockReset()
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
