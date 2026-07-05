<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    /** 大图地址：null 即关闭，非 null 即打开 */
    src: string | null
    alt?: string
  }>(),
  { alt: '' }
)
const emit = defineEmits<{ close: [] }>()

// alt 为空时用通用词条兜底，保证屏幕阅读器始终能播报对话框名称（与 Modal 同策略）
const ariaLabel = computed(() => props.alt || t('ui.dialog'))

// 打开前的焦点元素，关闭时还焦（与 Modal 的 lastFocused 模式一致）
let lastFocused: HTMLElement | null = null

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

function teardown() {
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
  lastFocused?.focus()
  lastFocused = null
}

watch(
  () => props.src,
  (src, prev) => {
    if (src && !prev) {
      lastFocused = document.activeElement as HTMLElement | null
      document.body.style.overflow = 'hidden' // 锁定底层页面滚动
      window.addEventListener('keydown', onKey) // 只在打开期间监听
    } else if (!src && prev) {
      teardown()
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (props.src) teardown()
})
</script>

<template>
  <!-- Teleport 到 body：不受祖先 transform/overflow/层叠上下文影响（与 Modal 同策略） -->
  <Teleport to="body">
    <!-- 看图场景遮罩比 Modal 更深（black/80），整层任意处点击即关闭 -->
    <div
      v-if="src"
      role="dialog"
      aria-modal="true"
      :aria-label="ariaLabel"
      class="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/80 p-4"
      @click="emit('close')"
    >
      <img
        :src="src"
        :alt="alt"
        class="max-h-[92vh] max-w-[92vw] rounded-xl2 object-contain"
      >
    </div>
  </Teleport>
</template>
