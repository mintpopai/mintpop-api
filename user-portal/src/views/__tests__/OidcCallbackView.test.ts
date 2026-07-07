import { vi } from 'vitest'

// 只测视图编排：exchangePendingOAuth/login2FA（stores/auth.ts 内部调用）、getProfile 全部 mock 掉，
// 避免 jsdom 真实 XHR
vi.mock('@/api/auth', () => ({
  exchangePendingOAuth: vi.fn(),
  login2FA: vi.fn()
}))
vi.mock('@/api/user', () => ({
  getProfile: vi.fn()
}))

import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import OidcCallbackView from '@/views/OidcCallbackView.vue'
import { exchangePendingOAuth, login2FA } from '@/api/auth'
import { getProfile } from '@/api/user'
import type { User } from '@/api/types'

const mockExchange = vi.mocked(exchangePendingOAuth)
const mockLogin2FA = vi.mocked(login2FA)
const mockGetProfile = vi.mocked(getProfile)

const fakeUser: User = { id: 1, username: 'u', email: 'u@x.com', balance: 0 }

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/auth/oidc/callback', name: 'OidcCallback', component: OidcCallbackView },
      { path: '/dashboard', component: { template: '<div/>' } },
      { path: '/keys', component: { template: '<div/>' } },
      { path: '/login', component: { template: '<div/>' } },
      { path: '/:pathMatch(.*)*', component: { template: '<div/>' } }
    ]
  })
}

async function mountView() {
  const router = makeRouter()
  router.push('/auth/oidc/callback')
  await router.isReady()
  const wrapper = mount(OidcCallbackView, { global: { plugins: [router, i18n] } })
  await flushPromises()
  return { wrapper, router }
}

beforeEach(() => {
  setActivePinia(createPinia())
  mockExchange.mockReset()
  mockLogin2FA.mockReset()
  mockGetProfile.mockReset()
  localStorage.clear()
  window.location.hash = ''
})

describe('OidcCallbackView', () => {
  it('交换成功：拉取用户并跳转 redirect', async () => {
    mockExchange.mockResolvedValue({ access_token: 'tok', redirect: '/keys' })
    mockGetProfile.mockResolvedValue(fakeUser)
    const { router } = await mountView()
    expect(router.currentRoute.value.path).toBe('/keys')
  })

  it('requires_2fa：展示验证码步骤，不跳转', async () => {
    mockExchange.mockResolvedValue({
      requires_2fa: true,
      temp_token: 'tmp',
      user_email_masked: 'a***@x.com'
    })
    const { wrapper, router } = await mountView()
    expect(router.currentRoute.value.path).toBe('/auth/oidc/callback')
    expect(wrapper.find('input[inputmode="numeric"]').exists()).toBe(true)
  })

  it('requires_2fa 提交验证码后：loginWith2FA 成功跳转 /dashboard', async () => {
    mockExchange.mockResolvedValue({
      requires_2fa: true,
      temp_token: 'tmp',
      user_email_masked: 'a***@x.com'
    })
    mockLogin2FA.mockResolvedValue({ access_token: 'tok2', user: fakeUser })
    const { wrapper, router } = await mountView()
    await wrapper.find('input[inputmode="numeric"]').setValue('123456')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()
    expect(mockLogin2FA).toHaveBeenCalledWith('tmp', '123456')
    expect(router.currentRoute.value.path).toBe('/dashboard')
  })

  it('同邮箱待绑定等 pending：展示引导文案与返回登录', async () => {
    mockExchange.mockResolvedValue({ error: 'bind_login_required' })
    const { wrapper } = await mountView()
    expect(wrapper.text()).toContain('邮箱密码登录')
  })

  it('fragment 带 error：直接展示错误，不调 exchange', async () => {
    window.location.hash = '#error=provider_error&message=upstream'
    const { wrapper } = await mountView()
    expect(mockExchange).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('登录未完成')
  })

  it('交换请求本身失败：展示错误态', async () => {
    mockExchange.mockRejectedValue({ status: 500, code: 500, message: '服务暂不可用' })
    const { wrapper } = await mountView()
    expect(wrapper.text()).toContain('服务暂不可用')
  })
})
