/**
 * 从未知异常中取可读 message，空则用兜底文案。
 * api/client.ts reject 出的是 { code, message } 普通对象（非 Error 实例），全仓统一经此收口，
 * 不再各处内联 `(e as { message?: string }).message` 断言。
 */
export function errMessage(e: unknown, fallback: string): string {
  return (e as { message?: string })?.message || fallback
}
