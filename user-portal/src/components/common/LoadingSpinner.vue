<script setup lang="ts">
import i18n from '@/i18n'

withDefaults(defineProps<{ size?: number }>(), { size: 28 })

// 不用模板里的全局注入 $t：它要求 i18n 插件已 app.use() 安装到当前 app 实例，
// 而本组件复用度高，也会在未安装插件的宿主中被挂载（如 OnboardingView 的测试）。
// 直接取全局 composer 的 t，与 $t 是同一份实例，效果等价（与 AuthShell 同惯例）。
const t = i18n.global.t
</script>

<template>
  <span
    class="inline-block animate-spin rounded-full border-2 border-track border-t-accent"
    :style="{ width: `${size}px`, height: `${size}px` }"
    role="status"
    :aria-label="t('common.loading')"
  />
</template>
