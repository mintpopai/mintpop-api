<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AuthShell from '@/components/auth/AuthShell.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import { resetPassword } from '@/api/auth'
import { errMessage } from '@/utils/error'
import type { ApiError } from '@/api/types'

const route = useRoute()
const { t } = useI18n()

// 重置链接参数（后端邮件里拼的 ?email=&token=）；进入页面即定，无需响应 query 变化
const email = String(route.query.email ?? '')
const token = String(route.query.token ?? '')
const isInvalidLink = !email || !token

const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const showConfirm = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)
const success = ref(false)

async function onSubmit() {
  if (password.value.length < 6) {
    error.value = t('auth.errPasswordTooShort')
    return
  }
  if (password.value !== confirmPassword.value) {
    error.value = t('auth.errPasswordMismatch')
    return
  }
  loading.value = true
  error.value = null
  try {
    await resetPassword({ email, token, new_password: password.value })
    success.value = true
  } catch (e) {
    // token 一次性且有 TTL：后端明确回 INVALID_RESET_TOKEN 时给专门文案引导重新申请
    error.value =
      (e as ApiError)?.reason === 'INVALID_RESET_TOKEN'
        ? t('auth.errTokenInvalid')
        : errMessage(e, t('auth.errResetFailed'))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell
    :kicker="t('auth.forgotKicker')"
    :headline-pre="t('auth.forgotHeadlinePre')"
    :headline-mark="t('auth.forgotHeadlineMark')"
    :headline-end="t('auth.forgotHeadlineEnd')"
    :desc="t('auth.forgotBrandDesc')"
  >
    <div class="mb-8">
      <h1 class="mb-2 font-serif text-4xl font-medium tracking-tight text-text">
        {{ t('auth.resetTitle') }}
      </h1>
      <p class="text-sm text-subtle">
        {{ t('auth.resetSubtitle') }}
      </p>
    </div>

    <!-- ===== 无效链接态：缺 email/token ===== -->
    <div v-if="isInvalidLink">
      <div class="rounded-xl3 border border-border bg-muted p-6 text-center">
        <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neg/10">
          <svg
            class="text-neg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          ><circle
            cx="12"
            cy="12"
            r="9"
          /><path d="M12 8v4M12 16h.01" /></svg>
        </div>
        <h2 class="text-base font-semibold text-text">
          {{ t('auth.invalidResetLink') }}
        </h2>
        <p class="mt-2 text-sm leading-relaxed text-text3">
          {{ t('auth.invalidResetLinkHint') }}
        </p>
      </div>
      <p class="mt-[26px] text-center text-sm text-subtle">
        <router-link
          to="/forgot-password"
          class="border-b-2 border-accent pb-px font-semibold text-text"
        >
          {{ t('auth.requestNewLink') }}
        </router-link>
      </p>
    </div>

    <!-- ===== 成功态 ===== -->
    <div v-else-if="success">
      <div class="rounded-xl3 border border-border bg-muted p-6 text-center">
        <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
          <svg
            class="text-pos"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          ><path d="M20 6L9 17l-5-5" /></svg>
        </div>
        <h2 class="text-base font-semibold text-text">
          {{ t('auth.resetSuccess') }}
        </h2>
        <p class="mt-2 text-sm leading-relaxed text-text3">
          {{ t('auth.resetSuccessHint') }}
        </p>
      </div>
      <router-link
        to="/login"
        class="mt-6 flex w-full items-center justify-center gap-2 rounded-xl2 bg-accent py-[15px] text-[15px] font-semibold text-white transition hover:opacity-90"
        style="box-shadow: 0 4px 14px rgba(20, 194, 138, 0.32)"
      >
        <span>{{ t('auth.goSignIn') }}</span>
        <span class="text-base">→</span>
      </router-link>
    </div>

    <!-- ===== 表单态 ===== -->
    <form
      v-else
      @submit.prevent="onSubmit"
    >
      <div class="mb-[18px]">
        <label
          for="reset-email"
          class="mb-[9px] block text-xs font-semibold tracking-wide text-text2"
        >{{ t('auth.emailLabel') }}</label>
        <input
          id="reset-email"
          :value="email"
          type="email"
          disabled
          class="fld pl-4! opacity-60"
        >
      </div>

      <div class="mb-[18px]">
        <label
          for="reset-password"
          class="mb-[9px] block text-xs font-semibold tracking-wide text-text2"
        >{{ t('auth.newPasswordLabel') }}</label>
        <div class="relative">
          <svg
            class="ico"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
          ><rect
            x="4"
            y="11"
            width="16"
            height="9"
            rx="2"
          /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
          <input
            id="reset-password"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="new-password"
            class="fld pr-12!"
            :placeholder="t('auth.passwordMinPlaceholder')"
          >
          <button
            type="button"
            class="absolute right-[15px] top-1/2 -translate-y-1/2 text-faint transition hover:text-text2"
            :aria-label="showPassword ? t('auth.hidePassword') : t('auth.showPassword')"
            @click="showPassword = !showPassword"
          >
            <svg
              v-if="showPassword"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
            ><path d="M3 3l18 18" /><path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a17.4 17.4 0 0 1-3.2 4.2M6.1 6.1A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.9-1.9" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
            <svg
              v-else
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
            ><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle
              cx="12"
              cy="12"
              r="3"
            /></svg>
          </button>
        </div>
      </div>

      <div class="mb-[26px]">
        <label
          for="reset-confirm"
          class="mb-[9px] block text-xs font-semibold tracking-wide text-text2"
        >{{ t('auth.confirmPasswordLabel') }}</label>
        <div class="relative">
          <svg
            class="ico"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
          ><rect
            x="4"
            y="11"
            width="16"
            height="9"
            rx="2"
          /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
          <input
            id="reset-confirm"
            v-model="confirmPassword"
            :type="showConfirm ? 'text' : 'password'"
            autocomplete="new-password"
            class="fld pr-12!"
            :placeholder="t('auth.confirmPasswordPlaceholder')"
          >
          <button
            type="button"
            class="absolute right-[15px] top-1/2 -translate-y-1/2 text-faint transition hover:text-text2"
            :aria-label="showConfirm ? t('auth.hidePassword') : t('auth.showPassword')"
            @click="showConfirm = !showConfirm"
          >
            <svg
              v-if="showConfirm"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
            ><path d="M3 3l18 18" /><path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a17.4 17.4 0 0 1-3.2 4.2M6.1 6.1A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.9-1.9" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
            <svg
              v-else
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
            ><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle
              cx="12"
              cy="12"
              r="3"
            /></svg>
          </button>
        </div>
      </div>

      <p
        v-if="error"
        class="mb-4 text-sm text-neg"
      >
        {{ error }}
      </p>

      <button
        type="submit"
        :disabled="loading"
        class="flex w-full items-center justify-center gap-2 rounded-xl2 bg-accent py-[15px] text-[15px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        style="box-shadow: 0 4px 14px rgba(20, 194, 138, 0.32)"
      >
        <LoadingSpinner
          v-if="loading"
          :size="16"
        />
        <span>{{ loading ? t('auth.resettingPassword') : t('auth.resetPasswordBtn') }}</span>
      </button>
    </form>
  </AuthShell>
</template>
