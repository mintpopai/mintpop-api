// 文档标题拼接：router.afterEach 与 App.vue 语言切换补刷共用同一份格式，避免手写副本漂移
import i18n from '@/i18n'

/**
 * 设置 document.title。
 * - titleKey 有值 → `${t(titleKey)} · MintPop API`
 * - titleKey 为空（如新增路由漏配 meta.title）→ 回退纯 'MintPop API'
 */
export function setDocumentTitle(titleKey?: string): void {
  document.title = titleKey ? `${i18n.global.t(titleKey)} · MintPop API` : 'MintPop API'
}
