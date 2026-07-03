<script setup lang="ts">
import type { User, PublicSettings } from '@/api/types'

const props = defineProps<{
  user: User
  settings: PublicSettings | null
}>()

const emit = defineEmits<{
  (e: 'bind', provider: string): void
  (e: 'unbind', provider: string): void
}>()
</script>

<template>
  <div class="rounded-[18px] bg-card px-[30px] py-[28px] shadow-soft">
    <h3 class="mb-[4px] font-serif text-[20px] font-medium text-text">
      {{ $t('profile.binding.title') }}
    </h3>
    <p class="mb-[22px] text-[13px] text-subtle">
      {{ $t('profile.binding.subtitle') }}
    </p>

    <div class="flex flex-col gap-[12px]">
      <!-- 邮箱行：始终显示 -->
      <div
        class="flex items-center gap-[16px] rounded-[14px] border-[1.5px] border-border bg-hover px-[20px] py-[18px]"
      >
        <!-- 图标 -->
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
        <!-- 文字 -->
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

      <!-- LinuxDo -->
      <div
        v-if="props.settings?.linuxdo_oauth_enabled"
        class="flex items-center gap-[16px] rounded-[14px] border-[1.5px] border-border px-[20px] py-[18px]"
      >
        <div
          class="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[12px] bg-muted text-[16px] font-semibold text-text3"
        >
          L
        </div>
        <div class="flex-1">
          <div class="mb-[3px] flex items-center gap-[9px]">
            <span class="text-[14px] font-semibold text-text">LinuxDo</span>
            <span
              v-if="props.user.linuxdo_bound"
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
            {{ $t('profile.binding.desc.linuxdo') }}
          </div>
        </div>
        <button
          v-if="props.user.linuxdo_bound"
          class="cursor-pointer rounded-[9px] border-[1.5px] border-border2 bg-card px-[18px] py-[9px] text-[13px] font-medium text-text2 hover:text-neg"
          type="button"
          @click="emit('unbind', 'linuxdo')"
        >
          {{ $t('profile.binding.unbind') }}
        </button>
        <button
          v-else
          class="cursor-pointer rounded-[9px] border-[1.5px] border-[rgba(20,194,138,0.35)] bg-[rgba(20,194,138,0.1)] px-[18px] py-[9px] text-[13px] font-semibold text-pos hover:bg-[rgba(20,194,138,0.18)]"
          type="button"
          @click="emit('bind', 'linuxdo')"
        >
          {{ $t('profile.binding.bind') }}
        </button>
      </div>

      <!-- 钉钉 -->
      <div
        v-if="props.settings?.dingtalk_oauth_enabled"
        class="flex items-center gap-[16px] rounded-[14px] border-[1.5px] border-border px-[20px] py-[18px]"
      >
        <div
          class="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[12px] bg-muted text-[16px] font-semibold text-text3"
        >
          钉
        </div>
        <div class="flex-1">
          <div class="mb-[3px] flex items-center gap-[9px]">
            <span class="text-[14px] font-semibold text-text">{{ $t('profile.binding.providers.dingtalk') }}</span>
            <span
              v-if="props.user.dingtalk_bound"
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
            {{ $t('profile.binding.desc.dingtalk') }}
          </div>
        </div>
        <button
          v-if="props.user.dingtalk_bound"
          class="cursor-pointer rounded-[9px] border-[1.5px] border-border2 bg-card px-[18px] py-[9px] text-[13px] font-medium text-text2 hover:text-neg"
          type="button"
          @click="emit('unbind', 'dingtalk')"
        >
          {{ $t('profile.binding.unbind') }}
        </button>
        <button
          v-else
          class="cursor-pointer rounded-[9px] border-[1.5px] border-[rgba(20,194,138,0.35)] bg-[rgba(20,194,138,0.1)] px-[18px] py-[9px] text-[13px] font-semibold text-pos hover:bg-[rgba(20,194,138,0.18)]"
          type="button"
          @click="emit('bind', 'dingtalk')"
        >
          {{ $t('profile.binding.bind') }}
        </button>
      </div>

      <!-- OIDC -->
      <div
        v-if="props.settings?.oidc_oauth_enabled"
        class="flex items-center gap-[16px] rounded-[14px] border-[1.5px] border-border px-[20px] py-[18px]"
      >
        <div
          class="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[12px] bg-muted text-[16px] font-semibold text-text3"
        >
          O
        </div>
        <div class="flex-1">
          <div class="mb-[3px] flex items-center gap-[9px]">
            <span class="text-[14px] font-semibold text-text">
              {{ props.settings.oidc_oauth_provider_name || 'OIDC' }}
            </span>
            <span
              v-if="props.user.oidc_bound"
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
            {{ $t('profile.binding.desc.oidc') }}
          </div>
        </div>
        <button
          v-if="props.user.oidc_bound"
          class="cursor-pointer rounded-[9px] border-[1.5px] border-border2 bg-card px-[18px] py-[9px] text-[13px] font-medium text-text2 hover:text-neg"
          type="button"
          @click="emit('unbind', 'oidc')"
        >
          {{ $t('profile.binding.unbind') }}
        </button>
        <button
          v-else
          class="cursor-pointer rounded-[9px] border-[1.5px] border-[rgba(20,194,138,0.35)] bg-[rgba(20,194,138,0.1)] px-[18px] py-[9px] text-[13px] font-semibold text-pos hover:bg-[rgba(20,194,138,0.18)]"
          type="button"
          @click="emit('bind', 'oidc')"
        >
          {{ $t('profile.binding.bind') }}
        </button>
      </div>

      <!-- 微信 -->
      <div
        v-if="props.settings?.wechat_oauth_enabled"
        class="flex items-center gap-[16px] rounded-[14px] border-[1.5px] border-border px-[20px] py-[18px]"
      >
        <div
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
        <div class="flex-1">
          <div class="mb-[3px] flex items-center gap-[9px]">
            <span class="text-[14px] font-semibold text-text">{{ $t('profile.binding.providers.wechat') }}</span>
            <span
              v-if="props.user.wechat_bound"
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
            {{ $t('profile.binding.desc.wechat') }}
          </div>
        </div>
        <button
          v-if="props.user.wechat_bound"
          class="cursor-pointer rounded-[9px] border-[1.5px] border-border2 bg-card px-[18px] py-[9px] text-[13px] font-medium text-text2 hover:text-neg"
          type="button"
          @click="emit('unbind', 'wechat')"
        >
          {{ $t('profile.binding.unbind') }}
        </button>
        <button
          v-else
          class="cursor-pointer rounded-[9px] border-[1.5px] border-[rgba(20,194,138,0.35)] bg-[rgba(20,194,138,0.1)] px-[18px] py-[9px] text-[13px] font-semibold text-pos hover:bg-[rgba(20,194,138,0.18)]"
          type="button"
          @click="emit('bind', 'wechat')"
        >
          {{ $t('profile.binding.bind') }}
        </button>
      </div>
    </div>
  </div>
</template>
