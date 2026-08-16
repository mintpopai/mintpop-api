<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import PageSkeleton from '@/components/common/PageSkeleton.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatCard from '@/components/ui/StatCard.vue'
import Pagination from '@/components/ui/Pagination.vue'
import Modal from '@/components/ui/Modal.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import OrderTable from '@/components/orders/OrderTable.vue'
import OrderDetailModal from '@/components/orders/OrderDetailModal.vue'
import { useOrders } from '@/composables/useOrders'
import { useAuthStore } from '@/stores/auth'
import { formatBalance, formatDateMinute, orderStatusMeta, ORDER_PAID_STATUSES } from '@/utils/format'
import type { PaymentOrder } from '@/api/types'
import { errMessage } from '@/utils/error'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const { rows, total, page, pageSize, statusFilter, loading, error, loaded, load, setPage, cancel } = useOrders()

// 前端搜索关键字（纯视图层过滤，不参与请求，故不放进 useOrders）
const search = ref('')

// 状态 chip 标签（value 为后端枚举值，保持不变）
const tabs = computed(() => [
  { label: t('orders.tabs.all'), value: '' },
  { label: t('orders.tabs.pending'), value: 'PENDING' },
  { label: t('orders.tabs.completed'), value: 'COMPLETED' },
  { label: t('orders.tabs.failed'), value: 'FAILED' },
  { label: t('orders.tabs.refunded'), value: 'REFUNDED' },
])

// 切换 tab 时重置分页
function pickTab(value: string) {
  statusFilter.value = value
  page.value = 1
  load()
}

// 前端搜索过滤（按 out_trade_no）
const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return rows.value
  return rows.value.filter(r => r.out_trade_no.toLowerCase().includes(q))
})

// === StatCard 派生数据 ===
const paidCount = computed(() => rows.value.filter(r => ORDER_PAID_STATUSES.includes(r.status)).length)
const pendingCount = computed(() => rows.value.filter(r => r.status === 'PENDING').length)

// 「累计充值」口径改用 auth store 的 total_recharged（后端累加的权威值），不再用当前页订单
// reduce 近似——分页/筛选下前者会随之漂移，与「累计」语义不符。缺失时（尚未拉取/拉取失败）兜底 —。
const totalRechargeValue = computed(() => {
  const v = authStore.user?.total_recharged
  return v == null ? '—' : `$${formatBalance(v)}`
})

const latestOrder = computed(() => rows.value[0] ?? null)

const statTotalHint = computed(() => t('orders.stats.totalHint', { paid: paidCount.value, pending: pendingCount.value }))
const statLatestValue = computed(() => {
  if (!latestOrder.value) return '—'
  const meta = orderStatusMeta(latestOrder.value.status)
  return `$${formatBalance(latestOrder.value.amount)} · ${meta.label}`
})
const statLatestHint = computed(() => (latestOrder.value ? formatDateMinute(latestOrder.value.created_at) : ''))

// === 详情弹窗 ===
const detailOpen = ref(false)
const detailOrder = ref<PaymentOrder | null>(null)

function openDetail(order: PaymentOrder) {
  detailOrder.value = order
  detailOpen.value = true
}

function closeDetail() {
  detailOpen.value = false
}

// === 取消确认弹窗 ===
const cancelOpen = ref(false)
const cancelTarget = ref<PaymentOrder | null>(null)
const cancelLoading = ref(false)
const cancelError = ref<string | null>(null)

function promptCancel(order: PaymentOrder) {
  cancelTarget.value = order
  cancelError.value = null
  cancelOpen.value = true
}

async function confirmCancel() {
  if (!cancelTarget.value) return
  cancelLoading.value = true
  cancelError.value = null
  try {
    await cancel(cancelTarget.value.id)
    cancelOpen.value = false
    cancelTarget.value = null
  } catch (e) {
    cancelError.value = errMessage(e, t('orders.cancelFailed'))
  } finally {
    cancelLoading.value = false
  }
}

function handleReorder() {
  router.push('/recharge')
}

onMounted(() => {
  load()
  // 刷新用户资料以拿最新 total_recharged；fetchUser 失败已在 store 内吞掉（返回 false、不抛），
  // 不会让本页崩溃，StatCard 兜底展示 —。
  authStore.fetchUser()
})
</script>

<template>
  <div>
    <!-- 页头 -->
    <PageHeader
      :title="$t('orders.pageTitle')"
      :subtitle="$t('orders.pageSubtitle')"
    >
      <template #actions>
        <button
          class="rounded-full bg-card px-4 py-[11px] text-[13px] font-medium text-text2 shadow-pill transition-colors hover:text-text"
          :disabled="loading"
          @click="load"
        >
          ↻ {{ $t('common.refresh') }}
        </button>
        <button
          class="rounded-full bg-accent px-[22px] py-[11px] text-[14px] font-semibold text-white shadow-[0_4px_14px_rgba(20,194,138,.3)] transition-opacity hover:opacity-90"
          @click="router.push('/recharge')"
        >
          + {{ $t('orders.backToRecharge') }}
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
      class="rounded-xl3 border border-dashed border-border2 bg-card px-7 py-16 text-center"
    >
      <p class="text-sm text-subtle">
        {{ error }}
      </p>
      <button
        class="mt-4 rounded-full border border-border px-5 py-2 text-sm font-semibold text-text"
        @click="load"
      >
        {{ $t('common.retry') }}
      </button>
    </div>

    <template v-else>
      <!-- StatCard 统计行 -->
      <div class="mb-[22px] grid grid-cols-1 gap-[18px] sm:grid-cols-3">
        <StatCard
          :label="$t('orders.stats.total')"
          :value="String(total)"
          :hint="statTotalHint"
        />
        <StatCard
          :label="$t('orders.stats.totalRecharge')"
          :value="totalRechargeValue"
          :hint="$t('orders.stats.totalRechargeHint')"
        />
        <StatCard
          :label="$t('orders.stats.latest')"
          :value="statLatestValue"
          :hint="statLatestHint"
        />
      </div>

      <!-- 筛选栏 -->
      <div class="mb-4 flex items-center gap-3">
        <!-- 状态 chip 组 -->
        <div class="inline-flex gap-0.5 rounded-full bg-track p-1">
          <button
            v-for="tab in tabs"
            :key="tab.value"
            class="rounded-full px-[15px] py-2 text-[13px] font-medium text-text3 transition-colors hover:text-text"
            :class="statusFilter === tab.value ? 'bg-card font-semibold text-text shadow-pill' : ''"
            @click="pickTab(tab.value)"
          >
            {{ tab.label }}
          </button>
        </div>

        <!-- 搜索框 -->
        <SearchInput
          v-model="search"
          class="ml-1 max-w-[300px] flex-1"
          input-class="w-full input-base py-[11px] pl-10 pr-4"
          :placeholder="$t('orders.searchPlaceholder')"
        >
          <p
            v-if="search.trim()"
            class="absolute mt-1.5 text-[11px] text-subtle"
          >
            {{ $t('orders.searchHint') }}
          </p>
        </SearchInput>
      </div>

      <!-- 表格卡片 -->
      <div class="overflow-hidden rounded-xl3 bg-card shadow-[0_2px_12px_rgba(0,0,0,.04)]">
        <OrderTable
          :rows="filteredRows"
          @view="openDetail"
          @cancel="promptCancel"
          @reorder="handleReorder"
        />
        <Pagination
          v-if="!search.trim()"
          :page="page"
          :page-size="pageSize"
          :total="total"
          @update:page="setPage"
        />
      </div>
    </template>

    <!-- 订单详情弹窗 -->
    <OrderDetailModal
      :open="detailOpen"
      :order="detailOrder"
      @close="closeDetail"
    />

    <!-- 取消确认弹窗 -->
    <Modal
      :open="cancelOpen"
      :title="$t('orders.cancelTitle')"
      @close="cancelOpen = false"
    >
      <!-- 具名插值 + 样式化插槽（vue-i18n <i18n-t>）：语序由词条承载，不再拆前后缀 -->
      <i18n-t
        keypath="orders.cancelConfirm"
        tag="p"
        scope="global"
        class="text-sm text-text2"
      >
        <template #orderNo>
          <span class="font-medium text-text">{{ cancelTarget?.out_trade_no }}</span>
        </template>
      </i18n-t>
      <p
        v-if="cancelError"
        class="mt-3 text-[13px] text-neg"
      >
        {{ cancelError }}
      </p>
      <template #footer>
        <button
          class="rounded-full border border-border px-5 py-2 text-sm font-medium text-text2 transition-colors hover:bg-muted"
          :disabled="cancelLoading"
          @click="cancelOpen = false"
        >
          {{ $t('orders.cancelReconsider') }}
        </button>
        <button
          class="rounded-full bg-neg px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          :disabled="cancelLoading"
          @click="confirmCancel"
        >
          {{ cancelLoading ? $t('orders.cancelling') : $t('orders.confirmCancel') }}
        </button>
      </template>
    </Modal>
  </div>
</template>
