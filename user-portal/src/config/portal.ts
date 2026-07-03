/**
 * 构建期门户配置的统一解析（单一来源，勿在组件内各自读 import.meta.env 重复解析）。
 * VITE_PORTAL_DISTRIBUTION_MODE：分布文案模式，MODEL=模型厂商（Claude/GPT/Gemini），
 * APPLICATION=应用能力（Text/Vision/Voice）；缺省/非法值按 MODEL。
 */
export const IS_APPLICATION_MODE =
  (import.meta.env.VITE_PORTAL_DISTRIBUTION_MODE ?? 'MODEL').trim().toUpperCase() === 'APPLICATION'
