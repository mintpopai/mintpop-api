import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import HeroBalance from '../HeroBalance.vue'
import { SHOP_PAGE_URL } from '@/config/portal'

// 空消息 + 关闭缺失告警：本用例只关心角标的渲染与存在性，不关心文案内容
const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: false,
  missingWarn: false,
  fallbackWarn: false,
  messages: { 'zh-CN': {}, 'en-US': {} }
})

function mountHero(inviteRatePercent: number | null) {
  return mount(HeroBalance, {
    props: { balance: 70, todayCost: 0, inviteRatePercent },
    global: { plugins: [i18n], stubs: { RouterLink: true } }
  })
}

describe('HeroBalance 角标区', () => {
  it('MintPop Shop 角标渲染为新开页外链，并带无障碍关联的说明', () => {
    const wrapper = mountHero(20)
    const shop = wrapper.get(`a[href="${SHOP_PAGE_URL}"]`)
    expect(shop.attributes('target')).toBe('_blank')
    expect(shop.attributes('rel')).toContain('noopener')
    expect(shop.attributes('aria-describedby')).toBe('hero-shop-hint')
    expect(wrapper.find('#hero-shop-hint').exists()).toBe(true)
    wrapper.unmount()
  })

  it('邀请返利开启时两个角标并存', () => {
    const wrapper = mountHero(20)
    expect(wrapper.find(`a[href="${SHOP_PAGE_URL}"]`).exists()).toBe(true)
    expect(wrapper.find('router-link-stub[to="/invite"]').exists()).toBe(true)
    wrapper.unmount()
  })

  // 关键回归点：邀请返利是条件渲染，商店角标不能因它缺席而错位
  it('邀请返利关闭时商店角标仍在，且与充值按钮同属一个 flex 角标容器', () => {
    const wrapper = mountHero(null)
    expect(wrapper.find('router-link-stub[to="/invite"]').exists()).toBe(false)

    const shop = wrapper.get(`a[href="${SHOP_PAGE_URL}"]`)
    // 商店角标自身不做绝对定位，定位由外层角标容器统一负责
    expect(shop.classes().join(' ')).not.toContain('absolute')
    const badgeRow = shop.element.closest('.absolute')
    expect(badgeRow).not.toBeNull()
    expect(badgeRow!.className).toContain('flex')
    wrapper.unmount()
  })
})
