/**
 * 构建期门户配置的统一解析（单一来源，勿在组件内各自读 import.meta.env 重复解析）。
 * VITE_PORTAL_DISTRIBUTION_MODE：分布文案模式，MODEL=模型厂商（Claude/GPT/Gemini），
 * APPLICATION=应用能力（Text/Vision/Voice）；缺省/非法值按 MODEL。
 */
import type { AppLocale } from '@/i18n'

export const IS_APPLICATION_MODE =
  (import.meta.env.VITE_PORTAL_DISTRIBUTION_MODE ?? 'MODEL').trim().toUpperCase() === 'APPLICATION'

/**
 * 官网营销站联系页（登录页 / 顶栏导航 / 文档占位符共用），按门户当前语言取对应路径
 * （英文是默认语言、无前缀）。站内不再设联系方式页面，联系入口一律外链官网。
 */
export const CONTACT_PAGE_URLS: Record<AppLocale, string> = {
  'zh-CN': 'https://mintpop.ai/zh/contact',
  'en-US': 'https://mintpop.ai/contact'
}

/**
 * MintPop Shop（成品 Claude / ChatGPT 账号商店）入口。
 * 与联系页不同，这里不按门户语言分流——店铺站点自行处理多语言，门户侧只给一个地址。
 */
export const SHOP_PAGE_URL = 'https://shop.mintpop.ai'
