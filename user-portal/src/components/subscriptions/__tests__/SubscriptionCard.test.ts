// 订阅卡片的四条契约：
// 1. 只渲染「配置了上限」的额度条——多渲染一条空进度条会让用户以为有额度限制；
// 2. 三个上限皆空时必须显示「不限额度」块，而不是整块消失（消失会让人以为卡片渲染坏了）；
// 3. 续费按钮只在生效中出现，且带对的 group_id——按钮带错 id 会跳到别人的套餐；
// 4. 站点关闭订阅购买（canRenew=false）时不给续费按钮——充值页没有订阅 tab，点过去是死链。
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import type { UserSubscription } from '@/api/types'
import SubscriptionCard from '../SubscriptionCard.vue'
import zhCN from '@/i18n/locales/zh-CN'

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
    group: { id: 42, name: 'Claude Pro', platform: 'anthropic' },
    ...over
  }
}

function mountCard(sub: UserSubscription, canRenew?: boolean) {
  return mount(SubscriptionCard, {
    props: canRenew === undefined ? { sub } : { sub, canRenew },
    global: { plugins: [i18n] }
  })
}

describe('SubscriptionCard：额度渲染', () => {
  it('只配了日额度时只渲染一条进度条', () => {
    const wrapper = mountCard(
      makeSub({ group: { id: 42, name: 'g', daily_limit_usd: 10 }, daily_usage_usd: 3 })
    )
    expect(wrapper.findAll('[role="progressbar"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="unlimited-block"]').exists()).toBe(false)
  })

  it('日周月都配了则渲染三条', () => {
    const wrapper = mountCard(
      makeSub({
        group: { id: 42, name: 'g', daily_limit_usd: 10, weekly_limit_usd: 50, monthly_limit_usd: 200 }
      })
    )
    expect(wrapper.findAll('[role="progressbar"]')).toHaveLength(3)
  })

  it('三个上限皆空时渲染「不限额度」块而非空白', () => {
    const wrapper = mountCard(makeSub({ group: { id: 42, name: 'g' } }))
    expect(wrapper.findAll('[role="progressbar"]')).toHaveLength(0)
    expect(wrapper.find('[data-testid="unlimited-block"]').exists()).toBe(true)
    expect(wrapper.text()).toContain(zhCN.subscriptions.unlimited)
  })
})

describe('SubscriptionCard：状态与续费', () => {
  it('生效中显示续费按钮，点击带出 group_id', async () => {
    const wrapper = mountCard(makeSub())
    const btn = wrapper.find('button')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    expect(wrapper.emitted('renew')?.at(-1)).toEqual([42])
  })

  it('已过期不显示续费按钮，状态文案为「已过期」', () => {
    const wrapper = mountCard(
      makeSub({ status: 'expired', expires_at: new Date(Date.now() - DAY).toISOString() })
    )
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.text()).toContain(zhCN.subscriptions.status.expired)
  })

  it('status 为 active 但已过期时，同样不给续费按钮（后端状态可能滞后）', () => {
    const wrapper = mountCard(makeSub({ expires_at: new Date(Date.now() - DAY).toISOString() }))
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('已撤销显示「已撤销」文案', () => {
    const wrapper = mountCard(makeSub({ status: 'revoked' }))
    expect(wrapper.text()).toContain(zhCN.subscriptions.status.revoked)
  })

  // 站点关闭订阅购买时充值页不渲染订阅 tab、深链也直接 bail，留着按钮就是死链
  it('canRenew 为 false 时，即便生效中也不给续费按钮（卡片其余内容照常）', () => {
    const wrapper = mountCard(makeSub(), false)
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.text()).toContain('Claude Pro')
    expect(wrapper.text()).toContain(zhCN.subscriptions.status.active)
  })
})

// 后端 dto.Group.RateMultiplier 是 float64 且无 omitempty，恒有值：
// 只判 typeof 等于不过滤，默认倍率会渲染成「倍率：1×」这种噪声
describe('SubscriptionCard：倍率展示', () => {
  it('倍率为默认值 1 时不展示倍率行', () => {
    const wrapper = mountCard(makeSub({ group: { id: 42, name: 'g', rate_multiplier: 1 } }))
    expect(wrapper.text()).not.toContain(zhCN.subscriptions.rate)
  })

  it('倍率非 1 时展示倍率行', () => {
    const wrapper = mountCard(makeSub({ group: { id: 42, name: 'g', rate_multiplier: 1.5 } }))
    expect(wrapper.text()).toContain(`${zhCN.subscriptions.rate}：1.5×`)
  })
})
