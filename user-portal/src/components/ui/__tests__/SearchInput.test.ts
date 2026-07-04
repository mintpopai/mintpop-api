import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import SearchInput from '../SearchInput.vue'

// 空消息 + 关闭缺失告警：本用例只关心 DOM 结构/交互行为，不关心文案内容
const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: false,
  missingWarn: false,
  fallbackWarn: false,
  messages: { 'zh-CN': {}, 'en-US': {} }
})

function mountSearchInput(modelValue = '') {
  return mount(SearchInput, {
    props: { modelValue, placeholder: '搜索…' },
    global: { plugins: [i18n] }
  })
}

describe('SearchInput：放大镜图标 + input', () => {
  it('渲染放大镜 SVG 与 input，placeholder/aria-label 取自 prop', () => {
    const wrapper = mountSearchInput()
    expect(wrapper.find('svg').exists()).toBe(true)
    const input = wrapper.find('input')
    expect(input.exists()).toBe(true)
    expect(input.attributes('placeholder')).toBe('搜索…')
    expect(input.attributes('aria-label')).toBe('搜索…')
    wrapper.unmount()
  })

  it('输入时触发 update:modelValue（defineModel 双向绑定）', async () => {
    const wrapper = mountSearchInput('')
    const input = wrapper.find('input')
    await input.setValue('abc')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['abc'])
    wrapper.unmount()
  })

  it('原生 change（失焦/回车）时转发 change 事件，供 KeysView 触发服务端重新拉取', async () => {
    const wrapper = mountSearchInput('')
    const input = wrapper.find('input')
    await input.trigger('change')
    expect(wrapper.emitted('change')).toBeTruthy()
    wrapper.unmount()
  })

  it('class 经默认 attrs 透传合并到根容器（供页面控制宽度等布局类）', () => {
    const wrapper = mount(SearchInput, {
      props: { modelValue: '', placeholder: '搜索…' },
      attrs: { class: 'max-w-[340px] flex-1' },
      global: { plugins: [i18n] }
    })
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['relative', 'max-w-[340px]', 'flex-1']))
    wrapper.unmount()
  })

  it('inputClass 原样应用到 input 元素（不内置默认样式，保证两处历史外观互不影响）', () => {
    const wrapper = mount(SearchInput, {
      props: { modelValue: '', placeholder: '搜索…', inputClass: 'input-base py-[11px]' },
      global: { plugins: [i18n] }
    })
    const input = wrapper.find('input')
    expect(input.classes()).toEqual(expect.arrayContaining(['input-base', 'py-[11px]']))
    wrapper.unmount()
  })

  it('默认插槽渲染在 input 之后、仍处于同一个 relative 容器内（供绝对定位的提示文案）', () => {
    const wrapper = mount(SearchInput, {
      props: { modelValue: '', placeholder: '搜索…' },
      slots: { default: '<p class="hint">仅过滤当前页</p>' },
      global: { plugins: [i18n] }
    })
    expect(wrapper.find('.relative > .hint').exists()).toBe(true)
    wrapper.unmount()
  })
})
