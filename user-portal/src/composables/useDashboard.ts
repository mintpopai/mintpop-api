import { ref } from 'vue'
import i18n from '@/i18n'
import {
  getDashboardStats,
  getDashboardTrend,
  getDashboardModels,
  getRecentUsage
} from '@/api/usage'
import type {
  UserDashboardStats,
  TrendDataPoint,
  ModelStat,
  UsageLog
} from '@/api/types'
import { toLocalDate } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import { errMessage } from '@/utils/error'

/** Dashboard 数据加载与状态管理 */
export function useDashboard() {
  const authStore = useAuthStore()

  const stats = ref<UserDashboardStats | null>(null)
  const trend = ref<TrendDataPoint[]>([])
  const models = ref<ModelStat[]>([])
  const recent = ref<UsageLog[]>([])

  const loading = ref(false)
  const error = ref<string | null>(null)

  // 默认近 7 天
  const endDate = ref(toLocalDate(new Date()))
  const startDate = ref(toLocalDate(new Date(Date.now() - 6 * 86_400_000)))

  // 竞态守卫：切换日期区间连发请求时只让最后一次的响应落地
  let loadSeq = 0

  async function loadAll(): Promise<void> {
    const seq = ++loadSeq
    loading.value = true
    error.value = null
    try {
      const [s, t, m] = await Promise.all([
        authStore.fetchUser().then(() => getDashboardStats()),
        getDashboardTrend({
          start_date: startDate.value,
          end_date: endDate.value,
          granularity: 'day'
        }),
        getDashboardModels({ start_date: startDate.value, end_date: endDate.value })
      ])
      if (seq !== loadSeq) return
      stats.value = s
      trend.value = t.trend || []
      models.value = m.models || []
      // 最近使用记录单独加载，失败不影响主体
      try {
        const r = await getRecentUsage(startDate.value, endDate.value, 5)
        if (seq === loadSeq) recent.value = r.items || []
      } catch {
        if (seq === loadSeq) recent.value = []
      }
    } catch (e) {
      if (seq !== loadSeq) return // 已被更新的请求取代，过期失败不展示
      error.value = errMessage(e, i18n.global.t('common.loadFailed'))
      console.error('加载 Dashboard 失败:', e)
    } finally {
      if (seq === loadSeq) loading.value = false
    }
  }

  return {
    stats,
    trend,
    models,
    recent,
    loading,
    error,
    startDate,
    endDate,
    loadAll
  }
}
