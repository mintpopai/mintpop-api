// 套餐卡片补齐的四条契约：
// 1. 已有该分组的生效订阅时按钮必须显示「续费」——显示「选择此套餐」会让用户以为要重新买一份；
// 2. 折扣徽章只在真有折扣时出现，且百分比算对；
// 3. 三个额度上限皆空时显示「不限额度」，不能整块消失；
// 4. 深链高亮只命中目标分组的那张卡。
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import type { SubscriptionPlan } from '@/api/types'
import SubscriptionPlans from '../SubscriptionPlans.vue'
import zhCN from '@/i18n/locales/zh-CN'

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: false,
  missingWarn: false,
  fallbackWarn: false,
  messages: { 'zh-CN': zhCN }
})

function makePlan(over: Partial<SubscriptionPlan> = {}): SubscriptionPlan {
  return {
    id: 1,
    group_id: 42,
    group_name: 'Claude Pro',
    group_platform: 'anthropic',
    name: '月卡',
    price: 20,
    validity_days: 30,
    ...over
  }
}

function mountPlans(plans: SubscriptionPlan[], extra: Record<string, unknown> = {}) {
  return mount(SubscriptionPlans, {
    props: { plans, ...extra },
    global: { plugins: [i18n] }
  })
}

describe('SubscriptionPlans', () => {
  it('无生效订阅时按钮为「选择此套餐」', () => {
    const wrapper = mountPlans([makePlan()])
    expect(wrapper.find('button').text()).toBe(zhCN.recharge.selectPlan)
  })

  it('该分组已有生效订阅时按钮变「续费此套餐」', () => {
    const wrapper = mountPlans([makePlan()], { activeGroupIds: [42] })
    expect(wrapper.find('button').text()).toBe(zhCN.recharge.renewPlan)
  })

  it('有原价时展示折扣徽章，百分比按四舍五入算', () => {
    const wrapper = mountPlans([makePlan({ price: 15, original_price: 20 })])
    expect(wrapper.text()).toContain('-25%')
  })

  it('无原价时不展示折扣徽章', () => {
    const wrapper = mountPlans([makePlan()])
    expect(wrapper.text()).not.toMatch(/-\d+%/)
  })

  it('三个额度上限皆空时展示「不限额度」', () => {
    const wrapper = mountPlans([makePlan()])
    expect(wrapper.text()).toContain(zhCN.recharge.unlimitedQuota)
  })

  it('配了额度上限时不展示「不限额度」', () => {
    const wrapper = mountPlans([makePlan({ daily_limit_usd: 10 })])
    expect(wrapper.text()).not.toContain(zhCN.recharge.unlimitedQuota)
  })

  it('高亮只命中目标分组的卡片', () => {
    const wrapper = mountPlans(
      [makePlan({ id: 1, group_id: 42 }), makePlan({ id: 2, group_id: 43 })],
      { highlightGroupId: 43 }
    )
    const cards = wrapper.findAll('[data-plan-group]')
    expect(cards[0].classes()).not.toContain('ring-accent')
    expect(cards[1].classes()).toContain('ring-accent')
  })

  it('点击按钮抛出对应套餐', async () => {
    const plan = makePlan()
    const wrapper = mountPlans([plan])
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('subscribe')?.at(-1)).toEqual([plan])
  })
})
