<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as authApi from '@/api/auth'
import { onboardOidcAccount } from '@/api/auth'
import { getPublicSettings } from '@/api/settings'
import { useAuthStore } from '@/stores/auth'
import type { PublicSettings } from '@/api/types'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import AuthShell from '@/components/auth/AuthShell.vue'
import { errMessage } from '@/utils/error'
import i18n from '@/i18n'
import {
  clearAffiliateReferralCode,
  loadAffiliateReferralCode,
  pickAffiliateCode,
  storeAffiliateReferralCode
} from '@/utils/affiliateReferral'

// 不用 useI18n()：它要求 i18n 插件已 app.use() 安装到当前 app 实例，而本组件
// 也会在未安装插件的宿主中被挂载（如测试）。直接取全局 composer 的 t 与
// useI18n({ useScope: 'global' }) 拿到的是同一个实例，效果等价（与 AuthShell、utils/composables 同惯例）。
const t = i18n.global.t

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const invitation = ref('')
const promo = ref('')

const settings = ref<PublicSettings | null>(null)
const submitting = ref(false)
const error = ref('')

// 优惠码实时校验状态（有效时展示赠送金额，无效时阻止提交）
const promoValidating = ref(false)
const promoValid = ref(false)
const promoInvalid = ref(false)
const promoBonus = ref<number | null>(null)
const promoMsg = ref<string | null>(null)
let promoTimer: ReturnType<typeof setTimeout> | null = null

// 邀请码实时校验状态（后端开启邀请码注册时必填且须有效）
const invValidating = ref(false)
const invValid = ref(false)
const invInvalid = ref(false)
let invTimer: ReturnType<typeof setTimeout> | null = null

// ===== 邀请返利码（来自邀请链接 ?aff= / ?aff_code=）=====
// 进站即落地 localStorage（30 天 TTL）；affiliate 开启时作为「好友返利码」输入框展示，可改可清空
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
    // 拉取失败时按最常见配置（无邀请码 / 无优惠码）兜底
  }
})

onUnmounted(() => {
  if (promoTimer) clearTimeout(promoTimer)
  if (invTimer) clearTimeout(invTimer)
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

async function onSubmit() {
  error.value = ''
  // 后端开启邀请码注册时邀请码必填且须有效；
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
  // 填了优惠码时同样堵竞态：防抖窗口内提交先同步校验一次，无效则阻止提交
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
  submitting.value = true
  try {
    // 回填已前移到进页时（watch + onMounted），此处以输入框内容为准：用户清空即视为不带返利码
    const aff = affCode.value.trim() || loadAffiliateReferralCode()
    const res = await onboardOidcAccount({
      invitation_code: invitation.value.trim() || undefined,
      promo_code: promo.value.trim() || undefined,
      aff_code: aff || undefined
    })
    clearAffiliateReferralCode()
    await authStore.fetchUser()
    const redirect = (route.query.redirect as string) || res?.redirect || '/dashboard'
    router.replace(redirect)
  } catch (e) {
    error.value = errMessage(e, t('auth.onboardingFailed'))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AuthShell
    :kicker="t('auth.registerKicker')"
    :headline-pre="t('auth.registerHeadlinePre')"
    :headline-mark="t('auth.registerHeadlineMark')"
    :headline-end="t('auth.registerHeadlineEnd')"
    :desc="t('auth.registerBrandDesc')"
  >
    <template #brand-footer>
      <!-- 三步骤（覆盖缺省的模型标签行） -->
      <div class="flex flex-col gap-3.5">
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
    </template>

    <div class="mb-[30px]">
      <h1 class="mb-2 font-serif text-4xl font-medium tracking-tight text-text">
        {{ t('auth.createAccount') }}
      </h1>
      <p class="text-sm text-subtle">
        {{ t('auth.registerSubtitle') }}
      </p>
    </div>

    <form @submit.prevent="onSubmit">
      <!-- 邀请码（仅在站点开启邀请码时显示；开启时必填） -->
      <div
        v-if="settings?.invitation_code_enabled === true"
        class="mb-[22px]"
      >
        <label
          for="onboard-invitation"
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
            id="onboard-invitation"
            v-model="invitation"
            data-test="onboarding-invitation"
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

      <!-- 好友返利码（邀请返利，仅在站点开启返利时显示；?aff= 链接进站自动回填） -->
      <div
        v-if="settings?.affiliate_enabled"
        class="mb-[22px]"
      >
        <label
          for="onboard-aff"
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
            id="onboard-aff"
            v-model="affCode"
            data-test="onboarding-aff"
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
          for="onboard-promo"
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
            id="onboard-promo"
            v-model="promo"
            data-test="onboarding-promo"
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

      <p
        v-if="error"
        class="mb-4 text-sm text-neg"
      >
        {{ error }}
      </p>

      <button
        type="button"
        data-test="onboarding-submit"
        :disabled="submitting"
        class="flex w-full items-center justify-center gap-2 rounded-xl2 bg-accent py-[15px] text-[15px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        style="box-shadow: 0 4px 14px rgba(20, 194, 138, 0.32)"
        @click="onSubmit"
      >
        <LoadingSpinner
          v-if="submitting"
          :size="16"
        />
        <span>{{ submitting ? t('auth.creating') : t('auth.createAccount') }}</span>
        <span
          v-if="!submitting"
          class="text-base"
        >→</span>
      </button>
    </form>
  </AuthShell>
</template>
