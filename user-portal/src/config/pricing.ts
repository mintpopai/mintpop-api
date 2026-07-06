/**
 * 定价页渠道价格数据（PricingView 的唯一数据来源）。
 *
 * ⚠️ 单一来源债务：价格、折扣、模型名目前为前端硬编码，与后端计费配置零联动——
 * 后端调价 / 换模型时必须同步改这里，否则定价页会漂移成虚假宣传。
 * 长期正解是由后端公开定价接口下发（PublicSettings 目前没有定价字段，需后端先扩展）；
 * 在那之前，任何调价动作都要把这里列入 checklist。
 *
 * 字段含义：单位美元 / 百万 tokens。origInput/origOutput 为原价（划线展示），
 * input/output 为折后现价；discount 为「立减」百分比；multiplier 为「1元=1美金体系」
 * 下的行业常见倍率（仅中文界面展示，见 pricing.multiplierNote）。
 * 品牌名（name）与型号（model）属技术标识，中英一致，不走 i18n。
 */
export interface PricingChannel {
  key: string
  name: string
  model: string
  discount: number
  origInput: number
  input: number
  origOutput: number
  output: number
  multiplier: number
}

/**
 * 充值页官方价值比对口径（营销展示用，单一来源）：
 * 平台充值 $1 可获得官方 API 价约 $5 的等值用量（即平台价为官方价的 2 折，省 80%）。
 * 充值档位卡的「官方价值 ≈ $X」与订单明细的「你已省下」均按此换算。
 */
export const OFFICIAL_VALUE_MULTIPLIER = 5

/** 相对官方 API 价节省的百分比（整数，如 80 表示省 80%） */
export const OFFICIAL_SAVING_PERCENT = Math.round((1 - 1 / OFFICIAL_VALUE_MULTIPLIER) * 100)

/** 充值金额 → 官方 API 价等值用量 */
export function officialValueOf(amount: number): number {
  return amount * OFFICIAL_VALUE_MULTIPLIER
}

export const PRICING_CHANNELS: PricingChannel[] = [
  {
    key: 'claudeCode',
    name: 'Claude (Claude Code / Desktop)',
    model: 'Opus 4.8',
    discount: 70,
    origInput: 5,
    input: 1.5,
    origOutput: 25,
    output: 7.5,
    multiplier: 1.9
  },
  {
    key: 'claudeApi',
    name: 'Claude (API)',
    model: 'Opus 4.8',
    discount: 55,
    origInput: 5,
    input: 2.25,
    origOutput: 25,
    output: 11.25,
    multiplier: 2.9
  },
  {
    key: 'chatgpt',
    name: 'ChatGPT',
    model: 'GPT-5.5',
    discount: 80,
    origInput: 5,
    input: 1,
    origOutput: 30,
    output: 6,
    multiplier: 0.9
  },
  {
    key: 'gemini',
    name: 'Gemini',
    model: '3.1 Pro',
    discount: 80,
    origInput: 2,
    input: 0.4,
    origOutput: 12,
    output: 2.4,
    multiplier: 0.9
  }
]
