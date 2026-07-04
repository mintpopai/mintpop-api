import { ref } from 'vue'
import i18n from '@/i18n'
import { getMyOrders, cancelOrder } from '@/api/payment'
import type { PaymentOrder } from '@/api/types'
import { errMessage } from '@/utils/error'
import { useLatestRequest } from '@/composables/useLatestRequest'

export function useOrders() {
  const rows = ref<PaymentOrder[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(20)
  const statusFilter = ref('')
  const search = ref('')
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
      const res = await getMyOrders({
        page: page.value,
        page_size: pageSize.value,
        status: statusFilter.value || undefined
      })
      if (!isLatest(seq)) return
      rows.value = res.items
      total.value = res.total
      loaded.value = true
    } catch (e) {
      if (!isLatest(seq)) return // 已被更新的请求取代，过期失败不展示
      error.value = errMessage(e, i18n.global.t('common.loadFailed'))
    } finally {
      if (isLatest(seq)) loading.value = false
    }
  }

  function setPage(n: number) {
    page.value = n
    load()
  }

  async function cancel(id: number) {
    await cancelOrder(id)
    await load()
  }

  return { rows, total, page, pageSize, statusFilter, search, loading, error, loaded, load, setPage, cancel }
}
