import { describe, it, expect, afterEach } from 'vitest'
import i18n from '@/i18n'
import type { AppLocale } from '@/i18n'
import type { OrderStatus } from '@/api/types'
import {
  orderStatusMeta,
  formatDateTime,
  toLocalDate,
  ORDER_SETTLING_STATUSES,
  formatRegMonth,
  formatValidity,
  discountPercent
} from '@/utils/format'

// 后端订单状态取值为 SCREAMING_SNAKE_CASE（见 backend payment.OrderStatus*），
// 前端必须以同样的取值理解状态：否则状态筛选 tab、状态徽章、行内按钮全部对不上。
describe('orderStatusMeta（识别后端大写枚举取值）', () => {
  it('PENDING → pending 变体且有可读文案（非回退原样输出）', () => {
    const meta = orderStatusMeta('PENDING')
    expect(meta.variant).toBe('pending')
    expect(meta.label).not.toBe('PENDING')
  })

  it('PAID / COMPLETED → paid 变体', () => {
    expect(orderStatusMeta('PAID').variant).toBe('paid')
    expect(orderStatusMeta('COMPLETED').variant).toBe('paid')
  })

  it('FAILED → neg，REFUNDED → muted', () => {
    expect(orderStatusMeta('FAILED').variant).toBe('neg')
    expect(orderStatusMeta('REFUNDED').variant).toBe('muted')
  })

  // 13 个后端状态（OrderStatus 全集）逐一核对 variant：变体从 orderStatusMeta 现有实现摘出，
  // 断言其"确实配置到了正确变体"而非静默落到未知状态兜底的 muted。
  const expectedVariants: Record<OrderStatus, string> = {
    PENDING: 'pending',
    PAID: 'paid',
    RECHARGING: 'paid',
    COMPLETED: 'paid',
    EXPIRED: 'muted',
    CANCELLED: 'muted',
    FAILED: 'neg',
    REFUND_REQUESTED: 'pending',
    REFUNDING: 'pending',
    REFUND_PENDING: 'pending',
    PARTIALLY_REFUNDED: 'muted',
    REFUNDED: 'muted',
    REFUND_FAILED: 'neg'
  }

  it.each(Object.entries(expectedVariants) as Array<[OrderStatus, string]>)(
    '%s → %s 变体 + 可读文案（非未知状态兜底路径）',
    (status, variant) => {
      const meta = orderStatusMeta(status)
      expect(meta.variant).toBe(variant)
      // 已配置状态的 label 走 i18n 翻译，不等于原样枚举字符串
      expect(meta.label).not.toBe(status)
      // 词条真的存在：vue-i18n 缺词条时 t() 会原样返回 key 路径（如 'orders.status.PENDING'）
      expect(meta.label).not.toContain('orders.status.')
    }
  )

  it('未知状态 → 回退 muted 且 label 原样输出', () => {
    const meta = orderStatusMeta('SOME_UNKNOWN_STATUS')
    expect(meta.variant).toBe('muted')
    expect(meta.label).toBe('SOME_UNKNOWN_STATUS')
  })
})

// 与 frontend SUCCESS_STATUSES 及后端履约链（PAID→RECHARGING→COMPLETED）对齐：
// 已支付口径（PAID/COMPLETED）之上，轮询期间还要把"已付款、到账中"的 RECHARGING 计为成功。
describe('ORDER_SETTLING_STATUSES（支付轮询"成功"口径守护）', () => {
  it('恰为 PAID / COMPLETED / RECHARGING 三者，多一个少一个都会破坏轮询判定', () => {
    expect([...ORDER_SETTLING_STATUSES].sort()).toEqual(['COMPLETED', 'PAID', 'RECHARGING'].sort())
  })
})

// 用本地时区构造的 new Date(y, m, d, ...) 固定输入断言输出，避免 ISO UTC 字符串（带 Z）
// 在不同时区的测试环境下解析出不同的本地字段，导致断言在部分时区抖动。
describe('formatDateTime / toLocalDate（本地时区固定输入，输出与时区无关）', () => {
  const pad = (n: number) => String(n).padStart(2, '0')
  // 无 'Z'/偏移量后缀的日期时间字符串按规范以"本地时间"解析，
  // 与 new Date(y, m, d, ...) 构造的本地时刻语义一致，断言不受运行环境时区影响。
  const toLocalIsoLike = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`

  it('formatDateTime 输出 YYYY/MM/DD HH:mm:ss', () => {
    const d = new Date(2026, 5, 4, 9, 8, 7) // 本地时刻 2026-06-04 09:08:07
    expect(formatDateTime(toLocalIsoLike(d))).toBe('2026/06/04 09:08:07')
  })

  it('toLocalDate 输出 YYYY-MM-DD（直接接收 Date，无需字符串往返）', () => {
    const d = new Date(2026, 0, 9) // 本地时刻 2026-01-09
    expect(toLocalDate(d)).toBe('2026-01-09')
  })
})

// frontend 跟随浏览器 locale，本门户有显式语言切换入口，故跟随门户当前语言而非钉死 en-US，
// 否则中文界面会出现「Jun 2026」这种未本地化的月份缩写。
describe('formatRegMonth（跟随门户语言）', () => {
  afterEach(() => {
    i18n.global.locale.value = 'zh-CN' as AppLocale
  })

  it('门户语言为 zh-CN 时不应出现英文月份缩写', () => {
    i18n.global.locale.value = 'zh-CN' as AppLocale
    expect(formatRegMonth('2026-06-15T00:00:00Z')).not.toMatch(/[A-Za-z]/)
  })

  it('门户语言为 en-US 时仍是英文月份缩写', () => {
    i18n.global.locale.value = 'en-US' as AppLocale
    expect(formatRegMonth('2026-06-15T00:00:00Z')).toMatch(/Jun/i)
  })
})

// 后端 validity_unit 常配成英文（days），中文界面直接拼会得到「30days」这种中英混排
describe('formatValidity（有效期单位本地化）', () => {
  it('英文 days / 缺省单位都归一到当前语言的「天」', () => {
    expect(formatValidity(30, 'days')).toBe('30天')
    expect(formatValidity(30, 'DAY')).toBe('30天')
    expect(formatValidity(30, null)).toBe('30天')
  })

  it('非「天」的自定义单位原样保留，不误翻译', () => {
    expect(formatValidity(100, '次')).toBe('100次')
    expect(formatValidity(12, '小时')).toBe('12小时')
  })
})

describe('discountPercent（折扣百分比）', () => {
  it('原价高于现价时四舍五入取整', () => {
    expect(discountPercent(15, 20)).toBe(25)
    expect(discountPercent(7.5, 40)).toBe(81)
  })

  it('无原价、原价不高于现价时均视为无折扣', () => {
    expect(discountPercent(20, null)).toBe(0)
    expect(discountPercent(20, 20)).toBe(0)
    expect(discountPercent(20, 10)).toBe(0)
  })
})
