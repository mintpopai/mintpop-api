<script setup lang="ts">
import type { UsageLog } from '@/api/types'
import {
  formatTokens,
  formatCost,
  formatDuration,
  formatDateTime,
  formatReasoningEffort,
  formatBillingType,
} from '@/utils/format'

defineProps<{ rows: UsageLog[] }>()
</script>

<template>
  <div class="overflow-x-auto">
    <div
      role="table"
      class="min-w-[1180px]"
    >
      <!-- 表头 -->
      <div
        role="row"
        class="grid gap-[14px] border-b border-track px-[26px] py-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-faint"
        style="grid-template-columns: 0.7fr 1.3fr 0.8fr 1fr 0.7fr 0.8fr 1fr 0.9fr 0.7fr 0.7fr 1.1fr"
      >
        <div role="columnheader">
          {{ $t('usage.table.key') }}
        </div>
        <div role="columnheader">
          {{ $t('usage.table.model') }}
        </div>
        <div role="columnheader">
          {{ $t('usage.table.effort') }}
        </div>
        <div role="columnheader">
          {{ $t('usage.table.endpoint') }}
        </div>
        <div role="columnheader">
          {{ $t('usage.table.type') }}
        </div>
        <div role="columnheader">
          {{ $t('usage.table.billing') }}
        </div>
        <div role="columnheader">
          {{ $t('usage.table.token') }}
        </div>
        <div role="columnheader">
          {{ $t('usage.table.cost') }}
        </div>
        <div role="columnheader">
          {{ $t('usage.table.firstToken') }}
        </div>
        <div role="columnheader">
          {{ $t('usage.table.duration') }}
        </div>
        <div role="columnheader">
          {{ $t('usage.table.timeUa') }}
        </div>
      </div>

      <!-- 行 -->
      <div
        v-for="row in rows"
        :key="row.id"
        role="row"
        class="grid items-center gap-[14px] border-b border-rowline px-[26px] py-[18px] transition-colors duration-120 hover:bg-hover"
        style="grid-template-columns: 0.7fr 1.3fr 0.8fr 1fr 0.7fr 0.8fr 1fr 0.9fr 0.7fr 0.7fr 1.1fr"
      >
        <!-- 密钥 -->
        <div
          role="cell"
          class="truncate text-[13px] font-semibold text-text"
        >
          {{ row.api_key?.name ?? '—' }}
        </div>

        <!-- 模型 -->
        <div
          role="cell"
          class="truncate text-[13px] font-medium text-text"
        >
          {{ row.model }}
        </div>

        <!-- 强度 -->
        <div role="cell">
          <span
            v-if="row.reasoning_effort"
            class="rounded-[6px] bg-[#9B7BE0]/12 px-2.5 py-[3px] text-[11px] font-semibold text-[#9B7BE0]"
          >
            {{ formatReasoningEffort(row.reasoning_effort) }}
          </span>
          <span
            v-else
            class="text-[13px] text-text3"
          >—</span>
        </div>

        <!-- 端点 -->
        <div
          role="cell"
          class="truncate text-[12px] text-text3"
        >
          {{ row.inbound_endpoint ?? '—' }}
        </div>

        <!-- 类型（流式/同步） -->
        <div role="cell">
          <span class="rounded-[6px] bg-[#2A6FDB]/10 px-2.5 py-[3px] text-[11px] font-semibold text-[#2A6FDB]">
            {{ row.stream ? $t('usage.table.stream') : $t('usage.table.sync') }}
          </span>
        </div>

        <!-- 计费 -->
        <div role="cell">
          <span class="rounded-[6px] bg-track px-2.5 py-[3px] text-[11px] font-semibold text-text3">
            {{ formatBillingType(row.billing_type) }}
          </span>
        </div>

        <!-- Token -->
        <div
          role="cell"
          class="text-[12px] leading-[1.6] text-text3"
        >
          <span class="text-[#2A6FDB]">↓ {{ formatTokens(row.input_tokens) }}</span>
          {{ ' ' }}
          <span class="text-pos">↑ {{ formatTokens(row.output_tokens) }}</span>
          <br>
          <span class="text-[#E8A33D]">⊕ {{ formatTokens(row.cache_read_tokens) }}</span>
        </div>

        <!-- 费用 -->
        <div
          role="cell"
          class="num text-[13px] font-semibold text-pos"
        >
          ${{ formatCost(row.actual_cost) }}
        </div>

        <!-- 首 Token -->
        <div
          role="cell"
          class="text-[12px] text-text2"
        >
          {{ row.first_token_ms != null ? formatDuration(row.first_token_ms) : '—' }}
        </div>

        <!-- 耗时 -->
        <div
          role="cell"
          class="text-[12px] text-text2"
        >
          {{ row.duration_ms != null ? formatDuration(row.duration_ms) : '—' }}
        </div>

        <!-- 时间 · UA -->
        <div
          role="cell"
          class="text-[11px] leading-normal text-text3"
        >
          {{ formatDateTime(row.created_at) }}
          <br>
          <span class="text-faint">{{ row.user_agent ?? '' }}</span>
        </div>
      </div>

      <!-- 空状态 -->
      <div
        v-if="rows.length === 0"
        class="px-[26px] py-16 text-center text-sm text-subtle"
      >
        {{ $t('usage.empty') }}
      </div>
    </div>
  </div>
</template>
