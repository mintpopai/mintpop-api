<script setup lang="ts">
import { computed } from 'vue'
import { formatBalance } from '@/utils/format'

const props = defineProps<{
  /** 选中的充值金额（USD） */
  amount: number | null
  /** 充值倍率（1 = 无赠送） */
  multiplier: number
  /** 手续费率（如 0.05 = 5%） */
  feeRate: number
}>()

// 赠送金额
const bonus = computed(() => {
  if (!props.amount || props.multiplier <= 1) return 0
  return Math.round(props.amount * (props.multiplier - 1) * 100) / 100
})

// 应付（USD，含手续费）
const payUsd = computed(() => {
  if (!props.amount) return 0
  return props.amount * (1 + props.feeRate)
})

// 是否有有效金额
const hasAmount = computed(() => props.amount !== null && props.amount > 0)
</script>

<template>
  <div class="rounded-[20px] bg-card p-[24px_26px] shadow-card">
    <!-- 小标签 -->
    <div class="mb-[18px] text-[11px] font-medium uppercase tracking-widest text-faint">
      {{ $t('recharge.orderDetails') }}
    </div>

    <!-- 充值金额 -->
    <div class="mb-[13px] flex items-center justify-between">
      <span class="text-sm text-text3">{{ $t('recharge.rechargeAmount') }}</span>
      <span class="text-[15px] font-semibold text-text">
        {{ hasAmount ? `$${formatBalance(amount!)}` : '—' }}
      </span>
    </div>

    <!-- 赠送额度（分割线上方） -->
    <div
      class="mb-[15px] flex items-center justify-between border-b border-dashed border-border2 pb-[15px]"
    >
      <span class="text-sm text-text3">{{ $t('recharge.bonusCredit') }}</span>
      <span
        class="text-[15px] font-semibold"
        :class="bonus > 0 ? 'text-pos' : 'text-subtle'"
      >
        {{ bonus > 0 ? `+$${formatBalance(bonus)}` : '$0.00' }}
      </span>
    </div>

    <!-- 应付金额 -->
    <div class="mb-1 flex items-baseline justify-between">
      <span class="text-sm font-medium text-text">{{ $t('recharge.amountDue') }}</span>
      <span class="font-serif text-[30px] font-medium leading-none text-text">
        ${{ hasAmount ? formatBalance(payUsd) : '0.00' }}
      </span>
    </div>

    <!-- 注释：实际以下单结果为准 -->
    <p class="mb-5 text-right text-xs text-subtle">
      {{ $t('recharge.amountDueNote') }}
    </p>

    <!-- 插槽：父放确认支付按钮 -->
    <slot name="action" />

    <!-- 安全标识 -->
    <div
      class="mt-[14px] flex items-center justify-center gap-1.5 text-xs text-subtle"
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4z" />
      </svg>
      {{ $t('recharge.stripeSecured') }}
    </div>
  </div>
</template>
