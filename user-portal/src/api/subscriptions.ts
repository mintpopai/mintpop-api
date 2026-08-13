// 用户订阅查询 —— 只封 GET /subscriptions：它返回全部订阅且内嵌 group（含日/周/月额度上限），
// /active、/progress、/summary 三个接口的信息量都是它的子集，前端本地算即可，不重复封装。
import { apiClient } from './client'
import type { UserSubscription } from './types'

/** 当前用户的全部订阅（含已过期/已撤销）；排序由前端 sortSubscriptions 负责 */
export async function getMySubscriptions(): Promise<UserSubscription[]> {
  const { data } = await apiClient.get<UserSubscription[]>('/subscriptions')
  return data ?? []
}
