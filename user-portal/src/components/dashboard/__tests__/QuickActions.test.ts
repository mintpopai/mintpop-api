import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import QuickActions from '../QuickActions.vue'
import { SHOP_PAGE_URL } from '@/config/portal'

// 空消息 + 关闭缺失告警：本用例只关心站内/外链两种渲染形态，不关心文案内容
const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: false,
  missingWarn: false,
  fallbackWarn: false,
  messages: { 'zh-CN': {}, 'en-US': {} }
})

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

function mountActions() {
  return mount(QuickActions, { global: { plugins: [i18n] } })
}

describe('QuickActions：站内路由项与外链项分别渲染', () => {
  it('MintPop Shop 渲染为新开页外链', () => {
    const wrapper = mountActions()
    const links = wrapper.findAll('a')
    expect(links).toHaveLength(1)
    expect(links[0].attributes('href')).toBe(SHOP_PAGE_URL)
    expect(links[0].attributes('target')).toBe('_blank')
    expect(links[0].attributes('rel')).toContain('noopener')
    wrapper.unmount()
  })

  it('其余三项仍是 button，且不带 href', () => {
    const wrapper = mountActions()
    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(3)
    for (const b of buttons) expect(b.attributes('href')).toBeUndefined()
    wrapper.unmount()
  })

  it('点击站内项走路由跳转，点击外链项不调用 router.push', async () => {
    const wrapper = mountActions()
    push.mockClear()
    await wrapper.findAll('button')[0].trigger('click')
    expect(push).toHaveBeenCalledWith('/keys')

    push.mockClear()
    await wrapper.find('a').trigger('click')
    expect(push).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
