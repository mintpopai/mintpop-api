import { vi } from 'vitest'

// 只测视图编排：settings 接口 mock 掉，避免 jsdom 真实 XHR
vi.mock('@/api/settings', () => ({
  getPublicSettings: vi.fn()
}))

import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import LoginView from '@/views/LoginView.vue'
import { getPublicSettings } from '@/api/settings'
import type { PublicSettings } from '@/api/types'

const mockSettings = vi.mocked(getPublicSettings)

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

async function mountView(overrides: Partial<PublicSettings> = {}) {
  mockSettings.mockResolvedValue(settingsWith(overrides))
  const router = makeRouter()
  router.push('/login')
  await router.isReady()
  const wrapper = mount(LoginView, { global: { plugins: [router, i18n] } })
  await flushPromises()
  return wrapper
}

/** 找到统一登录按钮（按文案定位） */
function findOidcButton(wrapper: Awaited<ReturnType<typeof mountView>>) {
  return wrapper.findAll('button').filter((b) => b.text().includes(OIDC_BUTTON_TEXT))
}

beforeEach(() => {
  setActivePinia(createPinia())
  mockSettings.mockReset()
})

describe('LoginView：仅统一登录（Logto-only）', () => {
  it('渲染统一登录（OIDC）按钮', async () => {
    const wrapper = await mountView()
    expect(findOidcButton(wrapper)).toHaveLength(1)
  })

  it('即使 oidc_oauth_enabled 为 false 也强制渲染统一登录按钮（standalone 是唯一入口，不受开关门控）', async () => {
    const wrapper = await mountView({ oidc_oauth_enabled: false })
    expect(findOidcButton(wrapper)).toHaveLength(1)
  })

  it('不再渲染邮箱/密码表单（本地登录已收敛到认证中心）', async () => {
    const wrapper = await mountView()
    expect(wrapper.find('#login-email').exists()).toBe(false)
    expect(wrapper.find('#login-password').exists()).toBe(false)
    expect(wrapper.find('#login-totp').exists()).toBe(false)
  })
})
