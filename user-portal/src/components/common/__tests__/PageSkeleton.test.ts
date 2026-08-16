// 换页首屏骨架：三种形状各自要占住版面（而不是塌成空白），并对读屏器报告加载中。
// 骨架塌成 0 高度就退化回「白屏 → 内容砸下来」，正是它要消除的跳变，故按块数断言。
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import PageSkeleton from '../PageSkeleton.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: false,
  messages: { 'zh-CN': { common: { loading: '加载中' } } }
})

function mountSkeleton(props: Record<string, unknown> = {}) {
  return mount(PageSkeleton, { props, global: { plugins: [i18n] } })
}

describe('PageSkeleton', () => {
  it('对读屏器报告加载中', () => {
    const wrapper = mountSkeleton()
    expect(wrapper.attributes('role')).toBe('status')
    expect(wrapper.attributes('aria-label')).toBe('加载中')
  })

  it('默认是 cards 形状：主卡 + 4 张指标卡 + 两栏内容', () => {
    const wrapper = mountSkeleton()
    // 主卡 1 + 指标 4 + 两栏 2 = 7 个圆角块
    expect(wrapper.findAll('.rounded-xl3')).toHaveLength(7)
  })

  it('table 形状的行数跟随 rows', () => {
    const wrapper = mountSkeleton({ variant: 'table', rows: 3 })
    // 每行三段占位条
    expect(wrapper.findAll('.bg-track')).toHaveLength(9)
  })

  it('form 形状按 rows 渲染字段行（标签 + 输入框各一）', () => {
    const wrapper = mountSkeleton({ variant: 'form', rows: 4 })
    expect(wrapper.findAll('.bg-track')).toHaveLength(4)
    expect(wrapper.findAll('.rounded-\\[11px\\]')).toHaveLength(4)
  })
})
