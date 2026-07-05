// 第三方绑定发起链路契约（对齐后端 + 主前端行为）：
// 1) redirect_to 必须是「/ 开头的相对路径」——后端 normalizeUserIdentityRedirect 直接拒绝绝对 URL；
// 2) 跳转前必须先 POST /auth/oauth/bind-token 预置 cookie——后端 bind/start 是浏览器导航（无
//    Authorization 头），身份全靠这枚 cookie，不预置必然 401。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'

vi.mock('@/api/binding', () => ({
  prepareBindToken: vi.fn().mockResolvedValue(undefined),
  startBind: vi.fn().mockResolvedValue({ authorize_url: '/api/v1/auth/oauth/linuxdo/bind/start?intent=bind_current_user' }),
  unbind: vi.fn()
}))
vi.mock('@/api/user', () => ({
  getProfile: vi.fn().mockResolvedValue({ id: 1, username: 'u', email: 'u@x.com', balance: 0 }),
  updateProfile: vi.fn()
}))
vi.mock('@/utils/navigation', () => ({
  navigateTo: vi.fn()
}))

import { prepareBindToken, startBind } from '@/api/binding'
import { navigateTo } from '@/utils/navigation'
import { useProfile } from '@/composables/useProfile'

const mockPrepare = vi.mocked(prepareBindToken)
const mockStart = vi.mocked(startBind)

function withSetup<T>(fn: () => T): T {
  let result!: T
  const Host = defineComponent({
    setup() {
      result = fn()
      return () => null
    }
  })
  mount(Host, { global: { plugins: [createPinia(), i18n] } })
  return result
}

beforeEach(() => {
  setActivePinia(createPinia())
  mockPrepare.mockClear()
  mockStart.mockClear()
})

describe('useProfile.bind', () => {
  it('先预置 bind-token cookie，再以相对路径 redirect_to 发起绑定，最后导航到授权地址', async () => {
    const { bind } = withSetup(() => useProfile())
    await bind('linuxdo')

    // 顺序：prepare 在 startBind 之前（cookie 不先落地，bind/start 导航必 401）
    expect(mockPrepare).toHaveBeenCalledTimes(1)
    expect(mockStart).toHaveBeenCalledTimes(1)
    expect(mockPrepare.mock.invocationCallOrder[0]).toBeLessThan(mockStart.mock.invocationCallOrder[0])

    // redirect_to 是相对路径（后端拒绝绝对 URL）
    expect(mockStart).toHaveBeenCalledWith({ provider: 'linuxdo', redirect_to: '/profile' })

    // 最终浏览器导航到后端返回的授权地址
    expect(vi.mocked(navigateTo)).toHaveBeenCalledWith('/api/v1/auth/oauth/linuxdo/bind/start?intent=bind_current_user')
  })
})
