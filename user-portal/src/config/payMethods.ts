/**
 * 本门户支持渲染的支付方式白名单（单一来源；顺序即展示顺序与默认选中优先级）。
 * 后端 checkout-info 的 methods 可能包含更多通道（easypay/airwallex/alipay_direct 等），
 * 但本门户只实现了这三种的完整支付流；不在白名单内的通道一律不渲染、不默认选中——
 * 否则会出现「界面无选中项却可提交」或把 airwallex 的 client_secret 误当 Stripe 处理。
 * 新增通道时：此处加键 + PayMethodPicker 补图标文案 + PaymentResultModal 确认结果处理分支。
 */
export const SUPPORTED_PAYMENT_METHODS = ['wxpay', 'alipay', 'stripe'] as const

export type SupportedPaymentMethod = (typeof SUPPORTED_PAYMENT_METHODS)[number]

/** 从后端返回的通道键集合中，按白名单优先级挑默认选中项（无受支持通道返回 ''） */
export function pickDefaultPaymentMethod(methodKeys: string[]): string {
  const available = new Set(methodKeys)
  return SUPPORTED_PAYMENT_METHODS.find((k) => available.has(k)) ?? ''
}
