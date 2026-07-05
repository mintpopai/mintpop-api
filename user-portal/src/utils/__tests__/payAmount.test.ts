// 应付金额两件套的契约测试：
// - estimatePayAmount：前端预估口径必须与后端 payment.CalculatePayAmountForCurrency 一致
//   （fee = amount × rate / 100，rate 是「百分数」而非小数；手续费向上取整到分）
// - formatPayAmount：按订单币种格式化（订单币种由支付实例决定，不能硬编码 ¥）
import { describe, it, expect } from 'vitest'
import { estimatePayAmount, formatPayAmount } from '@/utils/format'

describe('estimatePayAmount（对齐后端 fee.go：百分数费率 + 手续费向上取整到分）', () => {
  it('费率 5（=5%）：$10 → $10.50，而不是把 5 当小数算成 $60', () => {
    expect(estimatePayAmount(10, 5)).toBe(10.5)
  })

  it('费率 0 或负数：原额返回（后端 feeRate<=0 分支）', () => {
    expect(estimatePayAmount(10, 0)).toBe(10)
    expect(estimatePayAmount(10, -1)).toBe(10)
  })

  it('手续费向上取整到分：$9.99 × 1% = 0.0999 → $0.10，应付 $10.09', () => {
    expect(estimatePayAmount(9.99, 1)).toBe(10.09)
  })

  it('浮点噪声不导致多收一分：$10 × 1% 恰为 $0.10，应付 $10.10', () => {
    expect(estimatePayAmount(10, 1)).toBe(10.1)
  })
})

describe('formatPayAmount（按币种格式化，未知/缺失币种回退 CNY——后端 DefaultPaymentCurrency）', () => {
  it('USD 用 $ 符号 + 千分位两位小数', () => {
    expect(formatPayAmount(1234.5, 'USD')).toBe('$1,234.50')
  })

  it('CNY 用 ¥ 符号', () => {
    expect(formatPayAmount(10.5, 'CNY')).toBe('¥10.50')
  })

  it('币种缺失时回退 CNY（与后端默认币种一致）', () => {
    expect(formatPayAmount(10.5, undefined)).toBe('¥10.50')
    expect(formatPayAmount(10.5, '')).toBe('¥10.50')
  })

  it('零小数位币种（JPY）不渲染小数', () => {
    const s = formatPayAmount(1234.5, 'JPY')
    expect(s).toContain('1,235')
    expect(s).not.toContain('.')
  })

  it('非法币种字符串回退 CNY', () => {
    expect(formatPayAmount(10.5, 'not-a-currency')).toBe('¥10.50')
  })
})
