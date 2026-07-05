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

/** 构造一个 HTTP 401 的 AxiosError；message 可自定义（默认沿用既有用例的 'token expired'） */
function unauthorized(config: InternalAxiosRequestConfig, message = 'token expired'): AxiosError {
  const response = {
    status: 401,
    statusText: 'Unauthorized',
    headers: {},
    config,
    data: { code: 401, message, data: null }
  } as AxiosResponse
  return new AxiosError('Request failed with status code 401', 'ERR_BAD_REQUEST', config, {}, response)
}

const originalAdapter = apiClient.defaults.adapter
// jsdom 的 window.location 是受限对象，直接赋值 href 会被忽略/报 "not implemented (navigation)"；
// 替换成可写的 plain object 后即可正常赋值，并在测试里持有引用断言最终写入的 href
const originalLocation = window.location

beforeEach(() => {
  localStorage.clear()
  // client.ts 模块级 isRefreshing/waiters 在现有全部分支中都会在请求 settle 前自清
  // （doRefresh 无论成功/失败都会走到 isRefreshing = false + onRefreshed 清空 waiters，
  // 且本文件所有用例都 await 到 apiClient 请求完全 settle 才结束），故不存在跨用例残留，
  // 无需在此显式重置；保留本注释说明原因，供后续新增用例复核该前提是否仍成立。
})

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
  Object.defineProperty(window, 'location', { value: originalLocation, writable: true })
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

describe('网络层错误归一化', () => {
  it('断网（无 response 的 AxiosError）时给出本地化提示，不把 axios 英文 "Network Error" 透出到界面', async () => {
    apiClient.defaults.adapter = async (config) => {
      throw new AxiosError('Network Error', 'ERR_NETWORK', config)
    }
    const i18n = (await import('@/i18n')).default
    await expect(apiClient.get('/whatever')).rejects.toMatchObject({
      message: i18n.global.t('common.networkError')
    })
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

describe('401 续期失败 → 清库并跳转登录', () => {
  it('刷新请求 reject（如网络错误）→ 清除 token 并跳转 /login?redirect=<原路径编码>', async () => {
    localStorage.setItem(TOKEN_KEY, 'old-token')
    localStorage.setItem(REFRESH_KEY, 'refresh-1')
    // doRefresh 内部 axios.post 失败（reject），doRefresh 会 catch 住并返回 null
    const post = vi.spyOn(axios, 'post').mockRejectedValue(new Error('network down'))

    apiClient.defaults.adapter = async (config) => {
      throw unauthorized(config)
    }

    const location = { pathname: '/settings', search: '?tab=security', hash: '', href: '' }
    Object.defineProperty(window, 'location', { value: location, writable: true })

    await expect(apiClient.get('/protected')).rejects.toMatchObject({
      status: 401,
      message: 'token expired'
    })

    expect(post).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
    expect(localStorage.getItem(REFRESH_KEY)).toBeNull()
    expect(location.href).toBe(`/login?redirect=${encodeURIComponent('/settings?tab=security')}`)
  })

  it('无 refresh_token 时不发起刷新请求，直接清库并跳转', async () => {
    localStorage.setItem(TOKEN_KEY, 'old-token')
    // 不设置 REFRESH_KEY

    const post = vi.spyOn(axios, 'post')

    apiClient.defaults.adapter = async (config) => {
      throw unauthorized(config)
    }

    const location = { pathname: '/dashboard', search: '', hash: '', href: '' }
    Object.defineProperty(window, 'location', { value: location, writable: true })

    await expect(apiClient.get('/protected')).rejects.toMatchObject({
      status: 401,
      message: 'token expired'
    })

    expect(post).not.toHaveBeenCalled()
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
    expect(location.href).toBe(`/login?redirect=${encodeURIComponent('/dashboard')}`)
  })
})

describe('auth 端点豁免刷新', () => {
  it('/auth/login 返回 401 时不触发刷新流程，直接 reject 出业务 message', async () => {
    // 特意保留 refresh_token：若豁免判断失效，会落入「有 refresh_token」分支从而调用 doRefresh/axios.post，
    // 下面 `post` 未被调用的断言才能真正证明是豁免生效、而非凑巧命中了「无 refresh_token」的短路分支
    localStorage.setItem(REFRESH_KEY, 'refresh-1')
    const post = vi.spyOn(axios, 'post')

    apiClient.defaults.adapter = async (config) => {
      throw unauthorized(config, '账号或密码错误')
    }

    await expect(apiClient.post('/auth/login', { email: 'a@b.com', password: 'x' })).rejects.toMatchObject({
      status: 401,
      message: '账号或密码错误'
    })

    // 豁免分支根本不进入续期逻辑，doRefresh 内部的 axios.post 不应被调用
    expect(post).not.toHaveBeenCalled()
  })
})
