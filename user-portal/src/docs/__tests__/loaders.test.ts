import { describe, it, expect } from 'vitest'
import { DOCS } from '@/docs/_manifest'
import { hasDoc, loadDoc } from '@/docs/loaders'

describe('docs manifest 完整性', () => {
  it('每篇文档的 zh-CN 与 en-US 文件都存在', () => {
    for (const doc of DOCS) {
      expect(hasDoc(doc.slug, 'zh-CN'), `${doc.slug} 缺 zh-CN`).toBe(true)
      expect(hasDoc(doc.slug, 'en-US'), `${doc.slug} 缺 en-US`).toBe(true)
    }
  })

  it('至少有一篇文档', () => {
    expect(DOCS.length).toBeGreaterThan(0)
  })
})

describe('loadDoc', () => {
  it('命中语言返回对应原文', async () => {
    const en = await loadDoc('quick-start', 'en-US')
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
