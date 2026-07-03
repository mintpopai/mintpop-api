<script setup lang="ts">
import Modal from '@/components/ui/Modal.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { orderStatusMeta, orderKind, formatCNY, formatBalance, formatDateMinute } from '@/utils/format'
import type { PaymentOrder } from '@/api/types'

defineProps<{ open: boolean; order: PaymentOrder | null }>()
const emit = defineEmits<{ close: [] }>()

</script>

<template>
  <Modal
    :open="open"
    :title="$t('orders.detailTitle')"
    @close="emit('close')"
  >
    <template v-if="order">
      <div class="space-y-3">
        <div class="flex items-start justify-between gap-4">
          <span class="text-[13px] text-text3">{{ $t('orders.fields.orderNo') }}</span>
          <span class="break-all text-right text-[13px] font-medium text-text">{{ order.out_trade_no }}</span>
        </div>
        <div class="flex items-center justify-between gap-4">
          <span class="text-[13px] text-text3">{{ $t('orders.fields.orderType') }}</span>
          <span class="text-[13px] font-medium text-text">{{ orderKind(order.order_type) }}</span>
        </div>
        <div class="flex items-center justify-between gap-4">
          <span class="text-[13px] text-text3">{{ $t('orders.fields.amount') }}</span>
          <span class="font-serif text-[15px] font-semibold text-text">${{ formatBalance(order.amount) }}</span>
        </div>
        <div class="flex items-center justify-between gap-4">
          <span class="text-[13px] text-text3">{{ $t('orders.fields.payAmount') }}</span>
          <span class="font-serif text-[15px] font-semibold text-text">¥{{ formatCNY(order.pay_amount) }}</span>
        </div>
        <div class="flex items-center justify-between gap-4">
          <span class="text-[13px] text-text3">{{ $t('orders.fields.paymentMethod') }}</span>
          <span class="text-[13px] font-medium text-text">{{ order.payment_type }}</span>
        </div>
        <div class="flex items-center justify-between gap-4">
          <span class="text-[13px] text-text3">{{ $t('orders.fields.status') }}</span>
          <StatusBadge v-bind="orderStatusMeta(order.status)" />
        </div>
        <div class="my-2 border-t border-track" />
        <div class="flex items-center justify-between gap-4">
          <span class="text-[13px] text-text3">{{ $t('orders.fields.createdAt') }}</span>
          <span class="text-[13px] text-text">{{ formatDateMinute(order.created_at) }}</span>
        </div>
        <div
          v-if="order.expires_at"
          class="flex items-center justify-between gap-4"
        >
          <span class="text-[13px] text-text3">{{ $t('orders.fields.expiresAt') }}</span>
          <span class="text-[13px] text-text">{{ formatDateMinute(order.expires_at) }}</span>
        </div>
        <div
          v-if="order.paid_at"
          class="flex items-center justify-between gap-4"
        >
          <span class="text-[13px] text-text3">{{ $t('orders.fields.paidAt') }}</span>
          <span class="text-[13px] text-text">{{ formatDateMinute(order.paid_at) }}</span>
        </div>
        <div
          v-if="order.refund_amount"
          class="flex items-center justify-between gap-4"
        >
          <span class="text-[13px] text-text3">{{ $t('orders.fields.refundAmount') }}</span>
          <span class="text-[13px] font-medium text-neg">¥{{ formatCNY(order.refund_amount) }}</span>
        </div>
        <div
          v-if="order.refund_reason"
          class="flex items-start justify-between gap-4"
        >
          <span class="shrink-0 text-[13px] text-text3">{{ $t('orders.fields.refundReason') }}</span>
          <span class="text-right text-[13px] text-text">{{ order.refund_reason }}</span>
        </div>
      </div>
    </template>

    <template #footer>
      <button
        class="rounded-full border border-border px-5 py-2 text-sm font-medium text-text2 transition-colors hover:bg-muted"
        @click="emit('close')"
      >
        {{ $t('common.close') }}
      </button>
    </template>
  </Modal>
</template>
