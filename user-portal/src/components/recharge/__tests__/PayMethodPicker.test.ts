import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import PayMethodPicker from '../PayMethodPicker.vue'
import type { PayOption } from '@/config/payMethods'

// 空消息 + 关闭缺失告警：本用例只关心键盘/DOM 行为，不关心文案内容
const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: false,
  missingWarn: false,
  fallbackWarn: false,
  messages: { 'zh-CN': {}, 'en-US': {} }
})

// 拍平后的典型选项列表（Stripe 展开为微信/支付宝/银行卡）
const OPTIONS: PayOption[] = [
  { key: 'stripe:wxpay', paymentType: 'stripe', subMethod: 'wxpay', limitsKey: 'stripe' },
  { key: 'stripe:alipay', paymentType: 'stripe', subMethod: 'alipay', limitsKey: 'stripe' },
  { key: 'stripe:card', paymentType: 'stripe', subMethod: 'card', limitsKey: 'stripe' }
]

function mountPicker(modelValue = 'stripe:wxpay') {
  return mount(PayMethodPicker, {
    props: {
      options: OPTIONS,
      modelValue
    },
    global: { plugins: [i18n] },
    attachTo: document.body
  })
}

describe('PayMethodPicker：radio group 方向键 + roving tabindex', () => {
  it('初始时选中项 tabindex=0，其余为 -1', () => {
    const wrapper = mountPicker('stripe:wxpay')
    const radios = wrapper.findAll('[role="radio"]')
    expect(radios[0].attributes('tabindex')).toBe('0')
    expect(radios[1].attributes('tabindex')).toBe('-1')
    expect(radios[2].attributes('tabindex')).toBe('-1')
    wrapper.unmount()
  })

  it('→ 移动焦点到下一项、选中它并更新 roving tabindex', async () => {
    const wrapper = mountPicker('stripe:wxpay')
    const radios = wrapper.findAll('[role="radio"]')
    await radios[0].trigger('keydown', { key: 'ArrowRight' })
    const updated = wrapper.findAll('[role="radio"]')
    expect(updated[0].attributes('tabindex')).toBe('-1')
    expect(updated[1].attributes('tabindex')).toBe('0')
    expect(updated[1].attributes('aria-checked')).toBe('true')
    expect(document.activeElement).toBe(updated[1].element)
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['stripe:alipay'])
    wrapper.unmount()
  })

  it('← 在首项时回绕到末项', async () => {
    const wrapper = mountPicker('stripe:wxpay')
    const radios = wrapper.findAll('[role="radio"]')
    await radios[0].trigger('keydown', { key: 'ArrowUp' })
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['stripe:card'])
    wrapper.unmount()
  })

  it('既有 Enter/Space/鼠标点击选中交互不受影响', async () => {
    const wrapper = mountPicker('stripe:wxpay')
    const radios = wrapper.findAll('[role="radio"]')
    await radios[1].trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['stripe:alipay'])
    await radios[2].trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['stripe:card'])
    wrapper.unmount()
  })
})
