import { apiClient } from './client'
import type { AffiliateTransferResponse, User, UserAffiliateDetail } from './types'

/** 用户资料（含余额 balance） */
export async function getProfile(): Promise<User> {
  const { data } = await apiClient.get<User>('/user/profile')
  return data
}

/** 更新当前用户资料（用户名 / 头像） */
export async function updateProfile(profile: {
  username?: string
  avatar_url?: string | null
}): Promise<User> {
  const { data } = await apiClient.put<User>('/user', profile)
  return data
}

/** 邀请返利详情（邀请码 / 返利比例 / 额度 / 已邀请用户） */
export async function getAffiliateDetail(): Promise<UserAffiliateDetail> {
  const { data } = await apiClient.get<UserAffiliateDetail>('/user/aff')
  return data
}

/** 将可用返利额度一键转入账户余额 */
export async function transferAffiliateQuota(): Promise<AffiliateTransferResponse> {
  const { data } = await apiClient.post<AffiliateTransferResponse>('/user/aff/transfer')
  return data
}
