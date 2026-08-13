import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { User } from '@/api/types'
import { getProfile } from '@/api/user'
import * as authApi from '@/api/auth'
import { useAnnouncementStore } from './announcements'
import { useSubscriptionsStore } from './subscriptions'

/** 登录第一步的结果：requires2FA 为真时视图须进入 TOTP 验证码步骤（此时尚无 token） */
export interface LoginOutcome {
  requires2FA: boolean
  tempToken?: string
  emailMasked?: string
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const loading = ref(false)

  // 登录态判定：路由守卫直接读 localStorage（TOKEN_KEY，见 router/index.ts）——localStorage
  // 不是响应式源，不在 store 里包 computed（首次求值后永久缓存，login/logout 后不更新）。
  // 需要响应式登录态请以 user ref 为源。
  const balance = computed(() => user.value?.balance ?? 0)

  /**
   * 拉取用户资料（含余额）。失败不抛、返回 false：
   * - 需要展示错误态的调用方（如 useProfile.load）检查返回值；
   * - 「操作成功后刷新资料」类调用可忽略返回值（刷新失败不该把成功操作误报成失败）。
   */
  async function fetchUser(): Promise<boolean> {
    loading.value = true
    try {
      user.value = await getProfile()
      return true
    } catch (e) {
      console.warn('加载用户资料失败:', e)
      return false
    } finally {
      loading.value = false
    }
  }

  async function login(email: string, password: string, turnstileToken?: string): Promise<LoginOutcome> {
    const resp = await authApi.login({
      email,
      password,
      turnstile_token: turnstileToken || undefined
    })
    // 开启 TOTP 2FA 的用户：后端只回 temp_token 不发 token，不能当登录成功处理
    if (resp.requires_2fa) {
      return { requires2FA: true, tempToken: resp.temp_token, emailMasked: resp.user_email_masked }
    }
    if (resp.user) {
      user.value = resp.user
    } else {
      await fetchUser()
    }
    onSignedIn()
    return { requires2FA: false }
  }

  /** 2FA 第二步：验证码通过后正式登录 */
  async function loginWith2FA(tempToken: string, totpCode: string): Promise<void> {
    const resp = await authApi.login2FA(tempToken, totpCode)
    if (resp.user) {
      user.value = resp.user
    } else {
      await fetchUser()
    }
    onSignedIn()
  }

  /**
   * 登录成功后的统一副作用。SPA 登录不刷新页面，App.vue 的「进站拉公告」早已跑过（那时还没 token），
   * 故这里补一次 force 拉取，保证刚登录就能看到未读的强提醒公告。
   */
  function onSignedIn(): void {
    void useAnnouncementStore().fetchAnnouncements(true)
  }

  async function logout(): Promise<void> {
    await authApi.logout()
    user.value = null
    // 清空公告缓存与「本会话已弹过」记录，避免换账号后看到上一个用户的公告
    useAnnouncementStore().reset()
    // 同理清空订阅缓存，避免换账号后看到上一个用户的套餐（含 60 秒缓存导致的不发请求）
    useSubscriptionsStore().reset()
  }

  return { user, loading, balance, fetchUser, login, loginWith2FA, logout }
})
