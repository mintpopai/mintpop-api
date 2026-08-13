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
