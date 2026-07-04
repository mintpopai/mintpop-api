<script setup lang="ts">
import { ref, watch, computed, nextTick, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import Modal from '@/components/ui/Modal.vue'
import QRCode from 'qrcode'
import { verifyOrder, getCheckoutInfo } from '@/api/payment'
import type { Stripe, StripeElements, StripePaymentElement, StripeElementLocale } from '@stripe/stripe-js'
import { errMessage } from '@/utils/error'
import { ORDER_PAID_STATUSES } from '@/utils/format'

const { t, locale } = useI18n()

// 内嵌 Stripe 表单的语言：跟随应用当前语言（zh-CN → zh，en-US → en），而非浏览器语言
const stripeLocale = computed<StripeElementLocale>(() => (locale.value === 'en-US' ? 'en' : 'zh'))

/**
 * 弹窗接受两类订单，统一用此类型描述：
 * - CreateOrderResult：刚下单返回（含 pay_url / qr_code / client_secret）
 * - PaymentOrder：订单列表里的待支付订单（仅 out_trade_no + expires_at，无 pay_url / qr_code）
 * 弹窗只读 out_trade_no、expires_at、status、pay_url?、qr_code?、client_secret?，其它字段忽略。
 */
export interface PaymentModalOrder {
  out_trade_no: string
  expires_at: string
  status: string
  pay_url?: string
  qr_code?: string
  /** Stripe PaymentIntent 的 client_secret，存在时走 Stripe.js 卡支付 */
  client_secret?: string
}

const props = defineProps<{
  open: boolean
  order: PaymentModalOrder | null
}>()

const emit = defineEmits<{
  close: []
  paid: []
}>()

// 当前订单状态（轮询过程中更新）
const status = ref('')
const verifying = ref(false)
const errMsg = ref('')

// 倒计时（秒）
const countdown = ref(0)
let countdownTimer: number | null = null

// 轮询定时器
let pollTimer: number | null = null

// 防止弹窗关闭后飞行中的 verify 回调仍触发 emit('paid') 或状态变更
let aborted = false

// ==================== Stripe 卡支付（Payment Element）====================
// 复刻主前端 StripePaymentView 的做法：用 client_secret 在弹窗内挂载 Stripe Payment Element，
// 用户填卡后 confirmPayment；成功后转入「确认中」并轮询后端订单状态直至到账。
const stripeError = ref('')
const stripeInitError = ref('')
const stripeReady = ref(false)
const stripeSubmitting = ref(false)
const stripeProcessing = ref(false)
const paymentElRef = ref<HTMLElement | null>(null)

let stripeInstance: Stripe | null = null
let elementsInstance: StripeElements | null = null
let paymentElement: StripePaymentElement | null = null
// 发布密钥缓存（结算信息里带，懒加载一次）
let publishableKey = ''

// 当前订单是否为 Stripe（存在 client_secret 即走卡支付）
const isStripe = computed(() => !!props.order?.client_secret)

// 二维码本地生成为 data URL（qrcode 库，与主前端 PaymentQRDialog 一致）：
// 不走第三方渲染服务——支付链接不出站，也不受境外服务在大陆可达性影响
const qrImageUrl = ref('')
watch(
  () => props.order?.qr_code ?? '',
  async (qr) => {
    if (!qr) {
      qrImageUrl.value = ''
      return
    }
    try {
      qrImageUrl.value = await QRCode.toDataURL(qr, { width: 200, margin: 2, errorCorrectionLevel: 'L' })
    } catch {
      // 生成失败（仅非法输入可能触发）：留空，模板不渲染图片
      qrImageUrl.value = ''
    }
  },
  { immediate: true }
)

// 弹窗标题：Stripe 卡支付用「完成支付」，其余用「扫码支付」
const modalTitle = computed(() => (isStripe.value ? t('payment.payTitle') : t('payment.scanToPay')))

// 倒计时格式
const countdownLabel = computed(() => {
  if (countdown.value <= 0) return t('payment.expired')
  const m = Math.floor(countdown.value / 60)
  const s = countdown.value % 60
  return `${m}:${String(s).padStart(2, '0')}`
})

// 状态文案
const statusLabel = computed(() => {
  const s = status.value || props.order?.status || ''
  // key 为后端订单状态枚举取值（SCREAMING_SNAKE_CASE）
  const map: Record<string, string> = {
    PENDING: t('payment.statusPending'),
    PAID: t('payment.statusPaid'),
    COMPLETED: t('payment.statusPaid'),
    FAILED: t('payment.statusFailed'),
    CANCELLED: t('payment.statusCancelled'),
    REFUNDED: t('payment.statusRefunded')
  }
  return map[s] ?? t('payment.statusPending')
})

function stopPoll() {
  if (pollTimer !== null) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function stopCountdown() {
  if (countdownTimer !== null) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

function startCountdown() {
  stopCountdown()
  const expiresAt = props.order?.expires_at
  if (!expiresAt) return
  const updateTick = () => {
    const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
    countdown.value = diff
  }
  updateTick()
  countdownTimer = window.setInterval(updateTick, 1000)
}

// 查一次订单状态并落地；失败时抛错，吞不吞由调用方决定（轮询吞、手动查询要展示）
async function verifyOnce(outTradeNo: string) {
  const o = await verifyOrder(outTradeNo)
  // 弹窗已关闭或组件已卸载，丢弃本次结果
  if (aborted) return
  status.value = o.status
  if (ORDER_PAID_STATUSES.includes(o.status)) {
    stopPoll()
    stopCountdown()
    emit('paid')
  } else if (o.status === 'FAILED' || o.status === 'REFUNDED') {
    stopPoll()
    stopCountdown()
  }
}

async function doVerify(outTradeNo: string) {
  try {
    await verifyOnce(outTradeNo)
  } catch {
    // 轮询失败忽略，下次再试
  }
}

function startPoll(outTradeNo: string) {
  stopPoll()
  // 立即查一次
  doVerify(outTradeNo)
  pollTimer = window.setInterval(() => doVerify(outTradeNo), 2000)
}

async function handleManualVerify() {
  if (!props.order?.out_trade_no) return
  verifying.value = true
  errMsg.value = ''
  try {
    // 走会抛错的 verifyOnce：手动「已支付，刷新」失败必须让用户看到错误
    await verifyOnce(props.order.out_trade_no)
  } catch (e) {
    errMsg.value = errMessage(e, t('payment.errVerify'))
  } finally {
    verifying.value = false
  }
}

// 挂载 Stripe Payment Element
async function initStripe(clientSecret: string) {
  stripeInitError.value = ''
  stripeError.value = ''
  stripeReady.value = false
  try {
    if (!publishableKey) {
      const info = await getCheckoutInfo()
      publishableKey = info.stripe_publishable_key || ''
    }
    if (aborted) return
    if (!publishableKey) {
      stripeInitError.value = t('payment.stripeNotConfigured')
      return
    }

    const { loadStripe } = await import('@stripe/stripe-js')
    const stripe = await loadStripe(publishableKey)
    if (aborted) return
    if (!stripe) {
      stripeInitError.value = t('payment.stripeLoadFailed')
      return
    }
    stripeInstance = stripe

    const elements = stripe.elements({
      clientSecret,
      locale: stripeLocale.value,
      appearance: { theme: 'stripe', variables: { borderRadius: '12px' } }
    })
    elementsInstance = elements
    paymentElement = elements.create('payment', { layout: 'tabs' })

    // 等容器 DOM 渲染出来再 mount
    await nextTick()
    if (aborted || !paymentElRef.value) return
    paymentElement.mount(paymentElRef.value)
    paymentElement.on('ready', () => {
      stripeReady.value = true
    })
  } catch {
    if (!aborted) stripeInitError.value = t('payment.stripeLoadFailed')
  }
}

async function handleStripePay() {
  if (!stripeInstance || !elementsInstance || stripeSubmitting.value) return
  stripeSubmitting.value = true
  stripeError.value = ''
  try {
    // redirect: 'if_required' —— 银行卡、微信（内联二维码）等无需跳转的方式在弹窗内直接完成；
    // 需整页跳转的方式（支付宝、部分 3DS）会跳走、付完再按 return_url 跳回本页。
    // 给 return_url 带上订单号（pay_return），跳回后由充值页据此确认订单并弹出成功提示。
    const returnUrl = new URL(window.location.href)
    if (props.order?.out_trade_no) {
      returnUrl.searchParams.set('pay_return', props.order.out_trade_no)
    }
    const { error } = await stripeInstance.confirmPayment({
      elements: elementsInstance,
      confirmParams: { return_url: returnUrl.toString() },
      redirect: 'if_required'
    })
    if (error) {
      stripeError.value = error.message || t('payment.statusFailed')
      return
    }
    // 卡支付已提交成功：转入「确认中」，轮询后端订单状态（等 Stripe webhook 到账）后 emit('paid')
    stripeProcessing.value = true
    if (props.order?.out_trade_no) startPoll(props.order.out_trade_no)
  } catch {
    stripeError.value = t('payment.stripeLoadFailed')
  } finally {
    stripeSubmitting.value = false
  }
}

function teardownStripe() {
  try {
    paymentElement?.unmount()
  } catch {
    // 忽略卸载异常
  }
  paymentElement = null
  stripeInstance = null
  elementsInstance = null
  stripeReady.value = false
  stripeSubmitting.value = false
  stripeProcessing.value = false
  stripeError.value = ''
  stripeInitError.value = ''
}

watch(
  () => props.open,
  (v) => {
    if (v && props.order) {
      // 重新打开时重置 aborted 标志，允许新一轮 verify 更新状态
      aborted = false
      status.value = props.order.status || 'PENDING'
      errMsg.value = ''

      if (props.order.client_secret) {
        // Stripe 卡支付：弹窗内挂载 Payment Element，同时启动倒计时展示过期时间
        startCountdown()
        initStripe(props.order.client_secret)
        return
      }

      if (props.order.pay_url) {
        // 跳转支付（支付宝 H5 等）
        window.location.href = props.order.pay_url
        return
      }

      // 扫码支付：启动倒计时 + 轮询
      startCountdown()
      if (props.order.out_trade_no) {
        startPoll(props.order.out_trade_no)
      }
    } else {
      // 弹窗关闭：标记 aborted，防止飞行中的 verify 回调触发副作用
      aborted = true
      stopPoll()
      stopCountdown()
      teardownStripe()
    }
  }
)

onBeforeUnmount(() => {
  aborted = true
  stopPoll()
  stopCountdown()
  teardownStripe()
})
</script>

<template>
  <Modal
    :open="open"
    :title="modalTitle"
    @close="emit('close')"
  >
    <div
      v-if="order"
      class="flex flex-col items-center gap-4"
    >
      <!-- Stripe 卡支付：Payment Element -->
      <div
        v-if="isStripe"
        class="w-full"
      >
        <!-- 加载失败 -->
        <p
          v-if="stripeInitError"
          class="rounded-xl2 bg-neg/8 px-4 py-3 text-center text-sm font-medium text-neg"
        >
          {{ stripeInitError }}
        </p>

        <template v-else-if="stripeProcessing">
          <!-- 支付已提交，等待到账确认 -->
          <div class="flex flex-col items-center gap-3 py-6 text-sm text-text3">
            <span class="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            {{ $t('payment.processing') }}
          </div>
        </template>

        <template v-else>
          <p class="mb-3 text-sm text-text3">
            {{ $t('payment.stripeHint') }}
          </p>
          <!-- Stripe Payment Element 挂载点 -->
          <div
            ref="paymentElRef"
            class="min-h-[180px]"
          />
          <p
            v-if="stripeError"
            class="mt-3 text-xs text-neg"
          >
            {{ stripeError }}
          </p>
          <button
            class="mt-5 w-full rounded-xl2 bg-accent py-[13px] text-sm font-semibold text-white transition-[background,opacity] duration-150 hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!stripeReady || stripeSubmitting"
            @click="handleStripePay"
          >
            {{ stripeSubmitting ? $t('payment.processing') : $t('payment.stripePay') }}
          </button>
          <!-- 倒计时 -->
          <div
            v-if="order.expires_at"
            class="mt-3 flex items-center justify-center gap-2 text-xs text-subtle"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
              />
              <path d="M12 6v6l4 2" />
            </svg>
            {{ $t('payment.qrValidity', { time: countdownLabel }) }}
          </div>
        </template>
      </div>

      <!-- 二维码 -->
      <div
        v-else-if="order.qr_code"
        class="flex flex-col items-center gap-3"
      >
        <img
          :src="qrImageUrl"
          :alt="$t('payment.qrAlt')"
          class="h-[200px] w-[200px] rounded-xl2 border border-border2 bg-muted"
        >
        <p class="text-sm text-text3">
          {{ $t('payment.scanHint') }}
        </p>

        <!-- 倒计时 -->
        <div
          class="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs text-subtle"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
            />
            <path d="M12 6v6l4 2" />
          </svg>
          {{ $t('payment.qrValidity', { time: countdownLabel }) }}
        </div>
      </div>

      <!-- 无二维码时（等待跳转中） -->
      <div
        v-else
        class="py-4 text-sm text-text3"
      >
        {{ $t('payment.redirecting') }}
      </div>

      <!-- 状态（Stripe 卡支付未提交前不展示「等待支付」冗余状态条）-->
      <div
        v-if="!isStripe || stripeProcessing"
        class="w-full rounded-xl2 px-4 py-3 text-center text-sm font-medium"
        :class="{
          'bg-pos/8 text-pos': status === 'PAID' || status === 'COMPLETED',
          'bg-neg/8 text-neg': status === 'FAILED',
          'bg-muted text-text3': status === 'PENDING' || !status
        }"
      >
        {{ statusLabel }}
      </div>

      <!-- 错误提示 -->
      <p
        v-if="errMsg"
        class="text-xs text-neg"
      >
        {{ errMsg }}
      </p>
    </div>

    <template #footer>
      <button
        class="rounded-xl2 border border-border2 px-4 py-2 text-sm font-medium text-text3 hover:border-border hover:text-text"
        @click="emit('close')"
      >
        {{ $t('common.close') }}
      </button>
      <button
        v-if="!isStripe || stripeProcessing"
        class="rounded-xl2 bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        :disabled="verifying"
        @click="handleManualVerify"
      >
        {{ verifying ? $t('payment.verifying') : $t('payment.paidRefresh') }}
      </button>
    </template>
  </Modal>
</template>
