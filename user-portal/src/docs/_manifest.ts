import type { AppLocale } from '@/i18n'

/** 单篇文档的导航元信息（二级目录条目） */
export interface DocEntry {
  /** 路由 slug，对应 docs/<slug>.<locale>.md 文件名 */
  slug: string
  /** 各语言下的目录标题 */
  title: Record<AppLocale, string>
}

/** 文档分组（一级目录）：组标题不可点击，仅作分类；items 为组内文档 */
export interface DocGroup {
  /** 各语言下的分组标题 */
  title: Record<AppLocale, string>
  /** 组内文档，数组顺序即目录顺序 */
  items: DocEntry[]
}

/** 文档目录（一级分组 → 二级文档）：分组与组内顺序即导航顺序，首组首篇为默认篇 */
export const DOC_GROUPS: DocGroup[] = [
  {
    title: { 'zh-CN': '快速开始', 'en-US': 'Quick Start' },
    items: [
      { slug: 'claude-code', title: { 'zh-CN': 'Claude Code', 'en-US': 'Claude Code' } },
      { slug: 'chatgpt', title: { 'zh-CN': 'ChatGPT', 'en-US': 'ChatGPT' } }
    ]
  }
]

/** 全部文档的扁平清单（由 DOC_GROUPS 派生，供 slug 校验/回退等按篇逻辑使用） */
export const DOCS: DocEntry[] = DOC_GROUPS.flatMap((g) => g.items)
