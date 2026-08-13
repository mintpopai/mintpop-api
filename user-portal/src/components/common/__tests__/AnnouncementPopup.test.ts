// 强提醒公告的核心约束：必须点「我知道了」才关闭。
// Esc 与点遮罩都不能关（靠 Modal 的 persistent），否则重要通知会被随手点掉且直接标成已读。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { setActivePinia, createPinia } from 'pinia'
import AnnouncementPopup from '../AnnouncementPopup.vue'
import { useAnnouncementStore } from '@/stores/announcements'
import type { UserAnnouncement } from '@/api/types'

vi.mock('@/api/announcements', () => ({
  list: vi.fn(),
  markRead: vi.fn()
}))

import * as announcementsApi from '@/api/announcements'

const mockList = vi.mocked(announcementsApi.list)
const mockMarkRead = vi.mocked(announcementsApi.markRead)

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: false,
  missingWarn: false,
  fallbackWarn: false,
  messages: { 'zh-CN': {}, 'en-US': {} }
})

// 每次现造：store 的 markAsRead 会就地改 read_at，共用同一个对象会把已读状态串到下一个用例
function makePopup(): UserAnnouncement {
  return {
    id: 42,
    title: '维护通知',
    content: '# 停机维护\n\n今晚 02:00 起。',
    notify_mode: 'popup',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  }
}

async function mountWithPopup() {
  mockList.mockResolvedValue([makePopup()])
  const store = useAnnouncementStore()
  await store.fetchAnnouncements()
  const wrapper = mount(AnnouncementPopup, { global: { plugins: [i18n] }, attachTo: document.body })
  await nextTick()
  return { wrapper, store }
}

beforeEach(() => {
  setActivePinia(createPinia())
  document.body.innerHTML = ''
  mockList.mockReset()
  mockMarkRead.mockReset()
  mockMarkRead.mockResolvedValue(undefined)
})

describe('AnnouncementPopup', () => {
  it('有待弹公告时渲染标题与 markdown 正文', async () => {
    const { wrapper } = await mountWithPopup()
    expect(document.body.textContent).toContain('维护通知')
    expect(document.body.innerHTML).toContain('<h1>停机维护</h1>')
    wrapper.unmount()
  })

  it('点「我知道了」才收起并标已读', async () => {
    const { wrapper, store } = await mountWithPopup()
    const btn = document.querySelector<HTMLElement>('[data-testid="announcement-popup-dismiss"]')
    expect(btn).not.toBeNull()

    btn!.click()
    await nextTick()

    expect(store.currentPopup).toBeNull()
    expect(mockMarkRead).toHaveBeenCalledWith(42)
    wrapper.unmount()
  })

  it('按 Esc 不关闭（persistent）', async () => {
    const { wrapper, store } = await mountWithPopup()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()

    expect(store.currentPopup?.id).toBe(42)
    expect(mockMarkRead).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('无待弹公告时不渲染任何弹窗', () => {
    const wrapper = mount(AnnouncementPopup, { global: { plugins: [i18n] }, attachTo: document.body })
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    wrapper.unmount()
  })
})
