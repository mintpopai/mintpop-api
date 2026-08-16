import { describe, it, expect } from 'vitest'
import { pickBilingual } from '@/utils/bilingual'

const ZH = ['· 个人开发者、学生、首次试用中转服务', '· 日常问答、小脚本、单文件改动', '· 单人单机，无长时任务'].join(
  '\n'
)
const EN = [
  '· Solo developers, students, first-time relay users',
  '· Q&A, small scripts, single-file edits',
  '· One user, one machine, no long-running jobs'
].join('\n')

describe('pickBilingual', () => {
  it('按空行切块：中文界面取第一块，英文界面取第二块', () => {
    const text = `${ZH}\n\n${EN}`
    expect(pickBilingual(text, 'zh-CN')).toBe(ZH)
    expect(pickBilingual(text, 'en-US')).toBe(EN)
  })

  it('块内换行原样保留（供 whitespace-pre-line 渲染）', () => {
    expect(pickBilingual(`${ZH}\n\n${EN}`, 'zh-CN').split('\n')).toHaveLength(3)
  })

  it('只有一块时两种语言都回退到这一块', () => {
    expect(pickBilingual(ZH, 'en-US')).toBe(ZH)
    expect(pickBilingual(ZH, 'zh-CN')).toBe(ZH)
  })

  it('只按第一个空行切：中文块后的多个段落整体算英文块', () => {
    const text = `${ZH}\n\n${EN}\n\n· Extra English note`
    expect(pickBilingual(text, 'en-US')).toBe(`${EN}\n\n· Extra English note`)
    expect(pickBilingual(text, 'zh-CN')).toBe(ZH)
  })

  it('容忍 CRLF、空行里的空白与首尾空白', () => {
    const text = `\r\n${ZH.replace(/\n/g, '\r\n')}\r\n   \r\n${EN}\r\n`
    expect(pickBilingual(text, 'zh-CN')).toBe(ZH)
    expect(pickBilingual(text, 'en-US')).toBe(EN)
  })

  it('空 / 缺失 / 纯空白一律返回空串', () => {
    expect(pickBilingual(undefined, 'zh-CN')).toBe('')
    expect(pickBilingual(null, 'en-US')).toBe('')
    expect(pickBilingual('  \n\n  ', 'zh-CN')).toBe('')
  })
})
