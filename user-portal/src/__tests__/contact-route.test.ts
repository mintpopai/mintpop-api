import { describe, it, expect } from 'vitest'
import { routes } from '@/router'

describe('contact 路由', () => {
  it('注册了 Contact 命名路由，路径为 /contact 且需登录', () => {
    const contact = routes.find((r) => r.name === 'Contact')
    expect(contact).toBeTruthy()
    expect(contact?.path).toBe('/contact')
    expect(contact?.meta?.requiresAuth).toBe(true)
    expect(contact?.meta?.title).toBe('nav.contact')
  })
})
