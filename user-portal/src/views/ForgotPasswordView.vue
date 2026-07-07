<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settings'
import AuthShell from '@/components/auth/AuthShell.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import TurnstileWidget from '@/components/common/TurnstileWidget.vue'
import { forgotPassword } from '@/api/auth'
import { errMessage } from '@/utils/error'

const { t } = useI18n()
const settingsStore = useSettingsStore()

const email = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
// 提交成功后切到「邮件已发送」态（后端防枚举：无论邮箱是否注册都返回成功）
const submitted = ref(false)

// ===== Cloudflare Turnstile（站点开启时后端强制校验，缺 token 即拒绝）=====
const turnstileEnabled = computed(
  () => !!settingsStore.settings?.turnstile_enabled && !!settingsStore.settings?.turnstile_site_key
)
const turnstileSiteKey = computed(() => settingsStore.settings?.turnstile_site_key ?? '')
const turnstileToken = ref('')
const turnstileRef = ref<InstanceType<typeof TurnstileWidget> | null>(null)

// token 是一次性的：每次请求（无论成败）都会消费掉，之后必须 reset 重新挑战
function consumeTurnstile() {
  turnstileToken.value = ''
  turnstileRef.value?.reset()
}

onMounted(() => {
  settingsStore.ensureLoaded()
})

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function onSubmit() {
  const value = email.value.trim()
  if (!value) {
    error.value = t('auth.errEmailRequired')
    return
  }
  if (!EMAIL_RE.test(value)) {
    error.value = t('auth.errEmailInvalid')
    return
  }
  if (turnstileEnabled.value && !turnstileToken.value) {
    error.value = t('auth.errTurnstileRequired')
    return
  }
  loading.value = true
  error.value = null
  try {
    await forgotPassword({
      email: value,
      turnstile_token: turnstileToken.value || undefined
    })
    submitted.value = true
  } catch (e) {
    error.value = errMessage(e, t('auth.errSendResetFailed'))
    // 失败后 token 已被后端消费，须重新挑战
    consumeTurnstile()
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
        {{ t('auth.forgotTitle') }}
      </h1>
      <p class="text-sm text-subtle">
        {{ t('auth.forgotSubtitle') }}
      </p>
    </div>

    <!-- ===== 成功态：邮件已发送 ===== -->
    <div v-if="submitted">
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
          {{ t('auth.resetEmailSent') }}
        </h2>
        <p class="mt-2 text-sm leading-relaxed text-text3">
          {{ t('auth.resetEmailSentHint') }}
        </p>
      </div>
      <p class="mt-[26px] text-center text-sm text-subtle">
        <router-link
          to="/login"
          class="border-b-2 border-accent pb-px font-semibold text-text"
        >
          {{ t('auth.backToLogin') }}
        </router-link>
      </p>
    </div>

    <!-- ===== 表单态 ===== -->
    <template v-else>
      <form @submit.prevent="onSubmit">
        <div class="mb-[18px]">
          <label
            for="forgot-email"
            class="mb-[9px] block text-xs font-semibold tracking-wide text-text2"
          >{{ t('auth.emailLabel') }}</label>
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
              x="3"
              y="5"
              width="18"
              height="14"
              rx="2.5"
            /><path d="M3.5 7l8.5 6 8.5-6" /></svg>
            <input
              id="forgot-email"
              v-model="email"
              type="email"
              autocomplete="email"
              class="fld"
              placeholder="you@example.com"
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
          <span>{{ loading ? t('auth.sendingResetLink') : t('auth.sendResetLink') }}</span>
          <span
            v-if="!loading"
            class="text-base"
          >→</span>
        </button>
      </form>

      <p class="mt-[30px] text-center text-sm text-subtle">
        {{ t('auth.rememberedPassword') }}<router-link
          to="/login"
          class="border-b-2 border-accent pb-px font-semibold text-text"
        >
          {{ t('auth.signIn') }}
        </router-link>
      </p>
    </template>
  </AuthShell>
</template>
