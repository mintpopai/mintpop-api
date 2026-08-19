import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import CreateKeyModal from '../CreateKeyModal.vue'
import type { Group } from '@/api/types'

// 空消息 + 关闭缺失告警：本用例只关心表单行为，不关心文案内容
const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: false,
  missingWarn: false,
  fallbackWarn: false,
  messages: { 'zh-CN': {}, 'en-US': {} }
})

const groups: Group[] = [
  { id: 1, name: '分组A' },
  { id: 2, name: '分组B' }
]

function mountModal(extra: { groups?: Group[]; groupRates?: Record<number, number> } = {}) {
  return mount(CreateKeyModal, {
    props: { open: true, groups, ...extra },
    global: {
      plugins: [i18n],
      // Modal 内容 Teleport 到 body，stub 掉让内容留在组件树内可查
      stubs: { Teleport: true }
    }
  })
}

function submitButton(wrapper: ReturnType<typeof mountModal>) {
  // footer 里第二个按钮是提交（第一个是取消）
  const buttons = wrapper.findAll('button')
  return buttons[buttons.length - 1]
}

describe('CreateKeyModal：分组必填（与 frontend 语义对齐）', () => {
  it('分组下拉不提供可选的「不指定分组」：占位项 disabled、真实分组可选', () => {
    const wrapper = mountModal()
    const options = wrapper.findAll('select option')
    // 首项为占位（value 为空、disabled），其余为真实分组
    expect(options).toHaveLength(3)
    expect(options[0].attributes('disabled')).toBeDefined()
    expect(options[1].attributes('disabled')).toBeUndefined()
    expect(options[2].attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('填了名称但未选分组：提交按钮禁用，点击也不发 submit', async () => {
    const wrapper = mountModal()
    await wrapper.find('input[type="text"]').setValue('生产环境')
    const btn = submitButton(wrapper)
    expect(btn.attributes('disabled')).toBeDefined()
    await btn.trigger('click')
    expect(wrapper.emitted('submit')).toBeUndefined()
    wrapper.unmount()
  })

  it('名称回车提交同样被分组必填拦截', async () => {
    const wrapper = mountModal()
    const nameInput = wrapper.find('input[type="text"]')
    await nameInput.setValue('生产环境')
    await nameInput.trigger('keydown.enter')
    expect(wrapper.emitted('submit')).toBeUndefined()
    wrapper.unmount()
  })

  it('分组选项带生效倍率：专属倍率优先于分组默认倍率，无倍率信息只显示名称', () => {
    const wrapper = mountModal({
      groups: [
        { id: 1, name: '分组A', rate_multiplier: 1.5 },
        { id: 2, name: '分组B', rate_multiplier: 2 },
        { id: 3, name: '分组C' }
      ],
      // 分组A 有专属倍率 0.8 → 生效倍率取专属
      groupRates: { 1: 0.8 }
    })
    const options = wrapper.findAll('select option')
    expect(options[1].text()).toBe('分组A（0.8x）')
    expect(options[2].text()).toBe('分组B（2x）')
    expect(options[3].text()).toBe('分组C')
    wrapper.unmount()
  })

  it('选定分组后可提交，payload 始终携带所选 group_id', async () => {
    const wrapper = mountModal()
    await wrapper.find('input[type="text"]').setValue('生产环境')
    await wrapper.find('select').setValue(2)
    const btn = submitButton(wrapper)
    expect(btn.attributes('disabled')).toBeUndefined()
    await btn.trigger('click')
    const emitted = wrapper.emitted('submit')
    expect(emitted).toHaveLength(1)
    expect(emitted![0][0]).toMatchObject({ name: '生产环境', group_id: 2 })
    wrapper.unmount()
  })
})
