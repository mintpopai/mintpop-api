<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import TurnstileWidget from '@/components/common/TurnstileWidget.vue'
import AuthShell from '@/components/auth/AuthShell.vue'
import OidcLoginButton from '@/components/auth/OidcLoginButton.vue'
import { errMessage } from '@/utils/error'
import { IS_APPLICATION_MODE } from '@/config/portal'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()

// 分发模式（解析收口在 config/portal.ts，与仪表盘分布卡片共用）
const IS_APPLICATION = IS_APPLICATION_MODE
// 左侧品牌区标语：APPLICATION 模式改用应用能力文案
const brandDescKey = IS_APPLICATION ? 'auth.loginBrandDescApp' : 'auth.loginBrandDesc'

const account = ref('')
const password = ref('')
const loading = ref(false)
const error = ref<string | null>(null)

// ===== Cloudflare Turnstile（站点开启时后端强制校验，缺 token 即拒绝登录）=====
const turnstileEnabled = computed(
  () => !!settingsStore.settings?.turnstile_enabled && !!settingsStore.settings?.turnstile_site_key
)
const turnstileSiteKey = computed(() => settingsStore.settings?.turnstile_site_key ?? '')
const turnstileToken = ref('')
const turnstileRef = ref<InstanceType<typeof TurnstileWidget> | null>(null)

// 站点开启密码重置时才在登录页展示「忘记密码？」入口
const passwordResetEnabled = computed(() => !!settingsStore.settings?.password_reset_enabled)

// token 是一次性的：每次登录请求（无论成败）都会消费掉，之后必须 reset 重新挑战
function consumeTurnstile() {
  turnstileToken.value = ''
  turnstileRef.value?.reset()
}

onMounted(() => {
  settingsStore.ensureLoaded()
})

// ===== TOTP 两步验证（后端第一步只回 temp_token，第二步换正式 token）=====
const step = ref<'CREDENTIALS' | 'TOTP'>('CREDENTIALS')
const tempToken = ref('')
const emailMasked = ref('')
const totpCode = ref('')

async function onSubmit() {
  if (!account.value || !password.value) {
    error.value = t('auth.errEmptyCredentials')
    return
  }
  if (turnstileEnabled.value && !turnstileToken.value) {
    error.value = t('auth.errTurnstileRequired')
    return
  }
  loading.value = true
  error.value = null
  try {
    const outcome = await authStore.login(account.value, password.value, turnstileToken.value)
    if (outcome.requires2FA) {
      // 进入验证码步骤；此时尚未登录成功，不能跳转
      tempToken.value = outcome.tempToken ?? ''
      emailMasked.value = outcome.emailMasked ?? ''
      step.value = 'TOTP'
      return
    }
    const redirect = (route.query.redirect as string) || '/dashboard'
    router.push(redirect)
  } catch (e) {
    error.value = errMessage(e, t('auth.errLoginFailed'))
    // 失败后 token 已被后端消费，须重新挑战
    consumeTurnstile()
  } finally {
    loading.value = false
  }
}

async function onSubmitTotp() {
  const code = totpCode.value.trim()
  if (!/^\d{6}$/.test(code)) {
    error.value = t('auth.errTotpRequired')
    return
  }
  loading.value = true
  error.value = null
  try {
    await authStore.loginWith2FA(tempToken.value, code)
    const redirect = (route.query.redirect as string) || '/dashboard'
    router.push(redirect)
  } catch (e) {
    error.value = errMessage(e, t('auth.errLoginFailed'))
  } finally {
    loading.value = false
  }
}

// 返回第一步（temp_token 可能已失效/被消费，验证码也应清空重填）
function backToCredentials() {
  step.value = 'CREDENTIALS'
  tempToken.value = ''
  emailMasked.value = ''
  totpCode.value = ''
  error.value = null
  consumeTurnstile()
}
</script>

<template>
  <AuthShell
    :kicker="t('auth.loginKicker')"
    :headline-pre="t('auth.loginHeadlinePre')"
    :headline-mark="t('auth.loginHeadlineMark')"
    :headline-end="t('auth.loginHeadlineEnd')"
    :desc="t(brandDescKey)"
  >
    <div class="mb-8">
      <h1 class="mb-2 font-serif text-4xl font-medium tracking-tight text-text">
        {{ step === 'TOTP' ? t('auth.totpTitle') : t('auth.welcomeBack') }}
      </h1>
      <p class="text-sm text-subtle">
        {{ step === 'TOTP' ? t('auth.totpHint') : t('auth.loginSubtitle') }}
      </p>
    </div>

    <!-- ===== 第二步：TOTP 动态验证码 ===== -->
    <form
      v-if="step === 'TOTP'"
      @submit.prevent="onSubmitTotp"
    >
      <p
        v-if="emailMasked"
        class="mb-4 text-sm text-text3"
      >
        {{ emailMasked }}
      </p>
      <div class="mb-[26px]">
        <label
          for="login-totp"
          class="mb-[9px] block text-xs font-semibold tracking-wide text-text2"
        >{{ t('auth.totpCodeLabel') }}</label>
        <input
          id="login-totp"
          v-model="totpCode"
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="6"
          class="fld pl-4!"
          :placeholder="t('auth.totpPlaceholder')"
        >
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
        <span>{{ loading ? t('auth.signingIn') : t('auth.totpVerify') }}</span>
      </button>

      <button
        type="button"
        class="mt-4 w-full text-center text-sm text-subtle underline-offset-2 hover:text-text hover:underline"
        @click="backToCredentials"
      >
        {{ t('auth.totpBack') }}
      </button>
    </form>

    <!-- ===== 第一步：邮箱 + 密码 ===== -->
    <form
      v-else
      @submit.prevent="onSubmit"
    >
      <OidcLoginButton />

      <div class="mb-[18px]">
        <label
          for="login-email"
          class="mb-[9px] block text-xs font-semibold tracking-wide text-text2"
        >{{ t('auth.emailLabel') }}</label>
        <div class="relative">
          <svg
            class="pointer-events-none absolute left-[15px] top-1/2 -translate-y-1/2 text-faint"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
          ><rect
            x="3"
            y="5"
            width="18"
            height="14"
            rx="2.5"
          /><path d="M3.5 7l8.5 6 8.5-6" /></svg>
          <input
            id="login-email"
            v-model="account"
            type="text"
            autocomplete="username"
            class="fld"
            placeholder="you@example.com"
          >
        </div>
      </div>

      <div class="mb-[26px]">
        <div class="mb-[9px] flex items-baseline justify-between">
          <label
            for="login-password"
            class="text-xs font-semibold tracking-wide text-text2"
          >{{ t('auth.passwordLabel') }}</label>
          <router-link
            v-if="passwordResetEnabled"
            to="/forgot-password"
            class="text-xs font-medium text-subtle underline-offset-2 transition hover:text-text hover:underline"
          >
            {{ t('auth.forgotEntry') }}
          </router-link>
        </div>
        <div class="relative">
          <svg
            class="pointer-events-none absolute left-[15px] top-1/2 -translate-y-1/2 text-faint"
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
            id="login-password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            class="fld"
            :placeholder="t('auth.passwordPlaceholder')"
          >
        </div>
      </div>

      <!-- Turnstile 人机验证（站点开启时展示；token 一次性，失败后自动重挑战） -->
      <div
        v-if="turnstileEnabled"
        class="mb-[18px]"
      >
        <TurnstileWidget
          ref="turnstileRef"
          :site-key="turnstileSiteKey"
          @verify="turnstileToken = $event"
          @expire="turnstileToken = ''"
          @error="turnstileToken = ''"
        />
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
        <span>{{ loading ? t('auth.signingIn') : t('auth.signIn') }}</span>
        <span
          v-if="!loading"
          class="text-base"
        >→</span>
      </button>
    </form>

    <p class="mt-[30px] text-center text-sm text-subtle">
      {{ t('auth.noAccount') }}<router-link
        to="/register"
        class="border-b-2 border-accent pb-px font-semibold text-text"
      >
        {{ t('auth.signUpFree') }}
      </router-link>
    </p>
  </AuthShell>
</template>
