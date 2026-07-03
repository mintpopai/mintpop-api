// 数值/金额/Token/时长格式化（与主前端展示口径一致）
import i18n from '@/i18n'

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

/** 千分位整数 */
export function formatNumber(n: number): string {
  return (n ?? 0).toLocaleString()
}

/** Token 数缩写：K / M */
export function formatTokens(n: number): string {
  const v = n ?? 0
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`
  return String(v)
}

/** 时长：ms / s */
export function formatDuration(ms: number): string {
  const v = ms ?? 0
  return v >= 1000 ? `${(v / 1000).toFixed(2)}s` : `${v.toFixed(0)}ms`
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

/** 订单状态 → 展示文案 + StatusBadge variant（文案随语言切换） */
export function orderStatusMeta(s: string): { label: string; variant: string } {
  // key 为后端订单状态枚举取值（SCREAMING_SNAKE_CASE），value 为展示变体
  // 全集与 admin 前端对齐（frontend/src/components/payment/orderUtils.ts）；受本门户配色所限，
  // frontend 的 info(蓝)/purple 统一并入既有语义变体：进行中→pending、已收款/已完成→paid、失败→neg、终态灰→muted
  const variants: Record<string, string> = {
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
  const variant = variants[s]
  if (!variant) return { label: s, variant: 'muted' }
  return { label: i18n.global.t(`orders.status.${s}`), variant }
}

/** 订单类型 → 展示文案（balance=余额充值 / subscription=订阅，文案随语言切换） */
export function orderKind(orderType: string): string {
  return i18n.global.t(orderType === 'balance' ? 'orders.orderType.balance' : 'orders.orderType.subscription')
}

/** 注册月份 Jun 2026 */
export function formatRegMonth(s: string | null | undefined): string {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(d)
}

const cny0 = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
/** 人民币金额（2 位小数，无符号，调用方自行加 ¥） */
export function formatCNY(n: number): string {
  return cny0.format(Number.isFinite(n) ? n : 0)
}

/** 缓存命中率 0-100 整数 */
export function cacheHitRate(cacheRead: number, input: number): number {
  return percent(cacheRead, (input ?? 0) + (cacheRead ?? 0))
}

/** 计费类型：0=按量，1=订阅 */
export function formatBillingType(t: number): string {
  return i18n.global.t(t === 1 ? 'usage.billingType.subscription' : 'usage.billingType.payg')
}
