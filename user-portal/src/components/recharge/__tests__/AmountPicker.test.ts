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

describe('AmountPicker：预设 / 自定义 / 外部 v-model 三态同步', () => {
  it('输入合法自定义金额：v-model 更新为该值，预设高亮取消', async () => {
    const wrapper = mountPicker(10)
    await wrapper.find('input').setValue('42.5')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([42.5])
    // 自定义模式下所有预设都不再 aria-checked
    for (const r of wrapper.findAll('[role="radio"]')) {
      expect(r.attributes('aria-checked')).toBe('false')
    }
    wrapper.unmount()
  })

  it('清空自定义输入：回退到上次选中的预设', async () => {
    const wrapper = mountPicker(10)
    const input = wrapper.find('input')
    await input.setValue('42.5')
    await input.setValue('')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([10])
    wrapper.unmount()
  })

  it('外部改 v-model 为非预设值：视为自定义，输入框回显该值', async () => {
    const wrapper = mountPicker(10)
    await wrapper.setProps({ modelValue: 77 })
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('77')
    wrapper.unmount()
  })

  it('外部改 v-model 为预设值：高亮同步到该预设', async () => {
    const wrapper = mountPicker(10)
    await wrapper.setProps({ modelValue: 30 })
    expect(wrapper.findAll('[role="radio"]')[2].attributes('aria-checked')).toBe('true')
    wrapper.unmount()
  })
})

describe('AmountPicker：金额范围校验提示', () => {
  function mountWithMin(modelValue: number | null, min: number) {
    return mount(AmountPicker, {
      props: { presets: [10, 20, 30], multiplier: 1, min, modelValue },
      global: { plugins: [i18n] }
    })
  }

  it('自定义金额低于下限时展示下限提示', async () => {
    const wrapper = mountWithMin(10, 15)
    await wrapper.find('input').setValue('3')
    expect(wrapper.text()).toContain('recharge.minAmount')
    wrapper.unmount()
  })

  it('选中的预设低于管理端下限时同样展示下限提示（不能只对自定义输入生效，否则按钮置灰无解释）', () => {
    // min=15 > 预设 10：选中 $10 档时用户必须被告知为什么不能提交
    const wrapper = mountWithMin(10, 15)
    expect(wrapper.text()).toContain('recharge.minAmount')
    wrapper.unmount()
  })
})
