<script setup lang="ts">
import { computed } from 'vue'
import type { User } from '@/api/types'

/**
 * 用户头像：有 avatar_url 用图（font-size:0 隐藏兜底字符），无则品牌绿底 + 名字首字。
 * 尺寸/圆角/字号由调用方经 boxClass 传入（AccountHero 74px、ProfileForm 72px 等各自微调）。
 */
const props = defineProps<{ user: User; boxClass?: string }>()

const char = computed(() => (props.user.username ?? props.user.email ?? '?').charAt(0).toUpperCase())

// 对象绑定 + url("...") 引号包裹：避免 avatar_url 含 `)` 或空白等字符时破坏 style 字符串拼接
const avatarStyle = computed(() =>
  props.user.avatar_url
    ? { background: `url("${props.user.avatar_url}") center/cover no-repeat`, fontSize: '0' }
    : { background: 'var(--accent)' }
)
</script>

<template>
  <div
    class="flex flex-none items-center justify-center font-serif font-semibold text-white"
    :class="boxClass"
    :style="avatarStyle"
  >
    <span v-if="!user.avatar_url">{{ char }}</span>
  </div>
</template>
