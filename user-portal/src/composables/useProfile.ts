import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { updateProfile } from '@/api/user'
import { prepareBindToken, startBind, unbind as unbindApi } from '@/api/binding'
import { errMessage } from '@/utils/error'
import { navigateTo } from '@/utils/navigation'

export function useProfile() {
  const authStore = useAuthStore()
  const { user } = storeToRefs(authStore)
  const toast = useToast()
  const { t } = useI18n()
  const loading = ref(false)
  const error = ref<string | null>(null)


  async function load() {
    loading.value = true
    error.value = null
    try {
      // fetchUser 失败不抛而是返回 false，据此展示错误态（不再用 user 是否为 null 反推）
      if (!(await authStore.fetchUser())) {
        error.value = t('common.loadFailed')
      }
    } finally {
      loading.value = false
    }
  }

  async function saveUsername(username: string) {
    try {
      await updateProfile({ username })
      await authStore.fetchUser()
      toast.success(t('profile.toast.updateSuccess'))
    } catch (e) {
      toast.error(errMessage(e, t('profile.toast.updateFailed')))
    }
  }

  async function saveAvatar(dataUrl: string) {
    try {
      await updateProfile({ avatar_url: dataUrl })
      await authStore.fetchUser()
      toast.success(t('profile.toast.avatarSuccess'))
    } catch (e) {
      toast.error(errMessage(e, t('profile.toast.avatarFailed')))
    }
  }

  async function removeAvatar() {
    try {
      await updateProfile({ avatar_url: null })
      await authStore.fetchUser()
      toast.success(t('profile.toast.avatarRemoved'))
    } catch (e) {
      toast.error(errMessage(e, t('profile.toast.avatarFailed')))
    }
  }

  async function bind(provider: string) {
    try {
      // bind/start 是浏览器导航（无 Authorization 头），身份靠短时 cookie——必须先预置
      await prepareBindToken()
      // redirect_to 必须是 / 开头的相对路径：后端 normalizeUserIdentityRedirect 拒绝绝对 URL
      const { authorize_url } = await startBind({ provider, redirect_to: '/profile' })
      navigateTo(authorize_url)
    } catch (e) {
      toast.error(errMessage(e, t('profile.toast.bindFailed')))
    }
  }

  async function unbind(provider: string) {
    try {
      await unbindApi(provider)
      await authStore.fetchUser()
      toast.success(t('profile.toast.unbindSuccess'))
    } catch (e) {
      toast.error(errMessage(e, t('profile.toast.unbindFailed')))
    }
  }

  return { user, loading, error, load, saveUsername, saveAvatar, removeAvatar, bind, unbind }
}
