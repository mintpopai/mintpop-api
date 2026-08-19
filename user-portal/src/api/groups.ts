// 分组 —— 用户可见分组列表（密钥筛选/创建表单用）
import { apiClient } from './client'
import type { Group } from './types'

export async function listAvailable(): Promise<Group[]> {
  const { data } = await apiClient.get<Group[]>('/groups/available')
  return data
}

/**
 * 当前用户的专属分组倍率（group_id → 倍率），由管理员按用户配置。
 * 生效倍率 = 专属倍率 ?? 分组默认倍率；未配置任何专属倍率时后端返回 null。
 */
export async function getUserGroupRates(): Promise<Record<number, number>> {
  const { data } = await apiClient.get<Record<number, number> | null>('/groups/rates')
  return data || {}
}
