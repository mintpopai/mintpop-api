/**
 * 构建期门户配置的统一解析（单一来源，勿在组件内各自读 import.meta.env 重复解析）。
 * VITE_PORTAL_DISTRIBUTION_MODE：分布文案模式，MODEL=模型厂商（Claude/GPT/Gemini），
 * APPLICATION=应用能力（Text/Vision/Voice）；缺省/非法值按 MODEL。
 */
export const IS_APPLICATION_MODE =
  (import.meta.env.VITE_PORTAL_DISTRIBUTION_MODE ?? 'MODEL').trim().toUpperCase() === 'APPLICATION'

/**
 * 联系渠道（ContactView 使用）。注意收口范围仅限「组件层」：docs/ 与 legal/ 的 markdown
 * 文档里另有邮箱硬编码副本（md 引不了常量），换邮箱时须全仓 grep 同步改。
 */
export const CONTACT_EMAIL = 'support@mintpop.ai'
export const TELEGRAM_GROUP_URL = 'https://t.me/+NpAwBIWXs8FkMzVh'
