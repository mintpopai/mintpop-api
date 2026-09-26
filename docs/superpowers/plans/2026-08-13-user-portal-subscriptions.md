# user-portal 套餐功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `user-portal` 中补齐套餐（订阅）功能：新增「我的套餐」页、仪表盘订阅概览与到期提醒横幅、购买侧套餐卡片补齐四项展示。

**Architecture:** 纯前端改动，不动后端。数据由 `api/subscriptions.ts` 单接口（`GET /subscriptions`）取回，经 Pinia store（60 秒缓存 + in-flight 去重）分发给「我的套餐」页、仪表盘两个组件与购买侧卡片；所有派生计算（额度百分比、色阶、到期等级、排序、窗口倒计时）落在 `utils/subscription.ts` 的纯函数里以便单测。

**Tech Stack:** Vue 3 `<script setup>` + TypeScript + Pinia + vue-i18n + Tailwind（user-portal 自有 token）+ Vitest + @vue/test-utils。

**Spec:** `docs/superpowers/specs/2026-08-13-user-portal-subscriptions-design.md`

对应设计文档：`docs/superpowers/specs/2026-08-13-user-portal-subscriptions-design.md`

## Global Constraints

- 所有命令走 mise：类型检查 + 单测 `mise run test-user-portal`（= `pnpm exec vue-tsc -b && pnpm exec vitest run`），lint `mise run lint-user-portal`（`--max-warnings 0`）。**不要**直接 `cd user-portal && pnpm test`。
- 代码注释、提交信息一律**简体中文**。
- 前端**新定义**的枚举，成员名与字符串取值一律 SCREAMING_SNAKE_CASE（本计划中的 `QuotaLevel`、`ExpiryLevel`、`QuotaWindow.key`）。
- 订阅 `status` 例外：沿用后端既有契约的小写取值 `'active' | 'expired' | 'suspended' | 'revoked'`（`backend/internal/domain/constants.go:67`），**不得**改成大写——那会与 backend/frontend/DB 契约脱节。
- 模板内不留裸中文，一律走 i18n；`zh-CN` 与 `en-US` 两个语言包**同步**新增同样的键（`zh-CN/index.ts` 的 `MessageSchema` 类型会强制 en-US 键齐全，缺键直接编译失败）。
- 样式只用 user-portal 现有设计 token：`bg-card` / `bg-track` / `bg-muted` / `shadow-card` / `shadow-pill` / `text-text` / `text-text2` / `text-text3` / `text-subtle` / `text-faint` / `text-accent` / `bg-accent` / `text-neg` / `bg-neg` / `text-pos` / `border-border2` / `rounded-xl2` / `rounded-xl3`。**不要**引入 frontend 管理端的 `dark-800` / `primary-500` 之类 class（user-portal 没有这些）。
- 每个任务结束都要提交一次，提交信息格式 `feat(user-portal): …` / `test(user-portal): …`。提交信息末尾加：
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  ```
- 当前分支 `mintpop`，直接在其上提交，不建新分支。

## File Structure

| 文件 | 职责 | 任务 |
| --- | --- | --- |
| `user-portal/src/api/types.ts`（改） | 新增 `SubscriptionGroup` / `SubscriptionStatus` / `UserSubscription` 类型 | 1 |
| `user-portal/src/api/subscriptions.ts`（新） | 封装 `GET /subscriptions` | 1 |
| `user-portal/src/utils/subscription.ts`（新） | 全部派生计算的纯函数 | 1 |
| `user-portal/src/utils/__tests__/subscription.test.ts`（新） | 上者的单测 | 1 |
| `user-portal/src/stores/subscriptions.ts`（新） | Pinia store：缓存、去重、排序 getter | 2 |
| `user-portal/src/stores/__tests__/subscriptions.test.ts`（新） | store 单测 | 2 |
| `user-portal/src/i18n/locales/{zh-CN,en-US}/subscriptions.ts`（新） | 套餐命名空间文案 | 3 |
| `user-portal/src/i18n/locales/{zh-CN,en-US}/index.ts`（改） | 注册 subscriptions 命名空间 | 3 |
| `user-portal/src/components/subscriptions/QuotaBar.vue`（新） | 单条额度进度条 | 3 |
| `user-portal/src/components/subscriptions/SubscriptionCard.vue`（新） | 一张订阅卡 | 3 |
| `user-portal/src/components/subscriptions/__tests__/SubscriptionCard.test.ts`（新） | 卡片组件测试 | 3 |
| `user-portal/src/views/SubscriptionsView.vue`（新） | 我的套餐页 | 4 |
| `user-portal/src/router/index.ts`（改） | 注册 `/subscriptions` 路由 | 4 |
| `user-portal/src/layouts/PortalLayout.vue`（改） | 导航加「我的套餐」 | 4 |
| `user-portal/src/i18n/locales/{zh-CN,en-US}/nav.ts`（改） | `nav.subscriptions` | 4 |
| `user-portal/src/components/dashboard/ExpiryBanner.vue`（新） | 到期提醒横幅 | 5 |
| `user-portal/src/components/dashboard/SubscriptionOverview.vue`（新） | 仪表盘订阅额度概览 | 5 |
| `user-portal/src/views/DashboardView.vue`（改） | 挂载上面两个组件 | 5 |
| `user-portal/src/utils/platform.ts`（改） | 补 `antigravity` 平台色 | 6 |
| `user-portal/src/components/recharge/SubscriptionPlans.vue`（改） | 卡片补齐四项 | 6 |
| `user-portal/src/views/RechargeView.vue`（改） | 支持 `?tab=subscription&group=<id>` | 6 |
| `user-portal/src/i18n/locales/{zh-CN,en-US}/recharge.ts`（改） | 续费/折扣/不限额度文案 | 6 |

---

### Task 1: 类型、API 封装与派生计算纯函数

**Files:**
- Modify: `user-portal/src/api/types.ts`（在文件末尾追加）
- Create: `user-portal/src/api/subscriptions.ts`
- Create: `user-portal/src/utils/subscription.ts`
- Test: `user-portal/src/utils/__tests__/subscription.test.ts`

**Interfaces:**
- Consumes: `apiClient`（`@/api/client`，已存在，`get<T>()` 返回的 `data` 即业务数据，`ApiResponse` 包装已在拦截器里剥掉）
- Produces:
  - 类型 `SubscriptionGroup`、`SubscriptionStatus`、`UserSubscription`（`@/api/types`）
  - `getMySubscriptions(): Promise<UserSubscription[]>`（`@/api/subscriptions`）
  - `@/utils/subscription` 导出：`QuotaLevel`、`ExpiryLevel`、`QuotaWindow`、`EXPIRY_SOON_DAYS`、`EXPIRY_URGENT_DAYS`、`progressPercent`、`progressLevel`、`daysRemaining`、`expiryLevel`、`windowResetsIn`、`formatRemaining`、`isActive`、`sortSubscriptions`、`quotaWindows`、`hasAnyLimit`、`tightestQuota`

- [ ] **Step 1: 在 `api/types.ts` 末尾追加订阅类型**

```ts
/** 订阅所属分组：额度上限来自分组配置（字段对齐后端 dto.Group 中订阅页用到的子集） */
export interface SubscriptionGroup {
  id: number
  name: string
  description?: string
  platform?: string
  rate_multiplier?: number
  daily_limit_usd?: number | null
  weekly_limit_usd?: number | null
  monthly_limit_usd?: number | null
}

/**
 * 订阅状态。取值沿用后端既有契约的小写形式（backend/internal/domain/constants.go），
 * 与「枚举取值 SCREAMING_SNAKE_CASE」的全局规范冲突，但该契约由 backend + frontend + DB 共用，
 * 改动超出本次范围，故前端按现状对齐。
 */
export type SubscriptionStatus = 'active' | 'expired' | 'suspended' | 'revoked'

/** 用户订阅。字段对齐后端 backend/internal/handler/dto/types.go 的 UserSubscription */
export interface UserSubscription {
  id: number
  user_id: number
  group_id: number
  starts_at: string
  expires_at: string
  status: SubscriptionStatus
  daily_window_start: string | null
  weekly_window_start: string | null
  monthly_window_start: string | null
  daily_usage_usd: number
  weekly_usage_usd: number
  monthly_usage_usd: number
  created_at: string
  updated_at: string
  revoked_at?: string | null
  group?: SubscriptionGroup
}
```

- [ ] **Step 2: 创建 `api/subscriptions.ts`**

```ts
// 用户订阅查询 —— 只封 GET /subscriptions：它返回全部订阅且内嵌 group（含日/周/月额度上限），
// /active、/progress、/summary 三个接口的信息量都是它的子集，前端本地算即可，不重复封装。
import { apiClient } from './client'
import type { UserSubscription } from './types'

/** 当前用户的全部订阅（含已过期/已撤销）；排序由前端 sortSubscriptions 负责 */
export async function getMySubscriptions(): Promise<UserSubscription[]> {
  const { data } = await apiClient.get<UserSubscription[]>('/subscriptions')
  return data ?? []
}
```

- [ ] **Step 3: 写失败的测试 `utils/__tests__/subscription.test.ts`**

```ts
// 套餐派生计算的纯函数测试。这些函数决定了「进度条什么时候变红」「到期什么时候告警」，
// 阈值错一档用户就收不到该收的提醒，故逐个边界都钉死。
import { describe, it, expect } from 'vitest'
import type { UserSubscription } from '@/api/types'
import {
  progressPercent,
  progressLevel,
  daysRemaining,
  expiryLevel,
  windowResetsIn,
  formatRemaining,
  isActive,
  sortSubscriptions,
  quotaWindows,
  hasAnyLimit,
  tightestQuota
} from '@/utils/subscription'

const NOW = new Date('2026-08-13T00:00:00Z')
const DAY = 86_400_000

function makeSub(over: Partial<UserSubscription> = {}): UserSubscription {
  return {
    id: 1,
    user_id: 1,
    group_id: 1,
    starts_at: '2026-08-01T00:00:00Z',
    expires_at: new Date(NOW.getTime() + 30 * DAY).toISOString(),
    status: 'active',
    daily_window_start: null,
    weekly_window_start: null,
    monthly_window_start: null,
    daily_usage_usd: 0,
    weekly_usage_usd: 0,
    monthly_usage_usd: 0,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...over
  }
}

describe('progressPercent', () => {
  it('正常按比例换算', () => {
    expect(progressPercent(2.5, 10)).toBe(25)
  })

  it('超额封顶 100，不会撑破进度条', () => {
    expect(progressPercent(30, 10)).toBe(100)
  })

  it('上限为 0 / null / undefined 一律返回 0（视为无上限，不画进度）', () => {
    expect(progressPercent(5, 0)).toBe(0)
    expect(progressPercent(5, null)).toBe(0)
    expect(progressPercent(5, undefined)).toBe(0)
  })
})

describe('progressLevel（70 / 90 两档阈值）', () => {
  it('69.9% → NORMAL，70% → WARNING', () => {
    expect(progressLevel(6.99, 10)).toBe('NORMAL')
    expect(progressLevel(7, 10)).toBe('WARNING')
  })

  it('89.9% → WARNING，90% → DANGER', () => {
    expect(progressLevel(8.99, 10)).toBe('WARNING')
    expect(progressLevel(9, 10)).toBe('DANGER')
  })

  it('无上限时恒为 NORMAL', () => {
    expect(progressLevel(999, null)).toBe('NORMAL')
  })
})

describe('expiryLevel（3 / 7 天两档阈值）', () => {
  const at = (ms: number) => new Date(NOW.getTime() + ms).toISOString()

  it('8 天 → NORMAL，7 天整 → SOON', () => {
    expect(expiryLevel(at(7 * DAY + 1), NOW)).toBe('NORMAL')
    expect(expiryLevel(at(7 * DAY), NOW)).toBe('SOON')
  })

  it('4 天 → SOON，3 天整 → URGENT', () => {
    expect(expiryLevel(at(3 * DAY + 1), NOW)).toBe('SOON')
    expect(expiryLevel(at(3 * DAY), NOW)).toBe('URGENT')
  })

  it('已到期 / 已过期 → EXPIRED', () => {
    expect(expiryLevel(at(0), NOW)).toBe('EXPIRED')
    expect(expiryLevel(at(-DAY), NOW)).toBe('EXPIRED')
  })
})

describe('daysRemaining', () => {
  it('不足一天按一天算（向上取整）', () => {
    expect(daysRemaining(new Date(NOW.getTime() + DAY / 2).toISOString(), NOW)).toBe(1)
  })

  it('已过期返回非正数', () => {
    expect(daysRemaining(new Date(NOW.getTime() - DAY).toISOString(), NOW)).toBeLessThanOrEqual(0)
  })
})

describe('windowResetsIn / formatRemaining', () => {
  it('窗口未启动（windowStart 为 null）返回 null', () => {
    expect(windowResetsIn(null, 24, NOW)).toBeNull()
  })

  it('窗口开始 6 小时后，24 小时窗口还剩 18 小时', () => {
    const start = new Date(NOW.getTime() - 6 * 3_600_000).toISOString()
    expect(windowResetsIn(start, 24, NOW)).toBe(18 * 3_600_000)
  })

  it('窗口已越界返回 0，不出现负数', () => {
    const start = new Date(NOW.getTime() - 30 * 3_600_000).toISOString()
    expect(windowResetsIn(start, 24, NOW)).toBe(0)
  })

  it('formatRemaining 三档：天 / 小时 / 分钟', () => {
    expect(formatRemaining(2 * DAY + 3 * 3_600_000)).toBe('2d 3h')
    expect(formatRemaining(3 * 3_600_000 + 5 * 60_000)).toBe('3h 5m')
    expect(formatRemaining(5 * 60_000)).toBe('5m')
  })
})

describe('isActive / sortSubscriptions', () => {
  it('status 为 active 但已过期的，不算生效中', () => {
    const sub = makeSub({ expires_at: new Date(NOW.getTime() - DAY).toISOString() })
    expect(isActive(sub, NOW)).toBe(false)
  })

  it('生效中在前按到期升序，其余置底按到期降序', () => {
    const activeFar = makeSub({ id: 1, expires_at: new Date(NOW.getTime() + 20 * DAY).toISOString() })
    const activeNear = makeSub({ id: 2, expires_at: new Date(NOW.getTime() + 2 * DAY).toISOString() })
    const expiredOld = makeSub({
      id: 3,
      status: 'expired',
      expires_at: new Date(NOW.getTime() - 30 * DAY).toISOString()
    })
    const expiredRecent = makeSub({
      id: 4,
      status: 'expired',
      expires_at: new Date(NOW.getTime() - 2 * DAY).toISOString()
    })

    const sorted = sortSubscriptions([expiredOld, activeFar, expiredRecent, activeNear], NOW)
    expect(sorted.map((s) => s.id)).toEqual([2, 1, 4, 3])
  })
})

describe('quotaWindows / hasAnyLimit / tightestQuota', () => {
  it('只产出有上限的窗口，并带上对应窗口时长', () => {
    const sub = makeSub({
      group: { id: 1, name: 'g', daily_limit_usd: 10, monthly_limit_usd: 100 },
      daily_usage_usd: 1,
      monthly_usage_usd: 50
    })
    const windows = quotaWindows(sub)
    expect(windows.map((w) => w.key)).toEqual(['DAILY', 'MONTHLY'])
    expect(windows[0]).toMatchObject({ limit: 10, used: 1, windowHours: 24 })
    expect(windows[1]).toMatchObject({ limit: 100, used: 50, windowHours: 720 })
  })

  it('三个上限皆空 → hasAnyLimit 为假、tightestQuota 为 null', () => {
    const sub = makeSub({ group: { id: 1, name: 'g' } })
    expect(hasAnyLimit(sub)).toBe(false)
    expect(tightestQuota(sub)).toBeNull()
  })

  it('tightestQuota 取占用比最高的那条（不是绝对值最大的）', () => {
    const sub = makeSub({
      group: { id: 1, name: 'g', daily_limit_usd: 10, monthly_limit_usd: 1000 },
      daily_usage_usd: 9,
      monthly_usage_usd: 100
    })
    expect(tightestQuota(sub)?.key).toBe('DAILY')
  })

  it('group 缺失时不报错，视为无额度', () => {
    expect(quotaWindows(makeSub())).toEqual([])
    expect(hasAnyLimit(makeSub())).toBe(false)
  })
})
```

- [ ] **Step 4: 运行测试确认失败**

Run: `mise run test-user-portal`
Expected: FAIL —— `Failed to resolve import "@/utils/subscription"`（模块尚不存在）

- [ ] **Step 5: 实现 `utils/subscription.ts`**

```ts
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
```

- [ ] **Step 6: 运行测试确认通过**

Run: `mise run test-user-portal`
Expected: PASS，`subscription.test.ts` 全部用例通过，`vue-tsc -b` 无类型错误

- [ ] **Step 7: 跑 lint**

Run: `mise run lint-user-portal`
Expected: 无输出（0 error 0 warning）

- [ ] **Step 8: 提交**

```bash
git add user-portal/src/api/types.ts user-portal/src/api/subscriptions.ts user-portal/src/utils/subscription.ts user-portal/src/utils/__tests__/subscription.test.ts
git commit -m "$(cat <<'EOF'
feat(user-portal): 新增订阅类型、查询接口与派生计算纯函数

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: 订阅 Pinia store

**Files:**
- Create: `user-portal/src/stores/subscriptions.ts`
- Test: `user-portal/src/stores/__tests__/subscriptions.test.ts`

**Interfaces:**
- Consumes: `getMySubscriptions()`（Task 1）、`sortSubscriptions` / `isActive` / `daysRemaining` / `EXPIRY_SOON_DAYS`（Task 1）
- Produces: `useSubscriptionsStore()`，实例暴露
  `items: Ref<UserSubscription[]>`、`loading: Ref<boolean>`、`loaded: Ref<boolean>`、`error: Ref<string>`、
  `sorted: ComputedRef<UserSubscription[]>`、`activeItems: ComputedRef<UserSubscription[]>`、
  `expiringSoon: ComputedRef<UserSubscription[]>`、
  `ensureLoaded(): Promise<void>`、`refresh(): Promise<void>`

> 设计文档写的是「失败回滚 `lastFetchedAt`」，这里实现为**失败不写时间戳**——效果相同（下次调用立即重试）且更简单。另外补了设计文档没列的 `error` 字段：套餐页整页就是这份列表，加载失败必须与「没有套餐」区分开，否则用户会误以为订阅丢了。

- [ ] **Step 1: 写失败的测试 `stores/__tests__/subscriptions.test.ts`**

```ts
// 订阅 store 的四条契约：
// 1. 60 秒缓存——仪表盘与套餐页会各自 ensureLoaded，没有缓存就是每次导航打一次接口；
// 2. in-flight 去重——两个组件同帧挂载只能发一次请求，且两边都要等到数据；
// 3. refresh 必须绕过缓存——页面上的刷新按钮点了要真刷新；
// 4. 失败不写时间戳且置 error——否则一次网络抖动会让套餐页 60 秒内空着且看不出是失败。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { UserSubscription } from '@/api/types'

vi.mock('@/api/subscriptions', () => ({
  getMySubscriptions: vi.fn()
}))

import { getMySubscriptions } from '@/api/subscriptions'
import { useSubscriptionsStore } from '@/stores/subscriptions'

const mockGet = vi.mocked(getMySubscriptions)
const DAY = 86_400_000

function makeSub(over: Partial<UserSubscription> = {}): UserSubscription {
  return {
    id: 1,
    user_id: 1,
    group_id: 1,
    starts_at: '2026-08-01T00:00:00Z',
    expires_at: new Date(Date.now() + 30 * DAY).toISOString(),
    status: 'active',
    daily_window_start: null,
    weekly_window_start: null,
    monthly_window_start: null,
    daily_usage_usd: 0,
    weekly_usage_usd: 0,
    monthly_usage_usd: 0,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...over
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  mockGet.mockReset()
  vi.useRealTimers()
})

describe('ensureLoaded', () => {
  it('缓存窗口内重复调用只打一次接口', async () => {
    mockGet.mockResolvedValue([makeSub()])
    const store = useSubscriptionsStore()
    await store.ensureLoaded()
    await store.ensureLoaded()
    expect(mockGet).toHaveBeenCalledTimes(1)
  })

  it('缓存过期后重新请求', async () => {
    vi.useFakeTimers()
    mockGet.mockResolvedValue([makeSub()])
    const store = useSubscriptionsStore()
    await store.ensureLoaded()
    vi.advanceTimersByTime(61_000)
    await store.ensureLoaded()
    expect(mockGet).toHaveBeenCalledTimes(2)
  })

  it('并发调用只发一次请求，且每个调用方都拿到数据', async () => {
    mockGet.mockResolvedValue([makeSub({ id: 7 })])
    const store = useSubscriptionsStore()
    await Promise.all([store.ensureLoaded(), store.ensureLoaded(), store.ensureLoaded()])
    expect(mockGet).toHaveBeenCalledTimes(1)
    expect(store.items.map((s) => s.id)).toEqual([7])
    expect(store.loaded).toBe(true)
  })
})

describe('refresh', () => {
  it('忽略缓存，强制重新请求', async () => {
    mockGet.mockResolvedValue([makeSub()])
    const store = useSubscriptionsStore()
    await store.ensureLoaded()
    await store.refresh()
    expect(mockGet).toHaveBeenCalledTimes(2)
  })
})

describe('失败处理', () => {
  it('失败时置 error，且下次调用立即重试（不被缓存挡住）', async () => {
    mockGet.mockRejectedValueOnce(new Error('boom'))
    const store = useSubscriptionsStore()
    await store.ensureLoaded()
    expect(store.error).not.toBe('')
    expect(store.loaded).toBe(false)

    mockGet.mockResolvedValueOnce([makeSub()])
    await store.ensureLoaded()
    expect(mockGet).toHaveBeenCalledTimes(2)
    expect(store.error).toBe('')
    expect(store.items).toHaveLength(1)
  })
})

describe('getters', () => {
  it('activeItems 排除已过期（即便后端 status 仍为 active）', async () => {
    mockGet.mockResolvedValue([
      makeSub({ id: 1 }),
      makeSub({ id: 2, expires_at: new Date(Date.now() - DAY).toISOString() }),
      makeSub({ id: 3, status: 'revoked' })
    ])
    const store = useSubscriptionsStore()
    await store.ensureLoaded()
    expect(store.activeItems.map((s) => s.id)).toEqual([1])
  })

  it('expiringSoon 只含 7 天内到期的生效订阅，按紧迫度升序', async () => {
    mockGet.mockResolvedValue([
      makeSub({ id: 1, expires_at: new Date(Date.now() + 20 * DAY).toISOString() }),
      makeSub({ id: 2, expires_at: new Date(Date.now() + 6 * DAY).toISOString() }),
      makeSub({ id: 3, expires_at: new Date(Date.now() + 2 * DAY).toISOString() })
    ])
    const store = useSubscriptionsStore()
    await store.ensureLoaded()
    expect(store.expiringSoon.map((s) => s.id)).toEqual([3, 2])
  })

  it('sorted 把生效中排到前面', async () => {
    mockGet.mockResolvedValue([
      makeSub({ id: 1, status: 'expired', expires_at: new Date(Date.now() - DAY).toISOString() }),
      makeSub({ id: 2 })
    ])
    const store = useSubscriptionsStore()
    await store.ensureLoaded()
    expect(store.sorted.map((s) => s.id)).toEqual([2, 1])
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `mise run test-user-portal`
Expected: FAIL —— `Failed to resolve import "@/stores/subscriptions"`

- [ ] **Step 3: 实现 `stores/subscriptions.ts`**

```ts
/**
 * 订阅（套餐）store。
 *
 * 两个要点：
 * - **60 秒缓存 + in-flight 去重**：仪表盘的到期横幅、订阅概览与「我的套餐」页会各自调
 *   ensureLoaded，没有这两层就会同帧打三次接口、切页再打一次。
 * - **失败不写时间戳**：请求失败不更新 lastFetchedAt，下次调用立即重试；同时置 error，
 *   让套餐页把「加载失败」与「没有套餐」区分开。
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getMySubscriptions } from '@/api/subscriptions'
import type { UserSubscription } from '@/api/types'
import { sortSubscriptions, isActive, daysRemaining, EXPIRY_SOON_DAYS } from '@/utils/subscription'
import { errMessage } from '@/utils/error'
import i18n from '@/i18n'

/** 缓存窗口：60 秒内不重复请求 */
const CACHE_TTL_MS = 60_000

export const useSubscriptionsStore = defineStore('subscriptions', () => {
  const items = ref<UserSubscription[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref('')
  const lastFetchedAt = ref(0)

  // 进行中的请求，用于并发去重；不需要响应式
  let inflight: Promise<void> | null = null

  const sorted = computed(() => sortSubscriptions(items.value))
  const activeItems = computed(() => items.value.filter((s) => isActive(s)))
  const expiringSoon = computed(() =>
    activeItems.value
      .filter((s) => daysRemaining(s.expires_at) <= EXPIRY_SOON_DAYS)
      .sort((a, b) => daysRemaining(a.expires_at) - daysRemaining(b.expires_at))
  )

  async function fetchAll(): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      items.value = await getMySubscriptions()
      loaded.value = true
      lastFetchedAt.value = Date.now()
    } catch (e) {
      // 不写 lastFetchedAt：下次调用不会被缓存挡住，可立即重试
      error.value = errMessage(e, i18n.global.t('subscriptions.loadFailed'))
    } finally {
      loading.value = false
    }
  }

  /** 发起（或复用）一次拉取 */
  function run(): Promise<void> {
    if (inflight) return inflight
    inflight = fetchAll().finally(() => {
      inflight = null
    })
    return inflight
  }

  /** 缓存有效则直接返回，否则拉取；并发调用共享同一次请求 */
  async function ensureLoaded(): Promise<void> {
    if (inflight) return inflight
    if (loaded.value && Date.now() - lastFetchedAt.value < CACHE_TTL_MS) return
    await run()
  }

  /** 强制刷新（忽略缓存） */
  async function refresh(): Promise<void> {
    lastFetchedAt.value = 0
    await run()
  }

  return { items, loading, loaded, error, sorted, activeItems, expiringSoon, ensureLoaded, refresh }
})
```

- [ ] **Step 4: 运行测试确认通过**

Run: `mise run test-user-portal`
Expected: PASS

> 若 `subscriptions.loadFailed` 尚未在语言包里（Task 3 才加），`i18n.global.t` 会回退输出键名本身，测试只断言 `error !== ''`，不受影响。Task 3 加完键后文案自动正确。

- [ ] **Step 5: 跑 lint**

Run: `mise run lint-user-portal`
Expected: 无输出

- [ ] **Step 6: 提交**

```bash
git add user-portal/src/stores/subscriptions.ts user-portal/src/stores/__tests__/subscriptions.test.ts
git commit -m "$(cat <<'EOF'
feat(user-portal): 新增订阅 store（60 秒缓存 + 并发去重）

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: 套餐卡片组件与 i18n 命名空间

**Files:**
- Create: `user-portal/src/i18n/locales/zh-CN/subscriptions.ts`
- Create: `user-portal/src/i18n/locales/en-US/subscriptions.ts`
- Modify: `user-portal/src/i18n/locales/zh-CN/index.ts`
- Modify: `user-portal/src/i18n/locales/en-US/index.ts`
- Create: `user-portal/src/components/subscriptions/QuotaBar.vue`
- Create: `user-portal/src/components/subscriptions/SubscriptionCard.vue`
- Test: `user-portal/src/components/subscriptions/__tests__/SubscriptionCard.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `quotaWindows` / `hasAnyLimit` / `progressPercent` / `progressLevel` / `expiryLevel` / `daysRemaining` / `windowResetsIn` / `formatRemaining`、类型 `UserSubscription`；现有 `platformMeta`（`@/utils/platform`）、`StatusBadge`（`@/components/ui/StatusBadge.vue`）、`formatBalance` / `formatDateMinute`（`@/utils/format`）
- Produces:
  - `QuotaBar.vue`：props `{ label: string; used: number; limit: number; level: QuotaLevel; resetText: string }`
  - `SubscriptionCard.vue`：props `{ sub: UserSubscription }`，emit `renew: [groupId: number]`
  - i18n 命名空间 `subscriptions.*`

- [ ] **Step 1: 创建 `i18n/locales/zh-CN/subscriptions.ts`**

```ts
/** 我的套餐页 / 仪表盘订阅概览与到期提醒的文案 */
export default {
  pageTitle: '我的套餐',
  pageSubtitle: '查看已购套餐的额度用量与到期时间。',
  empty: '暂无套餐',
  emptyDesc: '订阅套餐后，可在这里查看额度用量与到期时间。',
  emptyAction: '去订阅 →',
  loadFailed: '套餐加载失败',
  status: {
    active: '生效中',
    expired: '已过期',
    suspended: '已暂停',
    revoked: '已撤销'
  },
  expiresAt: '到期时间',
  daysRemaining: '剩余 {days} 天',
  expiredAlready: '已过期',
  renew: '续费',
  quota: {
    DAILY: '日额度',
    WEEKLY: '周额度',
    MONTHLY: '月额度'
  },
  resetIn: '{time} 后重置',
  windowNotStarted: '窗口未启动',
  unlimited: '不限额度',
  unlimitedDesc: '该套餐未设置日 / 周 / 月额度上限',
  rate: '倍率',
  overviewTitle: '订阅额度',
  overviewMore: '查看全部 →',
  expiryBanner: '「{name}」将在 {days} 天后到期',
  expiryBannerMore: '另有 {count} 个套餐即将到期',
  expiryBannerAction: '立即续费',
  dismiss: '关闭提醒'
}
```

- [ ] **Step 2: 创建 `i18n/locales/en-US/subscriptions.ts`**

```ts
/** Copy for the My Plans page and the dashboard subscription overview / expiry banner */
export default {
  pageTitle: 'My Plans',
  pageSubtitle: 'Track quota usage and expiry for your active plans.',
  empty: 'No plans yet',
  emptyDesc: 'Once you subscribe to a plan, its quota usage and expiry show up here.',
  emptyAction: 'Browse plans →',
  loadFailed: 'Failed to load plans',
  status: {
    active: 'Active',
    expired: 'Expired',
    suspended: 'Suspended',
    revoked: 'Revoked'
  },
  expiresAt: 'Expires',
  daysRemaining: '{days} days left',
  expiredAlready: 'Expired',
  renew: 'Renew',
  quota: {
    DAILY: 'Daily quota',
    WEEKLY: 'Weekly quota',
    MONTHLY: 'Monthly quota'
  },
  resetIn: 'Resets in {time}',
  windowNotStarted: 'Window not started',
  unlimited: 'Unlimited',
  unlimitedDesc: 'This plan has no daily / weekly / monthly quota cap',
  rate: 'Rate',
  overviewTitle: 'Plan quota',
  overviewMore: 'View all →',
  expiryBanner: '"{name}" expires in {days} days',
  expiryBannerMore: '{count} more plans expiring soon',
  expiryBannerAction: 'Renew now',
  dismiss: 'Dismiss'
}
```

- [ ] **Step 3: 在两个 `index.ts` 注册命名空间**

`zh-CN/index.ts`：在 `import announcements from './announcements'` 之后加一行 import，并把 `subscriptions` 加进导出对象（放在 `recharge` 之后，与功能相邻）：

```ts
import subscriptions from './subscriptions'
```

```ts
const zhCN = {
  // …
  recharge,
  subscriptions,
  orders,
  // …
}
```

`en-US/index.ts` 做完全相同的两处改动（该文件结构与 zh-CN 一致，导出对象需满足 `MessageSchema` 类型）。

- [ ] **Step 4: 创建 `components/subscriptions/QuotaBar.vue`**

```vue
<script setup lang="ts">
import type { QuotaLevel } from '@/utils/subscription'
import { progressPercent } from '@/utils/subscription'
import { formatBalance } from '@/utils/format'
import { computed } from 'vue'

const props = defineProps<{
  /** 已本地化的额度名（日额度 / 周额度 / 月额度） */
  label: string
  used: number
  limit: number
  level: QuotaLevel
  /** 已本地化的重置副文案；空串则不渲染副文案行 */
  resetText: string
}>()

const percent = computed(() => progressPercent(props.used, props.limit))

// 色阶与 QuotaLevel 一一对应：WARNING 用与 StatusBadge.pending 相同的琥珀色，DANGER 用负向色
const BAR_CLASS: Record<QuotaLevel, string> = {
  NORMAL: 'bg-accent',
  WARNING: 'bg-[#F59E0B]',
  DANGER: 'bg-neg'
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div class="flex items-center justify-between text-[13px]">
      <span class="font-medium text-text2">{{ label }}</span>
      <span class="text-subtle">${{ formatBalance(used) }} / ${{ formatBalance(limit) }}</span>
    </div>
    <div
      class="h-2 overflow-hidden rounded-full bg-track"
      role="progressbar"
      :aria-valuenow="Math.round(percent)"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-label="label"
    >
      <div
        class="h-full rounded-full transition-[width] duration-300"
        :class="BAR_CLASS[level]"
        :style="{ width: `${percent}%` }"
      />
    </div>
    <p
      v-if="resetText"
      class="text-[11px] text-faint"
    >
      {{ resetText }}
    </p>
  </div>
</template>
```

- [ ] **Step 5: 创建 `components/subscriptions/SubscriptionCard.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UserSubscription } from '@/api/types'
import type { ExpiryLevel, QuotaWindow } from '@/utils/subscription'
import {
  quotaWindows,
  hasAnyLimit,
  progressLevel,
  expiryLevel,
  daysRemaining,
  windowResetsIn,
  formatRemaining,
  isActive
} from '@/utils/subscription'
import { platformMeta } from '@/utils/platform'
import { formatDateMinute } from '@/utils/format'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import QuotaBar from './QuotaBar.vue'

const props = defineProps<{ sub: UserSubscription }>()
const emit = defineEmits<{ renew: [groupId: number] }>()

const { t } = useI18n()

const platform = computed(() => platformMeta(props.sub.group?.platform))
const groupName = computed(() => props.sub.group?.name ?? `#${props.sub.group_id}`)
const windows = computed(() => quotaWindows(props.sub))
const unlimited = computed(() => !hasAnyLimit(props.sub))
const active = computed(() => isActive(props.sub))

// 状态徽标：只有生效中走正向色，过期/暂停/撤销一律灰
const badgeVariant = computed(() => (active.value ? 'active' : 'muted'))
const badgeLabel = computed(() => t(`subscriptions.status.${props.sub.status}`))

const level = computed<ExpiryLevel>(() => expiryLevel(props.sub.expires_at))

// 到期文案色阶：紧急红、临近橙、已过期灰
const EXPIRY_CLASS: Record<ExpiryLevel, string> = {
  NORMAL: 'text-text2',
  SOON: 'text-[#C77800]',
  URGENT: 'text-neg',
  EXPIRED: 'text-subtle'
}

const expiryText = computed(() => {
  const date = formatDateMinute(props.sub.expires_at)
  if (level.value === 'EXPIRED') return `${date}（${t('subscriptions.expiredAlready')}）`
  return `${date}（${t('subscriptions.daysRemaining', { days: daysRemaining(props.sub.expires_at) })}）`
})

function quotaLabel(w: QuotaWindow): string {
  return t(`subscriptions.quota.${w.key}`)
}

function quotaLevel(w: QuotaWindow) {
  return progressLevel(w.used, w.limit)
}

function resetText(w: QuotaWindow): string {
  const ms = windowResetsIn(w.windowStart, w.windowHours)
  if (ms === null) return t('subscriptions.windowNotStarted')
  return t('subscriptions.resetIn', { time: formatRemaining(ms) })
}
</script>

<template>
  <div class="flex flex-col rounded-xl3 bg-card p-[22px_24px] shadow-card">
    <!-- 头部：平台圆点 + 分组名 + 状态 + 续费 -->
    <div class="mb-4 flex items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <span
            class="h-1.5 w-1.5 shrink-0 rounded-full"
            :style="{ backgroundColor: platform.color }"
          />
          <h3 class="truncate font-serif text-[19px] font-medium text-text">
            {{ groupName }}
          </h3>
          <span class="shrink-0 text-[11px] font-medium uppercase tracking-[0.1em] text-faint">
            {{ platform.label }}
          </span>
        </div>
        <p
          v-if="sub.group?.description"
          class="mt-1 truncate text-xs text-subtle"
        >
          {{ sub.group.description }}
        </p>
        <p
          v-if="typeof sub.group?.rate_multiplier === 'number'"
          class="mt-1 text-[11px] text-faint"
        >
          {{ $t('subscriptions.rate') }}：{{ sub.group.rate_multiplier }}×
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <StatusBadge
          :label="badgeLabel"
          :variant="badgeVariant"
        />
        <button
          v-if="active"
          class="rounded-full bg-accent px-4 py-[7px] text-xs font-semibold text-white transition-opacity hover:opacity-90"
          @click="emit('renew', sub.group_id)"
        >
          {{ $t('subscriptions.renew') }}
        </button>
      </div>
    </div>

    <!-- 到期时间 -->
    <div class="mb-4 flex items-center justify-between rounded-xl2 bg-muted px-4 py-2.5 text-[13px]">
      <span class="text-subtle">{{ $t('subscriptions.expiresAt') }}</span>
      <span
        class="font-medium"
        :class="EXPIRY_CLASS[level]"
      >{{ expiryText }}</span>
    </div>

    <!-- 额度进度 -->
    <div
      v-if="!unlimited"
      class="flex flex-col gap-4"
    >
      <QuotaBar
        v-for="w in windows"
        :key="w.key"
        :label="quotaLabel(w)"
        :used="w.used"
        :limit="w.limit"
        :level="quotaLevel(w)"
        :reset-text="resetText(w)"
      />
    </div>

    <!-- 无额度上限 -->
    <div
      v-else
      class="flex items-center gap-3 rounded-xl2 bg-muted px-4 py-5"
      data-testid="unlimited-block"
    >
      <span class="text-3xl leading-none text-accent">∞</span>
      <div>
        <p class="text-sm font-medium text-text">
          {{ $t('subscriptions.unlimited') }}
        </p>
        <p class="text-xs text-subtle">
          {{ $t('subscriptions.unlimitedDesc') }}
        </p>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 6: 写组件测试 `components/subscriptions/__tests__/SubscriptionCard.test.ts`**

```ts
// 订阅卡片的三条契约：
// 1. 只渲染「配置了上限」的额度条——多渲染一条空进度条会让用户以为有额度限制；
// 2. 三个上限皆空时必须显示「不限额度」块，而不是整块消失（消失会让人以为卡片渲染坏了）；
// 3. 续费按钮只在生效中出现，且带对的 group_id——按钮带错 id 会跳到别人的套餐。
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import type { UserSubscription } from '@/api/types'
import SubscriptionCard from '../SubscriptionCard.vue'
import zhCN from '@/i18n/locales/zh-CN'

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: false,
  missingWarn: false,
  fallbackWarn: false,
  messages: { 'zh-CN': zhCN }
})

const DAY = 86_400_000

function makeSub(over: Partial<UserSubscription> = {}): UserSubscription {
  return {
    id: 1,
    user_id: 1,
    group_id: 42,
    starts_at: '2026-08-01T00:00:00Z',
    expires_at: new Date(Date.now() + 30 * DAY).toISOString(),
    status: 'active',
    daily_window_start: null,
    weekly_window_start: null,
    monthly_window_start: null,
    daily_usage_usd: 0,
    weekly_usage_usd: 0,
    monthly_usage_usd: 0,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    group: { id: 42, name: 'Claude Pro', platform: 'anthropic' },
    ...over
  }
}

function mountCard(sub: UserSubscription) {
  return mount(SubscriptionCard, { props: { sub }, global: { plugins: [i18n] } })
}

describe('SubscriptionCard：额度渲染', () => {
  it('只配了日额度时只渲染一条进度条', () => {
    const wrapper = mountCard(
      makeSub({ group: { id: 42, name: 'g', daily_limit_usd: 10 }, daily_usage_usd: 3 })
    )
    expect(wrapper.findAll('[role="progressbar"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="unlimited-block"]').exists()).toBe(false)
  })

  it('日周月都配了则渲染三条', () => {
    const wrapper = mountCard(
      makeSub({
        group: { id: 42, name: 'g', daily_limit_usd: 10, weekly_limit_usd: 50, monthly_limit_usd: 200 }
      })
    )
    expect(wrapper.findAll('[role="progressbar"]')).toHaveLength(3)
  })

  it('三个上限皆空时渲染「不限额度」块而非空白', () => {
    const wrapper = mountCard(makeSub({ group: { id: 42, name: 'g' } }))
    expect(wrapper.findAll('[role="progressbar"]')).toHaveLength(0)
    expect(wrapper.find('[data-testid="unlimited-block"]').exists()).toBe(true)
    expect(wrapper.text()).toContain(zhCN.subscriptions.unlimited)
  })
})

describe('SubscriptionCard：状态与续费', () => {
  it('生效中显示续费按钮，点击带出 group_id', async () => {
    const wrapper = mountCard(makeSub())
    const btn = wrapper.find('button')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    expect(wrapper.emitted('renew')?.at(-1)).toEqual([42])
  })

  it('已过期不显示续费按钮，状态文案为「已过期」', () => {
    const wrapper = mountCard(
      makeSub({ status: 'expired', expires_at: new Date(Date.now() - DAY).toISOString() })
    )
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.text()).toContain(zhCN.subscriptions.status.expired)
  })

  it('status 为 active 但已过期时，同样不给续费按钮（后端状态可能滞后）', () => {
    const wrapper = mountCard(makeSub({ expires_at: new Date(Date.now() - DAY).toISOString() }))
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('已撤销显示「已撤销」文案', () => {
    const wrapper = mountCard(makeSub({ status: 'revoked' }))
    expect(wrapper.text()).toContain(zhCN.subscriptions.status.revoked)
  })
})
```

- [ ] **Step 7: 运行测试确认通过**

Run: `mise run test-user-portal`
Expected: PASS（`vue-tsc -b` 同时验证 en-US 语言包键与 zh-CN 齐全；若报某键缺失，补齐 en-US 后重跑）

- [ ] **Step 8: 跑 lint**

Run: `mise run lint-user-portal`
Expected: 无输出

- [ ] **Step 9: 提交**

```bash
git add user-portal/src/i18n user-portal/src/components/subscriptions
git commit -m "$(cat <<'EOF'
feat(user-portal): 新增订阅卡片与额度进度条组件及套餐文案

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: 「我的套餐」页、路由与导航

**Files:**
- Create: `user-portal/src/views/SubscriptionsView.vue`
- Modify: `user-portal/src/router/index.ts`（在 `/keys` 路由之后插入）
- Modify: `user-portal/src/layouts/PortalLayout.vue`（`tabs` 计算属性，约 45-51 行）
- Modify: `user-portal/src/i18n/locales/zh-CN/nav.ts`、`user-portal/src/i18n/locales/en-US/nav.ts`

**Interfaces:**
- Consumes: Task 2 的 `useSubscriptionsStore()`、Task 3 的 `SubscriptionCard.vue`；现有 `PortalLayout`、`PageHeader`、`LoadingSpinner`、`useSettingsStore()`（`settings.purchase_subscription_enabled`）
- Produces: 路由 `{ path: '/subscriptions', name: 'Subscriptions' }`；导航项 `nav.subscriptions`

- [ ] **Step 1: 两个 `nav.ts` 各加一个键**

`zh-CN/nav.ts`：在 `dashboard: '仪表盘',` 之后加 `subscriptions: '我的套餐',`
`en-US/nav.ts`：在 `dashboard: 'Dashboard',` 之后加 `subscriptions: 'My Plans',`

- [ ] **Step 2: 创建 `views/SubscriptionsView.vue`**

```vue
<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import PortalLayout from '@/layouts/PortalLayout.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import SubscriptionCard from '@/components/subscriptions/SubscriptionCard.vue'
import { useSubscriptionsStore } from '@/stores/subscriptions'
import { useSettingsStore } from '@/stores/settings'

const router = useRouter()
const store = useSubscriptionsStore()
const settingsStore = useSettingsStore()

// 站点未开放订阅购买时不给「去订阅」按钮（点进去也是空的），
// 但页面本身照常展示——管理员分配的订阅同样要能看到。
const canPurchase = computed(() => settingsStore.settings?.purchase_subscription_enabled ?? false)

/** 续费：跳到充值页订阅 tab 并定位到该分组的套餐 */
function goRenew(groupId: number) {
  router.push({ path: '/recharge', query: { tab: 'subscription', group: String(groupId) } })
}

onMounted(async () => {
  await settingsStore.ensureLoaded()
  await store.ensureLoaded()
})
</script>

<template>
  <PortalLayout>
    <PageHeader
      :title="$t('subscriptions.pageTitle')"
      :subtitle="$t('subscriptions.pageSubtitle')"
    >
      <template #actions>
        <button
          class="rounded-full bg-card px-4 py-2.5 text-[13px] font-medium text-text2 shadow-pill hover:text-text"
          :disabled="store.loading"
          @click="store.refresh()"
        >
          {{ $t('common.refresh') }}
        </button>
      </template>
    </PageHeader>

    <!-- 加载态 -->
    <div
      v-if="store.loading && !store.loaded"
      class="flex items-center justify-center py-24"
    >
      <LoadingSpinner :size="32" />
    </div>

    <!-- 错误态：与「没有套餐」区分开，给重试 -->
    <div
      v-else-if="store.error && !store.loaded"
      class="rounded-xl3 border border-dashed border-border2 bg-card px-7 py-16 text-center"
    >
      <p class="text-sm text-subtle">
        {{ store.error }}
      </p>
      <button
        class="mt-4 rounded-full border border-text px-5 py-2 text-sm font-semibold text-text"
        @click="store.refresh()"
      >
        {{ $t('common.retry') }}
      </button>
    </div>

    <!-- 空态 -->
    <div
      v-else-if="store.sorted.length === 0"
      class="rounded-xl3 border border-dashed border-border2 bg-card px-7 py-20 text-center"
    >
      <p class="mb-2 font-serif text-lg font-medium text-text">
        {{ $t('subscriptions.empty') }}
      </p>
      <p class="text-sm text-subtle">
        {{ $t('subscriptions.emptyDesc') }}
      </p>
      <button
        v-if="canPurchase"
        class="mt-5 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        @click="router.push({ path: '/recharge', query: { tab: 'subscription' } })"
      >
        {{ $t('subscriptions.emptyAction') }}
      </button>
    </div>

    <!-- 卡片网格 -->
    <div
      v-else
      class="grid grid-cols-1 gap-[22px] lg:grid-cols-2"
    >
      <SubscriptionCard
        v-for="sub in store.sorted"
        :key="sub.id"
        :sub="sub"
        @renew="goRenew"
      />
    </div>
  </PortalLayout>
</template>
```

- [ ] **Step 3: 在 `router/index.ts` 注册路由**

在 `/keys` 路由对象之后、`/pricing` 之前插入：

```ts
  {
    path: '/subscriptions',
    name: 'Subscriptions',
    component: () => import('@/views/SubscriptionsView.vue'),
    meta: { requiresAuth: true, title: 'nav.subscriptions' }
  },
```

- [ ] **Step 4: 在 `PortalLayout.vue` 的 `tabs` 里加导航项**

把 `tabs` 计算属性改成（「我的套餐」插到仪表盘之后）：

```ts
const tabs = computed(() => [
  { name: 'Dashboard', label: t('nav.dashboard'), to: '/dashboard' },
  { name: 'Subscriptions', label: t('nav.subscriptions'), to: '/subscriptions' },
  { name: 'Usage', label: t('nav.usage'), to: '/usage' },
  { name: 'Keys', label: t('nav.keys'), to: '/keys' },
  { name: 'Pricing', label: t('nav.pricing'), to: '/pricing' }
])
```

- [ ] **Step 5: 运行类型检查与测试**

Run: `mise run test-user-portal`
Expected: PASS（新页面无专属单测，靠 `vue-tsc -b` 兜类型；已有路由测试 `src/__tests__/*.test.ts` 不应回归）

- [ ] **Step 6: 跑 lint**

Run: `mise run lint-user-portal`
Expected: 无输出

- [ ] **Step 7: 手工验证（起开发服务器）**

Run: `mise run run-user-portal`（端口 5174）
检查：顶部导航出现「我的套餐」；点进去无订阅时显示空态；有订阅时卡片正常渲染；刷新按钮可用；切英文文案完整无键名裸露。验证完 Ctrl-C 停掉。

- [ ] **Step 8: 提交**

```bash
git add user-portal/src/views/SubscriptionsView.vue user-portal/src/router/index.ts user-portal/src/layouts/PortalLayout.vue user-portal/src/i18n/locales/zh-CN/nav.ts user-portal/src/i18n/locales/en-US/nav.ts
git commit -m "$(cat <<'EOF'
feat(user-portal): 新增我的套餐页并接入顶部导航

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: 仪表盘到期横幅与订阅概览

**Files:**
- Create: `user-portal/src/components/dashboard/ExpiryBanner.vue`
- Create: `user-portal/src/components/dashboard/SubscriptionOverview.vue`
- Modify: `user-portal/src/views/DashboardView.vue`
- Test: `user-portal/src/components/dashboard/__tests__/ExpiryBanner.test.ts`

**Interfaces:**
- Consumes: Task 2 的 `useSubscriptionsStore()`、Task 1 的 `daysRemaining` / `tightestQuota` / `progressPercent` / `progressLevel`、Task 3 的 `subscriptions.*` 文案
- Produces: 两个仪表盘组件，均自管数据（内部调 `store.ensureLoaded()`），`DashboardView` 只负责摆位置

- [ ] **Step 1: 创建 `components/dashboard/ExpiryBanner.vue`**

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSubscriptionsStore } from '@/stores/subscriptions'
import { daysRemaining } from '@/utils/subscription'

const router = useRouter()
const store = useSubscriptionsStore()

// 关闭状态只在本次会话生效：下次打开浏览器还没续费的话，该提醒应该再出现
const DISMISS_KEY = 'subscriptionExpiryBannerDismissed'
const dismissed = ref(false)

const soonest = computed(() => store.expiringSoon[0] ?? null)
const moreCount = computed(() => Math.max(0, store.expiringSoon.length - 1))
const visible = computed(() => !dismissed.value && soonest.value !== null)

const name = computed(() => soonest.value?.group?.name ?? `#${soonest.value?.group_id ?? ''}`)
// 剩余天数向上取整，最小显示 1 天（当天到期不该显示「0 天后到期」）
const days = computed(() => Math.max(1, daysRemaining(soonest.value?.expires_at)))

function dismiss() {
  dismissed.value = true
  try {
    sessionStorage.setItem(DISMISS_KEY, '1')
  } catch {
    // 隐私模式下 sessionStorage 可能不可用，忽略即可（本次渲染已关闭）
  }
}

function goRenew() {
  if (!soonest.value) return
  router.push({
    path: '/recharge',
    query: { tab: 'subscription', group: String(soonest.value.group_id) }
  })
}

onMounted(() => {
  try {
    dismissed.value = sessionStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    dismissed.value = false
  }
  void store.ensureLoaded()
})
</script>

<template>
  <div
    v-if="visible"
    class="mb-[22px] flex flex-wrap items-center justify-between gap-3 rounded-xl3 border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-6 py-4"
    role="status"
  >
    <div class="min-w-0">
      <p class="text-sm font-medium text-text">
        {{ $t('subscriptions.expiryBanner', { name, days }) }}
      </p>
      <button
        v-if="moreCount > 0"
        class="mt-1 text-xs text-subtle underline-offset-2 hover:underline"
        @click="router.push('/subscriptions')"
      >
        {{ $t('subscriptions.expiryBannerMore', { count: moreCount }) }}
      </button>
    </div>
    <div class="flex shrink-0 items-center gap-2">
      <button
        class="rounded-full bg-accent px-5 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
        @click="goRenew"
      >
        {{ $t('subscriptions.expiryBannerAction') }}
      </button>
      <button
        class="rounded-full px-3 py-2 text-[13px] text-subtle hover:text-text"
        :aria-label="$t('subscriptions.dismiss')"
        @click="dismiss"
      >
        ✕
      </button>
    </div>
  </div>
</template>
```

- [ ] **Step 2: 创建 `components/dashboard/SubscriptionOverview.vue`**

```vue
<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useSubscriptionsStore } from '@/stores/subscriptions'
import type { UserSubscription } from '@/api/types'
import {
  tightestQuota,
  progressPercent,
  progressLevel,
  daysRemaining,
  type QuotaLevel
} from '@/utils/subscription'
import { formatBalance } from '@/utils/format'

const router = useRouter()
const store = useSubscriptionsStore()
const { t } = useI18n()

const BAR_CLASS: Record<QuotaLevel, string> = {
  NORMAL: 'bg-accent',
  WARNING: 'bg-[#F59E0B]',
  DANGER: 'bg-neg'
}

/** 概览每行只展示「用得最满」的那条额度；无上限时展示不限额度 */
function quotaOf(sub: UserSubscription) {
  return tightestQuota(sub)
}

function quotaText(sub: UserSubscription): string {
  const w = quotaOf(sub)
  if (!w) return t('subscriptions.unlimited')
  return `${t(`subscriptions.quota.${w.key}`)} $${formatBalance(w.used)} / $${formatBalance(w.limit)}`
}

function barWidth(sub: UserSubscription): string {
  const w = quotaOf(sub)
  return w ? `${progressPercent(w.used, w.limit)}%` : '0%'
}

function barClass(sub: UserSubscription): string {
  const w = quotaOf(sub)
  return BAR_CLASS[w ? progressLevel(w.used, w.limit) : 'NORMAL']
}

onMounted(() => {
  void store.ensureLoaded()
})
</script>

<template>
  <!-- 无生效订阅时整块不渲染：仪表盘不该为一个用不上的功能占位 -->
  <div
    v-if="store.activeItems.length > 0"
    class="mb-[22px] rounded-xl3 bg-card p-[22px_24px] shadow-card"
  >
    <div class="mb-4 flex items-center justify-between">
      <h2 class="font-serif text-[19px] font-medium text-text">
        {{ $t('subscriptions.overviewTitle') }}
      </h2>
      <button
        class="text-[13px] font-medium text-subtle hover:text-text"
        @click="router.push('/subscriptions')"
      >
        {{ $t('subscriptions.overviewMore') }}
      </button>
    </div>

    <div class="flex flex-col gap-4">
      <div
        v-for="sub in store.activeItems"
        :key="sub.id"
        class="flex flex-col gap-1.5"
      >
        <div class="flex items-center justify-between text-[13px]">
          <span class="truncate font-medium text-text2">
            {{ sub.group?.name ?? `#${sub.group_id}` }}
          </span>
          <span class="shrink-0 text-subtle">
            {{ $t('subscriptions.daysRemaining', { days: daysRemaining(sub.expires_at) }) }}
          </span>
        </div>
        <div class="h-2 overflow-hidden rounded-full bg-track">
          <div
            class="h-full rounded-full"
            :class="barClass(sub)"
            :style="{ width: barWidth(sub) }"
          />
        </div>
        <p class="text-[11px] text-faint">
          {{ quotaText(sub) }}
        </p>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 3: 在 `DashboardView.vue` 挂载两个组件**

在 `<script setup>` 的 import 区加：

```ts
import ExpiryBanner from '@/components/dashboard/ExpiryBanner.vue'
import SubscriptionOverview from '@/components/dashboard/SubscriptionOverview.vue'
```

模板里，在页头那个 `<div class="mb-[34px] flex items-start justify-between">…</div>` **闭合之后**、`<!-- 加载态 -->` 之前插入横幅（放在分支之外，仪表盘统计失败时提醒照样出得来）：

```html
    <!-- 订阅到期提醒（独立于仪表盘统计的加载状态） -->
    <ExpiryBanner />
```

在 `<KpiRow :stats="stats" />` **之后**插入概览：

```html
      <SubscriptionOverview />
```

- [ ] **Step 4: 写测试 `components/dashboard/__tests__/ExpiryBanner.test.ts`**

```ts
// 到期横幅的三条契约：
// 1. 没有临期订阅就不能渲染——空横幅会白占仪表盘顶部；
// 2. 多条临期时展示最紧急的那条 + 「另有 N 个」；
// 3. 关闭后本次会话不再出现（写 sessionStorage），否则每次切页都被打断。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { setActivePinia, createPinia } from 'pinia'
import type { UserSubscription } from '@/api/types'
import zhCN from '@/i18n/locales/zh-CN'

vi.mock('@/api/subscriptions', () => ({
  getMySubscriptions: vi.fn()
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() })
}))

import { getMySubscriptions } from '@/api/subscriptions'
import ExpiryBanner from '../ExpiryBanner.vue'

const mockGet = vi.mocked(getMySubscriptions)
const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: false,
  missingWarn: false,
  fallbackWarn: false,
  messages: { 'zh-CN': zhCN }
})
const DAY = 86_400_000

function makeSub(over: Partial<UserSubscription> = {}): UserSubscription {
  return {
    id: 1,
    user_id: 1,
    group_id: 42,
    starts_at: '2026-08-01T00:00:00Z',
    expires_at: new Date(Date.now() + 30 * DAY).toISOString(),
    status: 'active',
    daily_window_start: null,
    weekly_window_start: null,
    monthly_window_start: null,
    daily_usage_usd: 0,
    weekly_usage_usd: 0,
    monthly_usage_usd: 0,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    group: { id: 42, name: 'Claude Pro' },
    ...over
  }
}

async function mountBanner() {
  const wrapper = mount(ExpiryBanner, { global: { plugins: [i18n] } })
  await new Promise((r) => setTimeout(r, 0))
  await wrapper.vm.$nextTick()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  mockGet.mockReset()
  sessionStorage.clear()
})

describe('ExpiryBanner', () => {
  it('没有临期订阅时不渲染', async () => {
    mockGet.mockResolvedValue([makeSub()])
    const wrapper = await mountBanner()
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })

  it('多条临期时展示最紧急的一条与「另有 N 个」', async () => {
    mockGet.mockResolvedValue([
      makeSub({ id: 1, group_id: 1, group: { id: 1, name: '套餐A' }, expires_at: new Date(Date.now() + 5 * DAY).toISOString() }),
      makeSub({ id: 2, group_id: 2, group: { id: 2, name: '套餐B' }, expires_at: new Date(Date.now() + 2 * DAY).toISOString() })
    ])
    const wrapper = await mountBanner()
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('套餐B')
    expect(wrapper.text()).not.toContain('套餐A')
    expect(wrapper.text()).toContain('另有 1 个')
  })

  it('关闭后不再渲染并写入 sessionStorage', async () => {
    mockGet.mockResolvedValue([
      makeSub({ expires_at: new Date(Date.now() + 2 * DAY).toISOString() })
    ])
    const wrapper = await mountBanner()
    const buttons = wrapper.findAll('button')
    await buttons[buttons.length - 1].trigger('click')
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(sessionStorage.getItem('subscriptionExpiryBannerDismissed')).toBe('1')
  })

  it('sessionStorage 已标记关闭时，挂载即不渲染', async () => {
    sessionStorage.setItem('subscriptionExpiryBannerDismissed', '1')
    mockGet.mockResolvedValue([
      makeSub({ expires_at: new Date(Date.now() + 2 * DAY).toISOString() })
    ])
    const wrapper = await mountBanner()
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })
})
```

- [ ] **Step 5: 运行测试确认通过**

Run: `mise run test-user-portal`
Expected: PASS
若「另有 1 个」断言因文案格式对不上而失败，以 `zhCN.subscriptions.expiryBannerMore` 的实际渲染为准调整断言字符串，不要改文案去迁就测试。

- [ ] **Step 6: 跑 lint**

Run: `mise run lint-user-portal`
Expected: 无输出

- [ ] **Step 7: 提交**

```bash
git add user-portal/src/components/dashboard user-portal/src/views/DashboardView.vue
git commit -m "$(cat <<'EOF'
feat(user-portal): 仪表盘新增订阅额度概览与到期提醒横幅

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: 购买侧套餐卡片补齐与续费跳转落地

**Files:**
- Modify: `user-portal/src/utils/platform.ts`
- Modify: `user-portal/src/components/recharge/SubscriptionPlans.vue`
- Modify: `user-portal/src/views/RechargeView.vue`
- Modify: `user-portal/src/i18n/locales/zh-CN/recharge.ts`、`user-portal/src/i18n/locales/en-US/recharge.ts`
- Test: `user-portal/src/components/recharge/__tests__/SubscriptionPlans.test.ts`（新建）

**Interfaces:**
- Consumes: Task 2 的 `useSubscriptionsStore()`（取 `activeItems` 判断续费）、现有 `platformMeta`、类型 `SubscriptionPlan`
- Produces: `SubscriptionPlans.vue` 新增可选 prop `activeGroupIds?: number[]`（由 `RechargeView` 传入）；`RechargeView` 支持 `?tab=subscription&group=<id>`

- [ ] **Step 1: `utils/platform.ts` 补 antigravity**

在 `MAP` 中加一条（紫色与 frontend 的 antigravity 配色一致）：

```ts
  antigravity: { label: 'antigravity', color: '#7C4DFF' },
```

- [ ] **Step 2: 两个 `recharge.ts` 各加三个键**

`zh-CN/recharge.ts`（加在 `selectPlan` 附近）：

```ts
  renewPlan: '续费此套餐',
  discountOff: '立减 {percent}%',
  quotaLabel: '额度',
  unlimitedQuota: '不限额度',
```

`en-US/recharge.ts`：

```ts
  renewPlan: 'Renew this plan',
  discountOff: '{percent}% off',
  quotaLabel: 'Quota',
  unlimitedQuota: 'Unlimited',
```

- [ ] **Step 3: 改造 `SubscriptionPlans.vue`**

`<script setup>` 部分改为：

```ts
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SubscriptionPlan } from '@/api/types'
import { formatBalance } from '@/utils/format'
import { platformMeta, type PlatformMeta } from '@/utils/platform'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    plans: SubscriptionPlan[]
    /** 用户当前生效订阅的分组 ID：命中则该套餐按钮显示为「续费」 */
    activeGroupIds?: number[]
    /** 需要高亮的分组 ID（续费深链跳转定位用），null 表示不高亮 */
    highlightGroupId?: number | null
  }>(),
  { activeGroupIds: () => [], highlightGroupId: null }
)

const emit = defineEmits<{
  subscribe: [plan: SubscriptionPlan]
}>()

interface LimitLine {
  label: string
  value: string
}

interface PlanCard {
  plan: SubscriptionPlan
  /** 原价 > 现价时显示划线 */
  hasDiscount: boolean
  /** 折扣百分比（整数，>0 才展示徽章） */
  discountPercent: number
  /** 仅含后端有值的额度限制行（每张卡只计算一次） */
  limitLines: LimitLine[]
  /** 三个额度上限皆无：展示「不限额度」而非整块消失 */
  unlimited: boolean
  /** 平台标签与圆点色 */
  platform: PlatformMeta
  /** 用户已有该分组的生效订阅 → 按钮文案变「续费」 */
  isRenewal: boolean
}

/** 额度限制行：只展示后端有值的那几行 */
function buildLimitLines(plan: SubscriptionPlan): LimitLine[] {
  const lines: LimitLine[] = []
  if (typeof plan.daily_limit_usd === 'number') {
    lines.push({ label: t('recharge.dailyLimit'), value: `$${formatBalance(plan.daily_limit_usd)}` })
  }
  if (typeof plan.weekly_limit_usd === 'number') {
    lines.push({ label: t('recharge.weeklyLimit'), value: `$${formatBalance(plan.weekly_limit_usd)}` })
  }
  if (typeof plan.monthly_limit_usd === 'number') {
    lines.push({ label: t('recharge.monthlyLimit'), value: `$${formatBalance(plan.monthly_limit_usd)}` })
  }
  return lines
}

/** 折扣百分比：四舍五入取整，非正数视为无折扣 */
function buildDiscountPercent(plan: SubscriptionPlan): number {
  if (typeof plan.original_price !== 'number' || plan.original_price <= plan.price) return 0
  const pct = Math.round((1 - plan.price / plan.original_price) * 100)
  return pct > 0 ? pct : 0
}

// 每张卡的派生数据预计算一次，模板只读不再重复计算
const cards = computed<PlanCard[]>(() =>
  props.plans.map((plan) => {
    const limitLines = buildLimitLines(plan)
    return {
      plan,
      hasDiscount: typeof plan.original_price === 'number' && plan.original_price > plan.price,
      discountPercent: buildDiscountPercent(plan),
      limitLines,
      unlimited: limitLines.length === 0,
      platform: platformMeta(plan.group_platform),
      isRenewal: props.activeGroupIds.includes(plan.group_id)
    }
  })
)

const isEmpty = computed(() => props.plans.length === 0)
```

模板部分改三处（其余保持原样）：

① 把套餐名之上的分组行换成「平台圆点 + 分组名 + 平台标签」——将原来的

```html
      <div class="mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-faint">
        {{ plan.group_name ?? $t('recharge.planFallback') }}
      </div>
```

替换为：

```html
      <div class="mb-1 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-faint">
        <span
          class="h-1.5 w-1.5 shrink-0 rounded-full"
          :style="{ backgroundColor: platform.color }"
        />
        <span class="truncate">{{ plan.group_name ?? $t('recharge.planFallback') }}</span>
        <span class="shrink-0 text-faint/70">{{ platform.label }}</span>
      </div>
```

② 价格区补折扣徽章——在划线原价 `<span>` 之后追加：

```html
        <span
          v-if="discountPercent > 0"
          class="rounded px-1.5 py-0.5 text-[11px] font-semibold text-neg"
          :title="$t('recharge.discountOff', { percent: discountPercent })"
        >
          -{{ discountPercent }}%
        </span>
```

③ 额度限制区补「不限额度」分支——在 `v-if="limitLines.length"` 那个 `<div>` 之后追加同级块：

```html
      <div
        v-else-if="unlimited"
        class="mb-4 flex items-center justify-between rounded-xl border border-dashed border-border2 px-3 py-1.5 text-[13px]"
      >
        <span class="text-subtle">{{ $t('recharge.quotaLabel') }}</span>
        <span class="font-medium text-accent">{{ $t('recharge.unlimitedQuota') }}</span>
      </div>
```

④ 按钮文案按 `isRenewal` 切换——把

```html
        {{ $t('recharge.selectPlan') }}
```

替换为：

```html
        {{ isRenewal ? $t('recharge.renewPlan') : $t('recharge.selectPlan') }}
```

同时 `v-for` 解构要带上新字段：

```html
      v-for="{ plan, hasDiscount, discountPercent, limitLines, unlimited, platform, isRenewal } in cards"
```

- [ ] **Step 4: 改造 `RechargeView.vue` 支持 `?tab=subscription&group=<id>`**

在 `<script setup>` import 区加：

```ts
import { useSubscriptionsStore } from '@/stores/subscriptions'
```

在 `const settingsStore = useSettingsStore()` 之后加：

```ts
const subscriptionsStore = useSubscriptionsStore()

// 已生效订阅的分组集合：套餐卡片据此把「选择此套餐」显示为「续费」
const activeGroupIds = computed(() => subscriptionsStore.activeItems.map((s) => s.group_id))

// 从「我的套餐」「到期横幅」跳来时高亮的分组（约 2 秒后自动淡出）
const highlightGroupId = ref<number | null>(null)
```

在 `ensurePlans()` 之后加定位函数：

```ts
/** 处理 ?tab=subscription&group=<id>：切到订阅 tab 并滚动/高亮对应分组的套餐卡 */
async function applyPlanDeepLink(): Promise<void> {
  if (route.query.tab !== 'subscription' || !showSubscription.value) return
  activeTab.value = 1
  await ensurePlans()

  const groupId = Number(route.query.group)
  if (!Number.isFinite(groupId) || groupId <= 0) return
  // 该分组当前没有在售套餐时静默忽略（只切 tab），不给用户一个指向空处的高亮
  if (!plans.value.some((p) => p.group_id === groupId)) return

  highlightGroupId.value = groupId
  await nextTick()
  document
    .querySelector(`[data-plan-group="${groupId}"]`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  setTimeout(() => {
    highlightGroupId.value = null
  }, 2000)
}
```

在 `onMounted` 里，`await load()` 与预加载之后、`#redeem` 分支之前调用它：

```ts
  await applyPlanDeepLink()
```

并在 `onMounted` 开头附近补一句拉订阅（用于续费文案，失败不影响主流程）：

```ts
  void subscriptionsStore.ensureLoaded()
```

模板里给 `SubscriptionPlans` 传入两个新 prop：

```html
        <SubscriptionPlans
          :plans="plans"
          :active-group-ids="activeGroupIds"
          :highlight-group-id="highlightGroupId"
          @subscribe="onSubscribe"
        />
```

`highlightGroupId` 这个 prop 已在 Step 3 的 props 定义里声明，此处只是把值传进去，无需再改 props。

卡片根元素加锚点与高亮态——把卡片外层 `<div>` 的开标签改为：

```html
    <div
      v-for="{ plan, hasDiscount, discountPercent, limitLines, unlimited, platform, isRenewal } in cards"
      :key="plan.id"
      :data-plan-group="plan.group_id"
      class="flex flex-col rounded-[20px] bg-card p-[24px_26px] shadow-card transition-shadow duration-150 hover:shadow-[0_6px_24px_rgba(0,0,0,0.10)]"
      :class="{ 'ring-2 ring-accent': plan.group_id === highlightGroupId }"
    >
```

- [ ] **Step 5: 写测试 `components/recharge/__tests__/SubscriptionPlans.test.ts`**

```ts
// 套餐卡片补齐的四条契约：
// 1. 已有该分组的生效订阅时按钮必须显示「续费」——显示「选择此套餐」会让用户以为要重新买一份；
// 2. 折扣徽章只在真有折扣时出现，且百分比算对；
// 3. 三个额度上限皆空时显示「不限额度」，不能整块消失；
// 4. 深链高亮只命中目标分组的那张卡。
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import type { SubscriptionPlan } from '@/api/types'
import SubscriptionPlans from '../SubscriptionPlans.vue'
import zhCN from '@/i18n/locales/zh-CN'

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: false,
  missingWarn: false,
  fallbackWarn: false,
  messages: { 'zh-CN': zhCN }
})

function makePlan(over: Partial<SubscriptionPlan> = {}): SubscriptionPlan {
  return {
    id: 1,
    group_id: 42,
    group_name: 'Claude Pro',
    group_platform: 'anthropic',
    name: '月卡',
    price: 20,
    validity_days: 30,
    ...over
  }
}

function mountPlans(plans: SubscriptionPlan[], extra: Record<string, unknown> = {}) {
  return mount(SubscriptionPlans, {
    props: { plans, ...extra },
    global: { plugins: [i18n] }
  })
}

describe('SubscriptionPlans', () => {
  it('无生效订阅时按钮为「选择此套餐」', () => {
    const wrapper = mountPlans([makePlan()])
    expect(wrapper.find('button').text()).toBe(zhCN.recharge.selectPlan)
  })

  it('该分组已有生效订阅时按钮变「续费此套餐」', () => {
    const wrapper = mountPlans([makePlan()], { activeGroupIds: [42] })
    expect(wrapper.find('button').text()).toBe(zhCN.recharge.renewPlan)
  })

  it('有原价时展示折扣徽章，百分比按四舍五入算', () => {
    const wrapper = mountPlans([makePlan({ price: 15, original_price: 20 })])
    expect(wrapper.text()).toContain('-25%')
  })

  it('无原价时不展示折扣徽章', () => {
    const wrapper = mountPlans([makePlan()])
    expect(wrapper.text()).not.toMatch(/-\d+%/)
  })

  it('三个额度上限皆空时展示「不限额度」', () => {
    const wrapper = mountPlans([makePlan()])
    expect(wrapper.text()).toContain(zhCN.recharge.unlimitedQuota)
  })

  it('配了额度上限时不展示「不限额度」', () => {
    const wrapper = mountPlans([makePlan({ daily_limit_usd: 10 })])
    expect(wrapper.text()).not.toContain(zhCN.recharge.unlimitedQuota)
  })

  it('高亮只命中目标分组的卡片', () => {
    const wrapper = mountPlans(
      [makePlan({ id: 1, group_id: 42 }), makePlan({ id: 2, group_id: 43 })],
      { highlightGroupId: 43 }
    )
    const cards = wrapper.findAll('[data-plan-group]')
    expect(cards[0].classes()).not.toContain('ring-accent')
    expect(cards[1].classes()).toContain('ring-accent')
  })

  it('点击按钮抛出对应套餐', async () => {
    const plan = makePlan()
    const wrapper = mountPlans([plan])
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('subscribe')?.at(-1)).toEqual([plan])
  })
})
```

- [ ] **Step 6: 运行测试确认通过**

Run: `mise run test-user-portal`
Expected: PASS

- [ ] **Step 7: 跑 lint**

Run: `mise run lint-user-portal`
Expected: 无输出

- [ ] **Step 8: 手工验证全链路**

Run: `mise run run-user-portal`
检查：
1. 「我的套餐」页点续费 → 跳到充值页且已切到订阅 tab、对应套餐卡有高亮环并滚入视野
2. 仪表盘到期横幅点「立即续费」→ 同上
3. 套餐卡片：已订阅分组按钮显示「续费此套餐」；有原价的显示 `-X%`；无额度上限的显示「不限额度」；平台圆点颜色正确
4. 切英文一遍，无键名裸露
验证完 Ctrl-C 停掉。

- [ ] **Step 9: 提交**

```bash
git add user-portal/src/utils/platform.ts user-portal/src/components/recharge user-portal/src/views/RechargeView.vue user-portal/src/i18n/locales/zh-CN/recharge.ts user-portal/src/i18n/locales/en-US/recharge.ts
git commit -m "$(cat <<'EOF'
feat(user-portal): 套餐卡片补齐平台标识/折扣/不限额度并支持续费深链

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## 完工验收

全部任务完成后跑一遍全量门禁：

```bash
mise run lint-user-portal && mise run test-user-portal
```

两条都绿即完工。任一失败先修再宣称完成，不要口头声称通过。
