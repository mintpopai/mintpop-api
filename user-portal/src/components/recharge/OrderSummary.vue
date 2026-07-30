<script setup lang="ts">
import { computed } from 'vue'
import { formatBalance, estimatePayAmount } from '@/utils/format'

const props = defineProps<{
  /** 选中的充值金额（USD） */
  amount: number | null
  /** 充值倍率（1 = 到账等于实付；7 = 实付 $1 到账 7 额度） */
  multiplier: number
  /** 手续费率，百分数（后端 checkout-info 的 recharge_fee_rate：5 = 5%，非小数） */
  feeRate: number
  /** 当前余额（USD），用于展示「到账后余额」 */
  balance: number
}>()

// 到账额度 = 实付金额 × 倍率（口径对齐后端 calculateCreditedBalance）
const credited = computed(() => {
  if (!props.amount) return 0
  return Math.round(props.amount * props.multiplier * 100) / 100
})

// 应付（USD，含手续费）：口径对齐后端 fee = amount × rate / 100、向上取整到分
const payUsd = computed(() => {
  if (!props.amount) return 0
  return estimatePayAmount(props.amount, props.feeRate)
})

// 是否有有效金额
const hasAmount = computed(() => props.amount !== null && props.amount > 0)

// 到账后余额 = 当前余额 + 到账额度
const balanceAfter = computed(() => props.balance + credited.value)
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

    <!-- 到账额度（倍率大于 1 时才显示，否则与「充值金额」重复） -->
    <div
      v-if="multiplier > 1 && hasAmount"
      class="mb-[13px] flex items-center justify-between"
    >
      <span class="text-sm text-text3">{{ $t('recharge.creditedAmount') }}</span>
      <span class="text-[15px] font-semibold text-pos">
        ${{ formatBalance(credited) }}
      </span>
    </div>

    <!-- 到账后余额（分割线上方） -->
    <div
      class="mb-[15px] flex items-center justify-between border-b border-dashed border-border2 pb-[15px]"
    >
      <span class="text-sm text-text3">{{ $t('recharge.balanceAfter') }}</span>
      <span class="text-[15px] font-semibold text-text">
        ${{ formatBalance(hasAmount ? balanceAfter : balance) }}
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
