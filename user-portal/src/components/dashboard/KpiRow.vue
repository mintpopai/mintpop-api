<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UserDashboardStats } from '@/api/types'
import { formatNumber, formatTokens, formatDuration } from '@/utils/format'

const props = defineProps<{ stats: UserDashboardStats }>()
const { t } = useI18n()

// 四张 KPI 卡片同构，收敛成数据驱动（样式与设计稿一比一，不复用 StatCard 的 32px 字号）
const cards = computed(() => {
  const s = props.stats
  return [
    {
      label: t('dashboard.kpi.apiKeys'),
      value: String(s.total_api_keys ?? 0),
      hint: t('dashboard.kpi.enabled', { count: s.active_api_keys ?? 0 })
    },
    {
      label: t('dashboard.kpi.todayRequests'),
      value: formatNumber(s.today_requests ?? 0),
      hint: t('dashboard.kpi.totalRequests', { value: formatNumber(s.total_requests ?? 0) })
    },
    {
      label: t('dashboard.kpi.todayTokens'),
      value: formatTokens(s.today_tokens ?? 0),
      hint: t('dashboard.kpi.inOut', {
        input: formatTokens(s.today_input_tokens ?? 0),
        output: formatTokens(s.today_output_tokens ?? 0)
      })
    },
    {
      label: t('dashboard.kpi.avgResponse'),
      value: formatDuration(s.average_duration_ms ?? 0),
      hint: `RPM ${formatNumber(s.rpm ?? 0)} · TPM ${formatTokens(s.tpm ?? 0)}`
    }
  ]
})
</script>

<template>
  <div class="mb-[22px] grid grid-cols-2 gap-[18px] lg:grid-cols-4">
    <div
      v-for="card in cards"
      :key="card.label"
      class="rounded-xl2 bg-card p-[22px] shadow-soft"
    >
      <div class="mb-4 text-[11px] font-medium uppercase tracking-[0.1em] text-faint">
        {{ card.label }}
      </div>
      <div class="num text-[34px] font-medium leading-none text-text">
        {{ card.value }}
      </div>
      <div class="mt-2.5 text-xs text-subtle">
        {{ card.hint }}
      </div>
    </div>
  </div>
</template>
