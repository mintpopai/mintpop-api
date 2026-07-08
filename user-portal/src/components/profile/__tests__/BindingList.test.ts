import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import i18n from '@/i18n'
import BindingList from '../BindingList.vue'
import type { User, PublicSettings } from '@/api/types'

function settings(overrides: Partial<PublicSettings> = {}): PublicSettings {
  return {
    linuxdo_oauth_enabled: true,
    dingtalk_oauth_enabled: false,
    oidc_oauth_enabled: true,
    oidc_oauth_provider_name: 'MintPop',
    wechat_oauth_enabled: false,
    ...overrides
  } as PublicSettings
}

function user(overrides: Partial<User> = {}): User {
  return {
    email: 'a@b.com',
    linuxdo_bound: true,
    oidc_bound: true,
    ...overrides
  } as User
}

function mountList(u: User, s: PublicSettings) {
  return mount(BindingList, { props: { user: u, settings: s }, global: { plugins: [i18n] } })
}

/** 按文案精确匹配「解绑」按钮 */
function unbindButtons(wrapper: ReturnType<typeof mountList>) {
  return wrapper.findAll('button').filter((b) => b.text() === '解绑')
}

describe('BindingList：统一登录（OIDC）不可解绑', () => {
  it('OIDC 已绑定时不渲染解绑按钮（唯一登录凭证，解绑即锁死）', () => {
    const wrapper = mountList(user({ oidc_bound: true, linuxdo_bound: false }), settings())
    expect(unbindButtons(wrapper)).toHaveLength(0)
    // 但仍显示「已绑定」标签
    expect(wrapper.text()).toContain('已绑定')
    expect(wrapper.text()).toContain('MintPop')
  })

  it('其它渠道（LinuxDo）已绑定时照常可解绑，不受影响', () => {
    const wrapper = mountList(user({ oidc_bound: true, linuxdo_bound: true }), settings())
    // 两个渠道都已绑定，但只有 LinuxDo 出解绑按钮 → 恰好 1 个
    expect(unbindButtons(wrapper)).toHaveLength(1)
  })

  it('OIDC 未绑定时仍显示绑定按钮（只取消解绑，不取消绑定）', () => {
    const wrapper = mountList(user({ oidc_bound: false, linuxdo_bound: false }), settings())
    const bindButtons = wrapper.findAll('button').filter((b) => b.text() === '绑定')
    expect(bindButtons.length).toBeGreaterThanOrEqual(1)
    expect(unbindButtons(wrapper)).toHaveLength(0)
  })
})
