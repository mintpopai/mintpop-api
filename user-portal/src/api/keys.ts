// API 密钥管理 —— 复刻主前端 /keys 契约（列表 / 创建 / 更新 / 删除 / 批量用量）
import { apiClient } from './client'
import type {
  ApiKey,
  CreateApiKeyRequest,
  UpdateApiKeyRequest,
  PaginatedResponse,
  ApiKeyUsageStat
} from './types'

export interface KeyListFilters {
  search?: string
  status?: string
  group_id?: number | string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

/** 分页查询当前用户的密钥 */
export async function listKeys(
  page = 1,
  pageSize = 20,
  filters?: KeyListFilters
): Promise<PaginatedResponse<ApiKey>> {
  const { data } = await apiClient.get<PaginatedResponse<ApiKey>>('/keys', {
    params: { page, page_size: pageSize, ...filters }
  })
  return data
}

/** 创建密钥 */
export async function createKey(payload: CreateApiKeyRequest): Promise<ApiKey> {
  const { data } = await apiClient.post<ApiKey>('/keys', payload)
  return data
}

/** 更新密钥 */
export async function updateKey(id: number, updates: UpdateApiKeyRequest): Promise<ApiKey> {
  const { data } = await apiClient.put<ApiKey>(`/keys/${id}`, updates)
  return data
}

/** 切换密钥启用状态 */
export async function toggleKeyStatus(id: number, status: 'active' | 'inactive'): Promise<ApiKey> {
  return updateKey(id, { status })
}

/** 删除密钥 */
export async function deleteKey(id: number): Promise<{ message: string }> {
  const { data } = await apiClient.delete<{ message: string }>(`/keys/${id}`)
  return data
}

/** 批量获取密钥的今日 / 近 30 天实际消费（后端未传时间范围时默认统计近 30 天，并非累计） */
export async function getKeysUsage(apiKeyIds: number[]): Promise<Record<string, ApiKeyUsageStat>> {
  if (apiKeyIds.length === 0) return {}
  const { data } = await apiClient.post<{ stats: Record<string, ApiKeyUsageStat> }>(
    '/usage/dashboard/api-keys-usage',
    { api_key_ids: apiKeyIds }
  )
  return data.stats || {}
}
