// mintpop 统一登录（OIDC）入口：登录页第一步顶端的次级按钮。
// 组件不自行拉取 settings（由 LoginView 的 onMounted -> settingsStore.ensureLoaded() 负责），
// 这里直接把 store 的 settings 灌好即可，覆盖开关与跳转目标两条契约。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import OidcLoginButton from '@/components/auth/OidcLoginButton.vue'
import { useSettingsStore } from '@/stores/settings'
import { navigateTo } from '@/utils/navigation'
import type { PublicSettings } from '@/api/types'

// 沿用 useProfile-bind.test.ts 的既有惯例：整页跳转收口在 @/utils/navigation（jsdom 的
// window.location 不可重定义，直接断言跳转目标必须经由该模块 mock，而非 spy window.location.assign）
vi.mock('@/utils/navigation', () => ({
  navigateTo: vi.fn()
}))

const mockNavigate = vi.mocked(navigateTo)

function settingsWith(overrides: Partial<PublicSettings> = {}): PublicSettings {
  return {
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
    site_name: 'Test',
    ...overrides
  } as PublicSettings
}

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', component: { template: '<div/>' } },
      { path: '/:pathMatch(.*)*', component: { template: '<div/>' } }
    ]
  })
}

async function mountButton(query: string, overrides: Partial<PublicSettings> = {}) {
  const router = makeRouter()
  router.push(`/login${query}`)
  await router.isReady()
  setActivePinia(createPinia())
  useSettingsStore().settings = settingsWith(overrides)
  const wrapper = mount(OidcLoginButton, { global: { plugins: [router, i18n] } })
  await wrapper.vm.$nextTick()
  return wrapper
}

beforeEach(() => {
  mockNavigate.mockClear()
})

describe('OidcLoginButton', () => {
  it('开关关闭时不渲染', async () => {
    const wrapper = await mountButton('', { oidc_oauth_enabled: false })
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('开关开启时渲染按钮与分隔文案，按钮文案带 provider 名', async () => {
    const wrapper = await mountButton('', { oidc_oauth_enabled: true, oidc_oauth_provider_name: 'MintPop' })
    expect(wrapper.find('button').exists()).toBe(true)
    expect(wrapper.text()).toContain('使用 MintPop 账号登录')
    expect(wrapper.text()).toContain('或使用邮箱登录')
  })

  it('provider 名为空时兜底展示 mintpop', async () => {
    const wrapper = await mountButton('', { oidc_oauth_enabled: true, oidc_oauth_provider_name: '' })
    expect(wrapper.text()).toContain('使用 mintpop 账号登录')
  })

  it('点击按钮：整页跳转到 start 端点，redirect 取当前路由 query.redirect', async () => {
    const wrapper = await mountButton('?redirect=%2Fbilling', { oidc_oauth_enabled: true })
    await wrapper.find('button').trigger('click')
    expect(mockNavigate).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('/auth/oauth/oidc/start?redirect=%2Fbilling')
    )
  })

  it('无 redirect 查询参数时默认回跳 /dashboard', async () => {
    const wrapper = await mountButton('', { oidc_oauth_enabled: true })
    await wrapper.find('button').trigger('click')
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('/auth/oauth/oidc/start?redirect=%2Fdashboard')
    )
  })
})
