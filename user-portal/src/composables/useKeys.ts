import { ref, reactive } from 'vue'
import i18n from '@/i18n'
import * as keysApi from '@/api/keys'
import * as groupsApi from '@/api/groups'
import type { ApiKey, Group, ApiKeyUsageStat, CreateApiKeyRequest, UpdateApiKeyRequest } from '@/api/types'
import { errMessage } from '@/utils/error'

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
  const usage = ref<Record<string, ApiKeyUsageStat>>({})
  const loading = ref(false)
  const error = ref<string | null>(null)
  const loaded = ref(false)

  // 竞态守卫：翻页/改筛选连发请求时只让最后一次的响应落地
  let loadSeq = 0

  async function load() {
    const seq = ++loadSeq
    loading.value = true
    error.value = null
    try {
      const res = await keysApi.listKeys(page.value, pageSize.value, {
        search: filters.search || undefined,
        status: filters.status || undefined,
        group_id: filters.group_id || undefined
      })
      if (seq !== loadSeq) return
      rows.value = res.items
      total.value = res.total
      loaded.value = true
      // 批量用量（非关键，失败不阻断）
      try {
        const u = await keysApi.getKeysUsage(res.items.map((k) => k.id))
        if (seq === loadSeq) usage.value = u
      } catch {
        if (seq === loadSeq) usage.value = {}
      }
    } catch (e) {
      if (seq !== loadSeq) return // 已被更新的请求取代，过期失败不展示
      error.value = errMessage(e, i18n.global.t('common.loadFailed'))
    } finally {
      if (seq === loadSeq) loading.value = false
    }
  }

  async function loadGroups() {
    try {
      groups.value = await groupsApi.listAvailable()
    } catch {
      groups.value = []
    }
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
