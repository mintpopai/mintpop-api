/**
 * 统一「竞态守卫」模式：多处（useDashboard/useKeys/useOrders/useUsage）曾各自手写
 * `let loadSeq = 0` + `seq !== loadSeq` 的序号守卫，用于「翻页/改筛选连发请求时只让
 * 最后一次的响应落地」；本 composable 把该模式抽成通用原语，供各处复用。
 *
 * - `next()`：发起一次新请求前调用，拿到本次的序号（与可选的 AbortSignal）。
 * - `isLatest(seq)`：请求完成后判断该序号是否仍是最新一次，不是则丢弃其结果。
 * - `next(true)`：额外语义「取消上一次未完成的可取消请求」——中止上一次的
 *   AbortController 并新建一个，返回新 controller 的 signal 供接受 AbortSignal 的
 *   API 函数使用；不接受 signal 的 API 函数可忽略该字段，仍靠 isLatest() 兜底。
 */
export interface LatestRequestHandle {
  /** 本次请求的序号，完成后传给 isLatest() 判断是否仍是最新一次 */
  seq: number
  /** 仅当以 cancelPrevious=true 调用 next() 时才有值 */
  signal: AbortSignal | undefined
}

export function useLatestRequest() {
  let seq = 0
  let controller: AbortController | null = null

  function next(cancelPrevious = false): LatestRequestHandle {
    const mySeq = ++seq
    if (cancelPrevious) {
      controller?.abort()
      controller = new AbortController()
    }
    return { seq: mySeq, signal: cancelPrevious ? controller?.signal : undefined }
  }

  function isLatest(mySeq: number): boolean {
    return mySeq === seq
  }

  return { next, isLatest }
}
