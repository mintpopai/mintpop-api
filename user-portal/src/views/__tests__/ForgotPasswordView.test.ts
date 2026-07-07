import { vi } from 'vitest'

// 只测视图编排：settings/auth 接口全部 mock 掉，避免 jsdom 真实 XHR
vi.mock('@/api/settings', () => ({
  getPublicSettings: vi.fn()
}))
vi.mock('@/api/auth', () => ({
  forgotPassword: vi.fn()
}))

import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import ForgotPasswordView from '@/views/ForgotPasswordView.vue'
import { getPublicSettings } from '@/api/settings'
import { forgotPassword } from '@/api/auth'
import type { PublicSettings } from '@/api/types'

const mockSettings = vi.mocked(getPublicSettings)
const mockForgot = vi.mocked(forgotPassword)

function settingsWith(overrides: Partial<PublicSettings> = {}): PublicSettings {
  return {
    registration_enabled: true,
    email_verify_enabled: false,
    invitation_code_enabled: false,
    promo_code_enabled: false,
    password_reset_enabled: true,
    payment_enabled: false,
    linuxdo_oauth_enabled: false,
    oidc_oauth_enabled: false,
    oidc_oauth_provider_name: '',
    wechat_oauth_enabled: false,
    site_name: 'Test',
    ...overrides
  } as PublicSettings
}

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/forgot-password', component: ForgotPasswordView },
      { path: '/login', component: { template: '<div/>' } },
      { path: '/:pathMatch(.*)*', component: { template: '<div/>' } }
    ]
  })
}

async function mountView(overrides: Partial<PublicSettings> = {}) {
  mockSettings.mockResolvedValue(settingsWith(overrides))
  const router = makeRouter()
  router.push('/forgot-password')
  await router.isReady()
  const wrapper = mount(ForgotPasswordView, { global: { plugins: [router, i18n] } })
  await flushPromises()
  return wrapper
}

async function submit(wrapper: Awaited<ReturnType<typeof mountView>>) {
  await wrapper.find('form').trigger('submit.prevent')
  await flushPromises()
}

beforeEach(() => {
  setActivePinia(createPinia())
  mockForgot.mockReset()
})

describe('ForgotPasswordView', () => {
  it('空邮箱提交：不发请求，展示校验错误', async () => {
    const wrapper = await mountView()
    await submit(wrapper)
    expect(mockForgot).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('请先填写邮箱')
  })

  it('邮箱格式非法：不发请求', async () => {
    const wrapper = await mountView()
    await wrapper.find('#forgot-email').setValue('not-an-email')
    await submit(wrapper)
    expect(mockForgot).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('请输入有效的邮箱地址')
  })

  it('提交成功：调用接口并切到「邮件已发送」态，表单消失', async () => {
    mockForgot.mockResolvedValue(undefined)
    const wrapper = await mountView()
    await wrapper.find('#forgot-email').setValue('a@b.com')
    await submit(wrapper)
    expect(mockForgot).toHaveBeenCalledWith({ email: 'a@b.com', turnstile_token: undefined })
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).toContain('重置邮件已发送')
  })

  it('turnstile 开启且无 token：拦截提交并提示', async () => {
    const wrapper = await mountView({ turnstile_enabled: true, turnstile_site_key: 'site-key' })
    await wrapper.find('#forgot-email').setValue('a@b.com')
    await submit(wrapper)
    expect(mockForgot).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('请先完成人机验证')
  })

  it('请求失败：内联展示错误信息，停留在表单态', async () => {
    mockForgot.mockRejectedValue({ code: 500, message: '服务暂不可用' })
    const wrapper = await mountView()
    await wrapper.find('#forgot-email').setValue('a@b.com')
    await submit(wrapper)
    expect(wrapper.text()).toContain('服务暂不可用')
    expect(wrapper.find('form').exists()).toBe(true)
  })
})
