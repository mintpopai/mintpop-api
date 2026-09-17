import { describe, it, expect } from 'vitest'
import { PRICING_CHANNELS } from '@/config/pricing'
import { featuredIndex } from '@/utils/pricing'

describe('PRICING_CHANNELS 分组数据自洽性', () => {
  it('分组 key 全局唯一（key 用作下拉开合与选中态的索引，重复会串卡片）', () => {
    const keys = PRICING_CHANNELS.map((ch) => ch.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('每组模型 ID 组内唯一', () => {
    for (const ch of PRICING_CHANNELS) {
      const ids = ch.models.map((m) => m.id)
      expect(new Set(ids).size, `分组 ${ch.key} 存在重复模型 ID`).toBe(ids.length)
    }
  })

  it('每组都非空且 featuredId 命中组内模型（回退到首个即说明数据写错）', () => {
    for (const ch of PRICING_CHANNELS) {
      expect(ch.models.length, `分组 ${ch.key} 没有模型`).toBeGreaterThan(0)
      expect(
        ch.models.some((m) => m.id === ch.featuredId),
        `分组 ${ch.key} 的 featuredId=${ch.featuredId} 不在模型清单里`
      ).toBe(true)
    }
  })

  it('立减百分比落在 0–100', () => {
    for (const ch of PRICING_CHANNELS) {
      expect(ch.discount, `分组 ${ch.key} 立减越界`).toBeGreaterThanOrEqual(0)
      expect(ch.discount, `分组 ${ch.key} 立减越界`).toBeLessThanOrEqual(100)
    }
  })

  it('标记 LOWEST_PRICE 的分组，正面模型确实是组内输入价最低的', () => {
    const groups = PRICING_CHANNELS.filter((ch) => ch.featuredTag === 'LOWEST_PRICE')
    expect(groups.length, '没有任何分组标记最低价').toBeGreaterThan(0)
    for (const ch of groups) {
      const featured = ch.models[featuredIndex(ch.models, ch.featuredId)]
      const cheapest = Math.min(...ch.models.map((m) => m.fallbackInput))
      expect(featured.fallbackInput, `分组 ${ch.key} 标了最低价但正面模型不是最便宜的`).toBe(cheapest)
    }
  })

  it('每个分组都配了头像字母与底色（卡片统一白底，品牌辨识全靠头像）', () => {
    for (const ch of PRICING_CHANNELS) {
      expect(ch.avatar, `分组 ${ch.key} 缺头像字母`).toBeTruthy()
      expect(ch.avatarBg, `分组 ${ch.key} 缺头像底色`).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })

  it('海外模型 4 组、开源模型 7 组', () => {
    const count = (tab: string) => PRICING_CHANNELS.filter((ch) => ch.tab === tab).length
    expect(count('OVERSEAS')).toBe(4)
    expect(count('OPEN_SOURCE')).toBe(7)
  })
})
