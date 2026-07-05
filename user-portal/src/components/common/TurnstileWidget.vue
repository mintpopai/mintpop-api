<script setup lang="ts">
// Cloudflare Turnstile 人机验证挂件（实现对齐主前端 frontend/src/components/TurnstileWidget.vue）。
// 站点开启 Turnstile 后，登录/注册/发验证码的请求都必须携带挑战 token，否则后端一律拒绝。
// 脚本从 challenges.cloudflare.com 动态加载（Cloudflare 域，全目标地区含大陆可达；
// 无法自托管——token 必须由 CF 挑战产生），仅在站点开启该功能时才会发起加载，不阻塞渲染。
import { ref, onMounted, onUnmounted, watch } from 'vue'

interface TurnstileRenderOptions {
  sitekey: string
  callback: (token: string) => void
  'expired-callback'?: () => void
  'error-callback'?: () => void
  theme?: 'light' | 'dark' | 'auto'
  size?: 'normal' | 'compact' | 'flexible'
}

interface TurnstileAPI {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string
  reset: (widgetId?: string) => void
  remove: (widgetId?: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileAPI
    onTurnstileLoad?: () => void
  }
}

const props = withDefaults(
  defineProps<{
    siteKey: string
    theme?: 'light' | 'dark' | 'auto'
    size?: 'normal' | 'compact' | 'flexible'
  }>(),
  { theme: 'auto', size: 'flexible' }
)

const emit = defineEmits<{
  /** 挑战通过，携带一次性 token（每次提交消费后须 reset 重新挑战） */
  verify: [token: string]
  /** token 过期（需重新挑战后才有新 token） */
  expire: []
  error: []
}>()

const containerRef = ref<HTMLElement | null>(null)
const scriptLoaded = ref(false)
let widgetId: string | null = null

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) {
      scriptLoaded.value = true
      resolve()
      return
    }
    // 已有同 src 脚本在加载中（如登录/注册页来回切换）：只挂回调等它就绪，不重复插入
    const existing = document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')
    window.onTurnstileLoad = () => {
      scriptLoaded.value = true
      resolve()
    }
    if (existing) return

    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad'
    script.async = true
    script.defer = true
    script.onerror = () => reject(new Error('Failed to load Turnstile script'))
    document.head.appendChild(script)
  })
}

function removeWidget() {
  if (window.turnstile && widgetId) {
    try {
      window.turnstile.remove(widgetId)
    } catch {
      // 挂件可能已随 DOM 卸载，移除失败无副作用
    }
    widgetId = null
  }
}

function renderWidget() {
  if (!window.turnstile || !containerRef.value || !props.siteKey) return
  removeWidget()
  containerRef.value.innerHTML = ''
  widgetId = window.turnstile.render(containerRef.value, {
    sitekey: props.siteKey,
    callback: (token: string) => emit('verify', token),
    'expired-callback': () => emit('expire'),
    'error-callback': () => emit('error'),
    theme: props.theme,
    size: props.size
  })
}

/** token 是一次性的：每次请求消费后由父组件调用 reset 重新挑战 */
function reset() {
  if (window.turnstile && widgetId) {
    window.turnstile.reset(widgetId)
  }
}

defineExpose({ reset })

onMounted(async () => {
  if (!props.siteKey) return
  try {
    await loadScript()
    renderWidget()
  } catch {
    emit('error')
  }
})

onUnmounted(removeWidget)

// siteKey 变化（公开设置晚于组件挂载到达）时补渲染
watch(
  () => props.siteKey,
  (key) => {
    if (key && scriptLoaded.value) renderWidget()
  }
)
</script>

<template>
  <div
    v-if="siteKey"
    class="w-full"
  >
    <div
      ref="containerRef"
      class="turnstile-container min-h-[65px] w-full"
    />
  </div>
</template>

<style scoped>
/* 让 Turnstile iframe 撑满容器宽度，与表单字段对齐 */
.turnstile-container :deep(iframe) {
  width: 100% !important;
}
</style>
