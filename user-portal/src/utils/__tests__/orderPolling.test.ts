// 订单轮询原语契约测试：PaymentResultModal 与 RechargeView 回流共用这一份实现，
// 消除「同一轮询语义两套手写」的漂移风险（口径复用 resolvePaymentPollAction）。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PaymentOrder } from '@/api/types'

vi.mock('@/api/payment', () => ({
  verifyOrder: vi.fn()
}))

import { verifyOrder } from '@/api/payment'
import { pollOrderUntilSettled } from '@/utils/orderPolling'

const mockVerify = vi.mocked(verifyOrder)

function orderWith(status: string): PaymentOrder {
  return { status } as unknown as PaymentOrder
}

beforeEach(() => {
  mockVerify.mockReset()
})

describe('pollOrderUntilSettled', () => {
  it('查询到成功口径状态（PAID）即返回 SETTLED，并停止后续查询', async () => {
    mockVerify
      .mockResolvedValueOnce(orderWith('PENDING'))
      .mockResolvedValueOnce(orderWith('PAID'))
    const outcome = await pollOrderUntilSettled('T1', { intervalMs: 1 })
    expect(outcome.kind).toBe('SETTLED')
    expect(mockVerify).toHaveBeenCalledTimes(2)
  })

  it('RECHARGING（已付款、到账中）也算成功口径', async () => {
    mockVerify.mockResolvedValueOnce(orderWith('RECHARGING'))
    const outcome = await pollOrderUntilSettled('T1', { intervalMs: 1 })
    expect(outcome.kind).toBe('SETTLED')
  })

  it('终态（FAILED/CANCELLED 等）返回 TERMINAL 且带最后一次订单', async () => {
    mockVerify.mockResolvedValueOnce(orderWith('FAILED'))
    const outcome = await pollOrderUntilSettled('T1', { intervalMs: 1 })
    expect(outcome.kind).toBe('TERMINAL')
    expect(outcome.kind === 'TERMINAL' && outcome.order.status).toBe('FAILED')
    expect(mockVerify).toHaveBeenCalledTimes(1)
  })

  it('一直 PENDING 时按 maxAttempts 上限返回 TIMEOUT', async () => {
    mockVerify.mockResolvedValue(orderWith('PENDING'))
    const outcome = await pollOrderUntilSettled('T1', { intervalMs: 1, maxAttempts: 3 })
    expect(outcome.kind).toBe('TIMEOUT')
    expect(mockVerify).toHaveBeenCalledTimes(3)
  })

  it('单次查询失败不终止轮询（吞错重试），下次成功仍能 SETTLED', async () => {
    mockVerify
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(orderWith('PAID'))
    const outcome = await pollOrderUntilSettled('T1', { intervalMs: 1 })
    expect(outcome.kind).toBe('SETTLED')
    expect(mockVerify).toHaveBeenCalledTimes(2)
  })

  it('isAborted 为真时立刻返回 ABORTED，不再发起查询', async () => {
    mockVerify.mockResolvedValue(orderWith('PENDING'))
    let aborted = false
    const p = pollOrderUntilSettled('T1', {
      intervalMs: 1,
      isAborted: () => aborted,
      onStatus: () => {
        aborted = true // 第一次查询落地后立刻中止
      }
    })
    const outcome = await p
    expect(outcome.kind).toBe('ABORTED')
    expect(mockVerify).toHaveBeenCalledTimes(1)
  })

  it('每次成功查询都回调 onStatus（供 UI 刷新状态条）', async () => {
    mockVerify
      .mockResolvedValueOnce(orderWith('PENDING'))
      .mockResolvedValueOnce(orderWith('PAID'))
    const seen: string[] = []
    await pollOrderUntilSettled('T1', {
      intervalMs: 1,
      onStatus: (o) => seen.push(o.status)
    })
    expect(seen).toEqual(['PENDING', 'PAID'])
  })
})
