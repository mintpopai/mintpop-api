import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { createI18n } from 'vue-i18n'
import PricingView from '@/views/PricingView.vue'
import { PRICING_CHANNELS } from '@/config/pricing'
import zhPricing from '@/i18n/locales/zh-CN/pricing'

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/pricing', name: 'Pricing', component: PricingView },
      { path: '/recharge', name: 'Recharge', component: { template: '<div/>' } }
    ]
  })
}

// 用真实 zh-CN 词条，保证断言的是用户可见文案而非键名
const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: { 'zh-CN': { pricing: zhPricing } }
})

// PortalLayout 依赖全局导航/store，与本页无关，stub 成透传插槽
const stubs = { PortalLayout: { template: '<div><slot /></div>' } }

describe('PricingView', () => {
  it('页头渲染指向 /recharge 的充值按钮', async () => {
    const router = makeRouter()
    router.push('/pricing')
    await router.isReady()
    const wrapper = mount(PricingView, { global: { plugins: [router, i18n], stubs } })

    const link = wrapper.find('a[href="/recharge"]')
    expect(link.exists()).toBe(true)
    expect(link.text()).toContain(zhPricing.recharge)
  })

  it('渲染全部渠道卡片', async () => {
    const router = makeRouter()
    router.push('/pricing')
    await router.isReady()
    const wrapper = mount(PricingView, { global: { plugins: [router, i18n], stubs } })

    for (const ch of PRICING_CHANNELS) {
      expect(wrapper.text()).toContain(ch.name)
    }
  })
})
