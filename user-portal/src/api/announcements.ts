// 用户公告 —— 复刻主前端 /announcements 契约（后端 routes/user.go 的 authenticated 组）
import { apiClient } from './client'
import type { UserAnnouncement } from './types'

/** 拉取当前用户可见的公告；unreadOnly 为真时只取未读 */
export async function list(unreadOnly = false): Promise<UserAnnouncement[]> {
  const { data } = await apiClient.get<UserAnnouncement[]>('/announcements', {
    params: unreadOnly ? { unread_only: 1 } : {}
  })
  return data
}

/** 标记单条公告已读（幂等） */
export async function markRead(id: number): Promise<void> {
  await apiClient.post(`/announcements/${id}/read`)
}
