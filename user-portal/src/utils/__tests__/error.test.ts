import { describe, it, expect } from 'vitest'
import axios from 'axios'
import { errMessage } from '@/utils/error'

// api/client.ts 的响应拦截器对取消请求（isCancel / code === 'ERR_CANCELED'）不做 normalize，
// 直接原样 reject 出 axios 的 CanceledError（message 固定为英文 "canceled"）。
// 请求取消（如组件卸载中断轮询）不是用户可见错误，不应把这句英文原文糊到界面上。
describe('errMessage（取消错误不透出英文原文）', () => {
  it('axios.isCancel 判定为真的取消错误 → 返回 fallback', () => {
    const cancelError = new axios.Cancel('canceled')
    expect(errMessage(cancelError, '兜底文案')).toBe('兜底文案')
  })

  it('code === "ERR_CANCELED" 的取消错误 → 返回 fallback', () => {
    const cancelError = { code: 'ERR_CANCELED', message: 'canceled' }
    expect(errMessage(cancelError, '兜底文案')).toBe('兜底文案')
  })

  it('普通业务错误仍返回原始 message（非取消场景不受影响）', () => {
    expect(errMessage({ message: '余额不足' }, '兜底文案')).toBe('余额不足')
  })

  it('无 message 的普通异常 → 返回 fallback', () => {
    expect(errMessage({}, '兜底文案')).toBe('兜底文案')
  })
})
