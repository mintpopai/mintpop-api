import { vi } from 'vitest'

// mock @/docs/loaders：让 loadDoc 立即 resolve（微任务），保留产品懒加载，只隔离 I/O 异步。
// DocsView 测试无需真实 fetch md 文件，但仍使用真实 renderMarkdown，确保 <h1> 断言有效。
vi.mock('@/docs/loaders', () => ({
  loadDoc: vi.fn().mockResolvedValue('# 快速开始'),
  hasDoc: vi.fn().mockReturnValue(true),
  docKey: vi.fn((slug: string, locale: string) => `./${slug}.${locale}.md`)
}))

import { loadDoc } from '@/docs/loaders'

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
import { DOCS, DOC_GROUPS } from '@/docs/_manifest'

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

function mountDocs(router: Router) {
  return mount(DocsView, {
    global: {
      plugins: [router, i18n]
    }
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('DocsView', () => {
  it('渲染分组标题、目录项与正文 HTML', async () => {
    const router = makeRouter()
    router.push(`/docs/${DOCS[0].slug}`)
    await router.isReady()
    const wrapper = mountDocs(router)
    await flushPromises()
    // 目录含一级分组标题与首篇二级标题（localeStore 默认 zh-CN）
    expect(wrapper.text()).toContain(DOC_GROUPS[0].title['zh-CN'])
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

describe('DocsView 图片点击放大', () => {
  it('点击正文图片打开全屏预览，Esc 关闭', async () => {
    // 本用例需要正文里有图片：覆盖一次 loadDoc 的返回
    vi.mocked(loadDoc).mockResolvedValueOnce('# 快速开始\n\n![示例图](/img/use-claude-code-api-key.png)')
    const router = makeRouter()
    router.push(`/docs/${DOCS[0].slug}`)
    await router.isReady()
    const wrapper = mountDocs(router)
    await flushPromises()

    // 还焦断言需要真实可聚焦元素：打开前把焦点放在 body 下的按钮上
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()
    try {
      // 点击正文图片 → Teleport 到 body 的 dialog 出现，大图 src 与被点图片一致
      await wrapper.get('.prose img').trigger('click')
      const dialog = document.body.querySelector('[role="dialog"]')
      expect(dialog).not.toBeNull()
      expect(dialog!.querySelector('img')?.getAttribute('src')).toContain('use-claude-code-api-key.png')

      // jsdom 点击不移焦，手动把焦点移走，使关闭时的还焦是真实动作而非 no-op
      trigger.blur()

      // Esc → 预览关闭
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      await flushPromises()
      expect(document.body.querySelector('[role="dialog"]')).toBeNull()
      // 关闭后焦点还原到打开前的元素（ImageLightbox 的 lastFocused 还焦逻辑）
      expect(document.activeElement).toBe(trigger)
    } finally {
      // 断言失败也要清理：移除 trigger、卸载 Teleport 内容（挂在 document.body），避免污染后续用例
      trigger.remove()
      wrapper.unmount()
    }
  })

  it('点击遮罩任意处关闭预览', async () => {
    vi.mocked(loadDoc).mockResolvedValueOnce('# 快速开始\n\n![示例图](/img/use-claude-code-api-key.png)')
    const router = makeRouter()
    router.push(`/docs/${DOCS[0].slug}`)
    await router.isReady()
    const wrapper = mountDocs(router)
    await flushPromises()

    await wrapper.get('.prose img').trigger('click')
    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')
    expect(dialog).not.toBeNull()

    // 点击遮罩层（整层任意处均可关闭）
    dialog!.click()
    await flushPromises()
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    wrapper.unmount()
  })
})
