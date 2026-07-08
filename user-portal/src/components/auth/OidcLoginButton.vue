<script setup lang="ts">
/**
 * 登录页统一登录（OIDC）入口：点击整页跳转到 backend 现成的
 * GET /api/v1/auth/oauth/oidc/start?redirect=<站内路径>（backend 零改动，后端会 302 到认证中心）。
 *
 * 两种形态（standalone prop 切换）：
 * - 默认（inline）：与邮箱密码表单并存时用。仅在 oidc_oauth_enabled 开启时渲染，次要按钮样式 + 「或」分隔线。
 * - standalone：portal 只允许统一登录时用（唯一登录方式）。无条件渲染（不受开关门控，否则关掉开关登录页会空白）、
 *   主按钮样式、无分隔线。
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settings'
import { API_BASE_URL } from '@/api/client'
import { navigateTo } from '@/utils/navigation'

const props = defineProps<{
  /** 唯一登录方式模式：无条件渲染 + 主按钮样式 + 无分隔线 */
  standalone?: boolean
}>()

const route = useRoute()
const { t } = useI18n()
const settingsStore = useSettingsStore()

// standalone 下是唯一入口，必须始终渲染；inline 下受站点开关门控
const visible = computed(() => props.standalone || !!settingsStore.settings?.oidc_oauth_enabled)
const providerName = computed(
  () => settingsStore.settings?.oidc_oauth_provider_name?.trim() || 'mintpop'
)

// 整页导航（非 XHR）：redirect 取当前路由 ?redirect=，与登录表单成功后的跳转目标保持一致
function startLogin(): void {
  const redirectTo = (route.query.redirect as string) || '/dashboard'
  navigateTo(`${API_BASE_URL}/auth/oauth/oidc/start?redirect=${encodeURIComponent(redirectTo)}`)
}
</script>

<template>
  <div
    v-if="visible"
    :class="standalone ? '' : 'mb-6'"
  >
    <button
      type="button"
      :class="
        standalone
          ? 'flex w-full items-center justify-center gap-2 rounded-xl2 bg-accent py-[15px] text-[15px] font-semibold text-white transition hover:opacity-90'
          : 'w-full rounded-xl2 border-[1.5px] border-border2 bg-card py-[13px] text-[15px] font-semibold text-text transition hover:bg-hover'
      "
      :style="standalone ? 'box-shadow: 0 4px 14px rgba(20, 194, 138, 0.32)' : undefined"
      @click="startLogin"
    >
      {{ t('auth.oidcSignIn', { provider: providerName }) }}
    </button>
    <div
      v-if="!standalone"
      class="mt-6 flex items-center gap-3"
    >
      <div class="h-px flex-1 bg-track" />
      <span class="text-xs text-subtle">{{ t('auth.oidcOr') }}</span>
      <div class="h-px flex-1 bg-track" />
    </div>
  </div>
</template>
