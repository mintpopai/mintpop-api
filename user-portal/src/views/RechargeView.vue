<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import PageSkeleton from '@/components/common/PageSkeleton.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import AmountPicker from '@/components/recharge/AmountPicker.vue'
import PayMethodPicker from '@/components/recharge/PayMethodPicker.vue'
import OrderSummary from '@/components/recharge/OrderSummary.vue'
import RedeemCard from '@/components/recharge/RedeemCard.vue'
import SubscriptionPlans from '@/components/recharge/SubscriptionPlans.vue'
import SubscribeConfirmModal from '@/components/recharge/SubscribeConfirmModal.vue'
import PaymentResultModal, { type PaymentModalOrder } from '@/components/payment/PaymentResultModal.vue'
import Modal from '@/components/ui/Modal.vue'
import { useRecharge } from '@/composables/useRecharge'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useSubscriptionsStore } from '@/stores/subscriptions'
import { getPlans } from '@/api/payment'
import { formatBalance } from '@/utils/format'
import { pollOrderUntilSettled } from '@/utils/orderPolling'
import type { SubscriptionPlan } from '@/api/types'
import { errMessage } from '@/utils/error'

const { t } = useI18n()
const toast = useToast()
const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const subscriptionsStore = useSubscriptionsStore()

// 已生效订阅的分组集合：套餐卡片据此把「选择此套餐」显示为「续费」
const activeGroupIds = computed(() => subscriptionsStore.activeItems.map((s) => s.group_id))

// 从「我的套餐」「到期横幅」跳来时高亮的分组（约 2 秒后自动淡出）
const highlightGroupId = ref<number | null>(null)

const { checkout, loading, error, loaded, amount, method, payOptions, activePayOption, presets, popular, load, submitRecharge, submitSubscription } = useRecharge()

// 分 tab：0 = 充值，1 = 订阅。订阅 tab 恒显示，有没有在售套餐由 SubscriptionPlans 自己出空态。
// 曾按 settings.purchase_subscription_enabled 决定是否显示，那是个 legacy 开关（后端语义是
// 「侧边栏是否展示外链『购买订阅』菜单项」，默认 false 且无管理端入口），导致套餐永远买不到。
const activeTab = ref<0 | 1>(0)

// 下单中
const submitting = ref(false)
const submitError = ref('')

// 支付结果弹窗（订单带上充值页选中的 Stripe 子方式，供弹窗只渲染该支付方式）
const payModalOpen = ref(false)
const currentOrder = ref<PaymentModalOrder | null>(null)

// 成功提示
const successNote = ref('')

// ============ 充值 tab 逻辑 ============

// 实际生效的充值下限/上限（0 表示无限制）。有两重约束，都要满足：
//   1. 全局最低/最高充值金额（min_amount/max_amount，管理端配置，下单校验以此为准）
//   2. 当前选中支付方式的 per-instance 限额（single_min/single_max，用于路由到可用实例）
// 故下限取两者较大者，上限取两者中「有限且较小」者。
// 限额键经拍平选项映射（Stripe 子方式共享 stripe 的限额），不能直接拿选项 key 查 methods
const activeMethodLimit = computed(() =>
  activePayOption.value ? checkout.value?.methods[activePayOption.value.limitsKey] : undefined
)
const effectiveMin = computed(() =>
  Math.max(checkout.value?.min_amount ?? 0, activeMethodLimit.value?.single_min ?? 0)
)
const effectiveMax = computed(() => {
  const caps = [checkout.value?.max_amount ?? 0, activeMethodLimit.value?.single_max ?? 0].filter((v) => v > 0)
  return caps.length ? Math.min(...caps) : 0
})

// 是否可提交（金额有效 + 支付方式已选 + 未在提交中）
const canSubmit = computed(() => {
  if (!checkout.value || submitting.value) return false
  const min = effectiveMin.value
  const max = effectiveMax.value
  const a = amount.value
  if (a === null || a < min || (max > 0 && a > max)) return false
  if (!method.value) return false
  return true
})

async function handleSubmit() {
  if (!canSubmit.value || !amount.value || !method.value) return
  submitting.value = true
  submitError.value = ''
  successNote.value = ''
  try {
    const result = await submitRecharge()
    currentOrder.value = { ...result, stripe_sub_method: activePayOption.value?.subMethod }
    payModalOpen.value = true
  } catch (e) {
    submitError.value = errMessage(e, t('recharge.errCreateOrder'))
  } finally {
    submitting.value = false
  }
}

function handlePayModalClose() {
  payModalOpen.value = false
}

async function handlePaid() {
  payModalOpen.value = false
  await authStore.fetchUser()
  successNote.value = t('recharge.rechargeSuccess')
}

function handleRedeemed() {
  authStore.fetchUser()
}

// ============ 订阅 tab 逻辑 ============

// 回退计划列表（checkout 里没有时单独 fetch）
const extraPlans = ref<SubscriptionPlan[]>([])
const extraPlansLoaded = ref(false)

const plans = computed<SubscriptionPlan[]>(() => {
  if (checkout.value && checkout.value.plans.length > 0) return checkout.value.plans
  return extraPlans.value
})

async function ensurePlans() {
  if (extraPlansLoaded.value) return
  if (checkout.value && checkout.value.plans.length > 0) {
    extraPlansLoaded.value = true
    return
  }
  try {
    extraPlans.value = await getPlans()
  } catch {
    // 静默失败，展示空态即可
  } finally {
    extraPlansLoaded.value = true
  }
}

/** 处理 ?tab=subscription&group=<id>：切到订阅 tab 并滚动/高亮对应分组的套餐卡 */
async function applyPlanDeepLink(): Promise<void> {
  if (route.query.tab !== 'subscription') return
  activeTab.value = 1
  await ensurePlans()

  const groupId = Number(route.query.group)
  if (!Number.isFinite(groupId) || groupId <= 0) return
  // 该分组当前没有在售套餐时静默忽略（只切 tab），不给用户一个指向空处的高亮
  if (!plans.value.some((p) => p.group_id === groupId)) return

  highlightGroupId.value = groupId
  await nextTick()
  document
    .querySelector(`[data-plan-group="${groupId}"]`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  setTimeout(() => {
    highlightGroupId.value = null
  }, 2000)
}

// 订阅确认弹窗
const confirmOpen = ref(false)
const selectedPlan = ref<SubscriptionPlan | null>(null)
const subscribeError = ref('')
const subscribing = ref(false)

function onSubscribe(plan: SubscriptionPlan) {
  selectedPlan.value = plan
  subscribeError.value = ''
  confirmOpen.value = true
}

function handleConfirmClose() {
  confirmOpen.value = false
  selectedPlan.value = null
}

async function handleConfirmSubscribe() {
  if (!selectedPlan.value || !method.value || subscribing.value) return
  subscribing.value = true
  subscribeError.value = ''
  try {
    const result = await submitSubscription(selectedPlan.value)
    confirmOpen.value = false
    currentOrder.value = { ...result, stripe_sub_method: activePayOption.value?.subMethod }
    payModalOpen.value = true
  } catch (e) {
    subscribeError.value = errMessage(e, t('recharge.errCreateOrder'))
  } finally {
    subscribing.value = false
  }
}

async function handleSubPaid() {
  payModalOpen.value = false
  await authStore.fetchUser()
  // 让订阅缓存失效：否则用户看到「订阅成功」后点进「我的套餐」会命中 60 秒缓存，
  // 刚买的套餐不在列表里。fire-and-forget，不阻塞成功提示
  void subscriptionsStore.refresh()
  successNote.value = t('recharge.subscribeSuccess')
}

// ============ Stripe 跳转支付返回处理 ============

// 支付宝等需整页跳转的 Stripe 方式付完会跳回本页（PaymentResultModal 在 return_url 上带了 pay_return=<订单号>）。
// 跳回后此处据订单号轮询确认（后端 webhook 可能有延迟），到账后刷新余额并弹出成功提示，最后清理 URL 参数。
function clearPayReturnQuery() {
  const query = { ...route.query }
  // pay_return 是我们自加的；其余是 Stripe 跳转回来自动附带的参数，一并清掉，避免刷新重复触发
  for (const k of ['pay_return', 'payment_intent', 'payment_intent_client_secret', 'redirect_status']) {
    delete query[k]
  }
  router.replace({ query, hash: route.hash })
}

// 轮询实现与状态口径统一走 utils/orderPolling（与 PaymentResultModal 共用同一原语）。
// 最多轮询约 30s（15 次 × 2s），等后端收到 Stripe webhook 确认到账。
const RESUME_POLL_MAX_ATTEMPTS = 15

// 组件卸载后中断回流轮询（用户切走路由时不再空转最多 30s、也不再写已卸载组件的状态）
let resumeAborted = false
onUnmounted(() => {
  resumeAborted = true
})

async function resumeRedirectPayment(outTradeNo: string) {
  const outcome = await pollOrderUntilSettled(outTradeNo, {
    maxAttempts: RESUME_POLL_MAX_ATTEMPTS,
    isAborted: () => resumeAborted
  })
  if (outcome.kind === 'ABORTED') return
  if (outcome.kind === 'SETTLED') {
    await authStore.fetchUser()
    const isSubscription = outcome.order.order_type === 'subscription'
    // 订阅订单同样要让订阅缓存失效（同 handleSubPaid），fire-and-forget
    if (isSubscription) void subscriptionsStore.refresh()
    successNote.value = isSubscription
      ? t('recharge.subscribeSuccess')
      : t('recharge.rechargeSuccess')
  } else {
    // TIMEOUT / TERMINAL：用户可能已付款，不能静默结束，引导去订单页核实
    toast.error(t('recharge.resumeUnknown'))
  }
  clearPayReturnQuery()
}

// ============ 生命周期 ============

onMounted(async () => {
  // 拉一次订阅数据用于续费文案（哪些分组已生效），失败不影响主流程
  void subscriptionsStore.ensureLoaded()
  await load()
  await ensurePlans()
  await applyPlanDeepLink()
  // 带 #redeem 锚点进入时（如仪表盘「兑换码充值」），切到充值 tab 并滚动到兑换码区
  if (route.hash === '#redeem') {
    activeTab.value = 0
    await nextTick()
    document.getElementById('redeem')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  // 从 Stripe 跳转支付（支付宝等）回来时，据订单号确认到账并弹出成功提示（不阻塞页面渲染）
  const payReturn = route.query.pay_return
  if (typeof payReturn === 'string' && payReturn) {
    resumeRedirectPayment(payReturn)
  }
})
</script>

<template>
  <div>
    <!-- 页头 -->
    <PageHeader
      :title="$t('recharge.pageTitle')"
      :subtitle="$t('recharge.pageSubtitle')"
    >
      <template #actions>
        <button
          class="rounded-full bg-card px-4 py-2.5 text-[13px] font-medium text-text2 shadow-pill hover:text-text"
          @click="router.push('/orders')"
        >
          {{ $t('recharge.myOrders') }} →
        </button>
      </template>
    </PageHeader>

    <!-- 加载态 -->
    <PageSkeleton
      v-if="loading && !loaded"
      variant="cards"
    />

    <!-- 错误态 -->
    <div
      v-else-if="error && !loaded"
      class="rounded-xl3 border border-dashed border-border2 bg-card px-7 py-16 text-center"
    >
      <p class="text-sm text-subtle">
        {{ error }}
      </p>
      <button
        class="mt-4 rounded-full border border-text px-5 py-2 text-sm font-semibold text-text"
        @click="load"
      >
        {{ $t('common.retry') }}
      </button>
    </div>

    <template v-else-if="loaded && checkout">
      <!-- 分段控制（充值 / 订阅） -->
      <div class="mb-6 inline-flex gap-1 rounded-full bg-track p-1">
        <button
          class="rounded-full px-6 py-2 text-sm font-medium transition-[background,color,box-shadow] duration-150"
          :class="
            activeTab === 0
              ? 'bg-card font-semibold text-text shadow-pill'
              : 'text-text3 hover:text-text2'
          "
          @click="activeTab = 0"
        >
          {{ $t('recharge.tabRecharge') }}
        </button>
        <button
          class="rounded-full px-6 py-2 text-sm font-medium transition-[background,color,box-shadow] duration-150"
          :class="
            activeTab === 1
              ? 'bg-card font-semibold text-text shadow-pill'
              : 'text-text3 hover:text-text2'
          "
          @click="activeTab = 1"
        >
          {{ $t('recharge.tabSubscription') }}
        </button>
      </div>

      <!-- ============ 充值 tab ============ -->
      <div
        v-if="activeTab === 0"
        class="grid grid-cols-1 items-start gap-[22px] lg:grid-cols-[1fr_360px]"
      >
        <!-- 左列 -->
        <div class="flex flex-col gap-[22px]">
          <AmountPicker
            v-model="amount"
            :presets="presets"
            :popular="popular"
            :multiplier="checkout.balance_recharge_multiplier"
            :min="effectiveMin"
            :max="effectiveMax"
          />

          <PayMethodPicker
            v-model="method"
            :options="payOptions"
          />

          <div
            id="redeem"
            class="scroll-mt-24"
          >
            <RedeemCard @redeemed="handleRedeemed" />
          </div>
        </div>

        <!-- 右列（sticky，吸顶相对 PortalLayout 的 main 滚动容器，顶栏在容器外） -->
        <div class="sticky top-6 flex flex-col gap-[18px]">
          <!-- 账户卡 -->
          <div class="relative overflow-hidden rounded-[20px] bg-[#1A1A1A] p-[24px_26px] shadow-[0_4px_18px_rgba(0,0,0,0.12)]">
            <!-- 装饰性点阵背景 -->
            <div
              class="pointer-events-none absolute bottom-[-40px] right-[-30px] h-[180px] w-[180px] opacity-55"
              style="background:linear-gradient(150deg,#0E9E72 0%,#14C28A 50%,rgba(20,194,138,0) 92%);-webkit-mask-image:radial-gradient(#000 2px,transparent 2.2px);mask-image:radial-gradient(#000 2px,transparent 2.2px);-webkit-mask-size:15px 15px;mask-size:15px 15px;"
            />
            <div class="relative">
              <div class="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50">
                {{ $t('recharge.rechargeAccount') }}
              </div>
              <div class="mb-[18px] text-[15px] font-semibold text-white">
                {{ authStore.user?.username ?? '—' }}
              </div>
              <div class="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50">
                {{ $t('recharge.currentBalance') }}
              </div>
              <div class="font-serif text-[40px] font-medium leading-none text-white">
                ${{ formatBalance(authStore.balance) }}
              </div>
            </div>
          </div>

          <!-- 订单摘要 + 确认支付按钮 -->
          <OrderSummary
            :amount="amount"
            :multiplier="checkout.balance_recharge_multiplier"
            :fee-rate="checkout.recharge_fee_rate"
            :balance="authStore.balance"
          >
            <template #action>
              <!-- 下单错误提示 -->
              <p
                v-if="submitError"
                class="mb-3 text-xs text-neg"
              >
                {{ submitError }}
              </p>

              <button
                class="w-full rounded-xl2 py-[15px] text-[15px] font-semibold text-white transition-[background,box-shadow,opacity] duration-150"
                :class="
                  canSubmit
                    ? 'cursor-pointer bg-accent shadow-[0_4px_14px_rgba(20,194,138,0.32)] hover:bg-accent/90'
                    : 'cursor-not-allowed bg-accent/40'
                "
                :disabled="!canSubmit || submitting"
                @click="handleSubmit"
              >
                {{ submitting ? $t('recharge.submitting') : canSubmit ? $t('recharge.confirmPay') : $t('recharge.selectAmount') }}
              </button>
            </template>
          </OrderSummary>
        </div>
      </div>

      <!-- ============ 订阅 tab ============ -->
      <template v-else-if="activeTab === 1">
        <!-- 套餐卡片（点击选择后在确认弹窗内选支付方式） -->
        <SubscriptionPlans
          :plans="plans"
          :active-group-ids="activeGroupIds"
          :highlight-group-id="highlightGroupId"
          @subscribe="onSubscribe"
        />
      </template>
    </template>

    <!-- 订阅确认弹窗 -->
    <SubscribeConfirmModal
      v-model:method="method"
      :open="confirmOpen"
      :plan="selectedPlan"
      :pay-options="payOptions"
      :error="subscribeError"
      :submitting="subscribing"
      @close="handleConfirmClose"
      @confirm="handleConfirmSubscribe"
    />

    <!-- 支付结果弹窗（充值与订阅共用，paid 回调按 activeTab 区分） -->
    <PaymentResultModal
      :open="payModalOpen"
      :order="currentOrder"
      @close="handlePayModalClose"
      @paid="activeTab === 0 ? handlePaid() : handleSubPaid()"
    />

    <!-- 支付成功弹窗 -->
    <Modal
      :open="!!successNote"
      @close="successNote = ''"
    >
      <div class="flex flex-col items-center text-center">
        <!-- 成功图标 -->
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
        <h3 class="mb-2 font-serif text-xl font-medium text-text">
          {{ $t('recharge.paySuccessTitle') }}
        </h3>
        <p class="text-sm text-text2">
          {{ successNote }}
        </p>
      </div>
      <template #footer>
        <button
          class="w-full rounded-xl2 bg-accent py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          @click="successNote = ''"
        >
          {{ $t('common.confirm') }}
        </button>
      </template>
    </Modal>
  </div>
</template>
