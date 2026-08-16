/**
 * 双语文本（后端单字段承载）按当前语言取块。
 *
 * 后端的分组/套餐说明只有一个 `description` 字段、并未分中英两列存，约定用**空行**把两段隔开：
 * 第一块中文、第二块英文，例如
 *
 * ```
 * · 个人开发者、学生、首次试用中转服务
 * · 日常问答、小脚本、单文件改动
 *
 * · Solo developers, students, first-time relay users
 * · Q&A, small scripts, single-file edits
 * ```
 *
 * 规则：
 * - **只按第一个空行切一刀**：之前算中文块，之后（含其中的空行）整体算英文块，
 *   这样中文块内部再出现空行也不会被误判成语言分界。
 * - 只有一块（没写英文）时两种语言都用它，免得英文界面下说明整块消失。
 * - 空/缺失返回空串，由调用方按 falsy 决定是否渲染。
 *
 * 注意：块内换行要保留，渲染处需配 `whitespace-pre-line`（单行截断的场景除外）。
 */
export function pickBilingual(text: string | null | undefined, locale: string): string {
  const normalized = (text ?? '').replace(/\r\n?/g, '\n').trim()
  if (!normalized) return ''

  // 空行 = 只含空白字符的一行；切完 [0] 为中文块，其余重新拼回英文块
  const blocks = normalized.split(/\n[ \t]*\n+/)
  const zh = blocks[0].trim()
  const en = blocks.slice(1).join('\n\n').trim()

  return locale.startsWith('en') ? en || zh : zh
}
