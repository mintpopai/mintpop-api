import axios from 'axios'

/**
 * 从未知异常中取可读 message，空则用兜底文案。
 * api/client.ts reject 出的是 { code, message } 普通对象（非 Error 实例），全仓统一经此收口，
 * 不再各处内联 `(e as { message?: string }).message` 断言。
 *
 * 取消请求（组件卸载中断轮询等主动 abort）不经过 client.ts 的 normalize，原样 reject 出
 * axios 的 CanceledError，其 message 固定为英文原文 "canceled"。请求取消不是用户可见的
 * 业务错误，不应把这句英文糊到界面上，故遇到取消错误一律回退 fallback。
 */
export function errMessage(e: unknown, fallback: string): string {
  if (axios.isCancel(e) || (e as { code?: string })?.code === 'ERR_CANCELED') return fallback
  return (e as { message?: string })?.message || fallback
}
