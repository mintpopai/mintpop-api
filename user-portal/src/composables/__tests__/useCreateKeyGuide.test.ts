import { describe, it, expect } from 'vitest'
import { defineComponent } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { useCreateKeyGuide } from '@/composables/useCreateKeyGuide'

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/keys', name: 'Keys', component: { template: '<div />' } }]
  })
}

/** 在带路由的组件上下文中执行 composable，返回其结果与 router */
async function setup(path: string) {
  const router = makeRouter()
  router.push(path)
  await router.isReady()

  let guide!: ReturnType<typeof useCreateKeyGuide>
  const Host = defineComponent({
    setup() {
      guide = useCreateKeyGuide()
      return () => null
    }
  })
  mount(Host, { global: { plugins: [router] } })
  await flushPromises()
  return { guide, router }
}

describe('useCreateKeyGuide', () => {
  it('带 ?guide=create 进入时激活引导，并消费掉该 query 参数', async () => {
    const { guide, router } = await setup('/keys?guide=create')
    expect(guide.active.value).toBe(true)
    expect(router.currentRoute.value.query.guide).toBeUndefined()
  })

  it('消费 guide 参数时保留其余 query', async () => {
    const { guide, router } = await setup('/keys?guide=create&from=doc')
    expect(guide.active.value).toBe(true)
    expect(router.currentRoute.value.query).toEqual({ from: 'doc' })
  })

  it('无 guide 参数时不激活、不改写路由', async () => {
    const { guide, router } = await setup('/keys?from=doc')
    expect(guide.active.value).toBe(false)
    expect(router.currentRoute.value.query).toEqual({ from: 'doc' })
  })

  it('guide 取值不是 create 时不激活', async () => {
    const { guide } = await setup('/keys?guide=other')
    expect(guide.active.value).toBe(false)
  })

  it('dismiss 后引导关闭', async () => {
    const { guide } = await setup('/keys?guide=create')
    guide.dismiss()
    expect(guide.active.value).toBe(false)
  })
})
