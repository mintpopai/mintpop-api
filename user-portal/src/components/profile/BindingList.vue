<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { User, PublicSettings } from '@/api/types'

const props = defineProps<{
  user: User
  settings: PublicSettings | null
}>()

const emit = defineEmits<{
  bind: [provider: string]
  unbind: [provider: string]
}>()

const { t } = useI18n()

/** 一个可绑定的第三方渠道行；四个渠道结构同构，数据驱动渲染（新增渠道只需加一条配置） */
interface ProviderRow {
  key: string
  name: string
  desc: string
  bound: boolean
  /** 是否允许解绑；缺省视为 true。统一登录（OIDC）是 portal 唯一登录凭证，解绑会把自己锁死，故不可解绑 */
  unbindable?: boolean
  /** 文本图标（LinuxDo/钉钉/OIDC 用单字符） */
  iconChar?: string
  /** 特殊 SVG 图标（目前仅微信） */
  iconType?: 'wechat'
}

const providers = computed<ProviderRow[]>(() => {
  const s = props.settings
  const u = props.user
  if (!s) return []
  const rows: ProviderRow[] = []
  if (s.linuxdo_oauth_enabled) {
    rows.push({ key: 'linuxdo', name: 'LinuxDo', desc: t('profile.binding.desc.linuxdo'), bound: !!u.linuxdo_bound, iconChar: 'L' })
  }
  if (s.dingtalk_oauth_enabled) {
    rows.push({ key: 'dingtalk', name: t('profile.binding.providers.dingtalk'), desc: t('profile.binding.desc.dingtalk'), bound: !!u.dingtalk_bound, iconChar: '钉' })
  }
  if (s.oidc_oauth_enabled) {
    // 统一登录是唯一登录方式：可绑定，但不可解绑（解绑即锁死自己）
    rows.push({ key: 'oidc', name: s.oidc_oauth_provider_name || 'OIDC', desc: t('profile.binding.desc.oidc'), bound: !!u.oidc_bound, unbindable: false, iconChar: 'O' })
  }
  if (s.wechat_oauth_enabled) {
    rows.push({ key: 'wechat', name: t('profile.binding.providers.wechat'), desc: t('profile.binding.desc.wechat'), bound: !!u.wechat_bound, iconType: 'wechat' })
  }
  return rows
})
</script>

<template>
  <div class="rounded-xl3 bg-card px-[30px] py-[28px] shadow-soft">
    <h3 class="mb-[4px] font-serif text-[20px] font-medium text-text">
      {{ $t('profile.binding.title') }}
    </h3>
    <p class="mb-[22px] text-[13px] text-subtle">
      {{ $t('profile.binding.subtitle') }}
    </p>

    <div class="flex flex-col gap-[12px]">
      <!-- 邮箱行：始终显示、不可解绑，样式与渠道行略有差异，单独保留 -->
      <div
        class="flex items-center gap-[16px] rounded-[14px] border-[1.5px] border-border bg-hover px-[20px] py-[18px]"
      >
        <div
          class="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[12px] bg-[rgba(20,194,138,0.12)] text-pos"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
          >
            <rect
              x="3"
              y="5"
              width="18"
              height="14"
              rx="2.5"
            />
            <path d="M3.5 7l8.5 6 8.5-6" />
          </svg>
        </div>
        <div class="flex-1">
          <div class="mb-[3px] flex items-center gap-[9px]">
            <span class="text-[14px] font-semibold text-text">{{ $t('profile.binding.providers.email') }}</span>
            <span
              class="rounded-[6px] bg-[rgba(20,194,138,0.12)] px-[8px] py-[2px] text-[11px] font-semibold text-pos"
            >
              {{ $t('profile.binding.bound') }}
            </span>
          </div>
          <div class="text-[13px] text-subtle">
            {{ $t('profile.binding.desc.email', { email: props.user.email }) }}
          </div>
        </div>
      </div>

      <!-- 第三方渠道行（数据驱动） -->
      <div
        v-for="p in providers"
        :key="p.key"
        class="flex items-center gap-[16px] rounded-[14px] border-[1.5px] border-border px-[20px] py-[18px]"
      >
        <!-- 图标 -->
        <div
          v-if="p.iconType === 'wechat'"
          class="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[12px] bg-[rgba(9,187,7,0.1)] text-[#09BB07]"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              d="M8.7 10.2c-.5 0-.9-.4-.9-.9s.4-.9.9-.9.9.4.9.9-.4.9-.9.9zm4.1 0c-.5 0-.9-.4-.9-.9s.4-.9.9-.9.9.4.9.9-.4.9-.9.9zm2.9 5.1c.4 0 .7-.3.7-.7s-.3-.7-.7-.7-.7.3-.7.7.3.7.7.7zm3.2 0c.4 0 .7-.3.7-.7s-.3-.7-.7-.7-.7.3-.7.7.3.7.7.7zM12 2C6.5 2 2 5.8 2 10.5c0 2.7 1.5 5.1 3.8 6.7L5 20l3.4-1.7c1.1.3 2.4.5 3.6.5 5.5 0 10-3.8 10-8.5C22 5.8 17.5 2 12 2z"
            />
          </svg>
        </div>
        <div
          v-else
          class="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[12px] bg-muted text-[16px] font-semibold text-text3"
        >
          {{ p.iconChar }}
        </div>

        <!-- 文字 -->
        <div class="flex-1">
          <div class="mb-[3px] flex items-center gap-[9px]">
            <span class="text-[14px] font-semibold text-text">{{ p.name }}</span>
            <span
              v-if="p.bound"
              class="rounded-[6px] bg-[rgba(20,194,138,0.12)] px-[8px] py-[2px] text-[11px] font-semibold text-pos"
            >
              {{ $t('profile.binding.bound') }}
            </span>
            <span
              v-else
              class="rounded-[6px] bg-track px-[8px] py-[2px] text-[11px] font-semibold text-subtle"
            >
              {{ $t('profile.binding.unbound') }}
            </span>
          </div>
          <div class="text-[13px] text-subtle">
            {{ p.desc }}
          </div>
        </div>

        <!-- 操作：不可解绑的已绑定渠道（如统一登录）不渲染任何按钮，与邮箱行一致 -->
        <button
          v-if="p.bound && p.unbindable !== false"
          class="cursor-pointer rounded-[9px] border-[1.5px] border-border2 bg-card px-[18px] py-[9px] text-[13px] font-medium text-text2 hover:text-neg"
          type="button"
          @click="emit('unbind', p.key)"
        >
          {{ $t('profile.binding.unbind') }}
        </button>
        <button
          v-else-if="!p.bound"
          class="cursor-pointer rounded-[9px] border-[1.5px] border-[rgba(20,194,138,0.35)] bg-[rgba(20,194,138,0.1)] px-[18px] py-[9px] text-[13px] font-semibold text-pos hover:bg-[rgba(20,194,138,0.18)]"
          type="button"
          @click="emit('bind', p.key)"
        >
          {{ $t('profile.binding.bind') }}
        </button>
      </div>
    </div>
  </div>
</template>
