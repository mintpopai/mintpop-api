// 订阅确认弹窗的四条契约：
// 1. 支付方式必须以「一行一项」渲染——这块曾把充值页的三列卡片塞进 460px 弹窗，
//    列宽不足导致中文被压成竖排，是肉眼可见的破版，故钉死单列且不带自己的白卡外壳；
// 2. 主按钮带上金额（用户在点下去之前要知道扣多少钱）；
// 3. 未选支付方式时主按钮禁用，不能让用户提交出一个必然失败的订单；
// 4. 有效期本地化，不出现「30days」这种中英混排。
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import type { SubscriptionPlan } from '@/api/types'
import type { PayOption } from '@/config/payMethods'
import SubscribeConfirmModal from '../SubscribeConfirmModal.vue'
import zhCN from '@/i18n/locales/zh-CN'

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: false,
  missingWarn: false,
  fallbackWarn: false,
  messages: { 'zh-CN': zhCN }
})

const PAY_OPTIONS: PayOption[] = [
  { key: 'stripe:wxpay', paymentType: 'stripe', subMethod: 'wxpay', limitsKey: 'stripe' },
  { key: 'stripe:alipay', paymentType: 'stripe', subMethod: 'alipay', limitsKey: 'stripe' },
  { key: 'stripe:card', paymentType: 'stripe', subMethod: 'card', limitsKey: 'stripe' }
]

function makePlan(over: Partial<SubscriptionPlan> = {}): SubscriptionPlan {
  return {
    id: 1,
    group_id: 42,
    group_name: 'Lite 套餐',
    group_platform: 'anthropic',
    name: 'Lite 套餐（Claudecode/Desktop）',
    price: 7.5,
    original_price: 40,
    validity_days: 30,
    validity_unit: 'days',
    ...over
  }
}

function mountModal(props: Record<string, unknown> = {}) {
  return mount(SubscribeConfirmModal, {
    props: {
      open: true,
      plan: makePlan(),
      payOptions: PAY_OPTIONS,
      method: 'stripe:wxpay',
      ...props
    },
    global: { plugins: [i18n] },
    attachTo: document.body
  })
}

describe('SubscribeConfirmModal', () => {
  it('支付方式为单列一行一项，且不再套一层白卡外壳', () => {
    const wrapper = mountModal()
    const group = document.body.querySelector('[role="radiogroup"]')!
    expect(group.querySelectorAll('[role="radio"]')).toHaveLength(3)
    // 单列：不带任何 grid-cols-3（含容器查询变体），否则窄弹窗里列宽不足会把中文压成竖排
    expect(group.className).not.toMatch(/grid-cols-3/)
    // 无卡片外壳：picker 自己的标题与白卡阴影都不出现（弹窗已有标题，重复即卡中卡）
    expect(document.body.querySelectorAll('.shadow-card')).toHaveLength(0)
    wrapper.unmount()
  })

  it('主按钮带上应付金额', () => {
    const wrapper = mountModal()
    expect(document.body.textContent).toContain('支付 $7.50')
    wrapper.unmount()
  })

  it('未选支付方式时主按钮禁用', () => {
    const wrapper = mountModal({ method: '' })
    const buttons = Array.from(document.body.querySelectorAll('button'))
    const confirm = buttons[buttons.length - 1]
    expect(confirm.hasAttribute('disabled')).toBe(true)
    wrapper.unmount()
  })

  it('有效期按当前语言展示，不出现「30days」中英混排', () => {
    const wrapper = mountModal()
    expect(document.body.textContent).toContain('30天')
    expect(document.body.textContent).not.toContain('30days')
    wrapper.unmount()
  })
})
