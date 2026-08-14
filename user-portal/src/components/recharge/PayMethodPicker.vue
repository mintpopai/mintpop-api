<script setup lang="ts">
import { computed, ref, type ComponentPublicInstance } from 'vue'
import { nextRadioIndex } from '@/composables/useRadioGroupKeyboard'
import type { PayOption } from '@/config/payMethods'

const props = withDefaults(
  defineProps<{
    /** 拍平后的可选支付选项（useRecharge.payOptions，Stripe 已展开为微信/支付宝/银行卡） */
    options: PayOption[]
    /**
     * 展示形态：
     * - `card`（默认）：独立白卡，自带标题与安全提示，用于充值页整块区域；
     * - `plain`：无外壳、无标题的紧凑单列，用于弹窗等窄容器（外壳与标题由使用方给，避免卡中卡）。
     */
    variant?: 'card' | 'plain'
  }>(),
  { variant: 'card' }
)

// Vue 3.4+ 官方推荐的 v-model 宏（取值为 PayOption.key）
const model = defineModel<string>({ required: true })

// 展示配置按「视觉种类」取：Stripe 子方式与直连同名通道共用同一套图标文案
type DisplayKind = 'wxpay' | 'alipay' | 'card'
const DISPLAY_CONFIG: Record<DisplayKind, { labelKey: string; descKey: string; color: string; iconType: 'wechat' | 'alipay' | 'card' }> = {
  wxpay: { labelKey: 'recharge.methodWxpay', descKey: 'recharge.methodScanDesc', color: '#09BB07', iconType: 'wechat' },
  alipay: { labelKey: 'recharge.methodAlipay', descKey: 'recharge.methodScanDesc', color: '#1677FF', iconType: 'alipay' },
  card: { labelKey: 'recharge.methodCard', descKey: 'recharge.methodCardDesc', color: '#635BFF', iconType: 'card' }
}

function displayFor(option: PayOption) {
  return DISPLAY_CONFIG[(option.subMethod ?? option.paymentType) as DisplayKind]
}

function pick(key: string) {
  model.value = key
}

// roving tabindex：选中项（未选中时首项兜底）tabindex=0，其余 -1
const rovingIndex = computed(() => {
  const idx = props.options.findIndex((o) => o.key === model.value)
  return idx === -1 ? 0 : idx
})

// 各 radio 项的元素引用，供方向键移动焦点
const itemRefs = ref<(HTMLElement | null)[]>([])
function setItemRef(el: Element | ComponentPublicInstance | null, i: number) {
  itemRefs.value[i] = el as HTMLElement | null
}

// 方向键组内循环移动并选中（WAI-ARIA radio group 模式），与既有 Enter/Space 选中互不干扰
function onArrowKeydown(e: KeyboardEvent, i: number) {
  const next = nextRadioIndex(i, props.options.length, e.key)
  if (next === null) return
  e.preventDefault()
  pick(props.options[next].key)
  itemRefs.value[next]?.focus()
}
</script>

<template>
  <!-- @container：列数按「本组件实际宽度」而非视口决定，塞进弹窗/侧栏等窄容器也不会把文字挤成竖排 -->
  <div :class="variant === 'card' ? '@container rounded-[20px] bg-card p-[28px_30px] shadow-card' : '@container'">
    <!-- 标题（仅 card 形态；plain 由使用方给标题，避免与弹窗标题层级打架） -->
    <div
      v-if="variant === 'card'"
      class="mb-[18px] flex items-baseline justify-between"
    >
      <h3 class="font-serif text-xl font-medium text-text">
        {{ $t('recharge.paymentMethod') }}
      </h3>
      <!-- 具名插值 + 样式化插槽（vue-i18n <i18n-t>）：语序由词条承载，不再拆前后缀 -->
      <i18n-t
        keypath="recharge.poweredBy"
        tag="span"
        scope="global"
        class="text-xs text-subtle"
      >
        <template #provider>
          <span class="text-[13px] font-semibold text-[#635BFF]">Stripe</span>
        </template>
      </i18n-t>
    </div>

    <!-- 方式列表；radio 语义 + Enter/Space 可选，键盘可达 -->
    <div
      role="radiogroup"
      :aria-label="$t('recharge.paymentMethod')"
      class="grid grid-cols-1"
      :class="variant === 'card' ? 'gap-3 @[30rem]:grid-cols-3' : 'gap-2.5'"
    >
      <div
        v-for="(option, i) in options"
        :key="option.key"
        :ref="(el) => setItemRef(el, i)"
        role="radio"
        :aria-checked="model === option.key"
        :tabindex="i === rovingIndex ? 0 : -1"
        class="flex cursor-pointer items-center gap-3 rounded-xl2 border-[1.5px] transition-[border-color,background] duration-140 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        :class="[
          variant === 'card' ? 'px-[18px] py-4' : 'px-4 py-[13px]',
          model === option.key
            ? 'border-accent bg-accent/6'
            : 'border-border2 bg-card hover:border-[#9FE6CD]'
        ]"
        @click="pick(option.key)"
        @keydown.enter.prevent="pick(option.key)"
        @keydown.space.prevent="pick(option.key)"
        @keydown="onArrowKeydown($event, i)"
      >
        <!-- 品牌图标 -->
        <span
          class="flex flex-none items-center justify-center rounded-[9px]"
          :class="variant === 'card' ? 'h-[34px] w-[34px]' : 'h-[30px] w-[30px]'"
          :style="{ background: displayFor(option).color }"
        >
          <!-- 微信 -->
          <svg
            v-if="displayFor(option).iconType === 'wechat'"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="#fff"
          >
            <path d="M9 4C4.6 4 1 7 1 10.7c0 2.1 1.2 4 3 5.2l-.7 2.2 2.6-1.4c.9.3 1.9.4 2.9.4h.6a5.6 5.6 0 0 1-.2-1.5c0-3.4 3.3-6.1 7.3-6.1h.7C16.8 6.3 13.3 4 9 4Zm-2.7 4a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm5.4 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" />
            <path d="M23 15.5c0-3-3-5.5-6.7-5.5S9.6 12.5 9.6 15.5 12.6 21 16.3 21c.8 0 1.6-.1 2.3-.4l2.1 1.2-.6-1.8c1.4-1 2.9-2.6 2.9-4.5Zm-9-1a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6Zm4.6 0a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6Z" />
          </svg>

          <!-- 支付宝 -->
          <span
            v-else-if="displayFor(option).iconType === 'alipay'"
            class="text-base font-bold text-white"
          >支</span>

          <!-- 银行卡 -->
          <svg
            v-else-if="displayFor(option).iconType === 'card'"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect
              x="2"
              y="5"
              width="20"
              height="14"
              rx="2.5"
            />
            <path d="M2 10h20" />
          </svg>
        </span>

        <!-- 文字：card 两行（列窄）；plain 一行（整行可用，名称与说明并排更紧凑） -->
        <div
          class="min-w-0 flex-1"
          :class="variant === 'plain' ? 'flex items-baseline gap-2' : ''"
        >
          <div
            class="text-sm font-semibold text-text"
            :class="variant === 'plain' ? 'shrink-0 whitespace-nowrap' : ''"
          >
            {{ $t(displayFor(option).labelKey) }}
          </div>
          <!-- plain 行里说明是次要信息：容器放不下整句时整块让位，而非留个省略号 -->
          <div
            class="truncate text-xs text-subtle"
            :class="variant === 'card' ? 'mt-0.5' : 'hidden min-w-0 @[22rem]:block'"
          >
            {{ $t(displayFor(option).descKey) }}
          </div>
        </div>

        <!-- 选中标记 -->
        <span
          class="h-[18px] w-[18px] flex-none rounded-full transition-[background,box-shadow] duration-140"
          :class="
            model === option.key
              ? 'bg-accent shadow-[inset_0_0_0_3px_#fff,0_0_0_1px_#14C28A]'
              : 'bg-card shadow-[inset_0_0_0_1.5px_#D8D5CC]'
          "
        />
      </div>
    </div>

    <!-- 安全提示（仅 card 形态；plain 交由使用方按上下文决定要不要说这句） -->
    <div
      v-if="variant === 'card'"
      class="mt-4 flex items-center gap-2 border-t border-dashed border-border2 pt-4 text-xs leading-relaxed text-subtle"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#635BFF"
        stroke-width="2"
        class="flex-none"
      >
        <path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4z" />
      </svg>
      <!-- 具名插值 + 样式化插槽（vue-i18n <i18n-t>）：语序由词条承载，不再拆前后缀 -->
      <i18n-t
        keypath="recharge.securityNote"
        tag="span"
        scope="global"
      >
        <template #provider>
          <span class="font-semibold text-[#635BFF]">Stripe</span>
        </template>
      </i18n-t>
    </div>
  </div>
</template>
