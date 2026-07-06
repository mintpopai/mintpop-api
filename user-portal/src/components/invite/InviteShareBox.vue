<script setup lang="ts">
import { computed } from 'vue'
import { useCopy } from '@/composables/useCopy'

/**
 * 「我的邀请码 + 邀请链接 + 复制」两栏展示块。
 * 抽自 InviteView 的分享邀请卡，供邀请页与个人资料页共用；文案复用 invite.share.*。
 */
const props = defineProps<{ affCode: string }>()

// 复制 + 按钮「已复制」反馈（copiedKey 取 'code' | 'link'）
const { copiedKey, copy } = useCopy()

const inviteLink = computed(
  () => `${window.location.origin}/register?aff=${encodeURIComponent(props.affCode)}`
)
</script>

<template>
  <div class="grid gap-4 md:grid-cols-2">
    <div>
      <div class="mb-[9px] text-xs font-semibold tracking-wide text-text2">
        {{ $t('invite.share.yourCode') }}
      </div>
      <div class="flex items-center gap-2 rounded-xl2 border-[1.5px] border-border2 bg-muted py-2 pl-4 pr-2">
        <code class="num min-w-0 flex-1 truncate text-sm font-semibold text-text">{{ affCode }}</code>
        <button
          class="flex-none rounded-full bg-card px-4 py-[7px] text-[13px] font-medium text-text2 shadow-pill transition-colors hover:text-text"
          @click="copy(affCode, 'code')"
        >
          {{ copiedKey === 'code' ? $t('invite.share.copied') : $t('invite.share.copy') }}
        </button>
      </div>
    </div>

    <div>
      <div class="mb-[9px] text-xs font-semibold tracking-wide text-text2">
        {{ $t('invite.share.inviteLink') }}
      </div>
      <div class="flex items-center gap-2 rounded-xl2 border-[1.5px] border-border2 bg-muted py-2 pl-4 pr-2">
        <code class="num min-w-0 flex-1 truncate text-sm text-text2">{{ inviteLink }}</code>
        <button
          class="flex-none rounded-full bg-card px-4 py-[7px] text-[13px] font-medium text-text2 shadow-pill transition-colors hover:text-text"
          @click="copy(inviteLink, 'link')"
        >
          {{ copiedKey === 'link' ? $t('invite.share.copied') : $t('invite.share.copy') }}
        </button>
      </div>
    </div>
  </div>
</template>
