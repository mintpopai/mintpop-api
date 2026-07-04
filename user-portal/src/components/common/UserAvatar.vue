<script setup lang="ts">
import { computed } from 'vue'
import type { User } from '@/api/types'

/**
 * 用户头像：有 avatar_url 用图（font-size:0 隐藏兜底字符），无则品牌绿底 + 名字首字。
 * 尺寸/圆角/字号由调用方经 boxClass 传入（AccountHero 74px、ProfileForm 72px 等各自微调）。
 */
const props = defineProps<{ user: User; boxClass?: string }>()

const char = computed(() => (props.user.username ?? props.user.email ?? '?').charAt(0).toUpperCase())
</script>

<template>
  <div
    class="flex flex-none items-center justify-center font-serif font-semibold text-white"
    :class="boxClass"
    :style="
      user.avatar_url
        ? `background:url(${user.avatar_url}) center/cover no-repeat;font-size:0`
        : 'background:var(--accent)'
    "
  >
    <span v-if="!user.avatar_url">{{ char }}</span>
  </div>
</template>
