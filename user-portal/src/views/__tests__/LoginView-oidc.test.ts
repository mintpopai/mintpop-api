import { vi } from 'vitest'

// 只测视图编排：settings/auth 接口全部 mock 掉，避免 jsdom 真实 XHR
vi.mock('@/api/settings', () => ({
  getPublicSettings: vi.fn()
}))
vi.mock('@/api/auth', () => ({
  login: vi.fn()
}))

import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import LoginView from '@/views/LoginView.vue'
import { getPublicSettings } from '@/api/settings'
import { login } from '@/api/auth'
import type { PublicSettings } from '@/api/types'

const mockSettings = vi.mocked(getPublicSettings)
const mockLogin = vi.mocked(login)

const OIDC_BUTTON_TEXT = '使用 MintPop 账号登录'

function settingsWith(overrides: Partial<PublicSettings> = {}): PublicSettings {
  return {
    registration_enabled: true,
    email_verify_enabled: false,
    invitation_code_enabled: false,
    promo_code_enabled: false,
    password_reset_enabled: false,
    payment_enabled: false,
    linuxdo_oauth_enabled: false,
    oidc_oauth_enabled: true,
    oidc_oauth_provider_name: 'MintPop',
    wechat_oauth_enabled: false,
    site_name: 'Test',
    ...overrides
  } as PublicSettings
}

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', component: LoginView },
      { path: '/:pathMatch(.*)*', component: { template: '<div/>' } }
    ]
  })
}

async function mountView() {
  mockSettings.mockResolvedValue(settingsWith())
  const router = makeRouter()
  router.push('/login')
  await router.isReady()
  const wrapper = mount(LoginView, { global: { plugins: [router, i18n] } })
  await flushPromises()
  return wrapper
}

/** 找到统一登录按钮（按文案定位，避免误伤提交按钮） */
function findOidcButton(wrapper: Awaited<ReturnType<typeof mountView>>) {
  return wrapper.findAll('button').filter((b) => b.text().includes(OIDC_BUTTON_TEXT))
}

beforeEach(() => {
  setActivePinia(createPinia())
  mockSettings.mockReset()
  mockLogin.mockReset()
})

describe('LoginView 统一登录（OIDC）按钮的分步展示', () => {
  it('第一步（邮箱密码）渲染统一登录按钮', async () => {
    const wrapper = await mountView()
    expect(findOidcButton(wrapper)).toHaveLength(1)
  })

  it('进入 TOTP 第二步后统一登录按钮不再显示', async () => {
    // 后端第一步只回 temp_token（requires_2fa），视图切到 TOTP 步骤
    mockLogin.mockResolvedValue({
      requires_2fa: true,
      temp_token: 'tmp-token',
      user_email_masked: 'a***@b.com'
    } as Awaited<ReturnType<typeof login>>)

    const wrapper = await mountView()
    await wrapper.find('#login-email').setValue('a@b.com')
    await wrapper.find('#login-password').setValue('123456')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    // 已切到 TOTP 步骤（验证码输入框出现），统一登录按钮消失
    expect(mockLogin).toHaveBeenCalledTimes(1)
    expect(wrapper.find('#login-totp').exists()).toBe(true)
    expect(findOidcButton(wrapper)).toHaveLength(0)
  })
})
