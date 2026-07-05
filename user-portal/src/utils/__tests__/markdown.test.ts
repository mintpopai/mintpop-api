import { describe, it, expect } from 'vitest'
import { renderMarkdown } from '@/utils/markdown'

describe('renderMarkdown', () => {
  it('把标题渲染为 <h1>', () => {
    expect(renderMarkdown('# 你好')).toContain('<h1>')
  })

  it('自动把裸链接转为 <a>（linkify）', () => {
    expect(renderMarkdown('见 https://example.com')).toContain('<a')
  })

  it('超链接新开标签页打开（含 rel 防护）', () => {
    const html = renderMarkdown('[文档](https://example.com)')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('linkify 生成的裸链接同样新开标签页', () => {
    expect(renderMarkdown('见 https://example.com')).toContain('target="_blank"')
  })

  it('页内锚点链接不加 target，仍在本页跳转', () => {
    const html = renderMarkdown('[跳到章节](#section)')
    expect(html).toContain('href="#section"')
    expect(html).not.toContain('target="_blank"')
  })
})
