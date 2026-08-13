<script setup lang="ts">
import type { QuotaLevel } from '@/utils/subscription'
import { progressPercent } from '@/utils/subscription'
import { formatBalance } from '@/utils/format'
import { computed } from 'vue'

const props = defineProps<{
  /** 已本地化的额度名（日额度 / 周额度 / 月额度） */
  label: string
  used: number
  limit: number
  level: QuotaLevel
  /** 已本地化的重置副文案；空串则不渲染副文案行 */
  resetText: string
}>()

const percent = computed(() => progressPercent(props.used, props.limit))

// 色阶与 QuotaLevel 一一对应：WARNING 用与 StatusBadge.pending 相同的琥珀色，DANGER 用负向色
const BAR_CLASS: Record<QuotaLevel, string> = {
  NORMAL: 'bg-accent',
  WARNING: 'bg-[#F59E0B]',
  DANGER: 'bg-neg'
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div class="flex items-center justify-between text-[13px]">
      <span class="font-medium text-text2">{{ label }}</span>
      <span class="text-subtle">${{ formatBalance(used) }} / ${{ formatBalance(limit) }}</span>
    </div>
    <div
      class="h-2 overflow-hidden rounded-full bg-track"
      role="progressbar"
      :aria-valuenow="Math.round(percent)"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-label="label"
    >
      <div
        class="h-full rounded-full transition-[width] duration-300"
        :class="BAR_CLASS[level]"
        :style="{ width: `${percent}%` }"
      />
    </div>
    <p
      v-if="resetText"
      class="text-[11px] text-faint"
    >
      {{ resetText }}
    </p>
  </div>
</template>
