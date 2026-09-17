/** 定价页计算与展示的纯函数（与 config/pricing.ts 的数据、PricingView 的渲染解耦，便于单测） */
import type { PricingModel } from '@/config/pricing'

/** 按立减百分比折算实付价；discountPercent 为 0 时原样返回 */
export function discountedPrice(original: number, discountPercent: number): number {
  return original * (1 - discountPercent / 100)
}

/**
 * 金额展示：美元 + 两位小数，半分位向上进位。
 *
 * 不能直接用 toFixed(2)：它按 double 的二进制值取整，而 0.435 / 1.805 这类「看着正好是半分」
 * 的十进制数存成 double 后实际略小于字面值，会被截成 $0.43 / $1.80，与对外公布的定价表差一分。
 * 先乘 100 取整再定点，展示价与定价表逐字一致。
 */
export function formatPrice(price: number): string {
  return `$${(Math.round(price * 100) / 100).toFixed(2)}`
}

/** 卡片正面默认展示的模型下标：featuredId 命中则取其下标，否则回退首个模型 */
export function featuredIndex(models: PricingModel[], featuredId: string): number {
  const idx = models.findIndex((m) => m.id === featuredId)
  return idx >= 0 ? idx : 0
}
