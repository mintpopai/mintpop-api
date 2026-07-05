import { describe, it, expect } from 'vitest'
import { DOCS, DOC_GROUPS } from '@/docs/_manifest'
import { hasDoc, loadDoc } from '@/docs/loaders'

describe('docs manifest 完整性', () => {
  it('每篇文档的 zh-CN 与 en-US 文件都存在', () => {
    for (const doc of DOCS) {
      expect(hasDoc(doc.slug, 'zh-CN'), `${doc.slug} 缺 zh-CN`).toBe(true)
      expect(hasDoc(doc.slug, 'en-US'), `${doc.slug} 缺 en-US`).toBe(true)
    }
  })

  it('至少有一个分组且每组至少一篇文档', () => {
    expect(DOC_GROUPS.length).toBeGreaterThan(0)
    for (const group of DOC_GROUPS) {
      expect(group.items.length, `分组「${group.title['zh-CN']}」为空`).toBeGreaterThan(0)
    }
  })

  it('全部文档 slug 不重复', () => {
    const slugs = DOCS.map((d) => d.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })
})

describe('loadDoc', () => {
  it('命中语言返回对应原文', async () => {
    const en = await loadDoc('claude-code', 'en-US')
    expect(en).toContain('Getting Started')
  })

  it('缺失语言回退 zh-CN', async () => {
    // fallback-probe 只有 zh-CN、没有 en-US：请求 en-US 应回退到 zh-CN
    const result = await loadDoc('fallback-probe', 'en-US')
    expect(result).toContain('回退探针')
  })

  it('完全不存在的 slug 抛错', async () => {
    await expect(loadDoc('no-such-doc', 'zh-CN')).rejects.toThrow()
  })
})
