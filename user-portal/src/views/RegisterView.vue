<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import * as authApi from '@/api/auth'
import { getPublicSettings } from '@/api/settings'
import { updateProfile } from '@/api/user'
import { useAuthStore } from '@/stores/auth'
import type { PublicSettings } from '@/api/types'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import TurnstileWidget from '@/components/common/TurnstileWidget.vue'
import { errMessage } from '@/utils/error'
import {
  clearAffiliateReferralCode,
  loadAffiliateReferralCode,
  pickAffiliateCode,
  storeAffiliateReferralCode
} from '@/utils/affiliateReferral'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const authStore = useAuthStore()

const username = ref('')
const email = ref('')
const password = ref('')
const confirm = ref('')
const invitation = ref('')
const promo = ref('')
const verifyCode = ref('')
// 协议勾选必须默认不勾选：预勾选在 GDPR 等合规口径下不构成有效同意
const agreed = ref(false)

const settings = ref<PublicSettings | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

// ===== Cloudflare Turnstile（站点开启时后端对注册与发验证码都强制校验）=====
const turnstileEnabled = computed(
  () => !!settings.value?.turnstile_enabled && !!settings.value?.turnstile_site_key
)
const turnstileSiteKey = computed(() => settings.value?.turnstile_site_key ?? '')
const turnstileToken = ref('')
const turnstileRef = ref<InstanceType<typeof TurnstileWidget> | null>(null)

// token 是一次性的：发验证码 / 注册每发一次请求（无论成败）都会消费掉，之后须 reset 重新挑战
function consumeTurnstile() {
  turnstileToken.value = ''
  turnstileRef.value?.reset()
}

const sending = ref(false)
const countdown = ref(0)

// 优惠码实时校验状态（有效时展示赠送金额，无效时阻止提交）
const promoValidating = ref(false)
const promoValid = ref(false)
const promoInvalid = ref(false)
const promoBonus = ref<number | null>(null)
const promoMsg = ref<string | null>(null)
let promoTimer: ReturnType<typeof setTimeout> | null = null
let countdownTimer: ReturnType<typeof setInterval> | null = null

// 邀请码实时校验状态（后端开启邀请码注册时必填且须有效，与 frontend 注册页行为对齐）
const invValidating = ref(false)
const invValid = ref(false)
const invInvalid = ref(false)
let invTimer: ReturnType<typeof setTimeout> | null = null

// ===== 邀请返利码（来自邀请链接 ?aff= / ?aff_code=）=====
// 进站即落地 localStorage（30 天 TTL）；affiliate 开启时作为「好友邀请码」输入框展示，可改可清空
const affCode = ref('')

watch(
  () => [route.query.aff, route.query.aff_code],
  ([aff, legacy]) => {
    const code = pickAffiliateCode(aff, legacy)
    if (code) {
      affCode.value = code
      storeAffiliateReferralCode(code)
    }
  },
  { immediate: true }
)

onMounted(async () => {
  // URL 没带码时，回取此前落地的邀请码（30 天内有效）回填到输入框
  if (!affCode.value) {
    affCode.value = loadAffiliateReferralCode()
  }
  try {
    settings.value = await getPublicSettings()
  } catch {
    // 拉取失败时按最常见配置（无邀请码 / 无邮箱验证 / 无优惠码）兜底
  }
})

onUnmounted(() => {
  if (promoTimer) clearTimeout(promoTimer)
  if (invTimer) clearTimeout(invTimer)
  // 验证码倒计时一并清理，避免离开页面后 interval 空转最多 60s
  if (countdownTimer) clearInterval(countdownTimer)
})

function promoErrorMessage(code?: string): string {
  switch (code) {
    case 'PROMO_CODE_NOT_FOUND':
      return t('auth.promoNotFound')
    case 'PROMO_CODE_EXPIRED':
      return t('auth.promoExpired')
    case 'PROMO_CODE_DISABLED':
      return t('auth.promoDisabled')
    case 'PROMO_CODE_MAX_USED':
      return t('auth.promoMaxUsed')
    case 'PROMO_CODE_ALREADY_USED':
      return t('auth.promoAlreadyUsed')
    default:
      return t('auth.promoInvalid')
  }
}

function onPromoInput() {
  promoValid.value = false
  promoInvalid.value = false
  promoBonus.value = null
  promoMsg.value = null
  if (promoTimer) clearTimeout(promoTimer)
  const code = promo.value.trim()
  if (!code) {
    promoValidating.value = false
    return
  }
  promoTimer = setTimeout(() => runPromoValidation(code), 500)
}

async function runPromoValidation(code: string) {
  promoValidating.value = true
  try {
    const res = await authApi.validatePromoCode(code)
    if (res.valid) {
      promoValid.value = true
      promoInvalid.value = false
      promoBonus.value = res.bonus_amount ?? 0
      promoMsg.value = null
    } else {
      promoValid.value = false
      promoInvalid.value = true
      promoMsg.value = promoErrorMessage(res.error_code)
    }
  } catch {
    promoValid.value = false
    promoInvalid.value = true
    promoMsg.value = t('auth.promoInvalid')
  } finally {
    promoValidating.value = false
  }
}

function onInvitationInput() {
  invValid.value = false
  invInvalid.value = false
  if (invTimer) clearTimeout(invTimer)
  const code = invitation.value.trim()
  if (!code) {
    invValidating.value = false
    return
  }
  invTimer = setTimeout(() => runInvitationValidation(code), 500)
}

async function runInvitationValidation(code: string) {
  invValidating.value = true
  try {
    const res = await authApi.validateInvitationCode(code)
    invValid.value = res.valid
    invInvalid.value = !res.valid
  } catch {
    invValid.value = false
    invInvalid.value = true
  } finally {
    invValidating.value = false
  }
}

async function sendCode() {
  if (!email.value) {
    error.value = t('auth.errEmailRequired')
    return
  }
  if (turnstileEnabled.value && !turnstileToken.value) {
    error.value = t('auth.errTurnstileRequired')
    return
  }
  sending.value = true
  error.value = null
  try {
    await authApi.sendVerifyCode(email.value, turnstileToken.value)
    countdown.value = 60
    countdownTimer = setInterval(() => {
      countdown.value -= 1
      if (countdown.value <= 0 && countdownTimer) {
        clearInterval(countdownTimer)
        countdownTimer = null
      }
    }, 1000)
  } catch (e) {
    error.value = errMessage(e, t('auth.errSendCodeFailed'))
  } finally {
    // token 单次有效，发码请求（无论成败）已消费，重新挑战供后续注册提交使用
    consumeTurnstile()
    sending.value = false
  }
}

async function onSubmit() {
  if (!email.value || !password.value) {
    error.value = t('auth.errEmailPasswordRequired')
    return
  }
  if (password.value.length < 6) {
    error.value = t('auth.errPasswordTooShort')
    return
  }
  if (password.value !== confirm.value) {
    error.value = t('auth.errPasswordMismatch')
    return
  }
  if (!agreed.value) {
    error.value = t('auth.errAgreeRequired')
    return
  }
  // 后端开启邀请码注册时邀请码必填且须有效（与 frontend 注册页行为对齐）；
  // 同样堵住防抖窗口内提交的竞态：无结论则先同步校验一次
  if (settings.value?.invitation_code_enabled === true) {
    const code = invitation.value.trim()
    if (!code) {
      error.value = t('auth.errInvitationRequired')
      return
    }
    if (invTimer) {
      clearTimeout(invTimer)
      invTimer = null
    }
    if (!invValid.value && !invInvalid.value) {
      await runInvitationValidation(code)
    }
    if (invInvalid.value) {
      error.value = t('auth.errInvitationInvalid')
      return
    }
  }
  // 填了优惠码时：若尚未得到校验结论（在防抖窗口内点击提交），先取消防抖并同步校验一次，
  // 堵住「防抖未触发 → 结论未出 → 直接放行注册」的竞态；无效则阻止提交
  if (promo.value.trim()) {
    if (promoTimer) {
      clearTimeout(promoTimer)
      promoTimer = null
    }
    if (!promoValid.value && !promoInvalid.value) {
      await runPromoValidation(promo.value.trim())
    }
    if (promoInvalid.value) {
      error.value = t('auth.errPromoInvalid')
      return
    }
  }
  if (turnstileEnabled.value && !turnstileToken.value) {
    error.value = t('auth.errTurnstileRequired')
    return
  }
  loading.value = true
  error.value = null
  try {
    // 回填已前移到进页时（watch + onMounted），此处以输入框内容为准：用户清空即视为不带邀请码
    const aff = affCode.value.trim()
    await authApi.register({
      email: email.value,
      password: password.value,
      verify_code: settings.value?.email_verify_enabled ? verifyCode.value : undefined,
      invitation_code: invitation.value.trim() || undefined,
      promo_code: promo.value.trim() || undefined,
      turnstile_token: turnstileToken.value || undefined,
      aff_code: aff || undefined
    })
    clearAffiliateReferralCode()
    // 后端由邮箱派生用户名，若填写了昵称则注册后补充资料
    if (username.value.trim()) {
      try {
        await updateProfile({ username: username.value.trim() })
      } catch {
        // 资料补充失败不阻断注册成功流程
      }
    }
    await authStore.fetchUser()
    router.push('/dashboard')
  } catch (e) {
    error.value = errMessage(e, t('auth.errRegisterFailed'))
    // 失败后 token 已被后端消费，须重新挑战
    consumeTurnstile()
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen font-sans">
    <!-- ============ 左侧品牌区 ============ -->
    <div
      class="relative hidden w-[46%] flex-none flex-col justify-between overflow-hidden border-r border-border bg-muted px-14 py-[54px] lg:flex"
    >
      <div
        class="pointer-events-none absolute right-[-90px] top-[-70px] h-[340px] w-[340px] opacity-50"
        style="background: linear-gradient(150deg, #0e9e72 0%, #14c28a 45%, rgba(20, 194, 138, 0) 92%); -webkit-mask-image: radial-gradient(#000 2px, transparent 2.2px); mask-image: radial-gradient(#000 2px, transparent 2.2px); -webkit-mask-size: 18px 18px; mask-size: 18px 18px;"
      />
      <div
        class="pointer-events-none absolute -bottom-20 left-[-70px] h-[260px] w-[260px] opacity-[0.06]"
        style="background: radial-gradient(#1a1a1a 1.7px, transparent 1.9px); background-size: 15px 15px;"
      />

      <div class="relative flex items-center">
        <img
          src="/wordmark-dark.png"
          alt="MintPop API"
          class="block h-8 w-auto dark:hidden"
        >
        <img
          src="/wordmark-light.png"
          alt="MintPop API"
          class="hidden h-8 w-auto dark:block"
        >
      </div>

      <div class="relative max-w-[420px]">
        <div class="mb-5 text-xs font-semibold uppercase tracking-[0.14em] text-pos">
          {{ t('auth.registerKicker') }}
        </div>
        <h2 class="font-serif text-[42px] font-medium leading-[1.12] tracking-tight text-text">
          {{ t('auth.registerHeadlinePre') }}<span class="relative whitespace-nowrap">{{ t('auth.registerHeadlineMark') }}<span
            class="absolute inset-x-0 bottom-0.5 -z-10 h-[9px] rounded-xs bg-accent opacity-[0.28]"
          /></span>{{ t('auth.registerHeadlineEnd') }}
        </h2>
        <p class="mt-5 text-[15px] leading-relaxed text-text3">
          {{ t('auth.registerBrandDesc') }}
        </p>
      </div>

      <!-- 步骤 -->
      <div class="relative flex flex-col gap-3.5">
        <div class="flex items-center gap-[13px]">
          <span class="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-accent text-[13px] font-semibold text-white">1</span>
          <span class="text-sm font-medium text-text2">{{ t('auth.step1') }}</span>
        </div>
        <div class="flex items-center gap-[13px]">
          <span class="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full border-[1.5px] border-border2 bg-card text-[13px] font-semibold text-subtle">2</span>
          <span class="text-sm font-medium text-subtle">{{ t('auth.step2') }}</span>
        </div>
        <div class="flex items-center gap-[13px]">
          <span class="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full border-[1.5px] border-border2 bg-card text-[13px] font-semibold text-subtle">3</span>
          <span class="text-sm font-medium text-subtle">{{ t('auth.step3') }}</span>
        </div>
      </div>
    </div>

    <!-- ============ 右侧表单 ============ -->
    <div class="flex min-w-0 flex-1 items-center justify-center bg-bg px-10 py-12">
      <div class="w-full max-w-[392px]">
        <div class="mb-[30px]">
          <h1 class="mb-2 font-serif text-4xl font-medium tracking-tight text-text">
            {{ t('auth.createAccount') }}
          </h1>
          <p class="text-sm text-subtle">
            {{ t('auth.registerSubtitle') }}
          </p>
        </div>

        <form @submit.prevent="onSubmit">
          <div class="mb-4">
            <label
              for="reg-username"
              class="mb-[9px] block text-xs font-semibold tracking-wide text-text2"
            >{{ t('auth.usernameLabel') }}</label>
            <div class="relative">
              <svg
                class="ico"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
              ><circle
                cx="12"
                cy="8"
                r="4"
              /><path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" /></svg>
              <input
                id="reg-username"
                v-model="username"
                type="text"
                class="fld"
                :placeholder="t('auth.usernamePlaceholder')"
              >
            </div>
          </div>

          <div class="mb-4">
            <label
              for="reg-email"
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
                id="reg-email"
                v-model="email"
                type="email"
                class="fld"
                placeholder="you@example.com"
              >
            </div>
          </div>

          <!-- 邮箱验证码（仅在站点开启邮箱验证时显示） -->
          <div
            v-if="settings?.email_verify_enabled"
            class="mb-4"
          >
            <label
              for="reg-verify-code"
              class="mb-[9px] block text-xs font-semibold tracking-wide text-text2"
            >{{ t('auth.verifyCodeLabel') }}</label>
            <div class="flex gap-2">
              <input
                id="reg-verify-code"
                v-model="verifyCode"
                type="text"
                class="fld pl-4!"
                :placeholder="t('auth.verifyCodePlaceholder')"
              >
              <button
                type="button"
                :disabled="sending || countdown > 0"
                class="flex-none whitespace-nowrap rounded-xl2 border-[1.5px] border-border2 px-3.5 text-[13px] font-medium text-text2 disabled:opacity-50"
                @click="sendCode"
              >
                {{ countdown > 0 ? `${countdown}s` : t('auth.sendCode') }}
              </button>
            </div>
          </div>

          <div class="mb-4 grid grid-cols-2 gap-3">
            <div>
              <label
                for="reg-password"
                class="mb-[9px] block text-xs font-semibold tracking-wide text-text2"
              >{{ t('auth.passwordLabel') }}</label>
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
                  id="reg-password"
                  v-model="password"
                  type="password"
                  class="fld"
                  :placeholder="t('auth.passwordMinPlaceholder')"
                >
              </div>
            </div>
            <div>
              <label
                for="reg-confirm-password"
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
                ><path d="M5 13l4 4 10-10" /></svg>
                <input
                  id="reg-confirm-password"
                  v-model="confirm"
                  type="password"
                  class="fld"
                  :placeholder="t('auth.confirmPasswordPlaceholder')"
                >
              </div>
            </div>
          </div>

          <div
            v-if="settings?.invitation_code_enabled === true"
            class="mb-[22px]"
          >
            <label
              for="reg-invitation"
              class="mb-[9px] block text-xs font-semibold tracking-wide text-text2"
            >{{ t('auth.invitationLabel') }}</label>
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
                y="8"
                width="18"
                height="13"
                rx="2"
              /><path d="M3 12h18M12 8V5a2 2 0 0 1 4 0M12 8V5a2 2 0 0 0-4 0" /></svg>
              <input
                id="reg-invitation"
                v-model="invitation"
                type="text"
                class="fld"
                :placeholder="t('auth.invitationPlaceholder')"
                @input="onInvitationInput"
              >
            </div>
            <p
              v-if="invValidating"
              class="mt-1.5 text-xs text-subtle"
            >
              {{ t('auth.invitationValidating') }}
            </p>
            <p
              v-else-if="invValid"
              class="mt-1.5 text-xs font-medium text-pos"
            >
              {{ t('auth.invitationValid') }}
            </p>
            <p
              v-else-if="invInvalid"
              class="mt-1.5 text-xs text-neg"
            >
              {{ t('auth.invitationInvalid') }}
            </p>
          </div>

          <!-- 好友邀请码（邀请返利，仅在站点开启返利时显示；?aff= 链接进站自动回填） -->
          <div
            v-if="settings?.affiliate_enabled"
            class="mb-[22px]"
          >
            <label
              for="reg-aff"
              class="mb-[9px] block text-xs font-semibold tracking-wide text-text2"
            >{{ t('auth.affLabel') }} <span class="font-normal text-faint">{{ t('auth.optionalSuffix') }}</span></label>
            <div class="relative">
              <svg
                class="ico"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
              ><circle
                cx="9"
                cy="8"
                r="4"
              /><path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6" /><path d="M19 8v6M16 11h6" /></svg>
              <input
                id="reg-aff"
                v-model="affCode"
                type="text"
                class="fld"
                :placeholder="t('auth.affPlaceholder')"
              >
            </div>
          </div>

          <!-- 优惠码（仅在站点开启优惠码时显示；settings 未加载完成时为 null 不渲染，避免闪烁） -->
          <div
            v-if="settings?.promo_code_enabled"
            class="mb-[22px]"
          >
            <label
              for="reg-promo"
              class="mb-[9px] block text-xs font-semibold tracking-wide text-text2"
            >{{ t('auth.promoLabel') }} <span class="font-normal text-faint">{{ t('auth.optionalSuffix') }}</span></label>
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
                y="8"
                width="18"
                height="4"
                rx="1"
              /><path d="M12 8v13" /><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" /><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" /></svg>
              <input
                id="reg-promo"
                v-model="promo"
                type="text"
                class="fld"
                :placeholder="t('auth.promoPlaceholder')"
                @input="onPromoInput"
              >
            </div>
            <p
              v-if="promoValidating"
              class="mt-1.5 text-xs text-subtle"
            >
              {{ t('auth.promoValidating') }}
            </p>
            <p
              v-else-if="promoValid"
              class="mt-1.5 text-xs font-medium text-pos"
            >
              {{ t('auth.promoValid', { amount: (promoBonus ?? 0).toFixed(2) }) }}
            </p>
            <p
              v-else-if="promoInvalid"
              class="mt-1.5 text-xs text-neg"
            >
              {{ promoMsg }}
            </p>
          </div>

          <label class="mb-[22px] flex cursor-pointer items-start gap-[9px] text-[13px] leading-snug text-text3">
            <input
              v-model="agreed"
              type="checkbox"
              class="mt-0.5 h-[17px] w-[17px] flex-none rounded-[5px] accent-accent"
            >
            <span>{{ t('auth.agreePrefix') }} <router-link
              to="/legal#agreement"
              target="_blank"
              rel="noopener"
              class="font-semibold text-text underline-offset-2 hover:underline"
              @click.stop
            >{{ t('auth.termsOfService') }}</router-link> {{ t('auth.and') }} <router-link
              to="/legal#privacy"
              target="_blank"
              rel="noopener"
              class="font-semibold text-text underline-offset-2 hover:underline"
              @click.stop
            >{{ t('auth.privacyPolicy') }}</router-link></span>
          </label>

          <!-- Turnstile 人机验证（站点开启时展示；发验证码与注册提交都消费该 token） -->
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
            <span>{{ loading ? t('auth.creating') : t('auth.createAccount') }}</span>
            <span
              v-if="!loading"
              class="text-base"
            >→</span>
          </button>
        </form>

        <p class="mt-[26px] text-center text-sm text-subtle">
          {{ t('auth.haveAccount') }}<router-link
            to="/login"
            class="border-b-2 border-accent pb-px font-semibold text-text"
          >
            {{ t('auth.signInDirect') }}
          </router-link>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fld {
  width: 100%;
  font: 400 15px 'Space Grotesk', sans-serif;
  color: var(--text);
  background: var(--card);
  border: 1.5px solid var(--border2);
  border-radius: 12px;
  padding: 14px 16px 14px 44px;
  outline: none;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}
.fld::placeholder {
  color: var(--faint);
}
.fld:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(20, 194, 138, 0.13);
}
.ico {
  position: absolute;
  left: 15px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--faint);
  pointer-events: none;
}
</style>
