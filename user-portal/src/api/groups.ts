// 分组 —— 用户可见分组列表（密钥筛选/创建表单用）
import { apiClient } from './client'
import type { Group } from './types'

export async function listAvailable(): Promise<Group[]> {
  const { data } = await apiClient.get<Group[]>('/groups/available')
  return data
}
