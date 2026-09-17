import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { createI18n } from 'vue-i18n'
import PricingView from '@/views/PricingView.vue'
import { PRICING_CHANNELS } from '@/config/pricing'
import { featuredIndex } from '@/utils/pricing'
import zhPricing from '@/i18n/locales/zh-CN/pricing'

// mock 定价接口：默认失败（走兜底价），单测里按需覆盖
vi.mock('@/api/pricing', () => ({
  queryModelPricing: vi.fn().mockRejectedValue(new Error('network'))
}))
import { queryModelPricing } from '@/api/pricing'
const mockedQuery = vi.mocked(queryModelPricing)

const OVERSEAS = PRICING_CHANNELS.filter((ch) => ch.tab === 'OVERSEAS')
const OPEN_SOURCE = PRICING_CHANNELS.filter((ch) => ch.tab === 'OPEN_SOURCE')

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

async function mountView() {
  const router = makeRouter()
  router.push('/pricing')
  await router.isReady()
  const wrapper = mount(PricingView, { global: { plugins: [router, i18n] } })
  await flushPromises()
  return wrapper
}

/** 切到「开源模型」tab */
async function switchToOpenSource(wrapper: VueWrapper): Promise<void> {
  const tab = wrapper.findAll('[role="tab"]').find((b) => b.text() === zhPricing.tabOpenSource)
  expect(tab, '找不到开源模型 tab').toBeTruthy()
  await tab!.trigger('click')
}

/** 按卡片可见文案定位某张卡（卡片根节点带 card-surface 类） */
function findCard(wrapper: VueWrapper, text: string) {
  const card = wrapper.findAll('.card-surface').find((c) => c.text().includes(text))
  expect(card, `找不到包含「${text}」的卡片`).toBeTruthy()
  return card!
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

  it('默认落在海外模型 tab，只渲染海外分组的卡片', async () => {
    const wrapper = await mountView()

    expect(wrapper.findAll('.card-surface').length).toBe(OVERSEAS.length)
    for (const ch of OVERSEAS) {
      expect(wrapper.text()).toContain(ch.name)
      // 正面展示的是配置指定的主推模型（海外分组即「最常用」款）
      expect(wrapper.text()).toContain(ch.models[featuredIndex(ch.models, ch.featuredId)].label)
    }
    // 另一个 tab 的分组不该渲染出来
    for (const ch of OPEN_SOURCE) {
      expect(wrapper.text()).not.toContain(ch.featuredId)
    }
  })

  it('切到开源模型 tab 后换成开源分组，正面展示最低价款而非清单首位', async () => {
    const wrapper = await mountView()
    await switchToOpenSource(wrapper)

    expect(wrapper.findAll('.card-surface').length).toBe(OPEN_SOURCE.length)
    // 海外分组已让位
    expect(wrapper.text()).not.toContain('KIRO')

    const kimi = PRICING_CHANNELS.find((ch) => ch.key === 'kimi')!
    const card = findCard(wrapper, `${kimi.name} ${zhPricing.editionOverseas}`)
    // 最低价款 kimi-k2.7-code 排在清单第 2 位：取首位就会显示 kimi-k3，这里必须是最低价款
    expect(card.text()).toContain('kimi-k2.7-code')
    expect(card.text()).not.toContain('kimi-k3')
    // 原价 $0.95/$4.00 立减 5% → $0.90/$3.80
    expect(card.text()).toContain('$0.95')
    expect(card.text()).toContain('$0.90')
    expect(card.text()).toContain('$3.80')
  })

  it('接口失败时按兜底价 × 折扣展示主模型现价', async () => {
    const wrapper = await mountView()

    // claudeCode：Opus 5 兜底原价 $5/$25，立减 75% → $1.25/$6.25
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

  it('立减为 0 的分组不显示立减药丸与划线原价', async () => {
    const wrapper = await mountView()
    await switchToOpenSource(wrapper)

    const mimo = PRICING_CHANNELS.find((ch) => ch.key === 'mimo')!
    expect(mimo.discount, '这条测试以 mimo 是零折扣分组为前提').toBe(0)

    const card = findCard(wrapper, `${mimo.name} ${zhPricing.editionOverseas}`)
    expect(card.text()).not.toContain(zhPricing.discount)
    expect(card.find('.line-through').exists()).toBe(false)
    // 原价 $0.435 需向上进位到 $0.44（toFixed 会给出 $0.43）
    expect(card.text()).toContain('$0.44')
    expect(card.text()).toContain('$0.87')
  })

  it('单模型分组用唯一型号说明替代下拉', async () => {
    const wrapper = await mountView()
    await switchToOpenSource(wrapper)

    const mimo = PRICING_CHANNELS.find((ch) => ch.key === 'mimo')!
    const card = findCard(wrapper, `${mimo.name} ${zhPricing.editionOverseas}`)

    expect(card.find('button[aria-haspopup="listbox"]').exists()).toBe(false)
    expect(card.text()).toContain(
      zhPricing.onlyModel.replace('{model}', mimo.models[0].label)
    )
    expect(card.text()).toContain(zhPricing.unitOne)
  })

  it('下拉框选择模型后切换卡片价格展示', async () => {
    const wrapper = await mountView()

    const first = OVERSEAS[0]
    // 初始：下拉收起，非主模型不可见
    expect(wrapper.text()).not.toContain(first.models[1].label)

    const button = wrapper
      .findAll('button')
      .find((b) =>
        b.text().includes(zhPricing.viewAll.replace('{count}', String(first.models.length)))
      )
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

    // 收起后按钮换成所选型号，否则看不出当前选的是谁
    expect(button!.text()).toContain(picked.label)
  })

  it('同一时刻只允许一个渠道的下拉展开', async () => {
    const wrapper = await mountView()

    const toggles = wrapper.findAll('button[aria-haspopup="listbox"]')
    // 当前 tab 里模型数 > 1 的分组才有下拉
    expect(toggles.length).toBe(OVERSEAS.filter((ch) => ch.models.length > 1).length)

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

  it('展开的下拉在切 tab 后不残留展开态', async () => {
    const wrapper = await mountView()

    await wrapper.findAll('button[aria-haspopup="listbox"]')[0].trigger('click')
    expect(wrapper.findAll('[role="listbox"]').length).toBe(1)

    await switchToOpenSource(wrapper)
    expect(wrapper.findAll('[role="listbox"]').length).toBe(0)
  })
})
