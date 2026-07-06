import { vi } from 'vitest'

// 只测视图编排：settings/注册/用户资料接口全部 mock 掉，避免 jsdom 真实 XHR
vi.mock('@/api/settings', () => ({
  getPublicSettings: vi.fn()
}))
vi.mock('@/api/auth', () => ({
  register: vi.fn().mockResolvedValue({}),
  sendVerifyCode: vi.fn(),
  validatePromoCode: vi.fn()
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
import { storeAffiliateReferralCode } from '@/utils/affiliateReferral'
import type { PublicSettings } from '@/api/types'

const mockSettings = vi.mocked(getPublicSettings)
const mockRegister = vi.mocked(authApi.register)

function settingsWith(affiliateEnabled: boolean | undefined | 'not-set' = true): PublicSettings {
  const result: Partial<PublicSettings> = {
    registration_enabled: true,
    email_verify_enabled: false,
    invitation_code_enabled: false,
    promo_code_enabled: false,
    password_reset_enabled: false,
    payment_enabled: false,
    linuxdo_oauth_enabled: false,
    oidc_oauth_enabled: false,
    oidc_oauth_provider_name: '',
    wechat_oauth_enabled: false,
    site_name: 'Test'
  }
  // 只在显式设置时才加入 affiliate_enabled 字段；不设置时对应 undefined 值
  if (affiliateEnabled !== 'not-set') {
    result.affiliate_enabled = affiliateEnabled
  }
  return result as PublicSettings
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

async function mountView(query = '', affiliateEnabled: boolean | undefined | 'not-set' = true) {
  mockSettings.mockResolvedValue(settingsWith(affiliateEnabled))
  const router = makeRouter()
  router.push(`/register${query}`)
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
})

describe('RegisterView 好友邀请码', () => {
  it('访问 ?aff= 链接时输入框自动回填，且码已落地 localStorage', async () => {
    const wrapper = await mountView('?aff=V269J6HUH72F')
    const input = wrapper.find<HTMLInputElement>('#reg-aff')
    expect(input.exists()).toBe(true)
    expect(input.element.value).toBe('V269J6HUH72F')
    expect(localStorage.getItem('affiliate_referral_code')).toContain('V269J6HUH72F')
  })

  it('无 URL 参数但 localStorage 有未过期码时回填', async () => {
    storeAffiliateReferralCode('STOREDCODE1')
    const wrapper = await mountView()
    expect(wrapper.find<HTMLInputElement>('#reg-aff').element.value).toBe('STOREDCODE1')
  })

  it('affiliate_enabled 为 false 时不渲染输入框', async () => {
    const wrapper = await mountView('?aff=V269J6HUH72F', false)
    expect(wrapper.find('#reg-aff').exists()).toBe(false)
  })

  it('affiliate_enabled 为 undefined（未知）时不渲染输入框', async () => {
    // 补充 undefined 分支：settings 加载完但 affiliate_enabled 为 undefined（未知状态，即字段不存在）
    const wrapper = await mountView('?aff=V269J6HUH72F', 'not-set')
    expect(wrapper.find('#reg-aff').exists()).toBe(false)
  })

  it('settings 拉取失败时不渲染输入框（静默逻辑保留）', async () => {
    mockSettings.mockRejectedValue(new Error('network'))
    const router = makeRouter()
    router.push('/register?aff=V269J6HUH72F')
    await router.isReady()
    const wrapper = mount(RegisterView, { global: { plugins: [router, i18n] } })
    await flushPromises()
    expect(wrapper.find('#reg-aff').exists()).toBe(false)

    // 验证静默逻辑保留：settings 失败时 URL 带来的码仍随提交携带
    await fillAndSubmit(wrapper)
    expect(mockRegister).toHaveBeenCalledTimes(1)
    expect(mockRegister.mock.calls[0][0].aff_code).toBe('V269J6HUH72F')
  })

  it('提交时携带输入框中的邀请码（手动修改以修改值为准）', async () => {
    const wrapper = await mountView('?aff=V269J6HUH72F')
    await wrapper.find('#reg-aff').setValue('MANUAL123')
    await fillAndSubmit(wrapper)
    expect(mockRegister).toHaveBeenCalledTimes(1)
    expect(mockRegister.mock.calls[0][0].aff_code).toBe('MANUAL123')
  })

  it('清空输入框后提交不携带邀请码（即使 localStorage 有落地码）', async () => {
    const wrapper = await mountView('?aff=V269J6HUH72F')
    await wrapper.find('#reg-aff').setValue('')
    await fillAndSubmit(wrapper)
    expect(mockRegister).toHaveBeenCalledTimes(1)
    expect(mockRegister.mock.calls[0][0].aff_code).toBeUndefined()
  })
})
