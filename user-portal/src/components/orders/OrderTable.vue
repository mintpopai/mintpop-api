<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { orderStatusMeta, orderKind, formatCNY, formatBalance, formatDateMinute } from '@/utils/format'
import type { PaymentOrder } from '@/api/types'

const { t } = useI18n()

defineProps<{ rows: PaymentOrder[] }>()

const emit = defineEmits<{
  view: [order: PaymentOrder]
  pay: [order: PaymentOrder]
  cancel: [order: PaymentOrder]
  reorder: [order: PaymentOrder]
}>()

// 判定收口成一处（历史数据的 payment_type 存在 wxpay/wechat 等多种写法，故用包含匹配兜历史值）
function isWechat(ty: string): boolean {
  return ty.includes('wxpay') || ty.includes('wechat') || ty.includes('wx')
}
function isAlipay(ty: string): boolean {
  return ty.includes('alipay') || ty.includes('ali')
}

function paymentDot(type: string | null | undefined): string {
  const ty = (type ?? '').toLowerCase()
  if (isWechat(ty)) return 'bg-[#09BB07]'
  if (isAlipay(ty)) return 'bg-[#1677FF]'
  return 'bg-text'
}

function paymentLabel(type: string | null | undefined): string {
  const ty = (type ?? '').toLowerCase()
  if (isWechat(ty)) return t('orders.payment.wechat')
  if (isAlipay(ty)) return t('orders.payment.alipay')
  return type || '—'
}

</script>

<template>
  <div role="table">
    <!-- 表头 -->
    <div
      role="row"
      class="grid gap-4 border-b border-track px-[26px] py-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint"
      style="grid-template-columns: 1.5fr 1fr 0.9fr 1.1fr 1.3fr 1.2fr"
    >
      <div role="columnheader">
        {{ $t('orders.table.orderNo') }}
      </div>
      <div role="columnheader">
        {{ $t('orders.table.paid') }}
      </div>
      <div role="columnheader">
        {{ $t('orders.table.paymentMethod') }}
      </div>
      <div role="columnheader">
        {{ $t('orders.table.status') }}
      </div>
      <div role="columnheader">
        {{ $t('orders.table.createdAt') }}
      </div>
      <div
        role="columnheader"
        class="text-right"
      >
        {{ $t('orders.table.actions') }}
      </div>
    </div>

    <!-- 空状态 -->
    <div
      v-if="rows.length === 0"
      class="px-[26px] py-16 text-center text-sm text-subtle"
    >
      {{ $t('orders.empty') }}
    </div>

    <!-- 数据行 -->
    <div
      v-for="row in rows"
      :key="row.id"
      role="row"
      class="grid gap-4 border-b border-rowline px-[26px] py-5 transition-colors hover:bg-hover"
      style="grid-template-columns: 1.5fr 1fr 0.9fr 1.1fr 1.3fr 1.2fr; align-items: center"
    >
      <!-- 订单编号 -->
      <div role="cell">
        <div class="mb-[5px] text-[14px] font-semibold text-text">
          {{ row.out_trade_no }}
        </div>
        <div class="text-[11px] font-medium text-subtle">
          {{ orderKind(row.order_type) }} · ID {{ row.id }}
        </div>
      </div>

      <!-- 实付 -->
      <div role="cell">
        <div class="font-serif text-[15px] font-semibold text-text">
          ¥{{ formatCNY(row.pay_amount) }}
        </div>
        <div class="mt-0.5 text-[11px] text-subtle">
          ${{ formatBalance(row.amount) }}
        </div>
      </div>

      <!-- 支付方式 -->
      <div role="cell">
        <span class="inline-flex items-center gap-1.5 text-[13px] font-medium text-text">
          <span
            class="h-2 w-2 rounded-[2px]"
            :class="paymentDot(row.payment_type)"
          />
          {{ paymentLabel(row.payment_type) }}
        </span>
      </div>

      <!-- 状态 -->
      <div role="cell">
        <StatusBadge v-bind="orderStatusMeta(row.status)" />
      </div>

      <!-- 创建时间 -->
      <div
        role="cell"
        class="text-[13px] text-text3"
      >
        {{ formatDateMinute(row.created_at) }}
      </div>

      <!-- 操作 -->
      <div
        role="cell"
        class="flex flex-wrap justify-end gap-0.5"
      >
        <button
          class="inline-flex cursor-pointer items-center gap-[5px] rounded-lg px-[9px] py-[6px] text-[12px] font-medium text-text3 transition-colors hover:bg-muted hover:text-text"
          @click="emit('view', row)"
        >
          {{ $t('orders.actions.view') }}
        </button>
        <button
          v-if="row.status === 'PENDING'"
          class="inline-flex cursor-pointer items-center gap-[5px] rounded-lg px-[9px] py-[6px] text-[12px] font-medium text-accent transition-colors hover:bg-muted"
          @click="emit('pay', row)"
        >
          {{ $t('orders.actions.payNow') }}
        </button>
        <button
          v-if="row.status === 'PENDING'"
          class="inline-flex cursor-pointer items-center gap-[5px] rounded-lg px-[9px] py-[6px] text-[12px] font-medium text-text3 transition-colors hover:bg-muted hover:text-text"
          @click="emit('cancel', row)"
        >
          {{ $t('common.cancel') }}
        </button>
        <button
          v-if="row.status === 'FAILED' || row.status === 'REFUNDED'"
          class="inline-flex cursor-pointer items-center gap-[5px] rounded-lg px-[9px] py-[6px] text-[12px] font-medium text-accent transition-colors hover:bg-muted"
          @click="emit('reorder', row)"
        >
          {{ $t('orders.actions.reorder') }}
        </button>
      </div>
    </div>
  </div>
</template>
