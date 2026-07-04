<script setup lang="ts">
import type { UserDashboardStats } from '@/api/types'
import { formatTokens, formatNumber, formatBalance } from '@/utils/format'

defineProps<{ stats: UserDashboardStats }>()
</script>

<template>
  <div
    class="mb-[22px] flex flex-wrap items-center gap-2 rounded-[14px] border border-dashed border-border2 px-[22px] py-4"
  >
    <span class="mr-2 text-[11px] font-semibold uppercase tracking-widest text-faint">{{ $t('dashboard.lifetime.label') }}</span>
    <span class="text-[13px] text-text2">{{ $t('dashboard.lifetime.tokens') }} <b class="font-semibold text-text">{{ formatTokens(stats.total_tokens ?? 0) }}</b></span>
    <span class="text-[#d8d5cc]">·</span>
    <span class="text-[13px] text-text2">{{ $t('dashboard.lifetime.requests') }} <b class="font-semibold text-text">{{ formatNumber(stats.total_requests ?? 0) }}</b></span>
    <span class="text-[#d8d5cc]">·</span>
    <span class="text-[13px] text-text2">{{ $t('dashboard.lifetime.cost') }} <b class="font-semibold text-text">${{ formatBalance(stats.total_actual_cost ?? 0) }}</b></span>
    <router-link
      to="/usage"
      class="ml-auto text-xs font-medium text-subtle hover:text-text"
    >
      {{ $t('dashboard.lifetime.viewAll') }} →
    </router-link>
  </div>
</template>
