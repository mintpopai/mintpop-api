import { vi } from 'vitest'

vi.mock('@/api/auth', () => ({
  resetPassword: vi.fn()
}))

import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import ResetPasswordView from '@/views/ResetPasswordView.vue'
import { resetPassword } from '@/api/auth'

const mockReset = vi.mocked(resetPassword)

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/reset-password', component: ResetPasswordView },
      { path: '/forgot-password', component: { template: '<div/>' } },
      { path: '/login', component: { template: '<div/>' } },
      { path: '/:pathMatch(.*)*', component: { template: '<div/>' } }
    ]
  })
}

async function mountView(url = '/reset-password?email=a%40b.com&token=tok-1') {
  const router = makeRouter()
  router.push(url)
  await router.isReady()
  const wrapper = mount(ResetPasswordView, { global: { plugins: [router, i18n] } })
  await flushPromises()
  return wrapper
}

async function fillAndSubmit(
  wrapper: Awaited<ReturnType<typeof mountView>>,
  password: string,
  confirm: string
) {
  await wrapper.find('#reset-password').setValue(password)
  await wrapper.find('#reset-confirm').setValue(confirm)
  await wrapper.find('form').trigger('submit.prevent')
  await flushPromises()
}

beforeEach(() => {
  setActivePinia(createPinia())
  mockReset.mockReset()
})

describe('ResetPasswordView', () => {
  it('链接缺 email/token：展示无效链接态，无表单', async () => {
    const wrapper = await mountView('/reset-password')
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).toContain('重置链接无效')
  })

  it('密码不足 6 位：不发请求', async () => {
    const wrapper = await mountView()
    await fillAndSubmit(wrapper, '123', '123')
    expect(mockReset).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('密码至少 6 位')
  })

  it('两次输入不一致：不发请求', async () => {
    const wrapper = await mountView()
    await fillAndSubmit(wrapper, '123456', '654321')
    expect(mockReset).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('两次输入的密码不一致')
  })

  it('提交成功：按 query 参数调接口并切到成功态', async () => {
    mockReset.mockResolvedValue(undefined)
    const wrapper = await mountView()
    await fillAndSubmit(wrapper, '123456', '123456')
    expect(mockReset).toHaveBeenCalledWith({
      email: 'a@b.com',
      token: 'tok-1',
      new_password: '123456'
    })
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).toContain('密码重置成功')
  })

  it('后端回 INVALID_RESET_TOKEN：展示专门文案', async () => {
    mockReset.mockRejectedValue({
      status: 400,
      code: 400,
      reason: 'INVALID_RESET_TOKEN',
      message: 'invalid or expired password reset token'
    })
    const wrapper = await mountView()
    await fillAndSubmit(wrapper, '123456', '123456')
    expect(wrapper.text()).toContain('重置链接已失效或过期，请重新申请')
  })

  it('其它失败：内联展示后端 message', async () => {
    mockReset.mockRejectedValue({ status: 500, code: 500, message: '服务暂不可用' })
    const wrapper = await mountView()
    await fillAndSubmit(wrapper, '123456', '123456')
    expect(wrapper.text()).toContain('服务暂不可用')
  })
})
