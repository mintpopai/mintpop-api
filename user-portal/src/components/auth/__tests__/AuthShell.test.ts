// 认证页骨架的语言切换入口：登录前唯一的切换语言途径（登录后在 PortalLayout 用户菜单）。
// 覆盖三条契约：未锁定时渲染并显示对方语言名、点击后全局 locale 翻转、构建锁定单语言时不渲染。
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import AuthShell from '@/components/auth/AuthShell.vue'
import { useLocaleStore } from '@/stores/locale'

const BASE_PROPS = {
  kicker: 'kicker',
  headlinePre: 'pre',
  headlineMark: 'mark',
  headlineEnd: 'end',
  desc: 'desc'
}

function mountShell() {
  return mount(AuthShell, { props: BASE_PROPS, global: { plugins: [i18n] } })
}

/** 页面上的语言切换按钮（按文案定位，避免与插槽内其它按钮混淆） */
function localeButton(wrapper: ReturnType<typeof mountShell>) {
  return wrapper
    .findAll('button')
    .find((b) => b.text().includes('⇄'))
}

describe('AuthShell 语言切换入口', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    // i18n 是模块级单例，用例内的切换要复位，避免污染其它测试
    i18n.global.locale.value = 'zh-CN'
    localStorage.removeItem('locale')
  })

  it('未锁定时渲染切换按钮，且显示对方语言的原生名', () => {
    const wrapper = mountShell()
    const btn = localeButton(wrapper)
    expect(btn).toBeTruthy()
    // 当前 zh-CN → 按钮应展示 English
    expect(btn!.text()).toContain('English')
  })

  it('点击后全局 locale 翻转，按钮文案换成另一种语言', async () => {
    const wrapper = mountShell()
    await localeButton(wrapper)!.trigger('click')
    expect(i18n.global.locale.value).toBe('en-US')
    expect(localeButton(wrapper)!.text()).toContain('简体中文')
    // 再点一次切回来
    await localeButton(wrapper)!.trigger('click')
    expect(i18n.global.locale.value).toBe('zh-CN')
  })

  it('构建时锁定单语言（locked）则不渲染切换按钮', () => {
    // locked 由构建时常量导出，测试里直接改 store 状态模拟锁定构建
    const store = useLocaleStore()
    store.locked = true
    const wrapper = mountShell()
    expect(localeButton(wrapper)).toBeUndefined()
  })
})
