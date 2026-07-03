import { ref, onBeforeUnmount } from 'vue'
import { useToast } from '@/composables/useToast'
import i18n from '@/i18n'

/**
 * 剪贴板复制 + 「已复制」短暂反馈（收口自 KeyTable / CreateKeyModal / UseKeyModal 三处重复实现）。
 * - copiedKey 记录最近一次复制的标识（行 id / 文件索引等），模板据此高亮对应按钮
 * - 复制失败 toast 提示（此前静默失败，剪贴板权限被拒时用户零反馈）
 * - 反馈定时器随组件卸载清理
 */
export function useCopy(resetMs = 1500) {
  const toast = useToast()
  const copiedKey = ref<string | number | null>(null)
  let timer: ReturnType<typeof setTimeout> | null = null

  async function copy(text: string, key: string | number = 0): Promise<void> {
    try {
      await navigator.clipboard.writeText(text)
      copiedKey.value = key
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        copiedKey.value = null
        timer = null
      }, resetMs)
    } catch {
      toast.error(i18n.global.t('common.copyFailed'))
    }
  }

  /** 立即清除「已复制」反馈（如弹窗重置表单时） */
  function reset(): void {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    copiedKey.value = null
  }

  onBeforeUnmount(() => {
    if (timer) clearTimeout(timer)
  })

  return { copiedKey, copy, reset }
}
