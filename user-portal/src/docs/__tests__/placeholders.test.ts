import { describe, it, expect } from 'vitest'
import { docPlaceholderValues, resolveDocPlaceholders } from '../placeholders'
import type { PublicSettings } from '@/api/types'

// 最小可用的 PublicSettings 桩（只关心 api_base_url）
function settingsWith(apiBaseUrl?: string): PublicSettings {
  return { api_base_url: apiBaseUrl } as PublicSettings
}

describe('resolveDocPlaceholders', () => {
  it('替换已知占位符（含中文名），未知占位符原样保留', () => {
    const out = resolveDocPlaceholders('地址 {{BASE_URL}}，注册 {{注册链接}}，未知 {{Telegram}}', {
      BASE_URL: 'https://api.example.com',
      注册链接: 'https://portal.example.com/register'
    })
    expect(out).toBe('地址 https://api.example.com，注册 https://portal.example.com/register，未知 {{Telegram}}')
  })

  it('占位符名两侧空白容忍（{{ BASE_URL }} 也能命中）', () => {
    const out = resolveDocPlaceholders('{{ BASE_URL }}', { BASE_URL: 'x' })
    expect(out).toBe('x')
  })
})

describe('docPlaceholderValues', () => {
  it('api_base_url 存在时 BASE_URL 取它', () => {
    const values = docPlaceholderValues(settingsWith('https://api.example.com'))
    expect(values.BASE_URL).toBe('https://api.example.com')
  })

  it('设置缺失（null 或无 api_base_url）时 BASE_URL 回退站点 origin', () => {
    expect(docPlaceholderValues(null).BASE_URL).toBe(window.location.origin)
    expect(docPlaceholderValues(settingsWith()).BASE_URL).toBe(window.location.origin)
  })

  it('注册链接指向本站 /register', () => {
    expect(docPlaceholderValues(null).SIGNUP_URL).toBe(`${window.location.origin}/register`)
  })

  it('创建密钥链接指向本站对应页面', () => {
    const values = docPlaceholderValues(null)
    expect(values.APIKEY_CREATE_URL).toBe(`${window.location.origin}/keys?guide=create`)
  })

  it('联系我们链接按文档语言外链官网联系页', () => {
    expect(docPlaceholderValues(null, 'zh-CN').CONTACT_URL).toBe('https://mintpop.ai/zh/contact')
    expect(docPlaceholderValues(null, 'en-US').CONTACT_URL).toBe('https://mintpop.ai/contact')
  })

  it('api_base_url 含 HTML 特殊字符时先 encodeURI 再注入，防止管理员配置值被 markdown-it（html:true）当 HTML 解析', () => {
    const malicious = 'https://api.example.com/<script>alert(1)</script>'
    const values = docPlaceholderValues(settingsWith(malicious))
    expect(values.BASE_URL).not.toContain('<')
    expect(values.BASE_URL).not.toContain('>')
    // encodeURI 会保留 URL 合法字符（如 : / .），正常地址原样透传
    expect(docPlaceholderValues(settingsWith('https://api.example.com')).BASE_URL).toBe(
      'https://api.example.com'
    )
  })
})

describe('文档占位符守护：正式文档只允许使用已知占位符', () => {
  // 与 loaders.ts 相同的 glob 收口；eager 同步拿到全部 md 原文
  const raws = import.meta.glob('../*.md', {
    query: '?raw',
    import: 'default',
    eager: true
  }) as Record<string, string>

  it('所有 docs md 中出现的 {{占位符}} 都有对应的运行时取值', () => {
    const known = new Set(Object.keys(docPlaceholderValues(null)))
    const unknown: string[] = []
    for (const [file, src] of Object.entries(raws)) {
      for (const m of src.matchAll(/\{\{([^{}]+)\}\}/g)) {
        const name = m[1].trim()
        if (!known.has(name)) unknown.push(`${file} → {{${name}}}`)
      }
    }
    // 出现未知占位符说明文档写了但没人替换，会原样渲染给用户
    expect(unknown).toEqual([])
  })
})
