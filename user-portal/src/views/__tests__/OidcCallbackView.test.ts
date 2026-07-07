import { vi } from 'vitest'

// 只测视图编排：exchangePendingOAuth/login2FA（stores/auth.ts 内部调用）、getProfile 全部 mock 掉，
// 避免 jsdom 真实 XHR；applyOidcFragmentToken 纯 localStorage 读写、无 XHR，保留真实实现以断言落地效果
vi.mock('@/api/auth', async importOriginal => {
  const actual = await importOriginal<typeof import('@/api/auth')>()
  return {
    ...actual,
    exchangePendingOAuth: vi.fn(),
    login2FA: vi.fn()
  }
})
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

  it('TOTP 提交失败：停留 TOTP 步内联展示错误，重试成功后跳转', async () => {
    mockExchange.mockResolvedValue({
      requires_2fa: true,
      temp_token: 'tmp',
      user_email_masked: 'a***@x.com'
    })
    // 第一次提交失败（验证码错误等）
    mockLogin2FA.mockRejectedValueOnce({ status: 400, code: 400, message: '验证码错误' })
    const { wrapper, router } = await mountView()
    await wrapper.find('input[inputmode="numeric"]').setValue('111111')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()
    // 仍在 TOTP 步（输入框还在）、内联错误可见、不跳转、不落终态 ERROR
    expect(wrapper.find('input[inputmode="numeric"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('验证码错误')
    expect(router.currentRoute.value.path).toBe('/auth/oidc/callback')

    // 原地重输后重试成功 → /dashboard（验证重试路径真的能走通）
    mockLogin2FA.mockResolvedValueOnce({ access_token: 'tok2', user: fakeUser })
    await wrapper.find('input[inputmode="numeric"]').setValue('222222')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()
    expect(mockLogin2FA).toHaveBeenLastCalledWith('tmp', '222222')
    expect(router.currentRoute.value.path).toBe('/dashboard')
  })

  it('同邮箱待绑定等 pending：展示引导文案与返回登录', async () => {
    mockExchange.mockResolvedValue({ error: 'bind_login_required' })
    const { wrapper } = await mountView()
    expect(wrapper.text()).toContain('邮箱密码登录')
    // 「返回登录」链接指向 /login
    expect(wrapper.find('a[href="/login"]').exists()).toBe(true)
  })

  it('fragment 带 error_message：直接展示错误，不调 exchange', async () => {
    window.location.hash = '#error=provider_error&error_message=upstream'
    const { wrapper } = await mountView()
    expect(mockExchange).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('登录未完成')
    expect(wrapper.text()).toContain('upstream')
  })

  it('fragment 只有 error+error_description：展示 error_description 而非裸错误码', async () => {
    window.location.hash = '#error=provider_error&error_description=upstream%20provider%20unavailable'
    const { wrapper } = await mountView()
    expect(mockExchange).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('upstream provider unavailable')
    expect(wrapper.text()).not.toContain('provider_error')
  })

  it('fragment 同时带 error_message 与 error_description：error_description 优先（对齐主前端）', async () => {
    window.location.hash =
      '#error=provider_error&error_message=short&error_description=detailed%20reason'
    const { wrapper } = await mountView()
    expect(mockExchange).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('detailed reason')
    expect(wrapper.text()).not.toContain('short')
  })

  it('fragment 只有裸 error：展示错误码本身', async () => {
    window.location.hash = '#error=provider_error'
    const { wrapper } = await mountView()
    expect(mockExchange).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('provider_error')
  })

  it('fragment 带 access_token：落地 token + fetchUser + 跳转 fragment redirect + 清理 URL hash + 不调 exchange', async () => {
    window.location.hash = '#access_token=frag-tok&refresh_token=frag-refresh&redirect=%2Fkeys'
    mockGetProfile.mockResolvedValue(fakeUser)
    const { router } = await mountView()
    expect(mockExchange).not.toHaveBeenCalled()
    expect(localStorage.getItem('auth_token')).toBe('frag-tok')
    expect(localStorage.getItem('refresh_token')).toBe('frag-refresh')
    expect(mockGetProfile).toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe('/keys')
    expect(window.location.hash).toBe('')
  })

  it('fragment 带 access_token 但无 redirect：回退跳转 /dashboard', async () => {
    window.location.hash = '#access_token=frag-tok'
    mockGetProfile.mockResolvedValue(fakeUser)
    const { router } = await mountView()
    expect(mockExchange).not.toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe('/dashboard')
  })

  it('交换成功但无 redirect：回退跳转 /dashboard', async () => {
    mockExchange.mockResolvedValue({ access_token: 'tok' })
    mockGetProfile.mockResolvedValue(fakeUser)
    const { router } = await mountView()
    expect(router.currentRoute.value.path).toBe('/dashboard')
  })

  it('交换请求本身失败：展示错误态', async () => {
    mockExchange.mockRejectedValue({ status: 500, code: 500, message: '服务暂不可用' })
    const { wrapper } = await mountView()
    expect(wrapper.text()).toContain('服务暂不可用')
  })
})
