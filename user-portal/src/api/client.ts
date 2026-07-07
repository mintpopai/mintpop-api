/**
 * Axios 客户端 —— 复刻主前端的鉴权与通信契约：
 * - baseURL `/api/v1`，withCredentials
 * - Bearer token 取自 localStorage.auth_token
 * - 401 自动用 refresh_token 续期并重放（单次）
 * - 统一返回体 { code, message, data }：code===0 解包 data，否则 reject
 * - GET 自动注入 timezone 与 Accept-Language
 */
import axios, {
  type AxiosInstance,
  type AxiosError,
  type InternalAxiosRequestConfig,
  type AxiosResponse
} from 'axios'
import type { ApiResponse } from './types'
import i18n, { LOCALE_STORAGE_KEY } from '@/i18n'

// 导出供极少数「非 axios、需整页跳转」场景复用（如 OidcLoginButton 拼接 GET start 端点 URL），
// 避免各处各自重复解析 VITE_API_BASE_URL
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

export const TOKEN_KEY = 'auth_token'
export const REFRESH_KEY = 'refresh_token'

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
})

const getTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}

const getLocale = (): string => {
  try {
    return localStorage.getItem(LOCALE_STORAGE_KEY) || navigator.language || 'zh-CN'
  } catch {
    return 'zh-CN'
  }
}

// ==================== 请求拦截器 ====================
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  if (config.headers) {
    config.headers['Accept-Language'] = getLocale()
  }
  if (config.method === 'get') {
    config.params = { ...(config.params || {}), timezone: getTimezone() }
  }
  return config
})

// ==================== Token 续期状态 ====================
let isRefreshing = false
let waiters: Array<(token: string | null) => void> = []

function onRefreshed(token: string | null): void {
  waiters.forEach((cb) => cb(token))
  waiters = []
}

async function doRefresh(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_KEY)
  if (!refreshToken) return null
  try {
    const resp = await axios.post(
      `${API_BASE_URL}/auth/refresh`,
      { refresh_token: refreshToken },
      { withCredentials: true }
    )
    const body = resp.data as ApiResponse<{ access_token?: string; token?: string; refresh_token?: string }>
    // 兜底分支：兼容「响应体未走统一包装」的历史契约，直接读裸 resp.data。
    // 业务失败（code!==0）也会落到这里，但此时该分支读不到 access_token/token 字段，
    // newToken 自然为 null，走下面的登出逻辑，不会误把失败响应当续期成功。
    const data = body?.code === 0 ? body.data : (resp.data as Record<string, string>)
    const newToken = data?.access_token || data?.token || null
    if (newToken) localStorage.setItem(TOKEN_KEY, newToken)
    if (data?.refresh_token) localStorage.setItem(REFRESH_KEY, data.refresh_token)
    return newToken
  } catch {
    return null
  }
}

function clearAuthAndRedirect(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
  if (!window.location.pathname.startsWith('/login')) {
    // 带上当前地址作为 ?redirect=，登录成功后回到原页（与路由守卫的约定一致，LoginView 会消费该参数）
    const target = window.location.pathname + window.location.search + window.location.hash
    window.location.href = `/login?redirect=${encodeURIComponent(target)}`
  }
}

// ==================== 响应拦截器 ====================
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    const body = response.data as ApiResponse<unknown>
    if (body && typeof body === 'object' && 'code' in body) {
      if (body.code === 0) {
        response.data = body.data
      } else {
        return Promise.reject({
          status: response.status,
          code: body.code,
          reason: body.reason,
          message: body.message || 'Unknown error'
        })
      }
    }
    return response
  },
  async (error: AxiosError<ApiResponse<unknown>>) => {
    if (error.code === 'ERR_CANCELED' || axios.isCancel(error)) {
      return Promise.reject(error)
    }

    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    const status = error.response?.status
    const url = String(error.config?.url || '')
    const isAuthEndpoint =
      url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/refresh')

    if (status === 401 && !original?._retry && !isAuthEndpoint) {
      const refreshToken = localStorage.getItem(REFRESH_KEY)
      if (!refreshToken) {
        clearAuthAndRedirect()
        return Promise.reject(normalize(error))
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          waiters.push((token) => {
            if (!token) return reject(normalize(error))
            original._retry = true
            original.headers.Authorization = `Bearer ${token}`
            resolve(apiClient(original))
          })
        })
      }

      original._retry = true
      isRefreshing = true
      const newToken = await doRefresh()
      isRefreshing = false
      onRefreshed(newToken)

      if (!newToken) {
        clearAuthAndRedirect()
        return Promise.reject(normalize(error))
      }
      original.headers.Authorization = `Bearer ${newToken}`
      return apiClient(original)
    }

    return Promise.reject(normalize(error))
  }
)

function normalize(error: AxiosError<ApiResponse<unknown>>) {
  const data = error.response?.data as ApiResponse<unknown> | undefined
  // 无 response = 请求根本没到达服务端（断网/DNS/超时）：axios 的 message 是英文
  // "Network Error"/"timeout of ..."，会原样透出到界面，这里换成本地化提示
  const fallback = error.response
    ? i18n.global.t('common.requestFailed')
    : i18n.global.t('common.networkError')
  return {
    status: error.response?.status,
    code: data?.code ?? error.code,
    reason: data?.reason,
    message: data?.message || (error.response ? error.message : '') || fallback
  }
}
