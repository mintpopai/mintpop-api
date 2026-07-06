import { vi } from 'vitest'

// 只测视图编排：settings/注册/校验接口全部 mock 掉，避免 jsdom 真实 XHR
vi.mock('@/api/settings', () => ({
  getPublicSettings: vi.fn()
}))
vi.mock('@/api/auth', () => ({
  register: vi.fn().mockResolvedValue({}),
  sendVerifyCode: vi.fn(),
  validatePromoCode: vi.fn(),
  validateInvitationCode: vi.fn()
}))
vi.mock('@/api/user', () => ({
  getProfile: vi.fn().mockResolvedValue({ id: 1, username: 'u', email: 'u@x.com', balance: 0 }),
  updateProfile: vi.fn().mockResolvedValue({})
}))

import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import RegisterView from '@/views/RegisterView.vue'
import { getPublicSettings } from '@/api/settings'
import * as authApi from '@/api/auth'
import type { PublicSettings } from '@/api/types'

const mockSettings = vi.mocked(getPublicSettings)
const mockRegister = vi.mocked(authApi.register)
const mockValidateInvitation = vi.mocked(authApi.validateInvitationCode)

function settingsWith(invitationEnabled: boolean): PublicSettings {
  return {
    registration_enabled: true,
    email_verify_enabled: false,
    invitation_code_enabled: invitationEnabled,
    promo_code_enabled: false,
    password_reset_enabled: false,
    payment_enabled: false,
    linuxdo_oauth_enabled: false,
    oidc_oauth_enabled: false,
    oidc_oauth_provider_name: '',
    wechat_oauth_enabled: false,
    site_name: 'Test'
  } as PublicSettings
}

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/register', name: 'Register', component: RegisterView },
      { path: '/:pathMatch(.*)*', component: { template: '<div/>' } }
    ]
  })
}

async function mountView(invitationEnabled = true) {
  mockSettings.mockResolvedValue(settingsWith(invitationEnabled))
  const router = makeRouter()
  router.push('/register')
  await router.isReady()
  const wrapper = mount(RegisterView, { global: { plugins: [router, i18n] } })
  await flushPromises()
  return wrapper
}

async function fillAndSubmit(wrapper: Awaited<ReturnType<typeof mountView>>) {
  await wrapper.find('#reg-email').setValue('a@b.com')
  await wrapper.find('#reg-password').setValue('123456')
  await wrapper.find('#reg-confirm-password').setValue('123456')
  await wrapper.find('input[type="checkbox"]').setValue(true)
  await wrapper.find('form').trigger('submit.prevent')
  await flushPromises()
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  mockRegister.mockClear()
  mockSettings.mockReset()
  mockValidateInvitation.mockReset()
})

describe('RegisterView 邀请码（后端开启时必填）', () => {
  it('开启邀请码时渲染输入框，且标签不带「选填」', async () => {
    const wrapper = await mountView(true)
    expect(wrapper.find('#reg-invitation').exists()).toBe(true)
    const label = wrapper.find('label[for="reg-invitation"]')
    expect(label.text()).not.toContain('选填')
  })

  it('未开启邀请码时不渲染输入框', async () => {
    const wrapper = await mountView(false)
    expect(wrapper.find('#reg-invitation').exists()).toBe(false)
  })

  it('开启邀请码但未填写时阻止提交', async () => {
    const wrapper = await mountView(true)
    await fillAndSubmit(wrapper)
    expect(mockRegister).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('请填写邀请码')
  })

  it('填写的邀请码校验无效时阻止提交', async () => {
    mockValidateInvitation.mockResolvedValue({ valid: false, error_code: 'INVITATION_CODE_INVALID' })
    const wrapper = await mountView(true)
    await wrapper.find('#reg-invitation').setValue('BADCODE1')
    await fillAndSubmit(wrapper)
    expect(mockRegister).not.toHaveBeenCalled()
  })

  it('填写有效邀请码时提交携带该码', async () => {
    mockValidateInvitation.mockResolvedValue({ valid: true })
    const wrapper = await mountView(true)
    await wrapper.find('#reg-invitation').setValue('GOODCODE')
    await fillAndSubmit(wrapper)
    expect(mockRegister).toHaveBeenCalledTimes(1)
    expect(mockRegister.mock.calls[0][0].invitation_code).toBe('GOODCODE')
  })

  it('未开启邀请码时空邀请码不阻止提交', async () => {
    const wrapper = await mountView(false)
    await fillAndSubmit(wrapper)
    expect(mockRegister).toHaveBeenCalledTimes(1)
    expect(mockRegister.mock.calls[0][0].invitation_code).toBeUndefined()
  })
})
