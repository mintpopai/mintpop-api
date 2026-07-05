// 订单支付轮询原语（唯一实现）：PaymentResultModal（弹窗内轮询）与充值页回流轮询共用，
// 状态口径复用 utils/format 的 resolvePaymentPollAction，节奏/终止逻辑收口在此，防两处漂移。
import { verifyOrder } from '@/api/payment'
import { resolvePaymentPollAction } from '@/utils/format'
import type { PaymentOrder } from '@/api/types'

export interface PollOrderOptions {
  /** 轮询间隔（默认 2000ms，与主前端 PaymentResultView 节奏一致） */
  intervalMs?: number
  /** 最大查询次数（缺省不设上限，由 isAborted 负责终止，如弹窗关闭/倒计时归零） */
  maxAttempts?: number
  /** 外部中止信号：弹窗关闭、组件卸载、订单本地过期等场景返回 true */
  isAborted?: () => boolean
  /** 每次成功查询后的回调（UI 据此刷新状态展示）；查询失败的轮次不回调 */
  onStatus?: (order: PaymentOrder) => void
}

export type PollOrderOutcome =
  | { kind: 'SETTLED'; order: PaymentOrder }
  | { kind: 'TERMINAL'; order: PaymentOrder }
  | { kind: 'TIMEOUT' }
  | { kind: 'ABORTED' }

const DEFAULT_POLL_INTERVAL_MS = 2000

/**
 * 轮询订单直至出结果：
 * - SETTLED：命中成功口径（PAID/COMPLETED/RECHARGING）
 * - TERMINAL：命中终态（FAILED/CANCELLED/EXPIRED/退款系列/未知状态）
 * - TIMEOUT：达到 maxAttempts 仍在 PENDING（用户可能已付款，调用方须引导核实、不能静默）
 * - ABORTED：外部中止（调用方不应再做任何 UI 副作用）
 * 单次查询失败按「下次再试」处理（网络抖动不终止支付确认）。
 */
export async function pollOrderUntilSettled(
  outTradeNo: string,
  options: PollOrderOptions = {}
): Promise<PollOrderOutcome> {
  const intervalMs = options.intervalMs ?? DEFAULT_POLL_INTERVAL_MS
  const maxAttempts = options.maxAttempts ?? Number.POSITIVE_INFINITY
  const isAborted = options.isAborted ?? (() => false)

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (isAborted()) return { kind: 'ABORTED' }
    try {
      const order = await verifyOrder(outTradeNo)
      // await 期间可能已被中止（弹窗关闭），丢弃本次结果、不再回调
      if (isAborted()) return { kind: 'ABORTED' }
      options.onStatus?.(order)
      const action = resolvePaymentPollAction(String(order.status || '').trim().toUpperCase())
      if (action === 'SETTLED') return { kind: 'SETTLED', order }
      if (action === 'TERMINAL') return { kind: 'TERMINAL', order }
      // CONTINUE（PENDING）：等待下一轮
    } catch {
      // 单次查询失败忽略，下一轮再试
    }
    if (isAborted()) return { kind: 'ABORTED' }
    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
  }
  return { kind: 'TIMEOUT' }
}
