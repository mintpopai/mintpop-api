<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { exchangePendingOAuth } from '@/api/auth'
import AuthShell from '@/components/auth/AuthShell.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import { errMessage } from '@/utils/error'

const router = useRouter()
const { t } = useI18n()
const authStore = useAuthStore()

// 状态机：处理中 / 需要 TOTP / 引导走邮箱登录（同邮箱待绑定等 pending）/ 出错
const state = ref<'PROCESSING' | 'TOTP' | 'GUIDE' | 'ERROR'>('PROCESSING')
const errorDetail = ref('')
const tempToken = ref('')
const emailMasked = ref('')
const totpCode = ref('')
const loading = ref(false)

onMounted(async () => {
  // 后端失败时把 error 放在 URL fragment（成功不带任何 token 参数）
  const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const fragError = fragment.get('error')
  if (fragError) {
    errorDetail.value = fragment.get('message') || fragError
    state.value = 'ERROR'
    return
  }
  try {
    const resp = await exchangePendingOAuth()
    if (resp.requires_2fa && resp.temp_token) {
      tempToken.value = resp.temp_token
      emailMasked.value = resp.user_email_masked || ''
      state.value = 'TOTP'
      return
    }
    if (resp.access_token) {
      await authStore.fetchUser()
      router.replace(resp.redirect || '/dashboard')
      return
    }
    // 其余 pending（同邮箱待绑定/需补充信息等）v1 统一引导：先邮箱登录，再到个人资料绑定
    state.value = 'GUIDE'
  } catch (e) {
    errorDetail.value = errMessage(e, t('auth.oidcErrExchange'))
    state.value = 'ERROR'
  }
})

async function onSubmitTotp() {
  const code = totpCode.value.trim()
  if (!/^\d{6}$/.test(code)) return
  loading.value = true
  try {
    await authStore.loginWith2FA(tempToken.value, code)
    router.replace('/dashboard')
  } catch (e) {
    errorDetail.value = errMessage(e, t('auth.errLoginFailed'))
    state.value = 'ERROR'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell
    :kicker="t('auth.oidcCallbackKicker')"
    :headline-pre="t('auth.oidcCallbackHeadlinePre')"
    :headline-mark="t('auth.oidcCallbackHeadlineMark')"
    headline-end=""
    :desc="t('auth.loginBrandDesc')"
  >
    <div class="mb-8">
      <h1 class="mb-2 font-serif text-4xl font-medium tracking-tight text-text">
        {{ t('auth.oidcCallbackTitle') }}
      </h1>
    </div>

    <!-- 处理中 -->
    <div
      v-if="state === 'PROCESSING'"
      class="flex items-center gap-3 text-sm text-subtle"
    >
      <LoadingSpinner :size="18" />
      <span>{{ t('auth.oidcProcessing') }}</span>
    </div>

    <!-- 存量 2FA 用户：TOTP 验证码 -->
    <form
      v-else-if="state === 'TOTP'"
      @submit.prevent="onSubmitTotp"
    >
      <p
        v-if="emailMasked"
        class="mb-4 text-sm text-text3"
      >
        {{ emailMasked }}
      </p>
      <div class="mb-[26px]">
        <input
          v-model="totpCode"
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="6"
          class="fld pl-4!"
          :placeholder="t('auth.totpPlaceholder')"
        >
      </div>
      <button
        type="submit"
        :disabled="loading"
        class="flex w-full items-center justify-center gap-2 rounded-xl2 bg-accent py-[15px] text-[15px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
      >
        <LoadingSpinner
          v-if="loading"
          :size="16"
        />
        <span>{{ t('auth.totpVerify') }}</span>
      </button>
    </form>

    <!-- 同邮箱待绑定等：引导先邮箱登录再绑定 -->
    <div v-else-if="state === 'GUIDE'">
      <p class="mb-6 text-sm leading-relaxed text-text2">
        {{ t('auth.oidcBindGuide') }}
      </p>
      <router-link
        to="/login"
        class="block w-full rounded-xl2 bg-accent py-[15px] text-center text-[15px] font-semibold text-white transition hover:opacity-90"
      >
        {{ t('auth.oidcBackToLogin') }}
      </router-link>
    </div>

    <!-- 出错 -->
    <div v-else>
      <p class="mb-2 text-sm font-semibold text-neg">
        {{ t('auth.oidcErrorTitle') }}
      </p>
      <p class="mb-6 text-sm text-text3">
        {{ errorDetail }}
      </p>
      <router-link
        to="/login"
        class="block w-full rounded-xl2 bg-accent py-[15px] text-center text-[15px] font-semibold text-white transition hover:opacity-90"
      >
        {{ t('auth.oidcBackToLogin') }}
      </router-link>
    </div>
  </AuthShell>
</template>
