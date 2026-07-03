/**
 * apiClient 契约测试（README/CLAUDE 自述的关键契约，此前零覆盖）：
 * - code===0 解包 data；code!==0 reject 出 { code, message }（不看 HTTP 状态码）
 * - 401 自动用 refresh_token 续期并重放原请求
 * - 并发 401 只触发一次刷新（waiters 队列）
 * 通过替换 apiClient.defaults.adapter 模拟服务端，不发真实网络请求。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import axios, { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { apiClient, TOKEN_KEY, REFRESH_KEY } from '@/api/client'

/** 构造一个 200 业务响应 */
function ok(config: InternalAxiosRequestConfig, body: unknown): AxiosResponse {
  return { status: 200, statusText: 'OK', headers: {}, config, data: body }
}

/** 构造一个 HTTP 401 的 AxiosError */
function unauthorized(config: InternalAxiosRequestConfig): AxiosError {
  const response = {
    status: 401,
    statusText: 'Unauthorized',
    headers: {},
    config,
    data: { code: 401, message: 'token expired', data: null }
  } as AxiosResponse
  return new AxiosError('Request failed with status code 401', 'ERR_BAD_REQUEST', config, {}, response)
}

const originalAdapter = apiClient.defaults.adapter

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
  vi.restoreAllMocks()
})

describe('统一返回体解包', () => {
  it('code===0 解包 data；请求头带 Bearer token', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok-1')
    let seenAuth = ''
    apiClient.defaults.adapter = async (config) => {
      seenAuth = String(AxiosHeaders.from(config.headers).Authorization)
      return ok(config, { code: 0, message: '', data: { hello: 'world' } })
    }
    const resp = await apiClient.get('/whatever')
    expect(resp.data).toEqual({ hello: 'world' })
    expect(seenAuth).toBe('Bearer tok-1')
  })

  it('code!==0 时 reject 出业务 code 与 message（HTTP 仍是 200）', async () => {
    apiClient.defaults.adapter = async (config) => ok(config, { code: 110001, message: '重复操作', data: null })
    await expect(apiClient.get('/whatever')).rejects.toMatchObject({ code: 110001, message: '重复操作' })
  })
})

describe('401 自动续期', () => {
  it('401 → 刷新 token → 用新 token 重放原请求', async () => {
    localStorage.setItem(TOKEN_KEY, 'old-token')
    localStorage.setItem(REFRESH_KEY, 'refresh-1')
    // doRefresh 走裸 axios.post（不经 apiClient），单独 mock
    const post = vi.spyOn(axios, 'post').mockResolvedValue({
      data: { code: 0, message: '', data: { access_token: 'new-token', refresh_token: 'refresh-2' } }
    })

    const authHeaders: string[] = []
    apiClient.defaults.adapter = async (config) => {
      const auth = String(AxiosHeaders.from(config.headers).Authorization)
      authHeaders.push(auth)
      if (auth === 'Bearer old-token') throw unauthorized(config)
      return ok(config, { code: 0, message: '', data: 'ok-after-refresh' })
    }

    const resp = await apiClient.get('/protected')
    expect(resp.data).toBe('ok-after-refresh')
    expect(post).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(TOKEN_KEY)).toBe('new-token')
    expect(localStorage.getItem(REFRESH_KEY)).toBe('refresh-2')
    // 第一次带旧 token 挨了 401，重放带新 token
    expect(authHeaders).toEqual(['Bearer old-token', 'Bearer new-token'])
  })

  it('并发多个 401 只触发一次刷新，全部用新 token 重放成功', async () => {
    localStorage.setItem(TOKEN_KEY, 'old-token')
    localStorage.setItem(REFRESH_KEY, 'refresh-1')
    const post = vi.spyOn(axios, 'post').mockImplementation(
      () =>
        new Promise((resolve) =>
          // 让刷新慢一拍，保证第二个请求进入 waiters 队列分支
          setTimeout(
            () => resolve({ data: { code: 0, message: '', data: { access_token: 'new-token' } } }),
            10
          )
        )
    )
    apiClient.defaults.adapter = async (config) => {
      const auth = String(AxiosHeaders.from(config.headers).Authorization)
      if (auth === 'Bearer old-token') throw unauthorized(config)
      return ok(config, { code: 0, message: '', data: `ok:${config.url}` })
    }

    const [a, b] = await Promise.all([apiClient.get('/a'), apiClient.get('/b')])
    expect(a.data).toBe('ok:/a')
    expect(b.data).toBe('ok:/b')
    expect(post).toHaveBeenCalledTimes(1)
  })
})
