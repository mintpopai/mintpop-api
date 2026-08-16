import { describe, it, expect } from 'vitest'
import router from '@/router'

// 断言走 router.resolve 而不是翻 routes 数组：门户内页现在挂在 PortalLayout 父路由下（嵌套路由），
// 路径由父子拼接而成，只有解析结果才是「用户实际访问到的路径 + 合并后的 meta」。
describe('docs 路由', () => {
  it('注册了 Docs 命名路由，路径为 /docs/:slug?', () => {
    const docs = router.resolve({ name: 'Docs', params: {} })
    expect(docs.matched.at(-1)?.path).toBe('/docs/:slug?')
    expect(docs.meta.requiresAuth).toBe(true)
    expect(docs.meta.title).toBe('nav.docs')
  })

  it('带 slug 的深链能解析到 Docs', () => {
    const resolved = router.resolve('/docs/quickstart')
    expect(resolved.name).toBe('Docs')
    expect(resolved.params.slug).toBe('quickstart')
  })
})
