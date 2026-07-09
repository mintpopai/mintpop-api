import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import OnboardingView from '../OnboardingView.vue'

vi.mock('@/api/settings', () => ({
  getPublicSettings: vi.fn().mockResolvedValue({
    invitation_code_enabled: true,
    promo_code_enabled: true,
    affiliate_enabled: true
  })
}))
const completeMock = vi.fn().mockResolvedValue({ access_token: 'tok', redirect: '/dashboard' })
vi.mock('@/api/auth', () => ({
  onboardOidcAccount: (...a: unknown[]) => completeMock(...a),
  validatePromoCode: vi.fn().mockResolvedValue({ valid: true, bonus_amount: 5 }),
  validateInvitationCode: vi.fn().mockResolvedValue({ valid: true })
}))
// authStore.fetchUser() 内部调用 getProfile()（@/api/user），mock 掉避免 jsdom 真实 XHR
vi.mock('@/api/user', () => ({
  getProfile: vi.fn().mockResolvedValue({ id: 1, username: 'u', email: 'u@x.com', balance: 0 })
}))
vi.mock('@/utils/affiliateReferral', () => ({
  loadAffiliateReferralCode: vi.fn().mockReturnValue('AFF123'),
  pickAffiliateCode: vi.fn(),
  storeAffiliateReferralCode: vi.fn(),
  clearAffiliateReferralCode: vi.fn()
}))

const router = createRouter({ history: createWebHistory(), routes: [
  { path: '/onboarding', component: OnboardingView },
  { path: '/dashboard', component: { template: '<div/>' } }
]})

describe('OnboardingView', () => {
  beforeEach(() => { setActivePinia(createPinia()); completeMock.mockClear() })

  it('开关开启时，邀请码为空则拦截提交', async () => {
    await router.push('/onboarding'); await router.isReady()
    const wrapper = mount(OnboardingView, { global: { plugins: [router, i18n] }, attachTo: document.body })
    await flushPromises()
    await wrapper.find('[data-test="onboarding-submit"]').trigger('click')
    await flushPromises()
    expect(completeMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('邀请码')
  })

  it('填入邀请码后提交，携带 aff 回填值调用 onboardOidcAccount', async () => {
    await router.push('/onboarding'); await router.isReady()
    const wrapper = mount(OnboardingView, { global: { plugins: [router, i18n] }, attachTo: document.body })
    await flushPromises()
    await wrapper.find('[data-test="onboarding-invitation"]').setValue('INV-OK')
    await flushPromises()
    await wrapper.find('[data-test="onboarding-submit"]').trigger('click')
    await flushPromises()
    expect(completeMock).toHaveBeenCalledWith(
      expect.objectContaining({ invitation_code: 'INV-OK', aff_code: 'AFF123' })
    )
  })
})
