import { ref } from 'vue'
import { defineStore } from 'pinia'
import i18n, { SUPPORTED_LOCALES, LOCALE_LABELS, LOCALE_LOCKED, LOCALE_STORAGE_KEY, type AppLocale } from '@/i18n'

/**
 * 语言状态：以 i18n 当前 locale 为初值，切换时同步到 vue-i18n、持久化到
 * localStorage（与 api/client.ts 的 Accept-Language 复用同一键），并更新 <html lang>。
 */
export const useLocaleStore = defineStore('locale', () => {
  const current = ref<AppLocale>(i18n.global.locale.value as AppLocale)

  function apply(): void {
    document.documentElement.setAttribute('lang', current.value)
  }

  function setLocale(locale: AppLocale): void {
    // 构建时锁定单语言时禁止切换（切换入口本已隐藏，此处为防御性兜底）
    if (LOCALE_LOCKED) return
    current.value = locale
    i18n.global.locale.value = locale
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale)
    } catch {
      // 忽略持久化失败
    }
    apply()
  }

  function toggle(): void {
    setLocale(current.value === 'zh-CN' ? 'en-US' : 'zh-CN')
  }

  /** 当前语言的展示名 */
  function label(locale: AppLocale = current.value): string {
    return LOCALE_LABELS[locale]
  }

  // 初始化即同步 <html lang>
  apply()

  return { current, setLocale, toggle, label, locales: SUPPORTED_LOCALES, locked: LOCALE_LOCKED }
})
