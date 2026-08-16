<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import PageSkeleton from '@/components/common/PageSkeleton.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatCard from '@/components/ui/StatCard.vue'
import FilterBar from '@/components/ui/FilterBar.vue'
import Pagination from '@/components/ui/Pagination.vue'
import UsageLogTable from '@/components/usage/UsageLogTable.vue'
import { useUsage, defaultUsageRange } from '@/composables/useUsage'
import { useToast } from '@/composables/useToast'
import { downloadCsv } from '@/utils/csv'
import { errMessage } from '@/utils/error'
import {
  formatTokens,
  formatCost,
  formatDuration,
  formatDateTime,
  formatReasoningEffort,
  formatBillingType,
  cacheHitRate,
} from '@/utils/format'

const { t } = useI18n()

const {
  rows,
  total,
  page,
  pageSize,
  stats,
  keys,
  filters,
  loading,
  error,
  loaded,
  load,
  loadKeys,
  setPage,
  fetchForExport,
} = useUsage()

onMounted(async () => {
  await Promise.all([load(), loadKeys()])
})

function resetPageAndLoad() {
  page.value = 1
  load()
}

function handleReset() {
  filters.api_key_id = ''
  Object.assign(filters, defaultUsageRange())
  page.value = 1
  load()
}

const toast = useToast()
const exporting = ref(false)

async function handleExport() {
  if (exporting.value) return
  exporting.value = true
  try {
    await doExport()
  } catch (e) {
    toast.error(errMessage(e, t('common.requestFailed')))
  } finally {
    exporting.value = false
  }
}

async function doExport() {
  const data = await fetchForExport()
  const headers = [
    t('usage.table.key'),
    t('usage.table.model'),
    t('usage.table.effort'),
    t('usage.table.endpoint'),
    t('usage.table.stream'),
    t('usage.table.billing'),
    'input_tokens',
    'output_tokens',
    'cache_tokens',
    'created_at',
    'actual_cost',
  ]
  const rowsData = data.map((r) => [
    r.api_key?.name ?? '',
    r.model,
    formatReasoningEffort(r.reasoning_effort),
    r.inbound_endpoint ?? '',
    r.stream ? t('common.yes') : t('common.no'),
    formatBillingType(r.billing_type),
    r.input_tokens,
    r.output_tokens,
    r.cache_read_tokens,
    formatDateTime(r.created_at),
    r.actual_cost,
  ])
  downloadCsv('usage.csv', headers, rowsData)
}

// KPI 计算
function kpiTokenHint(s: NonNullable<typeof stats.value>): string {
  // 注：UserDashboardStats 无 cache_read/cache_creation 独立字段，
  // 该差值实为「缓存命中 + 缓存创建」之和，待接口扩展后再拆分展示。
  // Math.max 兜底：上游统计口径不一致时差值可能为负，不能把负缓存量/负命中率摆给用户
  const cacheTokens = Math.max(0, s.total_tokens > 0 ? s.total_tokens - s.total_input_tokens - s.total_output_tokens : 0)
  const rate = cacheHitRate(cacheTokens, s.total_input_tokens)
  return t('usage.kpi.tokenHint', {
    input: formatTokens(s.total_input_tokens),
    output: formatTokens(s.total_output_tokens),
    cache: formatTokens(cacheTokens),
    rate: rate.toFixed(1),
  })
}
</script>

<template>
  <div>
    <!-- 页头 -->
    <PageHeader
      :title="$t('usage.title')"
      :subtitle="$t('usage.subtitle')"
    >
      <template #actions>
        <button
          class="rounded-full bg-card px-4 py-[11px] text-[13px] font-medium text-text2 shadow-pill transition-colors hover:text-text"
          :disabled="loading"
          @click="load()"
        >
          ↻ {{ $t('common.refresh') }}
        </button>
        <button
          class="rounded-full bg-card px-4 py-[11px] text-[13px] font-medium text-text2 shadow-pill transition-colors hover:text-text"
          @click="handleReset"
        >
          {{ $t('common.reset') }}
        </button>
        <button
          class="rounded-full bg-accent px-[22px] py-[11px] text-[14px] font-semibold text-white shadow-[0_4px_14px_rgba(20,194,138,.3)] transition-opacity hover:opacity-90 disabled:opacity-60"
          :disabled="exporting"
          @click="handleExport"
        >
          ↓ {{ exporting ? $t('common.loading') : $t('usage.exportCsv') }}
        </button>
      </template>
    </PageHeader>

    <!-- 加载态（首次） -->
    <PageSkeleton
      v-if="loading && !loaded"
      variant="table"
    />

    <!-- 错误态（首次） -->
    <div
      v-else-if="error && !loaded"
      class="rounded-xl3 border border-dashed border-border2 bg-card px-7 py-16 text-center text-sm text-subtle"
    >
      {{ error }}
      <button
        class="ml-2 underline"
        @click="load()"
      >
        {{ $t('common.retry') }}
      </button>
    </div>

    <template v-else>
      <!-- KPI 卡片 -->
      <div class="mb-[22px] grid grid-cols-2 gap-[18px] lg:grid-cols-4">
        <StatCard
          :label="$t('usage.stats.totalRequests')"
          :value="stats ? String(stats.total_requests) : '—'"
          :hint="$t('usage.stats.inRange')"
        />
        <StatCard
          :label="$t('usage.stats.totalTokens')"
          :value="stats ? formatTokens(stats.total_tokens) : '—'"
          :hint="stats ? kpiTokenHint(stats) : undefined"
        />
        <StatCard
          :label="$t('usage.stats.totalCost')"
          :value="stats ? `$${formatCost(stats.total_actual_cost)}` : '—'"
          :hint="stats ? $t('usage.stats.costHint', { cost: formatCost(stats.total_cost) }) : undefined"
          accent
        />
        <StatCard
          :label="$t('usage.stats.avgDuration')"
          :value="stats ? formatDuration(stats.average_duration_ms) : '—'"
          :hint="$t('usage.stats.perRequest')"
        />
      </div>

      <!-- 筛选栏 -->
      <FilterBar>
        <div>
          <label
            for="usage-filter-key"
            class="mb-2 block text-[11px] font-medium uppercase tracking-[0.08em] text-faint"
          >
            {{ $t('usage.filters.apiKey') }}
          </label>
          <select
            id="usage-filter-key"
            v-model="filters.api_key_id"
            class="input-base"
            @change="resetPageAndLoad"
          >
            <option value="">
              {{ $t('usage.filters.allKeys') }}
            </option>
            <option
              v-for="k in keys"
              :key="k.id"
              :value="k.id"
            >
              {{ k.name }}
            </option>
          </select>
        </div>

        <div>
          <label
            for="usage-filter-start"
            class="mb-2 block text-[11px] font-medium uppercase tracking-[0.08em] text-faint"
          >
            {{ $t('usage.filters.startDate') }}
          </label>
          <input
            id="usage-filter-start"
            v-model="filters.start_date"
            type="date"
            class="input-base"
            @change="resetPageAndLoad"
          >
        </div>

        <div>
          <label
            for="usage-filter-end"
            class="mb-2 block text-[11px] font-medium uppercase tracking-[0.08em] text-faint"
          >
            {{ $t('usage.filters.endDate') }}
          </label>
          <input
            id="usage-filter-end"
            v-model="filters.end_date"
            type="date"
            class="input-base"
            @change="resetPageAndLoad"
          >
        </div>
      </FilterBar>

      <!-- 表格卡片 -->
      <div class="overflow-hidden rounded-xl3 bg-card shadow-[0_2px_12px_rgba(0,0,0,.04)]">
        <!-- 加载中遮罩 -->
        <div
          v-if="loading && loaded"
          class="flex items-center justify-center py-16"
        >
          <LoadingSpinner :size="24" />
        </div>

        <!-- 错误（非首次） -->
        <div
          v-else-if="error && loaded"
          class="px-[26px] py-12 text-center text-sm text-subtle"
        >
          {{ error }}
          <button
            class="ml-2 underline"
            @click="load()"
          >
            {{ $t('common.retry') }}
          </button>
        </div>

        <!-- 表格 -->
        <UsageLogTable
          v-else
          :rows="rows"
        />

        <!-- 分页 -->
        <Pagination
          :page="page"
          :page-size="pageSize"
          :total="total"
          @update:page="setPage"
        />
      </div>
    </template>
  </div>
</template>
