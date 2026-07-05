import { apiClient, TOKEN_KEY, REFRESH_KEY } from './client'
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  User,
  ValidatePromoCodeResult
} from './types'

/** 登录：成功后落地 token 到 localStorage（2FA 用户第一步不含 token，只回 temp_token） */
export async function login(payload: LoginRequest): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>('/auth/login', payload)
  const token = data.access_token || data.token
  if (token) localStorage.setItem(TOKEN_KEY, token)
  if (data.refresh_token) localStorage.setItem(REFRESH_KEY, data.refresh_token)
  return data
}

/** 2FA 第二步：用 temp_token + TOTP 验证码换正式 token（POST /auth/login/2fa） */
export async function login2FA(tempToken: string, totpCode: string): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>('/auth/login/2fa', {
    temp_token: tempToken,
    totp_code: totpCode
  })
  const token = data.access_token || data.token
  if (token) localStorage.setItem(TOKEN_KEY, token)
  if (data.refresh_token) localStorage.setItem(REFRESH_KEY, data.refresh_token)
  return data
}

/** 注册：成功后落地 token 到 localStorage */
export async function register(payload: RegisterRequest): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>('/auth/register', payload)
  const token = data.access_token || data.token
  if (token) localStorage.setItem(TOKEN_KEY, token)
  if (data.refresh_token) localStorage.setItem(REFRESH_KEY, data.refresh_token)
  return data
}

/** 发送邮箱验证码（注册场景）；站点开启 Turnstile 时必须携带 token */
export async function sendVerifyCode(email: string, turnstileToken?: string): Promise<void> {
  await apiClient.post('/auth/send-verify-code', {
    email,
    turnstile_token: turnstileToken || undefined
  })
}

/** 校验优惠码（公开接口，注册前调用），返回是否有效及赠送金额 */
export async function validatePromoCode(code: string): Promise<ValidatePromoCodeResult> {
  const { data } = await apiClient.post<ValidatePromoCodeResult>('/auth/validate-promo-code', { code })
  return data
}

/** 当前登录用户（含 balance 等基础信息） */
export async function getCurrentUser(): Promise<User> {
  const { data } = await apiClient.get<User>('/auth/me')
  return data
}

/** 登出：通知后端并清理本地 token */
export async function logout(): Promise<void> {
  const refreshToken = localStorage.getItem(REFRESH_KEY)
  try {
    await apiClient.post('/auth/logout', { refresh_token: refreshToken })
  } catch {
    // 忽略登出请求失败，仍然清理本地状态
  } finally {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
  }
}
