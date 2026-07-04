import { ref } from 'vue'

/** 提示类型：成功 / 失败（沿用主题 pos / neg 语义色） */
export type ToastType = 'SUCCESS' | 'ERROR'

/** 单条提示 */
export interface Toast {
  id: number
  type: ToastType
  message: string
}

// 模块级单例：全局共享一个提示队列，任意组件 push、ToastHost 统一渲染
const toasts = ref<Toast[]>([])
let seq = 0

// 各 toast 的自动消失定时器 handle：dismiss 时需 clearTimeout，
// 防止已手动/提前关闭的 toast 定时器仍在空跑；也为将来「hover 暂停自动消失」留出清理入口
// 注：显式标注 number（而非 ReturnType<typeof window.setTimeout>）——
// 项目同时装了 @types/node，globalThis 上 node 的 setTimeout 重载会让 ReturnType
// 推断出 NodeJS.Timeout，与浏览器 window.setTimeout 实际返回的 number 不一致
const timers = new Map<number, number>()

/** 默认停留时长（毫秒） */
const DEFAULT_DURATION = 3000

/** 移除指定提示 */
function dismiss(id: number) {
  const idx = toasts.value.findIndex((t) => t.id === id)
  if (idx !== -1) toasts.value.splice(idx, 1)
  const timer = timers.get(id)
  if (timer !== undefined) {
    window.clearTimeout(timer)
    timers.delete(id)
  }
}

/** 弹出一条提示，到时自动消失 */
function push(type: ToastType, message: string, duration = DEFAULT_DURATION) {
  const id = ++seq
  toasts.value.push({ id, type, message })
  timers.set(
    id,
    window.setTimeout(() => dismiss(id), duration)
  )
}

/**
 * 全局提示。任意组件调用 `const toast = useToast()` 后：
 * - `toast.success(msg)` 弹成功提示
 * - `toast.error(msg)` 弹失败提示
 */
export function useToast() {
  return {
    toasts,
    dismiss,
    success: (message: string) => push('SUCCESS', message),
    error: (message: string) => push('ERROR', message)
  }
}
