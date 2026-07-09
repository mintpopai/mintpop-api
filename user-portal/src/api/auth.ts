import { apiClient, TOKEN_KEY, REFRESH_KEY } from './client'
import type {
  LoginRequest,
  LoginResponse,
  OidcPendingExchangeResult,
  OnboardOidcRequest,
  RegisterRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  User,
  ValidateInvitationCodeResult,
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

/** 忘记密码：请求发送重置邮件（后端防枚举——无论邮箱是否注册都返回成功） */
export async function forgotPassword(payload: ForgotPasswordRequest): Promise<void> {
  await apiClient.post('/auth/forgot-password', payload)
}

/** 凭邮件链接里的一次性 token 重置密码（成功后后端吊销全部旧会话，须重新登录） */
export async function resetPassword(payload: ResetPasswordRequest): Promise<void> {
  await apiClient.post('/auth/reset-password', payload)
}

/** 校验优惠码（公开接口，注册前调用），返回是否有效及赠送金额 */
export async function validatePromoCode(code: string): Promise<ValidatePromoCodeResult> {
  const { data } = await apiClient.post<ValidatePromoCodeResult>('/auth/validate-promo-code', { code })
  return data
}

/** 校验邀请码（公开接口，注册前调用）；后端开启邀请码注册时该码必填且须有效 */
export async function validateInvitationCode(code: string): Promise<ValidateInvitationCodeResult> {
  const { data } = await apiClient.post<ValidateInvitationCodeResult>('/auth/validate-invitation-code', {
    code
  })
  return data
}

/** 统一登录回调后凭 cookie 交换结果（POST /auth/oauth/pending/exchange）；拿到 token 即落地 */
export async function exchangePendingOAuth(): Promise<OidcPendingExchangeResult> {
  const { data } = await apiClient.post<OidcPendingExchangeResult>('/auth/oauth/pending/exchange', {})
  if (data.access_token) localStorage.setItem(TOKEN_KEY, data.access_token)
  if (data.refresh_token) localStorage.setItem(REFRESH_KEY, data.refresh_token)
  return data
}

/** 统一登录无密码开户：全新用户凭真实邮箱+三码建号（POST /auth/oauth/oidc/onboard）；
 * 后端返回裸 token 对象（无 ApiResponse 包装），拦截器原样透传，故直接取 response.data */
export async function onboardOidcAccount(
  payload: OnboardOidcRequest
): Promise<OidcPendingExchangeResult> {
  const { data } = await apiClient.post<OidcPendingExchangeResult>(
    '/auth/oauth/oidc/onboard',
    payload
  )
  if (data?.access_token) {
    localStorage.setItem(TOKEN_KEY, data.access_token)
    if (data.refresh_token) localStorage.setItem(REFRESH_KEY, data.refresh_token)
  }
  return data
}

/**
 * 统一登录回调快捷路径：已验证邮箱且本地无同邮箱账号时，后端不落 pending cookie，
 * 而是把 token 直接放进回调 URL 的 fragment（此时调 exchangePendingOAuth 必得 session not found）。
 * 落地方式与上面各函数一致，供 OidcCallbackView 消费 fragment 后调用。
 */
export function applyOidcFragmentToken(accessToken: string, refreshToken?: string): void {
  localStorage.setItem(TOKEN_KEY, accessToken)
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken)
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
