// 登录方式绑定 —— 发起第三方绑定（拿授权跳转）/ 解绑
import { apiClient } from './client'
import type { BindStartRequest, BindStartResult, User } from './types'

/**
 * 预置绑定用短时 cookie（POST /auth/oauth/bind-token，对齐主前端 prepareOAuthBindAccessTokenCookie）。
 * 绑定授权地址是「浏览器整页导航」而非 XHR——带不上 Authorization 头，后端 bind/start
 * 识别当前用户全靠这枚 cookie；发起绑定跳转前必须先调本接口，否则必然 401。
 */
export async function prepareBindToken(): Promise<void> {
  await apiClient.post('/auth/oauth/bind-token')
}

/** 发起绑定：返回授权 URL（后端返回的是同源相对路径），前端跳转 */
export async function startBind(req: BindStartRequest): Promise<BindStartResult> {
  const { data } = await apiClient.post<BindStartResult>('/user/auth-identities/bind/start', req)
  return data
}

/** 解绑指定 provider，返回更新后的用户资料 */
export async function unbind(provider: string): Promise<User> {
  const { data } = await apiClient.delete<User>(`/user/account-bindings/${provider}`)
  return data
}
