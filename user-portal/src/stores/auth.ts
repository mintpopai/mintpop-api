import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { User } from '@/api/types'
import { getProfile } from '@/api/user'
import * as authApi from '@/api/auth'
import { TOKEN_KEY } from '@/api/client'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const loading = ref(false)

  // 故意用普通函数而非 computed：localStorage 不是响应式源，computed 会在首次求值后
  // 永久缓存，login/logout 后不更新（潜伏 bug）。需要响应式登录态请以 user ref 为源。
  function isAuthenticated(): boolean {
    return !!localStorage.getItem(TOKEN_KEY)
  }
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

  async function login(email: string, password: string): Promise<void> {
    const resp = await authApi.login({ email, password })
    if (resp.user) {
      user.value = resp.user
    } else {
      await fetchUser()
    }
  }

  async function logout(): Promise<void> {
    await authApi.logout()
    user.value = null
  }

  return { user, loading, isAuthenticated, balance, fetchUser, login, logout }
})
