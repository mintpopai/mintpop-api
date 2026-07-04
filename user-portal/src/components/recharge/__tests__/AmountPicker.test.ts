import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import AmountPicker from '../AmountPicker.vue'

// 空消息 + 关闭缺失告警：本用例只关心键盘/DOM 行为，不关心文案内容
const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: false,
  missingWarn: false,
  fallbackWarn: false,
  messages: { 'zh-CN': {}, 'en-US': {} }
})

function mountPicker(modelValue: number | null = 10) {
  return mount(AmountPicker, {
    props: { presets: [10, 20, 30], multiplier: 1, min: 1, modelValue },
    global: { plugins: [i18n] },
    attachTo: document.body
  })
}

describe('AmountPicker：radio group 方向键 + roving tabindex', () => {
  it('初始时选中项 tabindex=0，其余为 -1', () => {
    const wrapper = mountPicker(10)
    const radios = wrapper.findAll('[role="radio"]')
    expect(radios[0].attributes('tabindex')).toBe('0')
    expect(radios[1].attributes('tabindex')).toBe('-1')
    expect(radios[2].attributes('tabindex')).toBe('-1')
    wrapper.unmount()
  })

  it('→ 移动焦点到下一项、选中它并更新 roving tabindex', async () => {
    const wrapper = mountPicker(10)
    const radios = wrapper.findAll('[role="radio"]')
    await radios[0].trigger('keydown', { key: 'ArrowRight' })
    const updated = wrapper.findAll('[role="radio"]')
    expect(updated[0].attributes('tabindex')).toBe('-1')
    expect(updated[1].attributes('tabindex')).toBe('0')
    expect(updated[1].attributes('aria-checked')).toBe('true')
    expect(document.activeElement).toBe(updated[1].element)
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([20])
    wrapper.unmount()
  })

  it('↓ 与 → 行为一致（前进一项）', async () => {
    const wrapper = mountPicker(10)
    const radios = wrapper.findAll('[role="radio"]')
    await radios[0].trigger('keydown', { key: 'ArrowDown' })
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([20])
    wrapper.unmount()
  })

  it('← 在首项时回绕到末项', async () => {
    const wrapper = mountPicker(10)
    const radios = wrapper.findAll('[role="radio"]')
    await radios[0].trigger('keydown', { key: 'ArrowLeft' })
    const updated = wrapper.findAll('[role="radio"]')
    expect(updated[2].attributes('tabindex')).toBe('0')
    expect(document.activeElement).toBe(updated[2].element)
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([30])
    wrapper.unmount()
  })

  it('→ 在末项时回绕到首项', async () => {
    const wrapper = mountPicker(30)
    const radios = wrapper.findAll('[role="radio"]')
    await radios[2].trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([10])
    wrapper.unmount()
  })

  it('既有 Enter/Space 选中交互不受影响', async () => {
    const wrapper = mountPicker(10)
    const radios = wrapper.findAll('[role="radio"]')
    await radios[1].trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([20])
    await radios[2].trigger('keydown', { key: ' ' })
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([30])
    wrapper.unmount()
  })

  it('既有鼠标点击选中交互不受影响', async () => {
    const wrapper = mountPicker(10)
    const radios = wrapper.findAll('[role="radio"]')
    await radios[2].trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([30])
    wrapper.unmount()
  })
})
