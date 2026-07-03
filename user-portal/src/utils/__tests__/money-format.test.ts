import { describe, it, expect } from 'vitest'
import { formatBalance, formatCost, formatCNY, formatTokens, percent, maskApiKey } from '@/utils/format'

describe('金额格式化', () => {
  it('formatBalance：两位小数 + 千分位，非有限值兜底 0', () => {
    expect(formatBalance(1234.5)).toBe('1,234.50')
    expect(formatBalance(0)).toBe('0.00')
    expect(formatBalance(NaN)).toBe('0.00')
    expect(formatBalance(Infinity)).toBe('0.00')
  })

  it('formatCost：四位小数（后端计费精度），非有限值兜底 0', () => {
    expect(formatCost(0.1234)).toBe('0.1234')
    expect(formatCost(2)).toBe('2.0000')
    expect(formatCost(NaN)).toBe('0.0000')
    expect(formatCost(1234.5)).toBe('1,234.5000')
  })

  it('formatCNY：两位小数 + 千分位', () => {
    expect(formatCNY(9876.5)).toBe('9,876.50')
    expect(formatCNY(NaN)).toBe('0.00')
  })
})

describe('formatTokens', () => {
  it('K / M 档位缩写', () => {
    expect(formatTokens(999)).toBe('999')
    expect(formatTokens(1500)).toBe('1.5K')
    expect(formatTokens(2_300_000)).toBe('2.3M')
  })
})

describe('percent', () => {
  it('0-100 夹取，whole 非正返回 0', () => {
    expect(percent(1, 4)).toBe(25)
    expect(percent(5, 4)).toBe(100)
    expect(percent(-1, 4)).toBe(0)
    expect(percent(1, 0)).toBe(0)
  })
})

describe('maskApiKey', () => {
  it('前 6 + … + 后 4；短 key 原样；空值 —', () => {
    expect(maskApiKey('sk-4d2abcdefge32d')).toBe('sk-4d2…e32d')
    expect(maskApiKey('short')).toBe('short')
    expect(maskApiKey(null)).toBe('—')
  })
})
