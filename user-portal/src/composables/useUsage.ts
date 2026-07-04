import { ref, reactive } from 'vue'
import i18n from '@/i18n'
import { queryUsage, getDashboardStats, type UsageQueryParams } from '@/api/usage'
import { listKeys } from '@/api/keys'
import type { UsageLog, UserDashboardStats, ApiKey } from '@/api/types'
import { toLocalDate } from '@/utils/format'
import { errMessage } from '@/utils/error'

export function useUsage() {
  const rows = ref<UsageLog[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(20)
  const stats = ref<UserDashboardStats | null>(null)
  const keys = ref<ApiKey[]>([])
  const filters = reactive({
    api_key_id: '' as number | '',
    start_date: toLocalDate(new Date(Date.now() - 6 * 86_400_000)),
    end_date: toLocalDate(new Date()),
  })
  const loading = ref(false)
  const error = ref<string | null>(null)
  const loaded = ref(false)

  function params(pageSizeOverride?: number): UsageQueryParams {
    return {
      page: page.value,
      page_size: pageSizeOverride ?? pageSize.value,
      api_key_id: filters.api_key_id === '' ? undefined : Number(filters.api_key_id),
      start_date: filters.start_date,
      end_date: filters.end_date,
      sort_by: 'created_at',
      sort_order: 'desc',
    }
  }

  // 竞态守卫：翻页/改筛选连发请求时只让最后一次的响应落地；旧列表请求直接取消
  let loadSeq = 0
  let loadAbort: AbortController | null = null

  async function load() {
    const seq = ++loadSeq
    loadAbort?.abort()
    loadAbort = new AbortController()
    loading.value = true
    error.value = null
    try {
      const [res, s] = await Promise.all([
        queryUsage(params(), { signal: loadAbort.signal }),
        getDashboardStats()
      ])
      if (seq !== loadSeq) return
      rows.value = res.items
      total.value = res.total
      stats.value = s
      loaded.value = true
    } catch (e) {
      if (seq !== loadSeq) return // 已被更新的请求取代（含主动取消），过期失败不展示
      error.value = errMessage(e, i18n.global.t('common.loadFailed'))
    } finally {
      if (seq === loadSeq) loading.value = false
    }
  }

  async function loadKeys() {
    try {
      keys.value = (await listKeys(1, 100)).items
    } catch {
      keys.value = []
    }
  }

  function setPage(n: number) {
    page.value = n
    load()
  }

  async function fetchForExport(): Promise<UsageLog[]> {
    // 导出语义是「当前筛选条件下的前 1000 条」，与浏览页码无关：
    // 必须强制 page:1，否则翻到第 2 页导出会带上 page=2（offset 1000），内容偏移甚至为空
    return (await queryUsage({ ...params(1000), page: 1 })).items
  }

  return {
    rows,
    total,
    page,
    pageSize,
    stats,
    keys,
    filters,
    loading,
    error,
    loaded,
    load,
    loadKeys,
    setPage,
    fetchForExport,
  }
}
