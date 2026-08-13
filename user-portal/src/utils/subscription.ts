/**
 * 套餐（订阅）派生计算 —— 全部为纯函数，视图层只做渲染。
 *
 * 之所以把这些抽出来：进度色阶与到期告警的阈值是「用户能不能及时收到提醒」的关键，
 * 放在组件里既测不动也容易在多处漂移（仪表盘概览与套餐页各算一遍）。
 * 所有函数都接受可注入的 `now`，便于测试钉死边界。
 */
import type { UserSubscription } from '@/api/types'

/** 额度占用等级：≥90% DANGER，≥70% WARNING，其余 NORMAL */
export type QuotaLevel = 'NORMAL' | 'WARNING' | 'DANGER'

/** 到期紧迫等级：已过期 EXPIRED，≤3 天 URGENT，≤7 天 SOON，其余 NORMAL */
export type ExpiryLevel = 'NORMAL' | 'SOON' | 'URGENT' | 'EXPIRED'

/** 额度窗口种类；取值即 i18n 的 subscriptions.quota.* 键 */
export type QuotaWindowKey = 'DAILY' | 'WEEKLY' | 'MONTHLY'

/** 到期告警阈值：进入 7 天显示提醒横幅，进入 3 天升级为紧急 */
export const EXPIRY_SOON_DAYS = 7
export const EXPIRY_URGENT_DAYS = 3

const QUOTA_WARNING_PERCENT = 70
const QUOTA_DANGER_PERCENT = 90

const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000
const MINUTE_MS = 60_000

/** 一条额度窗口的完整信息（只对「配置了上限」的窗口产出） */
export interface QuotaWindow {
  key: QuotaWindowKey
  /** 上限，美元 */
  limit: number
  /** 已用，美元 */
  used: number
  /** 当前窗口起点；为 null 表示窗口尚未启动（该周期还没产生用量） */
  windowStart: string | null
  /** 窗口时长（小时）：日 24 / 周 168 / 月 720 */
  windowHours: number
}

function toTime(value: string | null | undefined): number | null {
  if (!value) return null
  const t = new Date(value).getTime()
  return Number.isNaN(t) ? null : t
}

function ratio(used: number | null | undefined, limit: number | null | undefined): number | null {
  if (!limit || limit <= 0) return null
  const r = (used ?? 0) / limit
  return Number.isFinite(r) && r > 0 ? r : 0
}

/** 额度占用百分比，封顶 100；无上限返回 0 */
export function progressPercent(
  used: number | null | undefined,
  limit: number | null | undefined
): number {
  const r = ratio(used, limit)
  if (r === null) return 0
  return Math.min(r * 100, 100)
}

/** 额度占用等级（用未封顶的原始比例判定，超额同样是 DANGER） */
export function progressLevel(
  used: number | null | undefined,
  limit: number | null | undefined
): QuotaLevel {
  const r = ratio(used, limit)
  if (r === null) return 'NORMAL'
  const percent = r * 100
  if (percent >= QUOTA_DANGER_PERCENT) return 'DANGER'
  if (percent >= QUOTA_WARNING_PERCENT) return 'WARNING'
  return 'NORMAL'
}

/** 剩余天数，向上取整（剩 3 小时也算「还有 1 天」）；已过期返回 ≤0 */
export function daysRemaining(expiresAt: string | null | undefined, now: Date = new Date()): number {
  const t = toTime(expiresAt)
  if (t === null) return 0
  return Math.ceil((t - now.getTime()) / DAY_MS)
}

/** 到期紧迫等级 */
export function expiryLevel(
  expiresAt: string | null | undefined,
  now: Date = new Date()
): ExpiryLevel {
  const t = toTime(expiresAt)
  if (t === null) return 'NORMAL'
  if (t <= now.getTime()) return 'EXPIRED'
  const days = Math.ceil((t - now.getTime()) / DAY_MS)
  if (days <= EXPIRY_URGENT_DAYS) return 'URGENT'
  if (days <= EXPIRY_SOON_DAYS) return 'SOON'
  return 'NORMAL'
}

/** 距窗口重置的剩余毫秒；窗口未启动返回 null，已越界返回 0 */
export function windowResetsIn(
  windowStart: string | null | undefined,
  windowHours: number,
  now: Date = new Date()
): number | null {
  const start = toTime(windowStart)
  if (start === null) return null
  return Math.max(0, start + windowHours * HOUR_MS - now.getTime())
}

/** 剩余时长的紧凑展示：`2d 3h` / `3h 5m` / `5m`（技术标识，中英一致，不走 i18n） */
export function formatRemaining(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / MINUTE_MS))
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

/** 是否生效中：状态为 active 且尚未到期（后端状态可能滞后于时间，故两者都查） */
export function isActive(sub: UserSubscription, now: Date = new Date()): boolean {
  if (sub.status !== 'active') return false
  const t = toTime(sub.expires_at)
  return t !== null && t > now.getTime()
}

/** 生效中在前按到期升序（快到期的最需要关注），其余置底按到期降序（最近失效的在前） */
export function sortSubscriptions(
  list: UserSubscription[],
  now: Date = new Date()
): UserSubscription[] {
  const time = (s: UserSubscription) => toTime(s.expires_at) ?? 0
  const active = list.filter((s) => isActive(s, now)).sort((a, b) => time(a) - time(b))
  const rest = list.filter((s) => !isActive(s, now)).sort((a, b) => time(b) - time(a))
  return [...active, ...rest]
}

/** 该订阅配置了上限的额度窗口（无上限的窗口不产出，视图据此决定渲染哪几条进度条） */
export function quotaWindows(sub: UserSubscription): QuotaWindow[] {
  const group = sub.group
  if (!group) return []
  const candidates: QuotaWindow[] = [
    {
      key: 'DAILY',
      limit: group.daily_limit_usd ?? 0,
      used: sub.daily_usage_usd ?? 0,
      windowStart: sub.daily_window_start,
      windowHours: 24
    },
    {
      key: 'WEEKLY',
      limit: group.weekly_limit_usd ?? 0,
      used: sub.weekly_usage_usd ?? 0,
      windowStart: sub.weekly_window_start,
      windowHours: 168
    },
    {
      key: 'MONTHLY',
      limit: group.monthly_limit_usd ?? 0,
      used: sub.monthly_usage_usd ?? 0,
      windowStart: sub.monthly_window_start,
      windowHours: 720
    }
  ]
  return candidates.filter((w) => w.limit > 0)
}

/** 是否配置了任一额度上限；为假时视图显示「不限额度」 */
export function hasAnyLimit(sub: UserSubscription): boolean {
  return quotaWindows(sub).length > 0
}

/** 占用比最高的那条额度（仪表盘概览只展示这一条）；无上限返回 null */
export function tightestQuota(sub: UserSubscription): QuotaWindow | null {
  const windows = quotaWindows(sub)
  if (windows.length === 0) return null
  return windows.reduce((best, w) =>
    progressPercent(w.used, w.limit) > progressPercent(best.used, best.limit) ? w : best
  )
}
