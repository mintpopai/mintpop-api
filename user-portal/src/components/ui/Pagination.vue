<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ pageSize: number; total: number }>()
// Vue 3.4+ 官方推荐的 v-model 宏（具名 model：v-model:page）
const page = defineModel<number>('page', { required: true })

const from = computed(() => (props.total === 0 ? 0 : (page.value - 1) * props.pageSize + 1))
const to = computed(() => Math.min(page.value * props.pageSize, props.total))
const hasPrev = computed(() => page.value > 1)
const hasNext = computed(() => page.value * props.pageSize < props.total)
</script>

<template>
  <div class="flex items-center justify-between border-t border-track bg-hover px-[26px] py-4">
    <span class="text-[13px] text-subtle">{{ $t('ui.paginationSummary', { from, to, total, pageSize }) }}</span>
    <div class="flex items-center gap-1.5">
      <button
        class="rounded-lg border border-border px-[11px] py-1.5 text-[13px] text-faint disabled:opacity-50"
        :disabled="!hasPrev"
        @click="page = page - 1"
      >
        ‹
      </button>
      <span class="rounded-lg bg-accent px-3 py-1.5 text-[13px] font-semibold text-white">{{ page }}</span>
      <button
        class="rounded-lg border border-border px-[11px] py-1.5 text-[13px] text-faint disabled:opacity-50"
        :disabled="!hasNext"
        @click="page = page + 1"
      >
        ›
      </button>
    </div>
  </div>
</template>
