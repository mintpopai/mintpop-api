// 密钥表分组徽标的专属倍率契约（与 frontend GroupBadge 口径一致）：
// 1. 用户对该分组有专属倍率且与默认不同 → 原倍率删除线 + 专属倍率高亮；
// 2. 专属倍率与默认相同 → 视为无专属，只展示默认倍率（删除线对比是噪声）；
// 3. 未传 groupRates（或该分组无专属）→ 保持原有的默认倍率展示。
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import KeyTable from '../KeyTable.vue'
import type { ApiKey } from '@/api/types'

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: false,
  missingWarn: false,
  fallbackWarn: false,
  messages: { 'zh-CN': {}, 'en-US': {} }
})

function makeKey(over: Partial<ApiKey> = {}): ApiKey {
  return {
    id: 1,
    user_id: 1,
    key: 'sk-test-1234567890',
    name: '测试密钥',
    group_id: 42,
    status: 'active',
    quota: 0,
    quota_used: 0,
    last_used_at: null,
    expires_at: null,
    created_at: '2026-08-01T00:00:00Z',
    rate_limit_1d: 0,
    group: { id: 42, name: '标准分组', platform: 'anthropic', rate_multiplier: 1.5 },
    ...over
  }
}

function mountTable(rows: ApiKey[], groupRates?: Record<number, number>) {
  return mount(KeyTable, {
    props: { rows, usage: {}, groupRates },
    global: { plugins: [i18n] }
  })
}

describe('KeyTable：分组徽标专属倍率', () => {
  it('有专属倍率且与默认不同：原倍率删除线 + 专属倍率高亮', () => {
    const wrapper = mountTable([makeKey()], { 42: 0.8 })
    const struck = wrapper.find('.line-through')
    expect(struck.exists()).toBe(true)
    expect(struck.text()).toBe('1.5x')
    expect(wrapper.text()).toContain('0.8x')
    wrapper.unmount()
  })

  it('专属倍率与默认相同：不展示删除线，只显示默认倍率', () => {
    const wrapper = mountTable([makeKey()], { 42: 1.5 })
    expect(wrapper.find('.line-through').exists()).toBe(false)
    expect(wrapper.text()).toContain('1.5x')
    wrapper.unmount()
  })

  it('未传 groupRates：保持默认倍率展示', () => {
    const wrapper = mountTable([makeKey()])
    expect(wrapper.find('.line-through').exists()).toBe(false)
    expect(wrapper.text()).toContain('1.5x')
    wrapper.unmount()
  })

  it('分组默认倍率缺失时按 1 比较：专属 0.8 仍展示删除线对比', () => {
    const wrapper = mountTable(
      [makeKey({ group: { id: 42, name: '标准分组', platform: 'anthropic' } })],
      { 42: 0.8 }
    )
    const struck = wrapper.find('.line-through')
    expect(struck.exists()).toBe(true)
    expect(struck.text()).toBe('1x')
    expect(wrapper.text()).toContain('0.8x')
    wrapper.unmount()
  })
})
