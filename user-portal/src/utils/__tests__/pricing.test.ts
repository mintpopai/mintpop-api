import { describe, it, expect } from 'vitest'
import { discountedPrice, formatPrice, featuredIndex } from '@/utils/pricing'
import type { PricingModel } from '@/config/pricing'

describe('discountedPrice（按立减百分比折算实付价）', () => {
  it('立减 5%：$4.00 原价折出 $3.80', () => {
    expect(discountedPrice(4, 5)).toBeCloseTo(3.8, 10)
  })

  it('立减 30%：$1.20 原价折出 $0.84', () => {
    expect(discountedPrice(1.2, 30)).toBeCloseTo(0.84, 10)
  })

  it('立减 0（倍率 1x 的分组）：原价原样返回', () => {
    expect(discountedPrice(0.87, 0)).toBe(0.87)
  })
})

describe('formatPrice（美元两位小数展示）', () => {
  it('补足两位小数：3.8 → $3.80', () => {
    expect(formatPrice(3.8)).toBe('$3.80')
  })

  it('截断多余小数：0.9025 → $0.90', () => {
    expect(formatPrice(0.9025)).toBe('$0.90')
  })

  // toFixed 按 double 的二进制值取整，0.435 的 double 实际略小于 0.435 → 会得到 $0.43，
  // 与定价表/设计稿的 $0.44 对不上。展示价必须与对外公布的定价表逐字一致。
  it('半分位向上进位：0.435 → $0.44', () => {
    expect(formatPrice(0.435)).toBe('$0.44')
  })

  it('半分位向上进位：1.805 → $1.81', () => {
    expect(formatPrice(1.805)).toBe('$1.81')
  })
})

describe('featuredIndex（卡片正面默认展示的模型下标）', () => {
  const models: PricingModel[] = [
    { id: 'kimi-k3', label: 'kimi-k3', fallbackInput: 3, fallbackOutput: 15 },
    { id: 'kimi-k2.7-code', label: 'kimi-k2.7-code', fallbackInput: 0.95, fallbackOutput: 4 }
  ]

  it('featuredId 命中非首位模型时取其下标', () => {
    expect(featuredIndex(models, 'kimi-k2.7-code')).toBe(1)
  })

  it('featuredId 不在清单中时回退首个模型', () => {
    expect(featuredIndex(models, 'kimi-not-exist')).toBe(0)
  })
})
