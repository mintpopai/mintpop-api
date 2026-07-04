/**
 * vue-i18n 实例 —— Composition API 模式（legacy: false）。
 * - 支持简体中文（zh-CN）与英文（en-US）
 * - 首次访问无 localStorage 时跟随浏览器语言，回退中文
 * - locale 持久化键 `locale`，与 api/client.ts 的 Accept-Language 复用同一键
 * - 开启 globalInjection，模板内可直接用 $t；<script setup> 用 useI18n() 的 t
 *
 * 语言模式由构建时变量 VITE_PORTAL_LOCALE 决定（Vite 编译期烧入，见 .env.prod）：
 * - AUTO（默认）：显示语言切换入口，按 localStorage > 浏览器语言 > 中文 检测
 * - zh-CN / en-US：锁定该语言、隐藏切换入口，忽略 localStorage 与浏览器语言
 */
import { createI18n } from 'vue-i18n'
import zhCN from './locales/zh-CN'
import enUS from './locales/en-US'

export const SUPPORTED_LOCALES = ['zh-CN', 'en-US'] as const
export type AppLocale = (typeof SUPPORTED_LOCALES)[number]

/** 各语言的展示名（用于切换菜单） */
export const LOCALE_LABELS: Record<AppLocale, string> = {
  'zh-CN': '简体中文',
  'en-US': 'English'
}

export const DEFAULT_LOCALE: AppLocale = 'zh-CN'
/** locale 持久化键的唯一定义：stores/locale.ts 持久化、api/client.ts 的 Accept-Language 均引用此常量 */
export const LOCALE_STORAGE_KEY = 'locale'

function isSupported(value: string): value is AppLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

/**
 * 构建时锁定的语言：VITE_PORTAL_LOCALE 取 zh-CN/en-US 时锁定为该值，
 * 其余（含缺省、AUTO、非法值）一律视为 AUTO（不锁定）。
 */
const LOCKED_LOCALE: AppLocale | null = (() => {
  const configured = (import.meta.env.VITE_PORTAL_LOCALE ?? 'AUTO').trim()
  return isSupported(configured) ? configured : null
})()

/** 是否锁定单语言（锁定时隐藏切换入口、禁用切换） */
export const LOCALE_LOCKED: boolean = LOCKED_LOCALE !== null

/**
 * 检测初始语言：
 * - 已锁定 → 直接返回锁定值（忽略 localStorage / 浏览器语言）
 * - 未锁定（AUTO）→ localStorage > 浏览器语言（en* → en-US）> 回退中文
 */
export function detectLocale(): AppLocale {
  if (LOCKED_LOCALE) return LOCKED_LOCALE
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (saved && isSupported(saved)) return saved
    const nav = (navigator.language || '').toLowerCase()
    if (nav.startsWith('en')) return 'en-US'
    return DEFAULT_LOCALE
  } catch {
    return DEFAULT_LOCALE
  }
}

const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: detectLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS
  }
})

export default i18n
