/**
 * 定价页渠道配置（PricingView 的数据骨架）。
 *
 * 价格来源分两层：
 * 1. 实时价：页面加载时调后端 `POST /model-pricing/query`（数据源 LiteLLM 定价目录），
 *    拿到各模型官方原价（美元/百万 tokens），再按渠道 discount 折算现价；
 * 2. 回退价：接口不可用时使用下方 fallbackInput/fallbackOutput（取值与 LiteLLM 目录一致），
 *    保证页面永不空白。调价时只需后端定价目录更新，前端回退价可择机跟随。
 *
 * discount 为「立减」百分比（渠道级，作用于该渠道全部模型）；multiplier 为
 * 「1元=1美金体系」下的行业常见倍率（仅中文界面展示，见 pricing.multiplierNote）。
 * 品牌名（name）与型号（label）属技术标识，中英一致，不走 i18n。
 */
export interface PricingModel {
  /** LiteLLM 定价目录中的模型 ID，用于批量查询接口入参 */
  id: string
  /** 展示用型号名 */
  label: string
  /** 回退原价：输入，美元/百万 tokens */
  fallbackInput: number
  /** 回退原价：输出，美元/百万 tokens */
  fallbackOutput: number
}

export interface PricingChannel {
  key: string
  name: string
  /** 立减百分比，作用于该渠道全部模型 */
  discount: number
  /** 行业常见倍率（仅中文界面展示） */
  multiplier: number
  /** 渠道内模型清单，第一个为「最常用」主模型（卡片正面展示） */
  models: PricingModel[]
}

// Claude 系模型三个渠道（Claude Code / Claude API / KIRO）共用同一份清单，只是折扣不同
const CLAUDE_MODELS: PricingModel[] = [
  { id: 'claude-opus-5', label: 'Opus 5', fallbackInput: 5, fallbackOutput: 25 },
  { id: 'claude-opus-4-8', label: 'Opus 4.8', fallbackInput: 5, fallbackOutput: 25 },
  { id: 'claude-fable-5', label: 'Fable 5', fallbackInput: 10, fallbackOutput: 50 },
  { id: 'claude-opus-4-7', label: 'Opus 4.7', fallbackInput: 5, fallbackOutput: 25 },
  { id: 'claude-opus-4-6', label: 'Opus 4.6', fallbackInput: 5, fallbackOutput: 25 },
  { id: 'claude-sonnet-5', label: 'Sonnet 5', fallbackInput: 2, fallbackOutput: 10 },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6', fallbackInput: 3, fallbackOutput: 15 },
  { id: 'claude-sonnet-4-5', label: 'Sonnet 4.5', fallbackInput: 3, fallbackOutput: 15 },
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5', fallbackInput: 1, fallbackOutput: 5 }
]

export const PRICING_CHANNELS: PricingChannel[] = [
  {
    key: 'claudeCode',
    name: 'Claude (Claude Code / Desktop)',
    discount: 75,
    multiplier: 1.9,
    models: CLAUDE_MODELS
  },
  {
    key: 'claudeApi',
    name: 'Claude (API)',
    discount: 65,
    multiplier: 2.4,
    models: CLAUDE_MODELS
  },
  {
    key: 'chatgpt',
    name: 'ChatGPT',
    discount: 80,
    multiplier: 1.4,
    models: [
      // GPT-5.6 为最新一代系列（含 Sol/Luna/Terra 三个变体）
      { id: 'gpt-5.6', label: 'GPT-5.6', fallbackInput: 5, fallbackOutput: 30 },
      { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol', fallbackInput: 5, fallbackOutput: 30 },
      { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', fallbackInput: 2.5, fallbackOutput: 15 },
      { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna', fallbackInput: 1, fallbackOutput: 6 },
      { id: 'gpt-5.5', label: 'GPT-5.5', fallbackInput: 5, fallbackOutput: 30 },
      { id: 'gpt-5', label: 'GPT-5', fallbackInput: 1.25, fallbackOutput: 10 },
      { id: 'gpt-5-mini', label: 'GPT-5 Mini', fallbackInput: 0.25, fallbackOutput: 2 }
    ]
  },
  {
    key: 'kiro',
    name: 'KIRO',
    discount: 90,
    multiplier: 0.9,
    models: CLAUDE_MODELS
  }
]
