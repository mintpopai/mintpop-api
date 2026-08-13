// 登录分支契约：后端对开启 TOTP 2FA 的用户返回 { requires_2fa, temp_token }（不含 token）。
// store 必须把该分支透传给视图（进入验证码步骤），绝不能当作登录成功——否则会陷入
// 「登录成功→守卫发现无 token→弹回登录页」的死循环且无任何提示。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { User } from '@/api/types'

vi.mock('@/api/auth', () => ({
  login: vi.fn(),
  login2FA: vi.fn(),
  logout: vi.fn()
}))
vi.mock('@/api/user', () => ({
  getProfile: vi.fn()
}))
// 登录/登出会联动公告 store（拉取 / 重置），挡掉真实请求
vi.mock('@/api/announcements', () => ({
  list: vi.fn(),
  markRead: vi.fn()
}))

import * as authApi from '@/api/auth'
import * as announcementsApi from '@/api/announcements'
import { getProfile } from '@/api/user'
import { useAuthStore } from '@/stores/auth'

const mockLogin = vi.mocked(authApi.login)
const mockLogin2FA = vi.mocked(authApi.login2FA)
const mockGetProfile = vi.mocked(getProfile)
const mockListAnnouncements = vi.mocked(announcementsApi.list)

const USER: User = { id: 1, username: 'u', email: 'u@x.com', balance: 3 }

beforeEach(() => {
  setActivePinia(createPinia())
  mockLogin.mockReset()
  mockLogin2FA.mockReset()
  mockGetProfile.mockReset()
  mockListAnnouncements.mockReset()
  mockListAnnouncements.mockResolvedValue([])
})

describe('authStore.login', () => {
  it('普通登录：返回 requires2FA=false 并落地用户', async () => {
    mockLogin.mockResolvedValue({ access_token: 't', user: USER })
    const store = useAuthStore()
    const outcome = await store.login('u@x.com', 'pw')
    expect(outcome.requires2FA).toBe(false)
    expect(store.user).toEqual(USER)
  })

  it('2FA 用户：返回 requires2FA=true + temp_token，不落地用户、不视为登录成功', async () => {
    mockLogin.mockResolvedValue({ requires_2fa: true, temp_token: 'tmp-1', user_email_masked: 'u***@x.com' })
    const store = useAuthStore()
    const outcome = await store.login('u@x.com', 'pw')
    expect(outcome).toEqual({ requires2FA: true, tempToken: 'tmp-1', emailMasked: 'u***@x.com' })
    expect(store.user).toBeNull()
  })

  // SPA 登录不刷新页面，App.vue 的「进站拉公告」在没 token 时已跳过，
  // 登录成功必须自己补一次，否则刚登录看不到未读的强提醒公告。
  it('登录成功后立即拉取公告，且不受节流影响', async () => {
    mockLogin.mockResolvedValue({ access_token: 't', user: USER })
    const store = useAuthStore()
    await store.login('u@x.com', 'pw')
    expect(mockListAnnouncements).toHaveBeenCalledTimes(1)
  })

  it('2FA 第一步未真正登录，不拉公告', async () => {
    mockLogin.mockResolvedValue({ requires_2fa: true, temp_token: 'tmp-1' })
    const store = useAuthStore()
    await store.login('u@x.com', 'pw')
    expect(mockListAnnouncements).not.toHaveBeenCalled()
  })

  it('透传 Turnstile token（站点开启人机验证时后端强制校验）', async () => {
    mockLogin.mockResolvedValue({ access_token: 't', user: USER })
    const store = useAuthStore()
    await store.login('u@x.com', 'pw', 'ts-token')
    expect(mockLogin).toHaveBeenCalledWith({ email: 'u@x.com', password: 'pw', turnstile_token: 'ts-token' })
  })
})

describe('authStore.loginWith2FA', () => {
  it('验证码通过后落地用户（对齐 POST /auth/login/2fa 契约）', async () => {
    mockLogin2FA.mockResolvedValue({ access_token: 't', user: USER })
    const store = useAuthStore()
    await store.loginWith2FA('tmp-1', '123456')
    expect(mockLogin2FA).toHaveBeenCalledWith('tmp-1', '123456')
    expect(store.user).toEqual(USER)
  })
})
