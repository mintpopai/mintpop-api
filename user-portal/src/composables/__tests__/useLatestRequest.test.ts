import { describe, it, expect } from 'vitest'
import { useLatestRequest } from '../useLatestRequest'

describe('useLatestRequest：序号守卫', () => {
  it('后发请求先返回时，旧请求的结果应被判定为过期而丢弃', async () => {
    const { next, isLatest } = useLatestRequest()

    async function fakeLoad(ms: number) {
      const { seq } = next()
      await new Promise((resolve) => setTimeout(resolve, ms))
      return { seq, current: isLatest(seq) }
    }

    // 先发起的请求耗时更长、后发起的请求耗时更短——后者先落地
    const slow = fakeLoad(30)
    const fast = fakeLoad(5)
    const [slowResult, fastResult] = await Promise.all([slow, fast])

    expect(fastResult.current).toBe(true) // 后发且先返回：最新，应落地
    expect(slowResult.current).toBe(false) // 先发且后返回：已过期，结果应丢弃
  })

  it('同步连续调用 next() 时，只有最后一次是最新的', () => {
    const { next, isLatest } = useLatestRequest()
    const first = next()
    const second = next()
    const third = next()

    expect(isLatest(first.seq)).toBe(false)
    expect(isLatest(second.seq)).toBe(false)
    expect(isLatest(third.seq)).toBe(true)
  })

  it('不传 cancelPrevious 时不创建 AbortController（signal 为 undefined）', () => {
    const { next } = useLatestRequest()
    const { signal } = next()
    expect(signal).toBeUndefined()
  })

  it('cancelPrevious=true 时会中止上一次未完成的可取消请求', () => {
    const { next } = useLatestRequest()
    const first = next(true)
    expect(first.signal).toBeInstanceOf(AbortSignal)
    expect(first.signal?.aborted).toBe(false)

    const second = next(true)
    expect(first.signal?.aborted).toBe(true) // 上一次的 signal 被中止
    expect(second.signal?.aborted).toBe(false) // 新一次未被中止
  })

  it('不请求取消时（cancelPrevious 缺省/false），旧 signal 不会被中止', () => {
    const { next } = useLatestRequest()
    const first = next(true)
    next() // 后续请求不要求取消旧请求
    expect(first.signal?.aborted).toBe(false)
  })
})
