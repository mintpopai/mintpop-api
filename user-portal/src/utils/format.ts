// 数值/金额/Token/时长格式化（与主前端展示口径一致）
import i18n from '@/i18n'
import type { OrderStatus } from '@/api/types'

const usd2 = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

/** 余额/金额，保留 2 位 */
export function formatBalance(n: number): string {
  return usd2.format(Number.isFinite(n) ? n : 0)
}

const usd4 = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4
})

/** 消费金额，保留 4 位（与后端计费精度一致）；与 formatBalance 统一走 Intl（含千分位） */
export function formatCost(n: number): string {
  return usd4.format(Number.isFinite(n) ? n : 0)
}

/** 千分位整数（入参可能来自 API 缺失字段，故容忍 null/undefined） */
export function formatNumber(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString()
}

/** Token 数缩写：K / M（入参可能来自 API 缺失字段，故容忍 null/undefined） */
export function formatTokens(n: number | null | undefined): string {
  const v = n ?? 0
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`
  return String(v)
}

/** 时长：ms / s（入参可能来自 API 缺失字段，故容忍 null/undefined） */
export function formatDuration(ms: number | null | undefined): string {
  const v = ms ?? 0
  return v >= 1000 ? `${(v / 1000).toFixed(2)}s` : `${v.toFixed(0)}ms`
}

/**
 * 返利比例展示（入参是 0-100 的百分数，后端已 clamp）：
 * 保留 2 位后去掉尾零（20.00 → "20"、12.50 → "12.5"），与主前端口径一致。
 */
export function formatRebateRate(v: number | null | undefined): string {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0
  const rounded = Math.round(n * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : rounded.toString()
}

/** 百分比（0-100 整数） */
export function percent(part: number, whole: number): number {
  if (!whole || whole <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((part / whole) * 100)))
}

/** 日期时间 YYYY/MM/DD HH:mm:ss */
export function formatDateTime(s: string | null | undefined): string {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return '—'
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/** 日期 YYYY/MM/DD HH:mm */
export function formatDateMinute(s: string | null | undefined): string {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return '—'
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 本地日期字符串 YYYY-MM-DD */
export function toLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 掩码密钥：前 6 + … + 后 4，对齐设计稿 sk-4d2…e32d */
export function maskApiKey(key: string | null | undefined): string {
  if (!key) return '—'
  if (key.length <= 12) return key
  return `${key.slice(0, 6)}…${key.slice(-4)}`
}

/** 推理强度标签 */
export function formatReasoningEffort(e: string | null | undefined): string {
  if (!e) return '—'
  const map: Record<string, string> = {
    minimal: 'Minimal', low: 'Low', medium: 'Medium', high: 'High', xhigh: 'XHigh'
  }
  return map[e] ?? (e.charAt(0).toUpperCase() + e.slice(1))
}

/**
 * 订单状态口径（唯一定义，各视图引用、不再各自手写集合）：
 * - ORDER_PAID_STATUSES：「已支付」展示口径 —— PAID（已收款）与 COMPLETED（已完成）
 * - ORDER_SETTLING_STATUSES：支付回流轮询的「成功」口径 —— 在已支付之上加 RECHARGING（已付款、到账中的瞬时态）
 */
export const ORDER_PAID_STATUSES: readonly string[] = ['PAID', 'COMPLETED']
export const ORDER_SETTLING_STATUSES: readonly string[] = [...ORDER_PAID_STATUSES, 'RECHARGING']

/**
 * 支付轮询「下一步动作」（PaymentResultModal.verifyOnce 消费）：
 * - SETTLED：命中 ORDER_SETTLING_STATUSES（PAID/COMPLETED/RECHARGING）→ 已成功，停表并 emit('paid')
 * - CONTINUE：PENDING → 继续轮询
 * - TERMINAL：其余一切状态（FAILED/CANCELLED/EXPIRED/退款系列/未知字符串）→ 停表但不 emit
 */
export type PaymentPollAction = 'CONTINUE' | 'SETTLED' | 'TERMINAL'

export function resolvePaymentPollAction(status: string): PaymentPollAction {
  if (ORDER_SETTLING_STATUSES.includes(status)) return 'SETTLED'
  if (status === 'PENDING') return 'CONTINUE'
  return 'TERMINAL'
}

/** 订单状态 → 展示文案 + StatusBadge variant（文案随语言切换） */
export function orderStatusMeta(s: string): { label: string; variant: string } {
  // key 为后端订单状态枚举取值（SCREAMING_SNAKE_CASE），value 为展示变体
  // 全集与 admin 前端对齐（frontend/src/components/payment/orderUtils.ts）；受本门户配色所限，
  // frontend 的 info(蓝)/purple 统一并入既有语义变体：进行中→pending、已收款/已完成→paid、失败→neg、终态灰→muted
  // variants 以 OrderStatus 全集为键类型：后端/类型新增状态而此处漏配会直接编译报错，
  // 不再等到运行时才发现某状态悄悄回退成 muted。
  const variants: Record<OrderStatus, string> = {
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
  // 入参 s 仍是 string（调用方可能传入未知/脏数据），故索引时收窄为「值可能缺失」，
  // 未知状态回退 muted 的既有行为保持不变。
  const variant = (variants as Record<string, string | undefined>)[s]
  if (!variant) return { label: s, variant: 'muted' }
  return { label: i18n.global.t(`orders.status.${s}`), variant }
}

/** 订单类型 → 展示文案（balance=余额充值 / subscription=订阅，文案随语言切换） */
export function orderKind(orderType: string): string {
  return i18n.global.t(orderType === 'balance' ? 'orders.orderType.balance' : 'orders.orderType.subscription')
}

/**
 * 注册月份，如 Jun 2026 / 2026年6月。
 * locale 跟随门户当前语言（而非钉死 'en-US'）：常规做法是跟随浏览器 locale，
 * 但本门户提供了显式的语言切换入口，用户选的语言应立即体现在此处格式化上，
 * 否则中文界面里会混入未本地化的英文月份缩写（如「Jun 2026」）。
 */
export function formatRegMonth(s: string | null | undefined): string {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat(i18n.global.locale.value, { month: 'short', year: 'numeric' }).format(d)
}

// 后端 validity_unit 常配成英文（day/days），中文界面直接拼会出现「30days」这种中英混排
const DAY_UNIT_ALIASES = new Set(['d', 'day', 'days', '天'])

/**
 * 有效期展示（如「30 天」/「30 days」）：单位是「天」时归一到当前语言的词条，
 * 其它单位（后端自定义，如「次」「小时」）原样保留，避免误翻译。
 */
export function formatValidity(days: number, unit?: string | null): string {
  const raw = String(unit ?? '').trim()
  const label = !raw || DAY_UNIT_ALIASES.has(raw.toLowerCase())
    ? i18n.global.t('recharge.dayUnit')
    : raw
  return `${days}${label}`
}

/** 折扣百分比（整数）；无原价或原价不高于现价时返回 0，视图据此决定是否展示徽章 */
export function discountPercent(price: number, originalPrice?: number | null): number {
  if (typeof originalPrice !== 'number' || originalPrice <= price) return 0
  const pct = Math.round((1 - price / originalPrice) * 100)
  return pct > 0 ? pct : 0
}

/**
 * 预估应付金额（充值额 + 手续费），口径对齐后端 payment.CalculatePayAmountForCurrency：
 * - feeRatePercent 是「百分数」（5 = 5%），不是小数——后端按 amount × rate / 100 计费；
 * - 手续费向上取整到分（后端 RoundUp 到币种最小单位，此处按 2 位小数币种预估）。
 * 仅作下单前展示预估，实际以后端下单结果为准。
 */
export function estimatePayAmount(amount: number, feeRatePercent: number): number {
  if (!Number.isFinite(amount)) return 0
  if (!Number.isFinite(feeRatePercent) || feeRatePercent <= 0) return amount
  // amount × rate / 100（美元）恰为 amount × rate（美分）；toFixed(6) 先抹掉浮点噪声
  // （如 10 × 1 = 10.000000000000002），否则 ceil 会凭空多收一分
  const feeCents = Math.ceil(Number((amount * feeRatePercent).toFixed(6)))
  return Math.round(amount * 100 + feeCents) / 100
}

// 后端 payment.DefaultPaymentCurrency —— 订单未带币种时的回退值（两端须一致）
const DEFAULT_PAYMENT_CURRENCY = 'CNY'

/** 归一化币种代码：3 位字母才合法，否则回退默认币种 */
function normalizePaymentCurrency(currency?: string | null): string {
  const c = String(currency ?? '').trim().toUpperCase()
  return /^[A-Z]{3}$/.test(c) ? c : DEFAULT_PAYMENT_CURRENCY
}

/**
 * 按订单币种格式化实付金额（含货币符号与该币种的小数位，如 $10.50 / ¥10.50 / ¥1,235）。
 * 订单币种由支付实例决定（Stripe 单常为 USD），不能硬编码 ¥；locale 跟随门户当前语言。
 */
export function formatPayAmount(amount: number, currency?: string | null): string {
  const c = normalizePaymentCurrency(currency)
  const v = Number.isFinite(amount) ? amount : 0
  try {
    return new Intl.NumberFormat(i18n.global.locale.value, {
      style: 'currency',
      currency: c,
      currencyDisplay: 'narrowSymbol'
    }).format(v)
  } catch {
    // Intl 不认识的合法形状币种（如私有代码）：退化为「代码 + 两位小数」
    return `${c} ${v.toFixed(2)}`
  }
}

// Stripe 零小数币种（金额直接以整数最小单位计，名单来自 Stripe 文档 zero-decimal currencies）
const STRIPE_ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF'
])

/**
 * 金额（主单位）→ Stripe 最小货币单位整数（deferred 模式 Elements 的 amount 参数用）。
 * 两位小数币种 ×100，零小数币种取整；口径对齐后端 payment.AmountToMinorUnit。
 */
export function toStripeMinorUnit(amount: number, currency?: string | null): number {
  const v = Number.isFinite(amount) ? amount : 0
  const c = normalizePaymentCurrency(currency)
  return STRIPE_ZERO_DECIMAL_CURRENCIES.has(c) ? Math.round(v) : Math.round(v * 100)
}

/** 缓存命中率 0-100 整数（入参可能来自 API 缺失字段，故容忍 null/undefined） */
export function cacheHitRate(cacheRead: number | null | undefined, input: number | null | undefined): number {
  return percent(cacheRead ?? 0, (input ?? 0) + (cacheRead ?? 0))
}

/** 计费类型：0=按量，1=订阅 */
export function formatBillingType(t: number): string {
  return i18n.global.t(t === 1 ? 'usage.billingType.subscription' : 'usage.billingType.payg')
}
