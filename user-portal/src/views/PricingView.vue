<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { PRICING_CHANNELS, type PricingModel } from '@/config/pricing'
import { queryModelPricing, type ModelPricePerMillion } from '@/api/pricing'

const { t } = useI18n()

// 每渠道卡片配色（纯展示层，价格等事实数据在 config/pricing.ts + 后端定价接口维护）
interface ChannelPalette {
  bg: string
  nameColor: string
  modelColor: string
  labelColor: string
  origColor: string
  priceColor: string
  pillBg: string
  pillText: string
  dividerColor: string
  footColor: string
  multColor: string
  dotColor: string
  dotOpacity: number
  /** 模型选择按钮底色（半透明叠加层） */
  btnBg: string
}

const palettes: Record<string, ChannelPalette> = {
  claudeCode: {
    bg: '#F0ECE0',
    nameColor: '#1A1A1A',
    modelColor: '#6E6A60',
    labelColor: '#6E6A60',
    origColor: '#B0AC9E',
    priceColor: '#1A1A1A',
    pillBg: '#1F1D1A',
    pillText: '#F0ECE0',
    dividerColor: 'rgba(26,26,26,.10)',
    footColor: '#6E6A60',
    multColor: '#A29E92',
    dotColor: '#1A1A1A',
    dotOpacity: 0.07,
    btnBg: 'rgba(26,26,26,.06)'
  },
  claudeApi: {
    bg: '#C67C5B',
    nameColor: '#35190E',
    modelColor: 'rgba(53,25,14,.72)',
    labelColor: 'rgba(53,25,14,.78)',
    origColor: 'rgba(53,25,14,.45)',
    priceColor: '#ffffff',
    pillBg: '#35190E',
    pillText: '#F1E2D9',
    dividerColor: 'rgba(53,25,14,.22)',
    footColor: 'rgba(53,25,14,.72)',
    multColor: 'rgba(53,25,14,.55)',
    dotColor: '#35190E',
    dotOpacity: 0.1,
    btnBg: 'rgba(255,255,255,.20)'
  },
  chatgpt: {
    bg: '#14C28A',
    nameColor: '#063A2B',
    modelColor: 'rgba(6,58,43,.72)',
    labelColor: '#063A2B',
    origColor: 'rgba(6,58,43,.42)',
    priceColor: '#ffffff',
    pillBg: '#063A2B',
    pillText: 'rgba(255,255,255,.92)',
    dividerColor: 'rgba(255,255,255,.24)',
    footColor: 'rgba(6,58,43,.78)',
    multColor: 'rgba(6,58,43,.6)',
    dotColor: '#0A4A38',
    dotOpacity: 0.16,
    btnBg: 'rgba(255,255,255,.22)'
  },
  kiro: {
    bg: '#517FA9',
    nameColor: '#ffffff',
    modelColor: 'rgba(255,255,255,.72)',
    labelColor: 'rgba(255,255,255,.85)',
    origColor: 'rgba(255,255,255,.45)',
    priceColor: '#ffffff',
    pillBg: '#152F49',
    pillText: 'rgba(255,255,255,.92)',
    dividerColor: 'rgba(255,255,255,.22)',
    footColor: 'rgba(255,255,255,.82)',
    multColor: 'rgba(255,255,255,.6)',
    dotColor: '#152F49',
    dotOpacity: 0.16,
    btnBg: 'rgba(255,255,255,.16)'
  }
}

const channels = PRICING_CHANNELS.map((ch) => ({ ...ch, ...palettes[ch.key] }))

// 实时官方原价（modelId → 美元/百万 tokens）；接口失败时保持为空，回退到配置兜底价
const livePrices = ref<Map<string, ModelPricePerMillion>>(new Map())

// 各渠道模型下拉框开合状态与选中下标（默认 0 = 最常用主模型）
const open = reactive<Record<string, boolean>>({})
const selected = reactive<Record<string, number>>({})

function selectedIdx(key: string): number {
  return selected[key] ?? 0
}

function selectedModel(key: string, models: PricingModel[]): PricingModel {
  return models[selectedIdx(key)]
}

/**
 * 切换某渠道下拉：同一时刻只允许一个展开。
 * 浮层靠卡片的 z-20 压住相邻卡片，两个同时展开时后一张卡会盖掉前一张的浮层。
 */
function toggle(key: string): void {
  const next = !open[key]
  for (const k of Object.keys(open)) open[k] = false
  open[key] = next
}

/** 选中某模型：切换卡片数据展示并收起下拉 */
function pick(key: string, idx: number): void {
  selected[key] = idx
  open[key] = false
}

// 点击下拉区域以外时收起所有下拉框
function onDocClick(e: MouseEvent): void {
  const el = e.target as HTMLElement | null
  if (el && el.closest('[data-model-select]')) return
  for (const k of Object.keys(open)) open[k] = false
}

onMounted(async () => {
  document.addEventListener('click', onDocClick)
  const ids = [...new Set(PRICING_CHANNELS.flatMap((ch) => ch.models.map((m) => m.id)))]
  try {
    livePrices.value = await queryModelPricing(ids)
  } catch {
    // 静默回退：定价接口不可用时用配置里的兜底价展示，不打断页面
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
})

/** 某模型的官方原价（优先实时价，回退兜底价），美元/百万 tokens */
function origOf(m: PricingModel): ModelPricePerMillion {
  return livePrices.value.get(m.id) ?? { input: m.fallbackInput, output: m.fallbackOutput }
}

/** 按渠道立减折算现价 */
function discounted(price: number, discount: number): number {
  return price * (1 - discount / 100)
}

function fmt(price: number): string {
  return `$${price.toFixed(2)}`
}

// 倍率说明行：文案存在才渲染（en-US 侧为空串 → 不展示），语言差异由词条驱动而非模板判断
function multiplierNote(multiplier: number): string {
  return t('pricing.multiplierNote', { multiplier })
}
</script>

<template>
  <div>
    <!-- 页头（左：标题/副标题，右：跳充值 CTA；窄屏时按钮自动换行到标题下方） -->
    <div class="mb-[34px] flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="mb-2 font-serif text-4xl font-medium tracking-tight text-text">
          {{ $t('pricing.title') }}
        </h1>
        <p class="text-sm text-subtle">
          {{ $t('pricing.subtitle') }}
        </p>
      </div>
      <RouterLink
        to="/recharge"
        class="inline-block cursor-pointer rounded-full border-[1.5px] border-text bg-card px-7 py-3 text-sm font-semibold text-text"
      >
        {{ $t('pricing.recharge') }} →
      </RouterLink>
    </div>

    <!-- 渠道价格卡片（2×2）：正面展示当前选中模型，下拉框切换模型后同步刷新价格 -->
    <div class="grid grid-cols-1 items-start gap-[22px] md:grid-cols-2">
      <div
        v-for="ch in channels"
        :key="ch.key"
        class="relative rounded-xl3 px-7 py-8 shadow-card"
        :class="{ 'z-20': open[ch.key] }"
        :style="{ background: ch.bg }"
      >
        <!-- 点阵装饰（卡片不再 overflow-hidden，故自带圆角避免直角溢出） -->
        <div
          class="pointer-events-none absolute inset-0 rounded-xl3"
          :style="{
            color: ch.dotColor,
            backgroundImage: 'radial-gradient(currentColor 1.6px, transparent 1.8px)',
            backgroundSize: '13px 13px',
            opacity: ch.dotOpacity
          }"
        />

        <!-- 渠道名 + 当前模型（主模型带「最常用」前缀）/ 折扣标签 -->
        <div class="relative flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div
              class="text-sm font-semibold uppercase tracking-[0.08em]"
              :style="{ color: ch.nameColor }"
            >
              {{ ch.name }}
            </div>
            <div
              class="mt-1 text-xs font-medium"
              :style="{ color: ch.modelColor }"
            >
              <template v-if="selectedIdx(ch.key) === 0">
                {{ $t('pricing.mostUsed') }} ·
              </template>
              {{ selectedModel(ch.key, ch.models).label }}
            </div>
          </div>
          <div
            class="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold"
            :style="{ background: ch.pillBg, color: ch.pillText }"
          >
            {{ $t('pricing.discount') }} {{ ch.discount }}%
          </div>
        </div>

        <!-- 当前模型输入 / 输出价格（原价划线 + 现价大字） -->
        <div class="relative mt-7 grid grid-cols-2 gap-4">
          <div
            v-for="side in (['input', 'output'] as const)"
            :key="side"
          >
            <div
              class="mb-1.5 text-xs font-medium"
              :style="{ color: ch.labelColor }"
            >
              {{ $t(`pricing.${side}`) }}
            </div>
            <div
              class="num text-sm font-medium line-through"
              :style="{ color: ch.origColor }"
            >
              {{ fmt(origOf(selectedModel(ch.key, ch.models))[side]) }}
            </div>
            <div
              class="num text-[40px] font-medium leading-none"
              :style="{ color: ch.priceColor }"
            >
              {{ fmt(discounted(origOf(selectedModel(ch.key, ch.models))[side], ch.discount)) }}
            </div>
          </div>
        </div>

        <!-- 模型选择下拉框：默认文案「查看全部 N 个模型」，选择后显示所选型号并切换上方价格 -->
        <div
          class="relative mt-7 border-t pt-5"
          :style="{ borderColor: ch.dividerColor }"
          data-model-select
        >
          <button
            type="button"
            class="flex w-full cursor-pointer items-center justify-between rounded-xl px-5 py-3.5 text-sm font-semibold"
            :style="{ background: ch.btnBg, color: ch.nameColor }"
            :aria-expanded="!!open[ch.key]"
            aria-haspopup="listbox"
            @click="toggle(ch.key)"
          >
            <span>{{
              selectedIdx(ch.key) === 0
                ? $t('pricing.viewAll', { count: ch.models.length })
                : selectedModel(ch.key, ch.models).label
            }}</span>
            <span
              class="text-xs transition-transform duration-200"
              :class="{ 'rotate-180': open[ch.key] }"
            >▾</span>
          </button>

          <!-- 下拉选项：型号 + 折后价摘要，选中项打勾。
               绝对定位浮层（不占文档流），否则展开会把卡片整体撑高、打乱 2×2 网格 -->
          <div
            v-if="open[ch.key]"
            role="listbox"
            class="absolute inset-x-0 top-full z-20 mt-2 max-h-[320px] overflow-y-auto rounded-xl border shadow-card"
            :style="{ background: ch.bg, borderColor: ch.dividerColor }"
          >
            <button
              v-for="(m, idx) in ch.models"
              :key="m.id"
              type="button"
              role="option"
              :aria-selected="idx === selectedIdx(ch.key)"
              class="flex w-full cursor-pointer items-center justify-between gap-3 px-5 py-3 text-left text-sm"
              :style="idx === selectedIdx(ch.key) ? { background: ch.btnBg } : {}"
              @click="pick(ch.key, idx)"
            >
              <span
                class="flex min-w-0 items-center gap-2 font-medium"
                :style="{ color: ch.nameColor }"
              >
                <span class="truncate">{{ m.label }}</span>
                <span
                  v-if="idx === 0"
                  class="shrink-0 text-[10px] font-normal"
                  :style="{ color: ch.modelColor }"
                >{{ $t('pricing.mostUsed') }}</span>
              </span>
              <span class="flex shrink-0 items-center gap-2">
                <span
                  class="num text-xs"
                  :style="{ color: ch.footColor }"
                >
                  {{ fmt(discounted(origOf(m).input, ch.discount)) }} /
                  {{ fmt(discounted(origOf(m).output, ch.discount)) }}
                </span>
                <span
                  class="w-3 text-xs"
                  :style="{ color: ch.nameColor }"
                >{{ idx === selectedIdx(ch.key) ? '✓' : '' }}</span>
              </span>
            </button>
          </div>
        </div>

        <!-- 计价单位 + 倍率说明（倍率行仅中文展示） -->
        <div class="relative mt-6">
          <div
            class="text-xs font-medium"
            :style="{ color: ch.footColor }"
          >
            {{ $t('pricing.unitAll', { count: ch.models.length }) }}
          </div>
          <div
            v-if="multiplierNote(ch.multiplier)"
            class="mt-1 text-xs"
            :style="{ color: ch.multColor }"
          >
            {{ multiplierNote(ch.multiplier) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
