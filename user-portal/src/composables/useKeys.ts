import { ref, reactive } from 'vue'
import i18n from '@/i18n'
import * as keysApi from '@/api/keys'
import * as groupsApi from '@/api/groups'
import type { ApiKey, Group, ApiKeyUsageStat, CreateApiKeyRequest, UpdateApiKeyRequest } from '@/api/types'
import { errMessage } from '@/utils/error'
import { useLatestRequest } from '@/composables/useLatestRequest'

export function useKeys() {
  const rows = ref<ApiKey[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(20)
  const filters = reactive<{ search: string; status: string; group_id: string }>({
    search: '',
    status: '',
    group_id: ''
  })
  const groups = ref<Group[]>([])
  // 用户专属分组倍率（group_id → 倍率）；有值且与分组默认不同的分组按专属倍率计费
  const groupRates = ref<Record<number, number>>({})
  const usage = ref<Record<string, ApiKeyUsageStat>>({})
  const loading = ref(false)
  const error = ref<string | null>(null)
  const loaded = ref(false)

  // 竞态守卫：翻页/改筛选连发请求时只让最后一次的响应落地
  const { next, isLatest } = useLatestRequest()

  async function load() {
    const { seq } = next()
    loading.value = true
    error.value = null
    try {
      const res = await keysApi.listKeys(page.value, pageSize.value, {
        search: filters.search || undefined,
        status: filters.status || undefined,
        group_id: filters.group_id || undefined
      })
      if (!isLatest(seq)) return
      rows.value = res.items
      total.value = res.total
      loaded.value = true
      // 批量用量（非关键，失败不阻断）
      try {
        const u = await keysApi.getKeysUsage(res.items.map((k) => k.id))
        if (isLatest(seq)) usage.value = u
      } catch {
        if (isLatest(seq)) usage.value = {}
      }
    } catch (e) {
      if (!isLatest(seq)) return // 已被更新的请求取代，过期失败不展示
      error.value = errMessage(e, i18n.global.t('common.loadFailed'))
    } finally {
      if (isLatest(seq)) loading.value = false
    }
  }

  async function loadGroups() {
    // 分组与专属倍率并行拉取；两者都是非关键数据，失败各自降级（无分组列表 / 无专属倍率）
    const [gs, rates] = await Promise.all([
      groupsApi.listAvailable().catch(() => [] as Group[]),
      groupsApi.getUserGroupRates().catch(() => ({}) as Record<number, number>)
    ])
    groups.value = gs
    groupRates.value = rates
  }

  function setPage(n: number) {
    page.value = n
    load()
  }

  async function create(p: CreateApiKeyRequest) {
    const k = await keysApi.createKey(p)
    await load()
    return k
  }

  async function update(id: number, patch: UpdateApiKeyRequest) {
    await keysApi.updateKey(id, patch)
    await load()
  }

  async function toggle(id: number, status: 'active' | 'inactive') {
    await keysApi.toggleKeyStatus(id, status)
    await load()
  }

  async function remove(id: number) {
    await keysApi.deleteKey(id)
    await load()
  }

  return {
    rows,
    total,
    page,
    pageSize,
    filters,
    groups,
    groupRates,
    usage,
    loading,
    error,
    loaded,
    load,
    loadGroups,
    setPage,
    create,
    update,
    toggle,
    remove
  }
}
