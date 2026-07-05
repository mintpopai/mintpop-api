// 兑换码充值 —— 复刻主前端 /redeem 契约
import { apiClient } from './client'
import type { RedeemResult } from './types'

/** 使用兑换码（充值余额 / 提升并发） */
export async function redeem(code: string): Promise<RedeemResult> {
  const { data } = await apiClient.post<RedeemResult>('/redeem', { code })
  return data
}
