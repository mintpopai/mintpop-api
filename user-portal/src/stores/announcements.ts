/**
 * 公告 store —— 与主前端 frontend/src/stores/announcements.ts 行为一致。
 *
 * 两个要点：
 * - **节流**：PortalLayout 是「每个页面各自套一层」的布局，路由切换会重新挂载并再次触发拉取，
 *   靠 20 分钟节流兜住，避免每次导航都打一次接口。
 * - **弹窗队列**：notify_mode='popup' 的未读公告逐条弹出，`shownPopupIds` 是会话级去重，
 *   保证同一条在本次会话里只弹一次（即便用户没点确认就刷新了页面外的其它状态）。
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as announcementsApi from '@/api/announcements'
import type { UserAnnouncement } from '@/api/types'

/** 拉取节流窗口：20 分钟内不重复请求 */
const THROTTLE_MS = 20 * 60 * 1000

/** 铃铛列表最多展示的条数（后端按时间倒序返回） */
const MAX_ITEMS = 20

/** 弹出下一条前的间隔，避免两个弹窗瞬间闪切 */
const NEXT_POPUP_DELAY_MS = 300

export const useAnnouncementStore = defineStore('announcements', () => {
  const announcements = ref<UserAnnouncement[]>([])
  const loading = ref(false)
  const lastFetchTime = ref(0)
  const popupQueue = ref<UserAnnouncement[]>([])
  const currentPopup = ref<UserAnnouncement | null>(null)

  // 会话级去重集合：只作查表用，不需要响应式
  let shownPopupIds = new Set<number>()

  const unreadCount = computed(() => announcements.value.filter((a) => !a.read_at).length)

  /** 拉取公告；force 为真时忽略节流（如刚登录） */
  async function fetchAnnouncements(force = false): Promise<void> {
    const now = Date.now()
    if (!force && lastFetchTime.value > 0 && now - lastFetchTime.value < THROTTLE_MS) return

    // 先占住时间戳，防止并发重复请求（而非等请求回来再记）
    lastFetchTime.value = now
    loading.value = true
    try {
      const all = await announcementsApi.list()
      announcements.value = (all ?? []).slice(0, MAX_ITEMS)
      enqueueNewPopups()
    } catch (e) {
      // 失败则回滚时间戳，允许下次立即重试
      lastFetchTime.value = 0
      console.warn('加载公告失败:', e)
    } finally {
      loading.value = false
    }
  }

  /** 把新出现的未读强提醒公告排进弹窗队列 */
  function enqueueNewPopups(): void {
    const fresh = announcements.value.filter(
      (a) => a.notify_mode === 'popup' && !a.read_at && !shownPopupIds.has(a.id)
    )
    if (fresh.length === 0) return

    for (const item of fresh) {
      if (!popupQueue.value.some((q) => q.id === item.id)) popupQueue.value.push(item)
    }
    if (!currentPopup.value) showNextPopup()
  }

  function showNextPopup(): void {
    const next = popupQueue.value.shift()
    if (!next) {
      currentPopup.value = null
      return
    }
    currentPopup.value = next
    shownPopupIds.add(next.id)
  }

  /** 用户确认当前弹窗：立即收起并标已读，队列里还有就接着弹 */
  function dismissPopup(): void {
    const current = currentPopup.value
    if (!current) return
    currentPopup.value = null

    // UI 已经反馈过了，标已读失败不回滚（下次拉取会自然纠正）
    void markAsRead(current.id)

    if (popupQueue.value.length > 0) {
      window.setTimeout(() => showNextPopup(), NEXT_POPUP_DELAY_MS)
    }
  }

  /** 标记单条已读，成功后同步本地 read_at */
  async function markAsRead(id: number): Promise<void> {
    try {
      await announcementsApi.markRead(id)
      const target = announcements.value.find((a) => a.id === id)
      if (target) target.read_at = new Date().toISOString()
    } catch (e) {
      console.warn('标记公告已读失败:', e)
    }
  }

  /** 全部已读；失败向上抛，由调用方提示 */
  async function markAllAsRead(): Promise<void> {
    const unread = announcements.value.filter((a) => !a.read_at)
    if (unread.length === 0) return

    loading.value = true
    try {
      await Promise.all(unread.map((a) => announcementsApi.markRead(a.id)))
      const now = new Date().toISOString()
      announcements.value.forEach((a) => {
        if (!a.read_at) a.read_at = now
      })
    } finally {
      loading.value = false
    }
  }

  /** 退出登录时清空，避免换账号后看到上一个用户的公告 */
  function reset(): void {
    announcements.value = []
    popupQueue.value = []
    currentPopup.value = null
    lastFetchTime.value = 0
    loading.value = false
    shownPopupIds = new Set()
  }

  return {
    announcements,
    loading,
    currentPopup,
    unreadCount,
    fetchAnnouncements,
    dismissPopup,
    markAsRead,
    markAllAsRead,
    reset
  }
})
