// 订阅 store 的五条契约：
// 1. 60 秒缓存——仪表盘与套餐页会各自 ensureLoaded，没有缓存就是每次导航打一次接口；
// 2. in-flight 去重——两个组件同帧挂载只能发一次请求，且两边都要等到数据；
// 3. refresh 必须绕过缓存——页面上的刷新按钮点了要真刷新；
// 4. 失败不写时间戳且置 error——否则一次网络抖动会让套餐页 60 秒内空着且看不出是失败；
// 5. reset 必须彻底——退出登录不刷新页面，残留状态 / 残留缓存时间戳会让下一个用户看到上一个用户的套餐。
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

describe('reset', () => {
  it('清空数据，且之后的 ensureLoaded 必须真的重新发请求（不被 60 秒缓存挡住）', async () => {
    mockGet.mockResolvedValue([makeSub({ id: 1 })])
    const store = useSubscriptionsStore()
    await store.ensureLoaded()
    expect(store.items).toHaveLength(1)

    store.reset()
    expect(store.items).toEqual([])
    expect(store.loaded).toBe(false)
    expect(store.error).toBe('')

    // 关键：紧接着（远在 60 秒缓存窗口内）再 ensureLoaded 必须重新打接口，
    // 否则换账号后下一个用户会直接看到上一个用户的套餐
    mockGet.mockResolvedValue([makeSub({ id: 2 })])
    await store.ensureLoaded()
    expect(mockGet).toHaveBeenCalledTimes(2)
    expect(store.items.map((s) => s.id)).toEqual([2])
  })

  it('清空 error，退出后重新登录不残留上一个会话的错误态', async () => {
    mockGet.mockRejectedValueOnce(new Error('boom'))
    const store = useSubscriptionsStore()
    await store.ensureLoaded()
    expect(store.error).not.toBe('')

    store.reset()
    expect(store.error).toBe('')
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
