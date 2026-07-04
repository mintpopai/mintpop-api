import { describe, it, expect } from 'vitest'
import { resolvePaymentPollAction } from '@/utils/format'

// PaymentResultModal.verifyOnce 的「下一步动作」判定：与 frontend SUCCESS_STATUSES 对齐，
// RECHARGING（已付款、到账中）视为成功态，其余一切非 PENDING 状态一律停表（终态）。
describe('resolvePaymentPollAction（支付轮询下一步动作判定）', () => {
  it('PENDING → CONTINUE（继续轮询）', () => {
    expect(resolvePaymentPollAction('PENDING')).toBe('CONTINUE')
  })

  it.each(['PAID', 'COMPLETED', 'RECHARGING'])('%s → SETTLED（停表并通知调用方）', (status) => {
    expect(resolvePaymentPollAction(status)).toBe('SETTLED')
  })

  it.each(['FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'SOME_UNKNOWN_STATUS'])(
    '%s → TERMINAL（停表但不通知，含未知状态兜底）',
    (status) => {
      expect(resolvePaymentPollAction(status)).toBe('TERMINAL')
    }
  )
})
