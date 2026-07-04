/**
 * legal manifest ↔ content 文件对齐守护（照抄 docs/__tests__/loaders.test.ts 的模式）：
 * 法律条款是最不能空白的页面——删文件 / 改名 / 往 LEGAL_SECTIONS 加 slug 忘建文件，
 * 都必须在这里红掉，而不是线上分节加载失败。
 */
import { describe, it, expect } from 'vitest'
import { LEGAL_SECTIONS } from '../_manifest'
import { hasLegal, loadLegal, legalContentKeys } from '../loaders'
import { SUPPORTED_LOCALES } from '@/i18n'

describe('legal manifest 完整性', () => {
  it('每个分节的 zh-CN 与 en-US 条款文件都存在', () => {
    for (const section of LEGAL_SECTIONS) {
      expect(hasLegal(section.slug, 'zh-CN'), `${section.slug} 缺 zh-CN`).toBe(true)
      expect(hasLegal(section.slug, 'en-US'), `${section.slug} 缺 en-US（英文版是权威版本）`).toBe(true)
    }
  })

  it('content 目录下的文件都已登记进 LEGAL_SECTIONS（反向守护，防止新增条款忘登记）', () => {
    const slugs = new Set(LEGAL_SECTIONS.map((s) => s.slug))
    for (const key of legalContentKeys()) {
      // key 形如 './content/<slug>.<locale>.md'
      const m = key.match(/^\.\/content\/(.+)\.([^.]+-[^.]+)\.md$/)
      expect(m, `文件名不符合 <slug>.<locale>.md 约定：${key}`).not.toBeNull()
      const [, slug, locale] = m!
      expect(slugs.has(slug), `未登记进 LEGAL_SECTIONS 的条款文件：${key}`).toBe(true)
      expect(
        (SUPPORTED_LOCALES as readonly string[]).includes(locale),
        `不支持的语言后缀：${key}`
      ).toBe(true)
    }
  })

  it('至少有一个分节', () => {
    expect(LEGAL_SECTIONS.length).toBeGreaterThan(0)
  })
})

describe('loadLegal', () => {
  it('命中语言返回对应原文', async () => {
    const zh = await loadLegal('agreement', 'zh-CN')
    expect(zh).toContain('最后更新')
    const en = await loadLegal('agreement', 'en-US')
    expect(en).toContain('Last updated')
  })

  it('完全不存在的 slug 抛错', async () => {
    await expect(loadLegal('no-such-section', 'zh-CN')).rejects.toThrow()
  })
})
