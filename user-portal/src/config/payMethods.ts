import type { MethodLimit } from '@/api/types'

/**
 * 本门户支持渲染的支付选项（单一来源；顺序即展示顺序与默认选中优先级）。
 * 后端 checkout-info 的 methods 可能包含更多通道（easypay/airwallex/alipay_direct 等），
 * 但本门户只实现了直连微信/支付宝与 Stripe 的完整支付流；不在此内的通道一律不渲染、
 * 不默认选中——否则会出现「界面无选中项却可提交」或把 airwallex 的 client_secret 误当 Stripe 处理。
 *
 * Stripe 拍平（纯前端实现，后端零改动）：后端把 Stripe 实例聚合成单个 `stripe` 方式，
 * 门户按部署约定（Stripe 实例固定配置 card/alipay/wxpay 三个子方式）直接展开成
 * 「微信支付 / 支付宝 / 银行卡」平铺选项；支付弹窗用 deferred 模式 Elements 的
 * `paymentMethodTypes` 只渲染所选方式，再以 client_secret 确认同一个 PaymentIntent
 * （PaymentIntent 本身仍带三种方式，收窄只发生在展示层）。
 */

/** Stripe 拍平的子方式（展示顺序即数组顺序；与部署约定的实例 supported_types 对应） */
export const STRIPE_SUB_METHODS = ['wxpay', 'alipay', 'card'] as const
export type StripeSubMethod = (typeof STRIPE_SUB_METHODS)[number]

/** 子方式 → Stripe API 的 payment_method_types 取值（deferred Elements 的 paymentMethodTypes 用） */
export const STRIPE_PM_TYPE: Record<StripeSubMethod, string> = {
  wxpay: 'wechat_pay',
  alipay: 'alipay',
  card: 'card'
}

/** 直连扫码通道白名单 */
const DIRECT_METHODS = ['wxpay', 'alipay'] as const

/** 一个可选支付选项：UI 键 + 下单参数 + 限额来源键 */
export interface PayOption {
  /** UI 唯一键：直连 = 通道键；Stripe 子方式 = `stripe:<sub>` */
  key: string
  /** 下单 payment_type */
  paymentType: string
  /** Stripe 拍平选项携带的子方式（决定支付弹窗只渲染哪种方式） */
  subMethod?: StripeSubMethod
  /** 读取限额用的 checkout.methods 键（stripe:* 共享 stripe 的限额） */
  limitsKey: string
}

/**
 * 从后端 methods 构建拍平后的支付选项列表（展示顺序：微信 → 支付宝 → 银行卡）。
 * 同名去重：直连微信/支付宝优先，Stripe 的同名子方式不再重复出现。
 */
export function buildPayOptions(methods: Record<string, MethodLimit>): PayOption[] {
  const options: PayOption[] = []
  const hasStripe = 'stripe' in methods

  for (const m of DIRECT_METHODS) {
    if (m in methods) {
      options.push({ key: m, paymentType: m, limitsKey: m })
    } else if (hasStripe) {
      options.push({ key: `stripe:${m}`, paymentType: 'stripe', subMethod: m, limitsKey: 'stripe' })
    }
  }
  if (hasStripe) {
    options.push({ key: 'stripe:card', paymentType: 'stripe', subMethod: 'card', limitsKey: 'stripe' })
  }
  return options
}

/** 默认选中项：拍平列表的首个选项（列表顺序即优先级；无可用选项返回 ''） */
export function pickDefaultPayOption(options: PayOption[]): string {
  return options[0]?.key ?? ''
}
