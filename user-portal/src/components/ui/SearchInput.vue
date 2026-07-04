<script setup lang="ts">
/**
 * 搜索框（放大镜图标 + input）：从 OrdersView.vue / KeysView.vue 抽出的逐字重复结构。
 * - 外层尺寸/间距类（如 max-w-[...] flex-1）经组件默认的 attrs 透传自动合并到根元素
 *   （根元素只有一个，Vue 默认行为已够用，无需额外 prop）。
 * - inputClass：两处历史实现的 input 自身外观类并不完全相同（Orders 用 input-base 工具类，
 *   Keys 手写 rounded/border 组合），组件不内置默认样式，由调用方原样传入，
 *   保证抽取前后视觉逐字节不变。
 * - change：转发原生 input change 事件。KeysView 借它在失焦/回车时才触发服务端重新拉取
 *   （避免每敲一个字符就打一次接口）；OrdersView 是纯前端即时过滤，不监听即可。
 * - 默认插槽：渲染在 input 之后、仍处于同一个 position:relative 容器内，
 *   供 OrdersView 放置绝对定位的搜索提示文案。
 */
defineProps<{
  placeholder: string
  inputClass?: string
}>()

defineEmits<{ change: [Event] }>()

// Vue 3.4+ 官方推荐的 v-model 宏：搜索关键字
const model = defineModel<string>({ required: true })
</script>

<template>
  <div class="relative">
    <svg
      class="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
    >
      <circle
        cx="11"
        cy="11"
        r="7"
      />
      <path d="M21 21l-4-4" />
    </svg>
    <input
      v-model="model"
      type="text"
      :class="inputClass"
      :placeholder="placeholder"
      :aria-label="placeholder"
      @change="$emit('change', $event)"
    >
    <slot />
  </div>
</template>
