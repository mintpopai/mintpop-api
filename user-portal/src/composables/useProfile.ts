import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { updateProfile } from '@/api/user'
import { startBind, unbind as unbindApi } from '@/api/binding'
import { errMessage } from '@/utils/error'

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
      await authStore.fetchUser()
      // fetchUser 失败不抛（内部吞错），故以 user 是否就位判定失败，供视图展示错误态
      if (!authStore.user) {
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
      const { authorize_url } = await startBind({ provider, redirect_to: window.location.origin + '/profile' })
      window.location.href = authorize_url
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
