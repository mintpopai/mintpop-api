<script setup lang="ts">
// 跳转型支付（支付宝 H5 等）的站内回流页。后端 CanonicalizeReturnURL 强制下单 return_url
// 的路径必须是 /payment/result，并在跳回时附加 order_id / out_trade_no（/ resume_token）——
// 本页据 out_trade_no 轮询确认到账（复用 utils/orderPolling 统一原语），成功后刷新余额。
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import { useAuthStore } from '@/stores/auth'
import { pollOrderUntilSettled } from '@/utils/orderPolling'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const authStore = useAuthStore()

// 最多轮询约 30s（15 次 × 2s），等后端收到支付回调确认到账（与充值页回流口径一致）
const POLL_MAX_ATTEMPTS = 15

type ReturnState = 'CHECKING' | 'SUCCESS' | 'UNKNOWN' | 'MISSING'
const state = ref<ReturnState>('CHECKING')
const successText = ref('')

// 组件卸载后中断轮询（用户切走路由时不再空转、也不再写已卸载组件的状态）
let aborted = false
onUnmounted(() => {
  aborted = true
})

onMounted(async () => {
  const outTradeNo = typeof route.query.out_trade_no === 'string' ? route.query.out_trade_no : ''
  if (!outTradeNo) {
    state.value = 'MISSING'
    return
  }
  const outcome = await pollOrderUntilSettled(outTradeNo, {
    maxAttempts: POLL_MAX_ATTEMPTS,
    isAborted: () => aborted
  })
  if (outcome.kind === 'ABORTED') return
  if (outcome.kind === 'SETTLED') {
    await authStore.fetchUser()
    successText.value =
      outcome.order.order_type === 'subscription'
        ? t('payment.returnSubscribed')
        : t('payment.returnSuccess')
    state.value = 'SUCCESS'
  } else {
    // TIMEOUT / TERMINAL：用户可能已付款，不能静默结束，引导去订单页核实
    state.value = 'UNKNOWN'
  }
})
</script>

<template>
  <div>
    <div class="mx-auto max-w-[480px] py-16">
      <div class="flex flex-col items-center rounded-[20px] bg-card px-8 py-12 text-center shadow-card">
        <!-- 确认中 -->
        <template v-if="state === 'CHECKING'">
          <LoadingSpinner :size="32" />
          <p class="mt-5 text-sm text-text3">
            {{ $t('payment.returnChecking') }}
          </p>
        </template>

        <!-- 成功 -->
        <template v-else-if="state === 'SUCCESS'">
          <div class="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-pos/12 text-pos">
            <svg
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h1 class="mb-2 font-serif text-xl font-medium text-text">
            {{ $t('payment.statusPaid') }}
          </h1>
          <p class="text-sm text-text2">
            {{ successText }}
          </p>
        </template>

        <!-- 参数缺失 / 未确认 -->
        <template v-else>
          <div class="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-text3">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
              />
              <path d="M12 8v5" />
              <path d="M12 16.5v.01" />
            </svg>
          </div>
          <p class="text-sm leading-relaxed text-text2">
            {{ state === 'MISSING' ? $t('payment.returnMissing') : $t('payment.returnUnknown') }}
          </p>
        </template>

        <!-- 操作（确认中不展示，避免用户中途离开错过结果） -->
        <div
          v-if="state !== 'CHECKING'"
          class="mt-7 flex gap-3"
        >
          <button
            class="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-text2 transition-colors hover:bg-muted"
            @click="router.push('/recharge')"
          >
            {{ $t('payment.backRecharge') }}
          </button>
          <button
            class="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            @click="router.push('/orders')"
          >
            {{ $t('payment.goOrders') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
