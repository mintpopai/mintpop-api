import { describe, it, expect, vi } from 'vitest'
import { ref, reactive } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { createI18n } from 'vue-i18n'
import { createPinia } from 'pinia'
import KeysView from '@/views/KeysView.vue'
import zhCN from '@/i18n/locales/zh-CN'

// 数据加载走真实 useKeys + mock API 太重，这里直接 mock composable：
// 本测试只关心「?guide=create 的引导接线」，密钥数据给空态即可
vi.mock('@/composables/useKeys', () => ({
  useKeys: () => ({
    rows: ref([]),
    total: ref(0),
    page: ref(1),
    pageSize: ref(20),
    filters: reactive({ search: '', status: '', group_id: '' }),
    groups: ref([]),
    groupRates: ref({}),
    usage: ref({}),
    loading: ref(false),
    error: ref(null),
    loaded: ref(true),
    load: vi.fn(),
    loadGroups: vi.fn(),
    setPage: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    toggle: vi.fn(),
    remove: vi.fn()
  })
}))

// 公开设置接口不发真请求
vi.mock('@/api/settings', () => ({
  getPublicSettings: vi.fn().mockResolvedValue({ api_base_url: '' })
}))

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/keys', name: 'Keys', component: KeysView }]
  })
}

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: { 'zh-CN': zhCN }
})

const stubs = {
  // 只断言 open prop 的透传，弹窗内部不在本测试范围
  CreateKeyModal: {
    props: ['open', 'groups'],
    template: '<div data-test="create-modal" :data-open="String(open)" />'
  }
}

async function mountView(path: string) {
  const router = makeRouter()
  router.push(path)
  await router.isReady()
  const wrapper = mount(KeysView, {
    global: { plugins: [router, i18n, createPinia()], stubs }
  })
  await flushPromises()
  return wrapper
}

describe('KeysView 创建密钥引导', () => {
  it('带 ?guide=create 进入时展示引导气泡并高亮创建按钮', async () => {
    const wrapper = await mountView('/keys?guide=create')

    const bubble = wrapper.find('[role="status"]')
    expect(bubble.exists()).toBe(true)
    expect(bubble.text()).toContain(zhCN.keys.guide.createHint)

    const btn = wrapper
      .findAll('button')
      .find((b) => b.text().includes(zhCN.keys.createKey))
    expect(btn).toBeTruthy()
    expect(btn!.classes()).toContain('guide-pulse')
  })

  it('点击创建按钮后打开创建弹窗并消除引导', async () => {
    const wrapper = await mountView('/keys?guide=create')

    const btn = wrapper
      .findAll('button')
      .find((b) => b.text().includes(zhCN.keys.createKey))!
    await btn.trigger('click')

    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(btn.classes()).not.toContain('guide-pulse')
    expect(wrapper.find('[data-test="create-modal"]').attributes('data-open')).toBe('true')
  })

  it('无 guide 参数时不展示引导', async () => {
    const wrapper = await mountView('/keys')
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })
})
