import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import ToastHost from '../ToastHost.vue'
import { useToast } from '@/composables/useToast'

// 空消息 + 关闭缺失告警：本用例只关心关闭交互与可达性，不关心文案内容
const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: false,
  missingWarn: false,
  fallbackWarn: false,
  messages: { 'zh-CN': {}, 'en-US': {} }
})

function mountHost(): VueWrapper {
  return mount(ToastHost, { global: { plugins: [i18n] } })
}

describe('ToastHost：关闭交互可达性', () => {
  beforeEach(() => {
    // 假计时器：避免 3s 自动消失与断言竞态；useToast 是模块级单例，先清空残留队列
    vi.useFakeTimers()
    const { toasts, dismiss } = useToast()
    for (const t of [...toasts.value]) dismiss(t.id)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('渲染真 <button> 关闭钮：带 aria-label，默认 sr-only 视觉隐藏', async () => {
    const wrapper = mountHost()
    useToast().success('hello')
    await nextTick()
    const btn = wrapper.find('button')
    expect(btn.exists()).toBe(true)
    expect(btn.attributes('aria-label')).toBeDefined()
    // 默认视觉隐藏（不改变改动前的默认渲染），仅键盘聚焦时由 focus-visible:not-sr-only 显现
    expect(btn.classes()).toContain('sr-only')
    wrapper.unmount()
  })

  it('点击关闭钮移除 toast', async () => {
    const wrapper = mountHost()
    useToast().success('hello')
    await nextTick()
    await wrapper.find('button').trigger('click')
    expect(wrapper.findAll('[role="status"]')).toHaveLength(0)
    wrapper.unmount()
  })

  it('既有「点击整条 toast 关闭」的鼠标交互不受影响', async () => {
    const wrapper = mountHost()
    useToast().error('oops')
    await nextTick()
    await wrapper.find('[role="status"]').trigger('click')
    expect(wrapper.findAll('[role="status"]')).toHaveLength(0)
    wrapper.unmount()
  })
})
