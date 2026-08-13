// 公告 store 的三条契约：
// 1. 20 分钟节流——PortalLayout 每次路由切换都会重新挂载并触发拉取，没有节流就是每导航一次打一次接口；
// 2. 弹窗队列去重——同一条强提醒公告在一次会话里只能弹一次，否则用户每切一次页面就被打断；
// 3. 拉取失败要回滚节流时间戳，否则一次网络抖动会让公告在 20 分钟内彻底拉不回来。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { UserAnnouncement } from '@/api/types'

vi.mock('@/api/announcements', () => ({
  list: vi.fn(),
  markRead: vi.fn()
}))

import * as announcementsApi from '@/api/announcements'
import { useAnnouncementStore } from '@/stores/announcements'

const mockList = vi.mocked(announcementsApi.list)
const mockMarkRead = vi.mocked(announcementsApi.markRead)

function makeAnnouncement(over: Partial<UserAnnouncement> = {}): UserAnnouncement {
  return {
    id: 1,
    title: 't',
    content: 'c',
    notify_mode: 'silent',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  mockList.mockReset()
  mockMarkRead.mockReset()
  mockMarkRead.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('fetchAnnouncements', () => {
  it('节流窗口内重复调用只打一次接口，force 可绕过', async () => {
    mockList.mockResolvedValue([makeAnnouncement()])
    const store = useAnnouncementStore()

    await store.fetchAnnouncements()
    await store.fetchAnnouncements()
    expect(mockList).toHaveBeenCalledTimes(1)

    await store.fetchAnnouncements(true)
    expect(mockList).toHaveBeenCalledTimes(2)
  })

  it('拉取失败回滚节流时间戳，下次调用可立即重试', async () => {
    mockList.mockRejectedValueOnce(new Error('boom'))
    const store = useAnnouncementStore()

    await store.fetchAnnouncements()
    expect(store.announcements).toEqual([])

    mockList.mockResolvedValue([makeAnnouncement()])
    await store.fetchAnnouncements()
    expect(mockList).toHaveBeenCalledTimes(2)
    expect(store.announcements).toHaveLength(1)
  })

  it('unreadCount 只统计 read_at 为空的条目', async () => {
    mockList.mockResolvedValue([
      makeAnnouncement({ id: 1 }),
      makeAnnouncement({ id: 2, read_at: '2026-01-02T00:00:00Z' })
    ])
    const store = useAnnouncementStore()

    await store.fetchAnnouncements()
    expect(store.unreadCount).toBe(1)
  })
})

describe('弹窗队列', () => {
  it('只把未读的 popup 公告排进队列，silent 与已读都不弹', async () => {
    mockList.mockResolvedValue([
      makeAnnouncement({ id: 1, notify_mode: 'silent' }),
      makeAnnouncement({ id: 2, notify_mode: 'popup', read_at: '2026-01-02T00:00:00Z' }),
      makeAnnouncement({ id: 3, notify_mode: 'popup' })
    ])
    const store = useAnnouncementStore()

    await store.fetchAnnouncements()
    expect(store.currentPopup?.id).toBe(3)
  })

  it('确认后标已读，并在延时后弹出队列里的下一条', async () => {
    vi.useFakeTimers()
    mockList.mockResolvedValue([
      makeAnnouncement({ id: 1, notify_mode: 'popup' }),
      makeAnnouncement({ id: 2, notify_mode: 'popup' })
    ])
    const store = useAnnouncementStore()

    await store.fetchAnnouncements()
    expect(store.currentPopup?.id).toBe(1)

    store.dismissPopup()
    expect(store.currentPopup).toBeNull()
    expect(mockMarkRead).toHaveBeenCalledWith(1)

    await vi.runAllTimersAsync()
    expect(store.currentPopup?.id).toBe(2)
  })

  it('弹过的公告即便再次出现在拉取结果里也不重复弹', async () => {
    const popup = makeAnnouncement({ id: 7, notify_mode: 'popup' })
    mockList.mockResolvedValue([popup])
    const store = useAnnouncementStore()

    await store.fetchAnnouncements()
    expect(store.currentPopup?.id).toBe(7)

    store.dismissPopup()
    // 后端尚未同步已读时再拉一次，仍是未读态
    mockList.mockResolvedValue([makeAnnouncement({ id: 7, notify_mode: 'popup' })])
    await store.fetchAnnouncements(true)
    expect(store.currentPopup).toBeNull()
  })
})

describe('markAllAsRead', () => {
  it('逐条调用接口并把本地 read_at 补齐', async () => {
    mockList.mockResolvedValue([makeAnnouncement({ id: 1 }), makeAnnouncement({ id: 2 })])
    const store = useAnnouncementStore()

    await store.fetchAnnouncements()
    await store.markAllAsRead()

    expect(mockMarkRead).toHaveBeenCalledTimes(2)
    expect(store.unreadCount).toBe(0)
  })

  it('接口失败向上抛，交由调用方提示', async () => {
    mockList.mockResolvedValue([makeAnnouncement({ id: 1 })])
    mockMarkRead.mockRejectedValue(new Error('boom'))
    const store = useAnnouncementStore()

    await store.fetchAnnouncements()
    await expect(store.markAllAsRead()).rejects.toThrow('boom')
    expect(store.unreadCount).toBe(1)
  })
})

describe('reset', () => {
  it('清空列表、队列与节流状态，换账号后可立即重新拉取', async () => {
    mockList.mockResolvedValue([makeAnnouncement({ id: 1, notify_mode: 'popup' })])
    const store = useAnnouncementStore()

    await store.fetchAnnouncements()
    store.reset()
    expect(store.announcements).toEqual([])
    expect(store.currentPopup).toBeNull()

    await store.fetchAnnouncements()
    expect(mockList).toHaveBeenCalledTimes(2)
    expect(store.currentPopup?.id).toBe(1)
  })
})
