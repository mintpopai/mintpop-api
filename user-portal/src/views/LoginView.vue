<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settings'
import AuthShell from '@/components/auth/AuthShell.vue'
import OidcLoginButton from '@/components/auth/OidcLoginButton.vue'
import { IS_APPLICATION_MODE } from '@/config/portal'

const { t } = useI18n()
const settingsStore = useSettingsStore()

// 分发模式（解析收口在 config/portal.ts，与仪表盘分布卡片共用）
const IS_APPLICATION = IS_APPLICATION_MODE
// 左侧品牌区标语：APPLICATION 模式改用应用能力文案
const brandDescKey = IS_APPLICATION ? 'auth.loginBrandDescApp' : 'auth.loginBrandDesc'

// providerName 展示需要 settings，预加载一次（OidcLoginButton 内部也会读）
onMounted(() => {
  settingsStore.ensureLoaded()
})
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
        {{ t('auth.welcomeBack') }}
      </h1>
      <p class="text-sm text-subtle">
        {{ t('auth.loginUnifiedSubtitle') }}
      </p>
    </div>

    <!-- 唯一登录方式：统一账号（OIDC）。邮箱密码/注册/找回均已收敛到认证中心 -->
    <OidcLoginButton standalone />

    <p class="mt-[30px] text-center text-sm text-subtle">
      {{ t('auth.unifiedAccountHint') }}
    </p>
  </AuthShell>
</template>
