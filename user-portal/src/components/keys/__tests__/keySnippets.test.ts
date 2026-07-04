import { describe, expect, it } from 'vitest'
import { buildKeyFiles, stripHighlightMarkup } from '../keySnippets'

// 守护测试：Gemini CLI 片段的 content（复制用纯文本）与 highlighted（展示用高亮 HTML）
// 历史上是两份手写副本，曾出现「cmd 分支的模型注释行只加进了 highlighted、content 里漏掉」
// 的真实漂移（本测试最初以「独立复刻剥标签+反转义逻辑」的形式写出时，在 keySnippets.ts
// 改为单一来源之前确实是红的，见 task-7-report.md 的 TDD 记录）。
// 现在 content 由 keySnippets.ts 唯一导出的 stripHighlightMarkup(highlighted) 派生，
// 下面用两类断言守护该不变式：
// 1）content 与「剥离 highlighted 标签+反转义」逐字节一致（防止未来又绕开派生函数手写 content）；
// 2）content 与手工写死的期望纯文本逐字节一致（独立于生产代码实现的断言，防止 stripHighlightMarkup
//    本身写错、或 highlighted 手写内容本身出现新的疏漏）。
const baseUrl = 'https://example.com'
const apiKey = 'sk-test-123'
// zh-CN 文案，见 src/i18n/locales/zh-CN/keys.ts 的 keys.useKeyModal.gemini.modelComment
// （test-setup.ts 已把 i18n.global.locale 强制设为 zh-CN）
const modelComment = '如果你有 Gemini 3 权限可以填：gemini-3-pro-preview'

const expectedContent: Record<'unix' | 'cmd' | 'powershell', string> = {
  unix: `export GOOGLE_GEMINI_BASE_URL="${baseUrl}"
export GEMINI_API_KEY="${apiKey}"
export GEMINI_MODEL="gemini-2.0-flash"  # ${modelComment}`,
  cmd: `set GOOGLE_GEMINI_BASE_URL=${baseUrl}
set GEMINI_API_KEY=${apiKey}
set GEMINI_MODEL=gemini-2.0-flash
REM ${modelComment}`,
  powershell: `$env:GOOGLE_GEMINI_BASE_URL="${baseUrl}"
$env:GEMINI_API_KEY="${apiKey}"
$env:GEMINI_MODEL="gemini-2.0-flash"  # ${modelComment}`
}

describe('keySnippets：Gemini CLI 片段 content 与 highlighted 单一来源守护', () => {
  it.each(['unix', 'cmd', 'powershell'] as const)('shellTab=%s 时，content 与剥离 highlighted 标签后的纯文本逐字节一致', (shellTab) => {
    const [file] = buildKeyFiles({ platform: 'gemini', clientTab: 'gemini', shellTab, baseUrl, apiKey })
    expect(file.highlighted, `shellTab=${shellTab} 应生成 highlighted`).toBeTruthy()
    expect(file.content).toBe(stripHighlightMarkup(file.highlighted as string))
  })

  it.each(['unix', 'cmd', 'powershell'] as const)('shellTab=%s 时，content 与独立写死的期望纯文本逐字节一致', (shellTab) => {
    const [file] = buildKeyFiles({ platform: 'gemini', clientTab: 'gemini', shellTab, baseUrl, apiKey })
    expect(file.content).toBe(expectedContent[shellTab])
  })

  it('stripHighlightMarkup 剥离 span 标签并反转义 HTML 实体（含 escapeHtml 转义出的全部特殊字符）', () => {
    const html = '<span class="text-amber-200">&quot;a &amp; b &lt;c&gt; d&#39;e&quot;</span>'
    expect(stripHighlightMarkup(html)).toBe('"a & b <c> d\'e"')
  })
})
