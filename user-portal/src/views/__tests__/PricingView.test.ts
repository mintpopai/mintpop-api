import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { createI18n } from 'vue-i18n'
import PricingView from '@/views/PricingView.vue'
import { PRICING_CHANNELS } from '@/config/pricing'
import zhPricing from '@/i18n/locales/zh-CN/pricing'

// mock 定价接口：默认失败（走兜底价），单测里按需覆盖
vi.mock('@/api/pricing', () => ({
  queryModelPricing: vi.fn().mockRejectedValue(new Error('network'))
}))
import { queryModelPricing } from '@/api/pricing'
const mockedQuery = vi.mocked(queryModelPricing)

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

async function mountView() {
  const router = makeRouter()
  router.push('/pricing')
  await router.isReady()
  const wrapper = mount(PricingView, { global: { plugins: [router, i18n], stubs } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  mockedQuery.mockReset()
  mockedQuery.mockRejectedValue(new Error('network'))
})

describe('PricingView', () => {
  it('页头渲染指向 /recharge 的充值按钮', async () => {
    const wrapper = await mountView()

    const link = wrapper.find('a[href="/recharge"]')
    expect(link.exists()).toBe(true)
    expect(link.text()).toContain(zhPricing.recharge)
  })

  it('渲染全部渠道卡片，正面展示最常用主模型', async () => {
    const wrapper = await mountView()

    for (const ch of PRICING_CHANNELS) {
      expect(wrapper.text()).toContain(ch.name)
      expect(wrapper.text()).toContain(ch.models[0].label)
    }
  })

  it('接口失败时按兜底价 × 折扣展示主模型现价', async () => {
    const wrapper = await mountView()

    // claudeCode：Opus 4.8 兜底原价 $5/$25，立减 75% → $1.25/$6.25
    expect(wrapper.text()).toContain('$5.00')
    expect(wrapper.text()).toContain('$1.25')
    expect(wrapper.text()).toContain('$6.25')
  })

  it('接口成功时用实时原价折算现价', async () => {
    // 模拟后端返回主模型 Opus 5 原价 $10/$50（每百万 tokens）
    mockedQuery.mockResolvedValue(new Map([['claude-opus-5', { input: 10, output: 50 }]]))
    const wrapper = await mountView()

    // claudeCode 立减 75% → $2.50/$12.50
    expect(wrapper.text()).toContain('$10.00')
    expect(wrapper.text()).toContain('$2.50')
    expect(wrapper.text()).toContain('$12.50')
    // 未返回实时价的模型（如 gpt-5.5）仍走兜底价：$5 × 20% = $1.00
    expect(wrapper.text()).toContain('$1.00')
  })

  it('下拉框选择模型后切换卡片价格展示', async () => {
    const wrapper = await mountView()

    const first = PRICING_CHANNELS[0]
    // 初始：下拉收起，非主模型不可见
    expect(wrapper.text()).not.toContain(first.models[1].label)

    const button = wrapper
      .findAll('button')
      .find((b) => b.text().includes(zhPricing.viewAll.replace('{count}', String(first.models.length))))
    expect(button).toBeTruthy()
    await button!.trigger('click')

    // 下拉打开：渠道内全部模型选项可见
    for (const m of first.models) {
      expect(wrapper.text()).toContain(m.label)
    }

    // 选择 Sonnet 5（价格区别于主模型：兜底原价 $2/$10，立减 75% → $0.50/$2.50）
    const picked = first.models.find((m) => m.label === 'Sonnet 5')!
    const option = wrapper
      .findAll('button[role="option"]')
      .find((b) => b.text().includes(picked.label))
    expect(option).toBeTruthy()
    await option!.trigger('click')

    // 下拉已收起（其余模型不可见），卡片主价格切换为所选模型
    expect(wrapper.text()).not.toContain(first.models[1].label)
    expect(wrapper.text()).toContain(picked.label)
    expect(wrapper.text()).toContain('$2.00')
    expect(wrapper.text()).toContain('$0.50')

    // 「最常用」前缀只属于主模型，切换后卡片副标题不再带它…（但其它三张卡仍是主模型，全文含前缀，
    // 故这里断言按钮文案变为所选型号，而非默认的「查看全部」）
    expect(button!.text()).toContain(picked.label)
  })

  it('同一时刻只允许一个渠道的下拉展开', async () => {
    const wrapper = await mountView()

    const toggles = wrapper.findAll('button[aria-haspopup="listbox"]')
    expect(toggles.length).toBe(PRICING_CHANNELS.length)

    await toggles[0].trigger('click')
    expect(wrapper.findAll('[role="listbox"]').length).toBe(1)
    expect(toggles[0].attributes('aria-expanded')).toBe('true')

    // 点另一张卡的下拉：前一个必须收起，否则两个浮层会互相遮挡、看着像布局错乱
    await toggles[1].trigger('click')
    expect(wrapper.findAll('[role="listbox"]').length).toBe(1)
    expect(toggles[0].attributes('aria-expanded')).toBe('false')
    expect(toggles[1].attributes('aria-expanded')).toBe('true')

    // 再点自己：收起，不残留展开态
    await toggles[1].trigger('click')
    expect(wrapper.findAll('[role="listbox"]').length).toBe(0)
  })
})
