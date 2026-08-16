// PortalLayout 是门户内页的「持久外壳」（嵌套路由的父级）。切 tab 时它必须保持挂载、
// 只换 <router-view> 里的内容区——这正是换页手感的根基，故这三条行为都要有回归保护：
//   1. 切路由不重挂布局（顶栏/公告铃铛不重建，也不重复拉 user/announcements）
//   2. tab 高亮在「导航一开始」就跟上，不等懒加载 chunk 落地（否则点击后有一段静止空窗）
//   3. 内容区滚动位置每次换页归零（滚动容器是 <main> 而非 window，router 的 scrollBehavior 管不到）
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { createI18n } from 'vue-i18n'
import { setActivePinia, createPinia } from 'pinia'
import PortalLayout from '../PortalLayout.vue'

vi.mock('@/api/user', () => ({ getProfile: vi.fn().mockResolvedValue({ username: 'u', email: 'e' }) }))
vi.mock('@/api/auth', () => ({ logout: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/api/announcements', () => ({ list: vi.fn().mockResolvedValue([]), markRead: vi.fn() }))

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: false,
  missingWarn: false,
  fallbackWarn: false,
  messages: { 'zh-CN': {} }
})

const Stub = { template: '<div class="view-stub" />' }

// 路由表刻意平铺：本用例直接 mount 布局本身，若再把它配成父路由，它内部的 router-view
// 会把自己当子组件重渲一层。平铺后 router-view 直接渲染视图 stub，对布局的行为等价。
// 五个 tab 的路径都要注册，否则 router-link 解析不到会刷 warn。
function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/dashboard', name: 'Dashboard', component: Stub },
      { path: '/subscriptions', name: 'Subscriptions', component: Stub },
      { path: '/usage', name: 'Usage', component: Stub },
      { path: '/keys', name: 'Keys', component: Stub },
      { path: '/pricing', name: 'Pricing', component: Stub },
      { path: '/docs/:slug?', name: 'Docs', component: Stub }
    ]
  })
}

async function mountLayout(router: Router) {
  router.push('/dashboard')
  await router.isReady()
  const wrapper = mount(PortalLayout, {
    global: { plugins: [router, i18n], stubs: { Transition: false } }
  })
  await flushPromises()
  return wrapper
}

// jsdom 没有布局，scrollTop 的赋值不会被保留，故改成记录「写入了哪些值」
function spyScrollTop(el: Element): number[] {
  const writes: number[] = []
  Object.defineProperty(el, 'scrollTop', {
    get: () => 0,
    set: (v: number) => void writes.push(v),
    configurable: true
  })
  return writes
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('PortalLayout 持久外壳', () => {
  it('切 tab 不重挂布局：user/announcements 不会随每次换页重复拉取', async () => {
    const { getProfile } = await import('@/api/user')
    const { list } = await import('@/api/announcements')
    const router = makeRouter()
    await mountLayout(router)

    const profileCalls = vi.mocked(getProfile).mock.calls.length
    const listCalls = vi.mocked(list).mock.calls.length

    await router.push('/keys')
    await flushPromises()

    // 换页后 getProfile 不该再来一次（布局没重挂）；公告有 store 内节流兜底，同样不应再发请求
    expect(vi.mocked(getProfile).mock.calls.length).toBe(profileCalls)
    expect(vi.mocked(list).mock.calls.length).toBe(listCalls)
  })

  it('tab 高亮在导航开始时就跟上，不等目标组件解析', async () => {
    const router = makeRouter()
    const wrapper = await mountLayout(router)

    const activeHrefs = () =>
      wrapper.findAll('nav a').filter((a) => a.classes().includes('tab-on')).map((a) => a.attributes('href'))

    expect(activeHrefs()).toContain('/dashboard')

    // 模拟「组件还没解析完」：卡住导航的最后一步，此时高亮已应切走
    let release: () => void = () => {}
    const gate = new Promise<void>((r) => (release = r))
    const stop = router.beforeResolve(async () => {
      await gate
    })

    const nav = router.push('/keys')
    // 导航停在 beforeResolve（相当于「目标组件还没解析完」），此刻高亮就该已经切走
    await flushPromises()

    expect(activeHrefs()).toContain('/keys')
    expect(activeHrefs()).not.toContain('/dashboard')

    release()
    await nav
    stop()
  })

  it('每次换页把内容区滚动位置归零', async () => {
    const router = makeRouter()
    const wrapper = await mountLayout(router)
    const writes = spyScrollTop(wrapper.find('main').element)

    await router.push('/keys')
    await flushPromises()
    expect(writes).toEqual([0])

    // /docs 内换文档时路由组件不变、换页过渡不触发，滚动同样必须归零
    await router.push('/docs/a')
    await flushPromises()
    writes.length = 0
    await router.push('/docs/b')
    await flushPromises()
    expect(writes).toEqual([0])
  })

  it('带锚点的深链不抢走视图内部的锚点滚动', async () => {
    const router = makeRouter()
    const wrapper = await mountLayout(router)
    const writes = spyScrollTop(wrapper.find('main').element)

    await router.push('/docs/a#section')
    await flushPromises()
    expect(writes).toEqual([])
  })
})
