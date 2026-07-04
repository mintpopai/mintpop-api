<script setup lang="ts">
import { useToast } from '@/composables/useToast'

// 全局提示宿主：挂在 App.vue 顶层，渲染共享队列里的提示
const { toasts, dismiss } = useToast()
</script>

<template>
  <div class="pointer-events-none fixed right-5 top-5 z-100 flex flex-col items-end gap-2">
    <transition-group
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-x-3 opacity-0"
      enter-to-class="translate-x-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="translate-x-0 opacity-100"
      leave-to-class="translate-x-3 opacity-0"
    >
      <div
        v-for="t in toasts"
        :key="t.id"
        class="pointer-events-auto flex max-w-[360px] items-center gap-2.5 rounded-xl2 bg-card px-4 py-3 text-[13px] font-medium text-text shadow-menu"
        role="status"
        @click="dismiss(t.id)"
      >
        <span
          class="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full text-[12px] font-bold text-white"
          :class="t.type === 'SUCCESS' ? 'bg-pos' : 'bg-neg'"
        >
          {{ t.type === 'SUCCESS' ? '✓' : '!' }}
        </span>
        <span class="leading-[1.4]">{{ t.message }}</span>
      </div>
    </transition-group>
  </div>
</template>
