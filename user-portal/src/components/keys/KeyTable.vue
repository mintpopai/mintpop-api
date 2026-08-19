<script setup lang="ts">
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { maskApiKey, formatCost } from '@/utils/format'
import type { ApiKey, ApiKeyUsageStat, Group } from '@/api/types'
import { useCopy } from '@/composables/useCopy'

const props = defineProps<{
  rows: ApiKey[]
  usage: Record<string, ApiKeyUsageStat>
  /** 用户专属分组倍率（group_id → 倍率），来自 /groups/rates */
  groupRates?: Record<number, number>
}>()

const emit = defineEmits<{
  edit: [key: ApiKey]
  toggle: [key: ApiKey]
  remove: [key: ApiKey]
  use: [key: ApiKey]
}>()

// 复制反馈：copiedId = 最近复制的行 id
const { copiedKey: copiedId, copy } = useCopy()

function copyKey(row: ApiKey) {
  copy(row.key, row.id)
}

// 专属倍率且与分组默认不同才展示删除线对比（与 frontend GroupBadge 口径一致）
function customRate(group: Group): number | null {
  const rate = props.groupRates?.[group.id]
  if (typeof rate !== 'number') return null
  return rate !== (group.rate_multiplier ?? 1) ? rate : null
}

function platformDot(platform: string | undefined): string {
  if (!platform) return 'bg-ink'
  const p = platform.toLowerCase()
  if (p === 'claude' || p === 'anthropic') return 'bg-[#D8362C]'
  if (p === 'gpt' || p === 'openai') return 'bg-[#14C28A]'
  return 'bg-ink'
}
</script>

<template>
  <div
    role="table"
    class="overflow-hidden rounded-xl3 bg-card shadow-card"
  >
    <!-- 表头 -->
    <div
      role="row"
      class="grid grid-cols-[1fr_1.4fr_1.3fr_0.8fr_1.2fr_0.8fr_1.6fr] gap-4 border-b border-track px-[26px] py-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint"
    >
      <div role="columnheader">
        {{ $t('keys.table.name') }}
      </div>
      <div role="columnheader">
        {{ $t('keys.table.key') }}
      </div>
      <div role="columnheader">
        {{ $t('keys.table.group') }}
      </div>
      <div role="columnheader">
        {{ $t('keys.table.status') }}
      </div>
      <div role="columnheader">
        {{ $t('keys.table.usage') }}
      </div>
      <div role="columnheader">
        {{ $t('keys.table.rate') }}
      </div>
      <div
        role="columnheader"
        class="text-right"
      >
        {{ $t('keys.table.actions') }}
      </div>
    </div>

    <!-- 数据行 -->
    <div
      v-for="row in rows"
      :key="row.id"
      role="row"
      class="grid grid-cols-[1fr_1.4fr_1.3fr_0.8fr_1.2fr_0.8fr_1.6fr] items-center gap-4 border-b border-rowline px-[26px] py-5 transition-colors hover:bg-hover"
      :class="row.status === 'inactive' ? 'opacity-[0.72]' : ''"
    >
      <!-- 名称 -->
      <div
        role="cell"
        class="text-sm font-semibold text-text"
      >
        {{ row.name }}
      </div>

      <!-- 密钥（独占一列，可复制） -->
      <div role="cell">
        <button
          type="button"
          class="inline-flex max-w-full cursor-pointer items-center gap-[7px] rounded-[7px] px-[9px] py-1 text-xs font-medium transition-colors"
          :class="copiedId === row.id ? 'bg-accent/15 text-accent' : 'bg-muted text-text3 hover:text-text'"
          :title="$t('keys.copyToClipboard')"
          @click="copyKey(row)"
        >
          <span class="truncate font-mono">{{ maskApiKey(row.key) }}</span>
          <svg
            v-if="copiedId === row.id"
            class="h-3.5 w-3.5 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            stroke-width="2.2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span
            v-else
            class="shrink-0 text-accent"
          >⧉</span>
        </button>
      </div>

      <!-- 分组 -->
      <div role="cell">
        <span
          v-if="row.group"
          class="inline-flex items-center gap-1.5 text-[13px] font-medium text-text"
        >
          <span
            class="inline-block h-[7px] w-[7px] rounded-full"
            :class="platformDot(row.group.platform)"
          />
          {{ row.group.name }}
          <span class="rounded-[5px] bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-faint">
            <!-- 有专属倍率：原倍率删除线 + 专属倍率高亮（与 frontend GroupBadge 一致） -->
            <template v-if="customRate(row.group) !== null">
              <span class="line-through opacity-50">{{ row.group.rate_multiplier ?? 1 }}x</span>
              <span class="ml-0.5 font-bold text-text">{{ customRate(row.group) }}x</span>
            </template>
            <template v-else>
              {{ row.group.rate_multiplier ?? 1 }}x
            </template>
          </span>
        </span>
        <span
          v-else
          class="text-[13px] text-subtle"
        >—</span>
      </div>

      <!-- 状态 -->
      <div role="cell">
        <StatusBadge
          :variant="row.status === 'active' ? 'active' : 'inactive'"
          :label="row.status === 'active' ? $t('keys.status.active') : $t('keys.status.inactive')"
        />
      </div>

      <!-- 用量 -->
      <div
        role="cell"
        class="text-[13px] leading-relaxed text-text3"
      >
        {{ $t('keys.table.today') }} <b class="font-semibold text-text">${{ formatCost(usage[String(row.id)]?.today_actual_cost ?? 0) }}</b><br>
        {{ $t('keys.table.last30d') }} <b class="font-semibold text-text">${{ formatCost(usage[String(row.id)]?.total_actual_cost ?? 0) }}</b>
      </div>

      <!-- 速率 -->
      <div
        role="cell"
        class="text-[13px] font-medium text-text2"
      >
        {{ row.rate_limit_1d ? $t('keys.table.ratePerDay', { n: row.rate_limit_1d }) : '—' }}
      </div>

      <!-- 操作 -->
      <div
        role="cell"
        class="flex flex-wrap justify-end gap-0.5"
      >
        <button
          class="inline-flex cursor-pointer items-center gap-[5px] rounded-lg px-[9px] py-[6px] text-xs font-medium text-text3 transition-colors hover:bg-muted hover:text-text"
          @click="emit('use', row)"
        >
          {{ $t('keys.table.use') }}
        </button>
        <button
          class="inline-flex cursor-pointer items-center gap-[5px] rounded-lg px-[9px] py-[6px] text-xs font-medium text-text3 transition-colors hover:bg-muted hover:text-text"
          @click="emit('edit', row)"
        >
          {{ $t('common.edit') }}
        </button>
        <button
          class="inline-flex cursor-pointer items-center gap-[5px] rounded-lg px-[9px] py-[6px] text-xs font-medium transition-colors hover:bg-muted"
          :class="row.status === 'active' ? 'text-text3 hover:text-text' : 'text-pos hover:text-pos'"
          @click="emit('toggle', row)"
        >
          {{ row.status === 'active' ? $t('keys.disable') : $t('keys.enable') }}
        </button>
        <button
          class="inline-flex cursor-pointer items-center gap-[5px] rounded-lg px-[9px] py-[6px] text-xs font-medium text-neg transition-colors hover:bg-muted"
          @click="emit('remove', row)"
        >
          {{ $t('common.delete') }}
        </button>
      </div>
    </div>

    <!-- 空态 -->
    <div
      v-if="rows.length === 0"
      class="px-[26px] py-16 text-center text-sm text-subtle"
    >
      {{ $t('keys.empty') }}
    </div>
  </div>
</template>
