import { describe, it, expect } from 'vitest'
import { toCsvContent } from '@/utils/csv'

describe('toCsvContent', () => {
  it('普通值原样输出，行以 \\n 连接', () => {
    expect(toCsvContent(['a', 'b'], [['1', '2']])).toBe('a,b\n1,2')
  })

  it('含逗号/引号/换行/回车的字段用引号包裹，内部引号双写', () => {
    expect(toCsvContent(['h'], [['a,b']])).toBe('h\n"a,b"')
    expect(toCsvContent(['h'], [['say "hi"']])).toBe('h\n"say ""hi"""')
    expect(toCsvContent(['h'], [['line1\nline2']])).toBe('h\n"line1\nline2"')
    // 孤立 \r 也要触发包裹，否则破坏行结构
    expect(toCsvContent(['h'], [['a\rb']])).toBe('h\n"a\rb"')
  })

  it('公式注入防护：字符串以 = + - @ 开头时前置单引号', () => {
    expect(toCsvContent(['h'], [['=CMD(1)']])).toBe("h\n'=CMD(1)")
    expect(toCsvContent(['h'], [['+1+1']])).toBe("h\n'+1+1")
    expect(toCsvContent(['h'], [['-danger']])).toBe("h\n'-danger")
    expect(toCsvContent(['h'], [['@import']])).toBe("h\n'@import")
  })

  it('数字不做注入防护：负数金额原样输出', () => {
    expect(toCsvContent(['h'], [[-5.2]])).toBe('h\n-5.2')
  })
})
