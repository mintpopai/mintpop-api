/**
 * 定价页渠道配置（PricingView 的数据骨架）。
 *
 * 价格来源分两层：
 * 1. 实时价：页面加载时调后端 `POST /model-pricing/query`（数据源 LiteLLM 定价目录），
 *    拿到各模型官方原价（美元/百万 tokens），再按渠道 discount 折算现价；
 * 2. 回退价：接口不可用、或该模型未被定价目录收录时使用下方 fallbackInput/fallbackOutput，
 *    保证页面永不空白。调价时只需后端定价目录更新，前端回退价可择机跟随。
 *
 * 开源模型分组的模型 ID 取自内部定价表，未与后端调用名逐一核对；查不到即自动落到回退价。
 *
 * discount 为「立减」百分比（渠道级，作用于该渠道全部模型）：开源分组由文档给的分组倍率换算
 * （立减 = (1 − 倍率) × 100，如 0.95x → 立减 5%）；为 0 表示无折扣，卡片不显示立减药丸与划线原价。
 * multiplier 为「1元=1美金体系」下的行业常见倍率（仅中文界面 + 海外模型展示，见 pricing.multiplierNote）。
 * 品牌名（name）与型号（label）属技术标识，中英一致，不走 i18n；「海外版」后缀由 edition 字段走 i18n。
 */

/** 定价页 tab：海外模型 / 开源模型 */
export type PricingTab = 'OVERSEAS' | 'OPEN_SOURCE'

/** 卡片正面模型的标记语义：海外模型标「最常用」，开源模型标「最低价」 */
export type FeaturedTag = 'MOST_USED' | 'LOWEST_PRICE'

/** 品牌版本后缀（走 i18n，中文「海外版」/ 英文 Overseas） */
export type PricingEdition = 'OVERSEAS'

export interface PricingModel {
  /** LiteLLM 定价目录中的模型 ID，用于批量查询接口入参 */
  id: string
  /** 展示用型号名（开源模型直接用调用名，方便用户照抄） */
  label: string
  /** 回退原价：输入，美元/百万 tokens */
  fallbackInput: number
  /** 回退原价：输出，美元/百万 tokens */
  fallbackOutput: number
}

export interface PricingChannel {
  key: string
  name: string
  /** 归属 tab */
  tab: PricingTab
  /** 品牌版本后缀；不填表示无后缀 */
  edition?: PricingEdition
  /** 头像方块里的字母（卡片统一白底，品牌辨识全靠头像） */
  avatar: string
  /** 头像方块底色（品牌色，十六进制） */
  avatarBg: string
  /** 立减百分比，作用于该渠道全部模型；0 表示无折扣 */
  discount: number
  /** 行业常见倍率（仅中文界面展示）；开源分组无此数据 */
  multiplier?: number
  /** 卡片正面默认展示的模型 ID（未必是清单首位，如 Kimi 的最低价款排在第 2 位） */
  featuredId: string
  /** 正面模型的标记语义 */
  featuredTag: FeaturedTag
  /** 渠道内模型清单 */
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
  // ============ 海外模型 ============
  {
    key: 'claudeCode',
    name: 'Claude (Claude Code / Desktop)',
    tab: 'OVERSEAS',
    avatar: 'C',
    avatarBg: '#c67c5b',
    discount: 75,
    multiplier: 1.9,
    featuredId: 'claude-opus-5',
    featuredTag: 'MOST_USED',
    models: CLAUDE_MODELS
  },
  {
    key: 'claudeApi',
    name: 'Claude (API)',
    tab: 'OVERSEAS',
    avatar: 'C',
    avatarBg: '#8c4a2f',
    discount: 65,
    multiplier: 2.4,
    featuredId: 'claude-opus-5',
    featuredTag: 'MOST_USED',
    models: CLAUDE_MODELS
  },
  {
    key: 'chatgpt',
    name: 'ChatGPT',
    tab: 'OVERSEAS',
    avatar: 'G',
    avatarBg: '#10a37f',
    discount: 80,
    multiplier: 1.4,
    featuredId: 'gpt-5.6',
    featuredTag: 'MOST_USED',
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
    tab: 'OVERSEAS',
    avatar: 'K',
    avatarBg: '#517fa9',
    discount: 90,
    multiplier: 0.9,
    featuredId: 'claude-opus-5',
    featuredTag: 'MOST_USED',
    models: CLAUDE_MODELS
  },

  // ============ 开源模型（分组倍率见文件头注释；正面展示组内最低价款）============
  {
    key: 'kimi',
    name: 'Kimi',
    tab: 'OPEN_SOURCE',
    edition: 'OVERSEAS',
    avatar: 'K',
    avatarBg: '#1d1b4b',
    discount: 5,
    featuredId: 'kimi-k2.7-code',
    featuredTag: 'LOWEST_PRICE',
    models: [
      { id: 'kimi-k3', label: 'kimi-k3', fallbackInput: 3.0, fallbackOutput: 15.0 },
      { id: 'kimi-k2.7-code', label: 'kimi-k2.7-code', fallbackInput: 0.95, fallbackOutput: 4.0 },
      {
        id: 'kimi-k2.7-code-highspeed',
        label: 'kimi-k2.7-code-highspeed',
        fallbackInput: 1.9,
        fallbackOutput: 8.0
      },
      { id: 'kimi-k2.8-preview', label: 'kimi-k2.8-preview', fallbackInput: 1.0, fallbackOutput: 4.0 }
    ]
  },
  {
    key: 'glm',
    name: 'GLM',
    tab: 'OPEN_SOURCE',
    edition: 'OVERSEAS',
    avatar: 'G',
    avatarBg: '#0891b2',
    discount: 20,
    featuredId: 'glm-5.3-flash',
    featuredTag: 'LOWEST_PRICE',
    models: [
      { id: 'glm-5.3', label: 'glm-5.3', fallbackInput: 1.4, fallbackOutput: 4.4 },
      { id: 'glm-5.3-flash', label: 'glm-5.3-flash', fallbackInput: 0.15, fallbackOutput: 0.5 },
      { id: 'glm-5.2', label: 'glm-5.2', fallbackInput: 1.4, fallbackOutput: 4.4 }
    ]
  },
  {
    key: 'deepseek',
    name: 'DeepSeek',
    tab: 'OPEN_SOURCE',
    edition: 'OVERSEAS',
    avatar: 'D',
    avatarBg: '#4d6bfe',
    discount: 30,
    featuredId: 'deepseek-v4.1-flash',
    featuredTag: 'LOWEST_PRICE',
    models: [
      {
        id: 'deepseek-v4-pro-0813',
        label: 'deepseek-v4-pro-0813',
        fallbackInput: 1.32,
        fallbackOutput: 3.96
      },
      {
        id: 'deepseek-v4-flash-0731',
        label: 'deepseek-v4-flash-0731',
        fallbackInput: 0.44,
        fallbackOutput: 1.32
      },
      {
        id: 'deepseek-v4.1-flash',
        label: 'deepseek-v4.1-flash',
        fallbackInput: 0.3,
        fallbackOutput: 1.2
      }
    ]
  },
  {
    key: 'mimo',
    name: '小米 mimo',
    tab: 'OPEN_SOURCE',
    edition: 'OVERSEAS',
    avatar: 'M',
    avatarBg: '#ff6900',
    discount: 0,
    featuredId: 'mimo-v2.5-pro',
    featuredTag: 'LOWEST_PRICE',
    models: [
      { id: 'mimo-v2.5-pro', label: 'mimo-v2.5-pro', fallbackInput: 0.435, fallbackOutput: 0.87 }
    ]
  },
  {
    key: 'minimax',
    name: 'MiniMax',
    tab: 'OPEN_SOURCE',
    edition: 'OVERSEAS',
    avatar: 'MM',
    avatarBg: '#e5484d',
    discount: 0,
    featuredId: 'minimax-m2.7',
    featuredTag: 'LOWEST_PRICE',
    models: [
      { id: 'minimax-m2.7', label: 'minimax-m2.7', fallbackInput: 0.3, fallbackOutput: 1.2 },
      { id: 'minimax-m3', label: 'minimax-m3', fallbackInput: 0.6, fallbackOutput: 2.4 }
    ]
  },
  {
    key: 'hunyuan',
    name: '腾讯混元',
    tab: 'OPEN_SOURCE',
    edition: 'OVERSEAS',
    avatar: '混',
    avatarBg: '#0052d9',
    discount: 0,
    featuredId: 'hy4-preview',
    featuredTag: 'LOWEST_PRICE',
    models: [
      { id: 'hy4-preview', label: 'hy4-preview', fallbackInput: 0.834, fallbackOutput: 2.501 }
    ]
  },
  {
    key: 'qwen',
    name: '千问',
    tab: 'OPEN_SOURCE',
    edition: 'OVERSEAS',
    avatar: 'Q',
    avatarBg: '#7c3aed',
    discount: 10,
    featuredId: 'qwen3.8-flash',
    featuredTag: 'LOWEST_PRICE',
    models: [
      { id: 'qwen3.8-max', label: 'qwen3.8-max', fallbackInput: 2.0, fallbackOutput: 6.0 },
      { id: 'qwen3.8-flash', label: 'qwen3.8-flash', fallbackInput: 0.15, fallbackOutput: 0.47 }
    ]
  }
]
