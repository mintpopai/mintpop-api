import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useToast } from '../useToast'

describe('useToast：自动消失定时器清理', () => {
  beforeEach(() => {
    // 假计时器 + 清空模块级单例队列残留（与 ToastHost.test.ts 一致的隔离方式）
    vi.useFakeTimers()
    const { toasts, dismiss } = useToast()
    for (const t of [...toasts.value]) dismiss(t.id)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('dismiss 会 clearTimeout 该 toast 的自动消失定时器', () => {
    const clearSpy = vi.spyOn(window, 'clearTimeout')
    const { toasts, success, dismiss } = useToast()
    success('hi')
    const id = toasts.value[0].id
    dismiss(id)
    expect(clearSpy).toHaveBeenCalled()
    clearSpy.mockRestore()
  })

  it('手动 dismiss 后原定时器到期不再空跑（不重复触发/不报错）', () => {
    const { toasts, success, dismiss } = useToast()
    success('hello')
    const id = toasts.value[0].id
    dismiss(id)
    expect(toasts.value.find((t) => t.id === id)).toBeUndefined()
    expect(() => vi.runAllTimers()).not.toThrow()
    expect(toasts.value).toHaveLength(0)
  })

  it('未手动 dismiss 时，到时仍自动消失（既有行为不回退）', () => {
    const { toasts, success } = useToast()
    success('auto')
    expect(toasts.value).toHaveLength(1)
    vi.runAllTimers()
    expect(toasts.value).toHaveLength(0)
  })
})
