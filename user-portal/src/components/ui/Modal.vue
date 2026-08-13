<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    open: boolean
    title?: string
    /** 面板宽度：md=460px（默认）/ lg=640px / xl=720px */
    size?: 'md' | 'lg' | 'xl'
    /** 强确认弹窗：Esc 与点击遮罩都不关闭，必须点面板内的按钮（如强提醒公告） */
    persistent?: boolean
  }>(),
  { title: undefined, size: 'md', persistent: false }
)
const emit = defineEmits<{ close: [] }>()

// 无 title 时用通用词条兜底，保证屏幕阅读器始终能播报对话框名称
const ariaLabel = computed(() => props.title ?? t('ui.dialog'))

const panel = ref<HTMLElement | null>(null)
// 打开前的焦点元素，关闭时还焦
let lastFocused: HTMLElement | null = null

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    // persistent 时吞掉 Esc，但下面的 Tab 圈禁照常生效
    if (!props.persistent) emit('close')
    return
  }
  if (e.key !== 'Tab' || !panel.value) return
  // 极简焦点圈禁：Tab 只在弹窗内循环，不逃逸到底层页面
  const nodes = Array.from(panel.value.querySelectorAll<HTMLElement>(FOCUSABLE))
  if (nodes.length === 0) {
    e.preventDefault()
    return
  }
  const first = nodes[0]
  const last = nodes[nodes.length - 1]
  const active = document.activeElement as HTMLElement | null
  const inside = active ? panel.value.contains(active) : false
  if (e.shiftKey && (active === first || !inside)) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && (active === last || !inside)) {
    e.preventDefault()
    first.focus()
  }
}

function teardown() {
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
  lastFocused?.focus()
  lastFocused = null
}

watch(
  () => props.open,
  async (open, prev) => {
    if (open) {
      lastFocused = document.activeElement as HTMLElement | null
      document.body.style.overflow = 'hidden' // 锁定底层页面滚动
      window.addEventListener('keydown', onKey) // 只在打开期间监听，多实例互不叠加
      await nextTick()
      // 聚焦面板本身（tabindex=-1）：屏幕阅读器播报标题，Tab 从第一个控件开始
      panel.value?.focus()
    } else if (prev !== undefined) {
      teardown()
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (props.open) teardown()
})
</script>

<template>
  <!-- Teleport 到 body：不受祖先 transform/overflow/层叠上下文影响 -->
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        class="absolute inset-0 bg-black/40"
        @click="persistent || emit('close')"
      />
      <div
        ref="panel"
        role="dialog"
        aria-modal="true"
        :aria-label="ariaLabel"
        tabindex="-1"
        class="relative z-10 w-full rounded-xl4 bg-card p-7 shadow-menu outline-hidden"
        :class="size === 'xl' ? 'max-w-[720px]' : size === 'lg' ? 'max-w-[640px]' : 'max-w-[460px]'"
      >
        <h3
          v-if="title"
          class="mb-5 font-serif text-xl font-medium text-text"
        >
          {{ title }}
        </h3>
        <slot />
        <div class="mt-6 flex justify-end gap-3">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
