import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import InviteShareBox from '../InviteShareBox.vue'
import zhInvite from '@/i18n/locales/zh-CN/invite'

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: false,
  missingWarn: false,
  fallbackWarn: false,
  messages: { 'zh-CN': { invite: zhInvite }, 'en-US': {} }
})

const writeText = vi.fn().mockResolvedValue(undefined)

beforeEach(() => {
  writeText.mockClear()
  // jsdom 无 clipboard，注入 stub 供 useCopy 使用
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true
  })
})

function mountBox(affCode = 'PB5H7FJVXHLR') {
  return mount(InviteShareBox, {
    props: { affCode },
    global: { plugins: [i18n] }
  })
}

describe('InviteShareBox：邀请码 + 邀请链接 + 复制', () => {
  it('渲染邀请码原文与基于当前 origin 的 ?aff= 邀请链接', () => {
    const wrapper = mountBox()
    expect(wrapper.text()).toContain('PB5H7FJVXHLR')
    expect(wrapper.text()).toContain(`${window.location.origin}/register?aff=PB5H7FJVXHLR`)
    wrapper.unmount()
  })

  it('邀请码含特殊字符时链接经过 URL 编码', () => {
    const wrapper = mountBox('A&B')
    expect(wrapper.text()).toContain('/register?aff=A%26B')
    wrapper.unmount()
  })

  it('点击「复制」写入剪贴板并短暂显示「已复制」，两个按钮互不影响', async () => {
    const wrapper = mountBox()
    const [codeBtn, linkBtn] = wrapper.findAll('button')

    await codeBtn.trigger('click')
    expect(writeText).toHaveBeenCalledWith('PB5H7FJVXHLR')
    expect(codeBtn.text()).toBe('已复制')
    expect(linkBtn.text()).toBe('复制')

    await linkBtn.trigger('click')
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/register?aff=PB5H7FJVXHLR`)
    expect(linkBtn.text()).toBe('已复制')
    expect(codeBtn.text()).toBe('复制')
    wrapper.unmount()
  })
})
