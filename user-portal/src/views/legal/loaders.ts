import type { AppLocale } from '@/i18n'

// 懒加载：每个条款分节的 md 编译为独立 chunk，按需 fetch；?raw 取原文字符串。
// glob 收口在 legal/content 自身，key 形如 './content/agreement.zh-CN.md'。
const loaders = import.meta.glob('./content/*.md', {
  query: '?raw',
  import: 'default'
}) as Record<string, () => Promise<string>>

/** 由 slug + 语言拼出 glob key */
export function legalKey(slug: string, locale: AppLocale): string {
  return `./content/${slug}.${locale}.md`
}

/** 是否存在某分节某语言的条款文件（守护测试用） */
export function hasLegal(slug: string, locale: AppLocale): boolean {
  return legalKey(slug, locale) in loaders
}

/** 全部条款文件的 glob key（守护测试用：反向校验文件都已登记进 manifest） */
export function legalContentKeys(): string[] {
  return Object.keys(loaders)
}

/**
 * 加载某分节条款原文。命中当前语言即返回；缺当前语言回退 en-US
 * （法律文本以英文版为权威）；两者都缺则抛错（调用方决定如何兜底）。
 */
export function loadLegal(slug: string, locale: AppLocale): Promise<string> {
  const primary = loaders[legalKey(slug, locale)]
  if (primary) return primary()
  const fallback = loaders[legalKey(slug, 'en-US')]
  if (fallback) return fallback()
  return Promise.reject(new Error(`法律条款不存在：${slug}`))
}
