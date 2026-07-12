<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settings'
import { useLocaleStore } from '@/stores/locale'
import AuthShell from '@/components/auth/AuthShell.vue'
import OidcLoginButton from '@/components/auth/OidcLoginButton.vue'
import { IS_APPLICATION_MODE, CONTACT_PAGE_URLS } from '@/config/portal'

const { t } = useI18n()
const settingsStore = useSettingsStore()
const localeStore = useLocaleStore()

// 官网联系页入口：跟随当前门户语言跳对应语言路径（zh/en）
const contactUrl = computed(() => CONTACT_PAGE_URLS[localeStore.current])

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

    <!-- 官网联系页入口（外链新开页，语言跟随门户当前语言）：
         写成提示文案的续句，链接词复用品牌区大标题的薄荷绿荧光笔下划线 -->
    <p class="mt-2 text-center text-sm text-subtle">
      {{ t('auth.contactPrompt') }}
      <a
        :href="contactUrl"
        target="_blank"
        rel="noopener"
        class="group font-medium text-text2 transition-colors hover:text-text"
      >
        <span class="relative isolate">{{ t('auth.contactUs') }}<span
          class="absolute inset-x-0 bottom-0 -z-10 h-[7px] rounded-xs bg-accent opacity-[0.28] transition-opacity group-hover:opacity-50"
        /></span>
        <span aria-hidden="true">↗</span>
      </a>
    </p>
  </AuthShell>
</template>
