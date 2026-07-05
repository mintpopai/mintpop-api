import { ref } from 'vue'
import i18n from '@/i18n'
import { getCheckoutInfo, createOrder, verifyOrder } from '@/api/payment'
import { redeem as redeemApi } from '@/api/redeem'
import type { CheckoutInfoResponse, CreateOrderResult, RedeemResult, SubscriptionPlan } from '@/api/types'
import { errMessage } from '@/utils/error'
import { pickDefaultPaymentMethod } from '@/config/payMethods'

// 预设充值档位（精简为业界主流的少量档位，大额靠自定义输入兜底）
const PRESETS = [10, 50, 100, 200]
// 标记为「热门」的档位（作默认选中并高亮）
const POPULAR = 100

export function useRecharge() {
  const checkout = ref<CheckoutInfoResponse | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const loaded = ref(false)

  // 选中的预设金额（null 表示使用自定义）
  const amount = ref<number | null>(100)

  // 选中的支付方式
  const method = ref('')

  async function load() {
    loading.value = true
    error.value = null
    try {
      checkout.value = await getCheckoutInfo()
      // 默认选中按白名单优先级挑：methods 是 Go map（键序不稳定）且可能含本门户不渲染的通道，
      // 直接取首键会选中一个界面上看不见的方式
      if (!method.value) {
        method.value = pickDefaultPaymentMethod(Object.keys(checkout.value.methods))
      }
      loaded.value = true
    } catch (e) {
      error.value = errMessage(e, i18n.global.t('common.loadFailed'))
    } finally {
      loading.value = false
    }
  }

  // 跳转型支付（支付宝 H5 等）付完的浏览器回跳地址。后端 CanonicalizeReturnURL 要求
  // 绝对 URL、同源、且路径必须是规范的 /payment/result（本门户已注册该路由），
  // 回跳时后端会自动附加 order_id / out_trade_no 供回流页轮询确认。
  function paymentReturnURL(): string {
    return `${window.location.origin}/payment/result`
  }

  async function submitRecharge(): Promise<CreateOrderResult> {
    // 契约：视图层（RechargeView）在提交前必须已把自定义金额写回 amount（预设档位选中时
    // amount 本就同步更新）。此处显式守卫替代 `amount.value!`，防止未来重构悄悄打破这个隐式
    // 约定却仍带着 null 提交下单——宁可在这里抛错让调用方兜底展示，也不让请求带假值发出去。
    if (amount.value == null) {
      throw new Error(i18n.global.t('recharge.errAmountMissing'))
    }
    return createOrder({
      amount: amount.value,
      payment_type: method.value,
      order_type: 'balance',
      return_url: paymentReturnURL()
    })
  }

  async function submitSubscription(plan: SubscriptionPlan): Promise<CreateOrderResult> {
    return createOrder({
      amount: plan.price,
      payment_type: method.value,
      order_type: 'subscription',
      plan_id: plan.id,
      return_url: paymentReturnURL()
    })
  }

  async function redeem(code: string): Promise<RedeemResult> {
    return redeemApi(code)
  }

  return {
    checkout,
    loading,
    error,
    loaded,
    amount,
    method,
    presets: PRESETS,
    popular: POPULAR,
    load,
    submitRecharge,
    submitSubscription,
    verifyOrder,
    redeem
  }
}
