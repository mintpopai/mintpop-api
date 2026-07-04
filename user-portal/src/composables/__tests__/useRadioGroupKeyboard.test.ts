import { describe, it, expect } from 'vitest'
import { nextRadioIndex } from '../useRadioGroupKeyboard'

describe('nextRadioIndex', () => {
  it('→ / ↓ 前进一项', () => {
    expect(nextRadioIndex(0, 4, 'ArrowRight')).toBe(1)
    expect(nextRadioIndex(0, 4, 'ArrowDown')).toBe(1)
  })

  it('← / ↑ 后退一项', () => {
    expect(nextRadioIndex(2, 4, 'ArrowLeft')).toBe(1)
    expect(nextRadioIndex(2, 4, 'ArrowUp')).toBe(1)
  })

  it('前进越界回绕到首项', () => {
    expect(nextRadioIndex(3, 4, 'ArrowRight')).toBe(0)
    expect(nextRadioIndex(3, 4, 'ArrowDown')).toBe(0)
  })

  it('后退越界回绕到末项', () => {
    expect(nextRadioIndex(0, 4, 'ArrowLeft')).toBe(3)
    expect(nextRadioIndex(0, 4, 'ArrowUp')).toBe(3)
  })

  it('单项组回绕到自身', () => {
    expect(nextRadioIndex(0, 1, 'ArrowRight')).toBe(0)
    expect(nextRadioIndex(0, 1, 'ArrowLeft')).toBe(0)
  })

  it('非方向键返回 null', () => {
    expect(nextRadioIndex(0, 4, 'Enter')).toBeNull()
    expect(nextRadioIndex(0, 4, ' ')).toBeNull()
    expect(nextRadioIndex(0, 4, 'Tab')).toBeNull()
  })

  it('空组返回 null', () => {
    expect(nextRadioIndex(0, 0, 'ArrowRight')).toBeNull()
  })
})
