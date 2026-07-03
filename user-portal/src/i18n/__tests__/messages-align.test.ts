/**
 * i18n 守护测试：
 * 1. zh-CN 与 en-US 的叶子 key 结构必须完全一致（MessageSchema 只能防「en 缺 key」，
 *    防不了「en 多 key」，且该编译期防线依赖 vue-tsc 真跑；此处做运行时双向兜底）。
 * 2. 每条文案都要能被 vue-i18n 编译执行（曾有 'you@example.com' 未转义 @ 导致 t() 直接
 *    抛 Message compilation error 的真实案例——特殊字符 { } @ | $ 必须按官方语法转义）。
 */
import { describe, it, expect } from 'vitest'
import { createI18n } from 'vue-i18n'
import zhCN from '../locales/zh-CN'
import enUS from '../locales/en-US'

type Tree = Record<string, unknown>

/** 收集嵌套消息对象的全部叶子 key 路径 */
function leafPaths(obj: Tree, prefix = ''): string[] {
  const out: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object') {
      out.push(...leafPaths(v as Tree, path))
    } else {
      out.push(path)
    }
  }
  return out
}

describe('i18n 两侧对齐', () => {
  const zhKeys = leafPaths(zhCN as unknown as Tree).sort()
  const enKeys = leafPaths(enUS as unknown as Tree).sort()

  it('zh-CN 与 en-US 叶子 key 集合完全一致', () => {
    const zhSet = new Set(zhKeys)
    const enSet = new Set(enKeys)
    const onlyZh = zhKeys.filter((k) => !enSet.has(k))
    const onlyEn = enKeys.filter((k) => !zhSet.has(k))
    expect(onlyZh, 'en-US 缺少这些 key').toEqual([])
    expect(onlyEn, 'en-US 多出这些 key').toEqual([])
  })

  it('全部文案可被 vue-i18n 编译执行（特殊字符已正确转义）', () => {
    const i18n = createI18n({
      legacy: false,
      locale: 'zh-CN',
      fallbackLocale: false,
      missingWarn: false,
      fallbackWarn: false,
      messages: { 'zh-CN': zhCN, 'en-US': enUS }
    })
    const broken: string[] = []
    for (const [locale, keys] of [
      ['zh-CN', zhKeys],
      ['en-US', enKeys]
    ] as const) {
      i18n.global.locale.value = locale
      for (const key of keys) {
        try {
          i18n.global.t(key)
        } catch (e) {
          broken.push(`[${locale}] ${key}: ${(e as Error).message}`)
        }
      }
    }
    expect(broken).toEqual([])
  })
})
