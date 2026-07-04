import { describe, it, expect } from 'vitest'
import { setDocumentTitle } from '@/utils/title'

describe('setDocumentTitle', () => {
  it('有 titleKey 时拼接为 `翻译 · MintPop API`', () => {
    setDocumentTitle('nav.docs')
    expect(document.title).toBe('使用文档 · MintPop API')
  })

  it('无 titleKey 时（如新增路由漏配 meta.title）回退纯 MintPop API，不产出重复拼接', () => {
    setDocumentTitle(undefined)
    expect(document.title).toBe('MintPop API')
  })
})
