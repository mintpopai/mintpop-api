/**
 * 订阅（套餐）store。
 *
 * 两个要点：
 * - **60 秒缓存 + in-flight 去重**：仪表盘的到期横幅、订阅概览与「我的套餐」页会各自调
 *   ensureLoaded，没有这两层就会同帧打三次接口、切页再打一次。
 * - **失败不写时间戳**：请求失败不更新 lastFetchedAt，下次调用立即重试；同时置 error，
 *   让套餐页把「加载失败」与「没有套餐」区分开。
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getMySubscriptions } from '@/api/subscriptions'
import type { UserSubscription } from '@/api/types'
import { sortSubscriptions, isActive, daysRemaining, EXPIRY_SOON_DAYS } from '@/utils/subscription'
import { errMessage } from '@/utils/error'
import i18n from '@/i18n'

/** 缓存窗口：60 秒内不重复请求 */
const CACHE_TTL_MS = 60_000

export const useSubscriptionsStore = defineStore('subscriptions', () => {
  const items = ref<UserSubscription[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref('')
  const lastFetchedAt = ref(0)

  // 进行中的请求，用于并发去重；不需要响应式
  let inflight: Promise<void> | null = null

  // 请求代次：只有最后发出的那次可以写回状态。refresh(force) 会在旧请求未回时另发一次，
  // 若不加这道守卫，先发（数据更旧）的响应后到就会把新数据盖掉——正是刚下单完那一刻的场景。
  let generation = 0

  const sorted = computed(() => sortSubscriptions(items.value))
  const activeItems = computed(() => items.value.filter((s) => isActive(s)))
  const expiringSoon = computed(() =>
    activeItems.value
      .filter((s) => daysRemaining(s.expires_at) <= EXPIRY_SOON_DAYS)
      .sort((a, b) => daysRemaining(a.expires_at) - daysRemaining(b.expires_at))
  )

  async function fetchAll(): Promise<void> {
    const gen = ++generation
    loading.value = true
    error.value = ''
    try {
      const data = await getMySubscriptions()
      if (gen !== generation) return // 已被更新的请求取代，丢弃这份过期响应
      items.value = data
      loaded.value = true
      lastFetchedAt.value = Date.now()
    } catch (e) {
      if (gen !== generation) return
      // 不写 lastFetchedAt：下次调用不会被缓存挡住，可立即重试
      error.value = errMessage(e, i18n.global.t('subscriptions.loadFailed'))
    } finally {
      // 过期请求不得把 loading 提前翻回 false（新请求还在飞）
      if (gen === generation) loading.value = false
    }
  }

  /**
   * 发起一次拉取。默认复用进行中的请求（去重）；force 时必发新请求。
   *
   * force 不是可有可无的：订阅下单成功后调 refresh() 时，页面挂载时那次 ensureLoaded()
   * 可能还没回来——它是在订阅生效**之前**发出的，搭车复用等于把过期结果又缓存 60 秒，
   * 恰好毁掉「刚买完就能在我的套餐里看到」这个 refresh() 存在的理由。
   */
  function run(force = false): Promise<void> {
    if (inflight && !force) return inflight
    // 只有「自己仍是当前请求」时才清 inflight：force 覆盖后，旧请求先回来也不能把新的清掉
    const p: Promise<void> = fetchAll().finally(() => {
      if (inflight === p) inflight = null
    })
    inflight = p
    return p
  }

  /** 缓存有效则直接返回，否则拉取；并发调用共享同一次请求 */
  async function ensureLoaded(): Promise<void> {
    if (inflight) return inflight
    if (loaded.value && Date.now() - lastFetchedAt.value < CACHE_TTL_MS) return
    await run()
  }

  /** 强制刷新（忽略缓存，也不搭车复用进行中的请求） */
  async function refresh(): Promise<void> {
    lastFetchedAt.value = 0
    await run(true)
  }

  /**
   * 退出登录时清空，避免换账号后看到上一个用户的分组名 / 额度用量 / 到期日。
   * 必须一并清 lastFetchedAt 与 inflight：SPA 退出不刷新页面，Pinia 状态存活，
   * 只清 items 的话下一个用户仍会在 60 秒缓存窗口内被挡住、根本不发请求。
   */
  function reset(): void {
    items.value = []
    loading.value = false
    loaded.value = false
    error.value = ''
    lastFetchedAt.value = 0
    inflight = null
    // 作废尚未回来的请求，否则上一个用户的响应会写进下一个用户的界面
    generation++
  }

  return {
    items,
    loading,
    loaded,
    error,
    sorted,
    activeItems,
    expiringSoon,
    ensureLoaded,
    refresh,
    reset
  }
})
