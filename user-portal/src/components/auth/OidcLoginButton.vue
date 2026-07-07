<script setup lang="ts">
/**
 * 登录页统一登录（OIDC）入口：点击整页跳转到 backend 现成的
 * GET /api/v1/auth/oauth/oidc/start?redirect=<站内路径>（backend 零改动，后端会 302 到认证中心）。
 * 仅在站点开启 oidc_oauth_enabled 时渲染；未启用时不占位（不渲染分隔线）。
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settings'
import { API_BASE_URL } from '@/api/client'
import { navigateTo } from '@/utils/navigation'

const route = useRoute()
const { t } = useI18n()
const settingsStore = useSettingsStore()

const enabled = computed(() => !!settingsStore.settings?.oidc_oauth_enabled)
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
    v-if="enabled"
    class="mb-6"
  >
    <button
      type="button"
      class="w-full rounded-xl2 border-[1.5px] border-border2 bg-card py-[13px] text-[15px] font-semibold text-text transition hover:bg-hover"
      @click="startLogin"
    >
      {{ t('auth.oidcSignIn', { provider: providerName }) }}
    </button>
    <div class="mt-6 flex items-center gap-3">
      <div class="h-px flex-1 bg-track" />
      <span class="text-xs text-subtle">{{ t('auth.oidcOr') }}</span>
      <div class="h-px flex-1 bg-track" />
    </div>
  </div>
</template>
