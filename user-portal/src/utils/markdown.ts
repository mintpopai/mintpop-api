// Markdown 渲染：markdown-it 单例（文档为自有可信内容，允许内嵌 HTML）
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true
})

// 文档里的超链接一律新开标签页打开（避免读者跳走丢失当前文档）；页内锚点（#开头）仍在本页跳转
const defaultLinkOpen =
  md.renderer.rules.link_open ??
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx]!
  const href = token.attrGet('href') ?? ''
  if (!href.startsWith('#')) {
    token.attrSet('target', '_blank')
    token.attrSet('rel', 'noopener noreferrer')
  }
  return defaultLinkOpen(tokens, idx, options, env, self)
}

/** 把 Markdown 原文渲染为 HTML 字符串 */
export function renderMarkdown(src: string): string {
  return md.render(src)
}
