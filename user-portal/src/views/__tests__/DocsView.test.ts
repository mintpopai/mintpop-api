import { vi } from 'vitest'

// mock @/docs/loaders：让 loadDoc 立即 resolve（微任务），保留产品懒加载，只隔离 I/O 异步。
// DocsView 测试无需真实 fetch md 文件，但仍使用真实 renderMarkdown，确保 <h1> 断言有效。
vi.mock('@/docs/loaders', () => ({
  loadDoc: vi.fn().mockResolvedValue('# 快速开始'),
  hasDoc: vi.fn().mockReturnValue(true),
  docKey: vi.fn((slug: string, locale: string) => `./${slug}.${locale}.md`)
}))

// mock 公开设置接口：DocsView 渲染前会 ensureLoaded（供占位符取 api_base_url），
// 不 mock 会在 jsdom 里发真实 XHR（虽被 store 吞掉，但产生告警噪声）
vi.mock('@/api/settings', () => ({
  getPublicSettings: vi.fn().mockResolvedValue({ api_base_url: 'https://api.example.com' })
}))

import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import DocsView from '@/views/DocsView.vue'
import { DOCS } from '@/docs/_manifest'

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/docs/:slug?', name: 'Docs', component: DocsView },
      { path: '/', component: { template: '<div/>' } }
    ]
  })
}

// store 的当前语言由 test-setup.ts 的全局单例重置决定（默认 zh-CN），
// 此处 createI18n 的 locale 仅供组件内 $t/翻译，不影响 useLocaleStore。
const i18n = createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': {}, 'en-US': {} } })

// stub 掉 PortalLayout：只透传默认插槽，隔离 DocsView 与布局的重依赖（auth 网络请求等）
const PortalLayoutStub = { template: '<div><slot /></div>' }

function mountDocs(router: Router) {
  return mount(DocsView, {
    global: {
      plugins: [router, i18n],
      stubs: { PortalLayout: PortalLayoutStub }
    }
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('DocsView', () => {
  it('渲染目录项与正文 HTML', async () => {
    const router = makeRouter()
    router.push('/docs/quick-start')
    await router.isReady()
    const wrapper = mountDocs(router)
    await flushPromises()
    // 目录含首篇标题（localeStore 默认 zh-CN）
    expect(wrapper.text()).toContain(DOCS[0].title['zh-CN'])
    // 正文渲染出 markdown 的 h1
    expect(wrapper.html()).toContain('<h1>')
  })

  it('无 slug 时回退首篇', async () => {
    const router = makeRouter()
    router.push('/docs')
    await router.isReady()
    const wrapper = mountDocs(router)
    await flushPromises()
    expect(wrapper.html()).toContain('<h1>')
  })

  it('非法 slug 时 replace 到首篇文档路由，URL 与渲染内容一致', async () => {
    const router = makeRouter()
    router.push('/docs/not-a-real-doc')
    await router.isReady()
    const wrapper = mountDocs(router)
    await flushPromises()
    // URL 被纠正为首篇 slug，而非停留在非法 slug 上
    expect(router.currentRoute.value.fullPath).toBe(`/docs/${DOCS[0].slug}`)
    expect(wrapper.html()).toContain('<h1>')
  })
})
