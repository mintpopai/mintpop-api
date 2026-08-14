<script setup lang="ts">
import { computed } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import PayMethodPicker from '@/components/recharge/PayMethodPicker.vue'
import type { PayOption } from '@/config/payMethods'
import type { SubscriptionPlan } from '@/api/types'
import { discountPercent, formatBalance, formatValidity } from '@/utils/format'
import { platformMeta } from '@/utils/platform'

const props = defineProps<{
  open: boolean
  /** 待确认的套餐；为 null 时弹窗内不渲染内容（关闭动画期间可能短暂为空） */
  plan: SubscriptionPlan | null
  /** 拍平后的支付选项（与充值页共用同一份） */
  payOptions: PayOption[]
  /** 下单失败的错误文案 */
  error?: string
  /** 下单进行中：禁用按钮并改文案 */
  submitting?: boolean
}>()

const emit = defineEmits<{ close: []; confirm: [] }>()

// 选中的支付方式（与充值页共享同一个 method，故用 v-model 而非组件内部状态）
const method = defineModel<string>('method', { required: true })

// 票根展示值：与套餐卡片同源计算，两处口径一致
const view = computed(() => {
  const plan = props.plan
  if (!plan) return null
  return {
    platform: platformMeta(plan.group_platform),
    hasDiscount: typeof plan.original_price === 'number' && plan.original_price > plan.price,
    discount: discountPercent(plan.price, plan.original_price),
    validity: formatValidity(plan.validity_days, plan.validity_unit)
  }
})

const canConfirm = computed(() => !!method.value && !props.submitting)
</script>

<template>
  <Modal
    :open="open"
    :title="$t('recharge.confirmSubscribe')"
    @close="emit('close')"
  >
    <template v-if="plan && view">
      <!-- 套餐票根：分组/平台 → 套餐名 → 价格 → 虚线下的有效期与倍率 -->
      <div class="rounded-xl2 border border-border2 bg-muted/70 px-5 py-[18px]">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="mb-1.5 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-faint">
              <span
                class="h-1.5 w-1.5 shrink-0 rounded-full"
                :style="{ backgroundColor: view.platform.color }"
              />
              <span class="truncate">{{ plan.group_name ?? $t('recharge.planFallback') }}</span>
              <span class="shrink-0 text-faint/70">{{ view.platform.label }}</span>
            </div>
            <div class="font-serif text-[19px] font-medium leading-snug text-text">
              {{ plan.name }}
            </div>
          </div>
          <span
            v-if="view.discount > 0"
            class="shrink-0 rounded-full bg-neg/10 px-2.5 py-1 text-[11px] font-semibold text-neg"
            :title="$t('recharge.discountOff', { percent: view.discount })"
          >
            -{{ view.discount }}%
          </span>
        </div>

        <div class="mt-3.5 flex items-baseline gap-2">
          <span class="font-serif text-[30px] font-medium leading-none text-text">
            ${{ formatBalance(plan.price) }}
          </span>
          <span
            v-if="view.hasDiscount"
            class="text-sm text-faint line-through"
          >
            ${{ formatBalance(plan.original_price!) }}
          </span>
        </div>

        <div class="mt-3.5 flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t border-dashed border-border2 pt-3 text-[13px] text-subtle">
          <span>
            {{ $t('recharge.validity') }}
            <span class="ml-1.5 font-medium text-text">{{ view.validity }}</span>
          </span>
          <span v-if="typeof plan.rate_multiplier === 'number'">
            {{ $t('recharge.rateMultiplier') }}
            <span class="ml-1.5 font-medium text-text">{{ plan.rate_multiplier }}×</span>
          </span>
        </div>
      </div>

      <!-- 支付方式：标题由本组件给（plain 形态的 picker 只出选项，避免卡中卡） -->
      <div class="mt-6">
        <div class="mb-2.5 flex items-baseline justify-between gap-3">
          <span class="text-[11px] font-medium uppercase tracking-[0.12em] text-faint">
            {{ $t('recharge.paymentMethod') }}
          </span>
          <!-- 具名插值 + 样式化插槽（vue-i18n <i18n-t>）：语序由词条承载，不再拆前后缀 -->
          <i18n-t
            keypath="recharge.poweredBy"
            tag="span"
            scope="global"
            class="shrink-0 text-[11px] text-subtle"
          >
            <template #provider>
              <span class="font-semibold text-[#635BFF]">Stripe</span>
            </template>
          </i18n-t>
        </div>
        <PayMethodPicker
          v-model="method"
          :options="payOptions"
          variant="plain"
        />
      </div>

      <!-- 下单错误 -->
      <p
        v-if="error"
        class="mt-4 text-xs text-neg"
      >
        {{ error }}
      </p>

      <!-- 操作按钮：取消次要（窄），支付主行动（占满剩余宽度并带上金额） -->
      <div class="mt-6 flex gap-3">
        <button
          class="shrink-0 rounded-xl2 border border-border2 px-6 py-3 text-sm font-medium text-text2 transition-colors hover:bg-muted"
          @click="emit('close')"
        >
          {{ $t('common.cancel') }}
        </button>
        <button
          class="flex-1 rounded-xl2 py-3 text-sm font-semibold text-white transition-[background,opacity] duration-150"
          :class="
            canConfirm
              ? 'cursor-pointer bg-accent shadow-[0_4px_14px_rgba(20,194,138,0.28)] hover:bg-accent/90'
              : 'cursor-not-allowed bg-accent/40'
          "
          :disabled="!canConfirm"
          @click="emit('confirm')"
        >
          {{ submitting ? $t('recharge.submitting') : $t('recharge.payAmount', { amount: formatBalance(plan.price) }) }}
        </button>
      </div>
    </template>
  </Modal>
</template>
