<script setup lang="ts">
import { ref, watch, computed, nextTick, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import Modal from '@/components/ui/Modal.vue'
import QRCode from 'qrcode'
import { verifyOrder, getCheckoutInfo } from '@/api/payment'
import type { Stripe, StripeElements, StripePaymentElement, StripeElementLocale } from '@stripe/stripe-js'
import { errMessage } from '@/utils/error'
import { resolvePaymentPollAction, orderStatusMeta, toStripeMinorUnit } from '@/utils/format'
import { pollOrderUntilSettled } from '@/utils/orderPolling'
import { STRIPE_PM_TYPE, type StripeSubMethod } from '@/config/payMethods'

const { t, locale } = useI18n()

// 内嵌 Stripe 表单的语言：跟随应用当前语言（zh-CN → zh，en-US → en），而非浏览器语言
const stripeLocale = computed<StripeElementLocale>(() => (locale.value === 'en-US' ? 'en' : 'zh'))

/**
 * 弹窗接受两类订单，统一用此类型描述：
 * - CreateOrderResult：刚下单返回（含 pay_url / qr_code / client_secret）
 * - PaymentOrder：订单列表里的待支付订单（仅 out_trade_no + expires_at，无 pay_url / qr_code）
 * 弹窗只读 out_trade_no、expires_at、status、payment_type?、pay_url?、qr_code?、client_secret?，其它字段忽略。
 */
export interface PaymentModalOrder {
  out_trade_no: string
  expires_at: string
  status: string
  /** 支付方式（wxpay/alipay/stripe…）；用于确认 client_secret 确属 Stripe，缺省按 Stripe 处理 */
  payment_type?: string
  pay_url?: string
  qr_code?: string
  /** Stripe PaymentIntent 的 client_secret，存在时走 Stripe.js 卡支付 */
  client_secret?: string
  /** 应付金额（主单位）；与 currency 一起供 deferred 模式 Elements 使用 */
  pay_amount?: number
  /** 订单币种（Stripe 实例配置决定，如 USD） */
  currency?: string
  /**
   * 充值页选中的 Stripe 子方式（wxpay/alipay/card）。存在且金额币种齐全时，
   * 用 deferred 模式 Elements 的 paymentMethodTypes 只渲染该方式（拍平支付页，纯前端实现）；
   * 缺省（如从订单列表续付）回退为按 client_secret 渲染 PaymentIntent 的全部方式。
   */
  stripe_sub_method?: StripeSubMethod
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

// 轮询停止信号（倒计时归零/命中终态时置真；轮询实现在 utils/orderPolling，此处只管信号）
let pollStopped = false

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
// Elements 是否为 deferred 模式（拍平单一支付方式）：confirm 前需 elements.submit() 并显式传 client_secret
let deferredConfirm = false

// 当前订单是否为 Stripe 订单：除 client_secret 外还核对 payment_type——
// 其它通道（如 airwallex）也可能返回 client_secret，误挂 Stripe Elements 必然失败
const isStripe = computed(
  () => !!props.order?.client_secret && (props.order.payment_type ?? 'stripe') === 'stripe'
)

// 是否渲染 Stripe 卡表单：仅银行卡子方式（或无子方式的续付兜底）需要用户填卡信息；
// 微信子方式直出二维码、支付宝子方式直接整页跳转，都不该出现「填写卡信息 + 立即支付」
const isStripeCardForm = computed(() => {
  if (!isStripe.value) return false
  const sub = props.order?.stripe_sub_method
  return !sub || sub === 'card'
})

// Stripe 微信二维码生成中（弹窗打开到二维码直出之间的加载态）
const stripeQrLoading = ref(false)

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

// 弹窗标题：Stripe 卡表单用「完成支付」，其余（含 Stripe 微信直出二维码）用「扫码支付」
const modalTitle = computed(() => (isStripeCardForm.value ? t('payment.payTitle') : t('payment.scanToPay')))

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
  if (!s) return t('payment.statusPending')
  // key 为后端订单状态枚举取值（SCREAMING_SNAKE_CASE）；支付场景高频状态用本地化短文案，
  // 其余（REFUND_* 系列等）回退订单页的全集词条（orderStatusMeta），不再一律误显示成「等待支付」
  const map: Record<string, string> = {
    PENDING: t('payment.statusPending'),
    PAID: t('payment.statusPaid'),
    RECHARGING: t('payment.statusRecharging'),
    COMPLETED: t('payment.statusPaid'),
    EXPIRED: t('payment.expired'),
    FAILED: t('payment.statusFailed'),
    CANCELLED: t('payment.statusCancelled'),
    REFUNDED: t('payment.statusRefunded')
  }
  return map[s] ?? orderStatusMeta(s).label
})

function stopPoll() {
  pollStopped = true
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
    if (diff <= 0) {
      // 倒计时归零：订单本地已过期，同时停轮询——避免在后端状态还没翻到 EXPIRED 前，
      // 客户端仍按 2s 间隔无意义地继续查询一个注定失败的订单
      stopPoll()
      stopCountdown()
    }
  }
  updateTick()
  // 若首次 tick 已到 0（打开弹窗时订单已过期），上面已停表，不再起新的 interval
  if (countdown.value > 0) {
    countdownTimer = window.setInterval(updateTick, 1000)
  }
}

// 查一次订单状态并落地；失败时抛错，吞不吞由调用方决定（轮询吞、手动查询要展示）
async function verifyOnce(outTradeNo: string) {
  const o = await verifyOrder(outTradeNo)
  // 弹窗已关闭或组件已卸载，丢弃本次结果
  if (aborted) return
  status.value = o.status
  const action = resolvePaymentPollAction(o.status)
  if (action === 'SETTLED') {
    // RECHARGING 也算成功（已付款、到账中），与 frontend SUCCESS_STATUSES 对齐
    stopPoll()
    stopCountdown()
    emit('paid')
  } else if (action === 'TERMINAL') {
    // FAILED/CANCELLED/EXPIRED/退款系列/未知状态：一律停表，但不当作成功通知调用方
    stopPoll()
    stopCountdown()
  }
  // CONTINUE（PENDING）：什么都不做，继续轮询
}

function startPoll(outTradeNo: string) {
  pollStopped = false
  // 轮询实现与状态口径统一走 utils/orderPolling（与充值页回流共用同一原语）；
  // 不设 maxAttempts——由倒计时归零 / 弹窗关闭经 isAborted 终止
  void pollOrderUntilSettled(outTradeNo, {
    isAborted: () => aborted || pollStopped,
    onStatus: (o) => {
      status.value = o.status
    }
  }).then((outcome) => {
    if (outcome.kind === 'SETTLED') {
      // RECHARGING 也算成功（已付款、到账中），与 frontend SUCCESS_STATUSES 对齐
      stopCountdown()
      emit('paid')
    } else if (outcome.kind === 'TERMINAL') {
      // FAILED/CANCELLED/EXPIRED/退款系列/未知状态：停表但不当作成功通知调用方
      stopCountdown()
    }
    // ABORTED：关闭/过期时已各自清理，无副作用
  })
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

// 加载 Stripe 实例（发布密钥懒加载一次；失败时写 stripeInitError 并返回 null）
async function ensureStripe(): Promise<Stripe | null> {
  if (stripeInstance) return stripeInstance
  if (!publishableKey) {
    const info = await getCheckoutInfo()
    publishableKey = info.stripe_publishable_key || ''
  }
  if (aborted) return null
  if (!publishableKey) {
    stripeInitError.value = t('payment.stripeNotConfigured')
    return null
  }
  const { loadStripe } = await import('@stripe/stripe-js')
  const stripe = await loadStripe(publishableKey)
  if (aborted) return null
  if (!stripe) {
    stripeInitError.value = t('payment.stripeLoadFailed')
    return null
  }
  stripeInstance = stripe
  return stripe
}

// Stripe 微信支付：无任何可填信息，不挂表单——直接确认 PaymentIntent（handleActions:false）
// 拿微信收款链接，弹窗打开即直出二维码（本地渲染成 data URL，不依赖 Stripe 图片外链），
// 省去「填写卡信息 + 立即支付」这一步；到账由既有轮询检测
async function initStripeWechatQr(clientSecret: string) {
  stripeInitError.value = ''
  errMsg.value = ''
  stripeQrLoading.value = true
  try {
    const stripe = await ensureStripe()
    if (aborted) return
    if (!stripe) {
      // ensureStripe 的失败原因写在 stripeInitError；本模式没有卡表单区，转写到通用错误位展示
      errMsg.value = stripeInitError.value || t('payment.stripeLoadFailed')
      return
    }
    // 官方 web 集成入参：不传 payment_method（Stripe 自动创建并附加 wechat_pay 类型的
    // PaymentMethod），但必须在确认时声明 client: 'web' 才会返回扫码用的 next_action
    const result = await stripe.confirmWechatPayPayment(
      clientSecret,
      { payment_method_options: { wechat_pay: { client: 'web' } } },
      { handleActions: false }
    )
    if (aborted) return
    if (result.error) {
      errMsg.value = result.error.message || t('payment.stripeLoadFailed')
      return
    }
    const nextAction = result.paymentIntent?.next_action as {
      wechat_pay_display_qr_code?: { data?: string; image_data_url?: string }
    } | null
    const qr = nextAction?.wechat_pay_display_qr_code
    if (qr?.data) {
      qrImageUrl.value = await QRCode.toDataURL(qr.data, { width: 200, margin: 2, errorCorrectionLevel: 'L' })
    } else if (qr?.image_data_url) {
      // 兜底：Stripe 已内联的 data URL 图片（自包含，无外链可达性问题）
      qrImageUrl.value = qr.image_data_url
    } else {
      errMsg.value = t('payment.stripeLoadFailed')
    }
  } catch (e) {
    // stripe-js 对入参/集成问题会直接抛 IntegrationError：透出原始信息，便于定位，
    // 不能一律吞成「组件加载失败」
    if (!aborted) {
      errMsg.value = e instanceof Error && e.message ? e.message : t('payment.stripeLoadFailed')
    }
  } finally {
    stripeQrLoading.value = false
  }
}

// Stripe 支付宝：无任何可填信息，直接整页跳转 Stripe 托管支付页（跳过弹窗内确认步骤）；
// 付完按 return_url 回本页，充值页据 pay_return 参数轮询确认到账
async function redirectStripeAlipay(clientSecret: string) {
  try {
    const stripe = await ensureStripe()
    if (aborted) return
    if (!stripe) {
      errMsg.value = stripeInitError.value || t('payment.stripeLoadFailed')
      return
    }
    const returnUrl = new URL(window.location.href)
    if (props.order?.out_trade_no) {
      returnUrl.searchParams.set('pay_return', props.order.out_trade_no)
    }
    const { error } = await stripe.confirmAlipayPayment(clientSecret, { return_url: returnUrl.toString() })
    // 正常情况此行执行不到（已整页跳走）；走到这里说明确认失败
    if (error && !aborted) {
      errMsg.value = error.message || t('payment.stripeLoadFailed')
    }
  } catch (e) {
    // stripe-js 对入参/集成问题会直接抛 IntegrationError：透出原始信息，便于定位
    if (!aborted) {
      errMsg.value = e instanceof Error && e.message ? e.message : t('payment.stripeLoadFailed')
    }
  }
}

// 挂载 Stripe Payment Element（银行卡表单；无子方式的续付兜底则渲染 intent 的全部方式）
async function initStripe(clientSecret: string) {
  stripeInitError.value = ''
  stripeError.value = ''
  stripeReady.value = false
  try {
    const stripe = await ensureStripe()
    if (!stripe || aborted) return

    // 拍平单一支付方式（纯前端）：充值页选了微信/支付宝/银行卡时，用 deferred 模式的
    // paymentMethodTypes 只渲染该方式；PaymentIntent 本身仍带全部方式，确认时再传 client_secret。
    // 金额/币种不全（旧订单续付等）则回退 clientSecret 模式，渲染 PaymentIntent 的全部方式。
    const subMethod = props.order?.stripe_sub_method
    const payAmount = props.order?.pay_amount
    const currency = props.order?.currency?.trim()
    deferredConfirm = !!(subMethod && STRIPE_PM_TYPE[subMethod] && typeof payAmount === 'number' && payAmount > 0 && currency)
    const elements = deferredConfirm
      ? stripe.elements({
          mode: 'payment',
          amount: toStripeMinorUnit(payAmount!, currency),
          currency: currency!.toLowerCase(),
          paymentMethodTypes: [STRIPE_PM_TYPE[subMethod!]],
          locale: stripeLocale.value,
          appearance: { theme: 'stripe', variables: { borderRadius: '12px' } }
        })
      : stripe.elements({
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
    // deferred 模式（拍平单一方式）：确认前必须 elements.submit() 校验表单，
    // 且 Elements 未绑定 intent，须把已创建订单的 client_secret 显式传给 confirmPayment；
    // clientSecret 模式的 Elements 已绑定 intent，不再重复传。
    let confirmError
    if (deferredConfirm) {
      const { error: submitError } = await elementsInstance.submit()
      if (submitError) {
        stripeError.value = submitError.message || t('payment.statusFailed')
        return
      }
      const { error } = await stripeInstance.confirmPayment({
        elements: elementsInstance,
        clientSecret: props.order?.client_secret ?? '',
        confirmParams: { return_url: returnUrl.toString() },
        redirect: 'if_required'
      })
      confirmError = error
    } else {
      const { error } = await stripeInstance.confirmPayment({
        elements: elementsInstance,
        confirmParams: { return_url: returnUrl.toString() },
        redirect: 'if_required'
      })
      confirmError = error
    }
    if (confirmError) {
      stripeError.value = confirmError.message || t('payment.statusFailed')
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
  deferredConfirm = false
  stripeReady.value = false
  stripeSubmitting.value = false
  stripeProcessing.value = false
  stripeQrLoading.value = false
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
      // 上一单（如 Stripe 微信）可能残留二维码；本单不带 qr_code 时先清掉，避免闪现旧码
      if (!props.order.qr_code) {
        qrImageUrl.value = ''
      }

      if (props.order.client_secret) {
        const sub = isStripe.value ? props.order.stripe_sub_method : undefined
        if (sub === 'alipay') {
          // Stripe 支付宝：直接整页跳转托管支付页，弹窗只短暂显示「正在跳转」
          redirectStripeAlipay(props.order.client_secret)
          return
        }
        if (sub === 'wxpay') {
          // Stripe 微信：弹窗直出二维码 + 倒计时 + 轮询，无需任何点击
          startCountdown()
          initStripeWechatQr(props.order.client_secret)
          if (props.order.out_trade_no) {
            startPoll(props.order.out_trade_no)
          }
          return
        }
        // Stripe 银行卡（或续付兜底）：弹窗内挂载 Payment Element，同时启动倒计时展示过期时间
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
      <!-- Stripe 卡支付：Payment Element（仅银行卡子方式/续付兜底；微信直出二维码、支付宝直跳） -->
      <div
        v-if="isStripeCardForm"
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

      <!-- 二维码（直连通道的 qr_code 或 Stripe 微信直出的二维码） -->
      <div
        v-else-if="qrImageUrl"
        class="flex flex-col items-center gap-3"
      >
        <img
          :src="qrImageUrl"
          :alt="$t('payment.qrAlt')"
          class="h-[200px] w-[200px] rounded-xl2 border border-border2 bg-muted"
        >
        <p class="text-sm text-text3">
          {{ order.stripe_sub_method === 'wxpay' ? $t('payment.scanWechatHint') : $t('payment.scanHint') }}
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

      <!-- Stripe 微信二维码生成中 -->
      <div
        v-else-if="stripeQrLoading"
        class="flex flex-col items-center gap-3 py-6 text-sm text-text3"
      >
        <span class="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        {{ $t('payment.loadingQr') }}
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
        v-if="!isStripeCardForm || stripeProcessing"
        class="w-full rounded-xl2 px-4 py-3 text-center text-sm font-medium"
        :class="{
          'bg-pos/8 text-pos': status === 'PAID' || status === 'COMPLETED' || status === 'RECHARGING',
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
        v-if="!isStripeCardForm || stripeProcessing"
        class="rounded-xl2 bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        :disabled="verifying"
        @click="handleManualVerify"
      >
        {{ verifying ? $t('payment.verifying') : $t('payment.paidRefresh') }}
      </button>
    </template>
  </Modal>
</template>
