<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { nextRadioIndex } from '@/composables/useRadioGroupKeyboard'
import {
  PRICING_CHANNELS,
  type PricingChannel,
  type PricingModel,
  type PricingTab
} from '@/config/pricing'
import { queryModelPricing, type ModelPricePerMillion } from '@/api/pricing'
import { discountedPrice, featuredIndex, formatPrice } from '@/utils/pricing'

const { t } = useI18n()

/** tab 顺序即展示顺序 */
const TABS: { key: PricingTab; labelKey: string }[] = [
  { key: 'OVERSEAS', labelKey: 'pricing.tabOverseas' },
  { key: 'OPEN_SOURCE', labelKey: 'pricing.tabOpenSource' }
]

const activeTab = ref<PricingTab>('OVERSEAS')
/** tab 按钮 DOM，方向键切换后把焦点移过去（WAI-ARIA tabs 模式） */
const tabEls = ref<(HTMLElement | null)[]>([])

const visibleChannels = computed(() => PRICING_CHANNELS.filter((ch) => ch.tab === activeTab.value))

// 实时官方原价（modelId → 美元/百万 tokens）；接口失败或模型未收录时留空，回退到配置兜底价
const livePrices = ref<Map<string, ModelPricePerMillion>>(new Map())

// 各渠道模型下拉框开合状态与选中下标（未选过时取配置的 featuredId）
const open = reactive<Record<string, boolean>>({})
const selected = reactive<Record<string, number>>({})

function closeAllDropdowns(): void {
  for (const k of Object.keys(open)) open[k] = false
}

function selectTab(tab: PricingTab): void {
  activeTab.value = tab
  // 切 tab 后原卡片已卸载，残留的开合状态会让新 tab 的同名卡片直接展开
  closeAllDropdowns()
}

function onTabKeydown(e: KeyboardEvent, idx: number): void {
  const next = nextRadioIndex(idx, TABS.length, e.key)
  if (next === null) return
  e.preventDefault()
  selectTab(TABS[next].key)
  tabEls.value[next]?.focus()
}

/** 卡片正面展示的模型下标：用户选过就用选的，否则用配置指定的主推模型 */
function selectedIdx(ch: PricingChannel): number {
  return selected[ch.key] ?? featuredIndex(ch.models, ch.featuredId)
}

function selectedModel(ch: PricingChannel): PricingModel {
  return ch.models[selectedIdx(ch)]
}

function isFeatured(ch: PricingChannel, idx: number): boolean {
  return idx === featuredIndex(ch.models, ch.featuredId)
}

/** 主推模型的标记：海外模型标「最常用」，开源模型标「最低价」 */
function featuredTagText(ch: PricingChannel): string {
  return ch.featuredTag === 'MOST_USED' ? t('pricing.mostUsed') : t('pricing.lowestPrice')
}

/** 渠道展示名：品牌 + 版本后缀（品牌名不翻译，后缀走 i18n） */
function channelName(ch: PricingChannel): string {
  return ch.edition ? `${ch.name} ${t('pricing.editionOverseas')}` : ch.name
}

/**
 * 切换某渠道下拉：同一时刻只允许一个展开。
 * 浮层靠卡片的 z-20 压住相邻卡片，两个同时展开时后一张卡会盖掉前一张的浮层。
 */
function toggle(key: string): void {
  const next = !open[key]
  closeAllDropdowns()
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
  closeAllDropdowns()
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

/** 某模型某侧的实付价文案 */
function payText(m: PricingModel, side: 'input' | 'output', discount: number): string {
  return formatPrice(discountedPrice(origOf(m)[side], discount))
}

// 倍率说明行：文案存在才渲染（en-US 侧为空串 → 不展示），语言差异由词条驱动而非模板判断
function multiplierNote(multiplier: number): string {
  return t('pricing.multiplierNote', { multiplier })
}
</script>

<template>
  <div>
    <!-- 页头（左：标题/副标题，右：跳充值 CTA；窄屏时按钮自动换行到标题下方） -->
    <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
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

    <!-- 模型类别切换（海外模型 / 开源模型）：WAI-ARIA tabs，方向键可切换。
         选中态用与页面底色反相的实心药丸：深色主题下 --card 比 --muted 还暗，
         用 bg-card 会让选中项比轨道更沉、读不出选中 -->
    <div
      role="tablist"
      :aria-label="$t('pricing.title')"
      class="mb-[30px] inline-flex gap-1 rounded-full bg-muted p-1"
    >
      <button
        v-for="(tab, i) in TABS"
        :key="tab.key"
        :ref="(el) => (tabEls[i] = el as HTMLElement | null)"
        type="button"
        role="tab"
        :aria-selected="activeTab === tab.key"
        :tabindex="activeTab === tab.key ? 0 : -1"
        class="cursor-pointer rounded-full px-6 py-2.5 text-sm font-semibold transition-colors"
        :class="
          activeTab === tab.key
            ? 'bg-text text-bg shadow-pill'
            : 'text-subtle hover:text-text'
        "
        @click="selectTab(tab.key)"
        @keydown="onTabKeydown($event, i)"
      >
        {{ $t(tab.labelKey) }}
      </button>
    </div>

    <!-- 渠道价格卡片（2 列）：正面展示当前选中模型，下拉框切换模型后同步刷新价格。
         不加 items-start：同一行卡片等高才齐整（渠道名折行、单模型分组会让内容高度不一）；
         下拉是绝对定位浮层，展开不会撑高卡片 -->
    <div
      role="tabpanel"
      class="grid grid-cols-1 gap-[22px] md:grid-cols-2"
    >
      <div
        v-for="ch in visibleChannels"
        :key="ch.key"
        class="card-surface relative rounded-xl3 px-7 py-8 shadow-card"
        :class="{ 'z-20': open[ch.key] }"
      >
        <!-- 品牌头像 + 渠道名 / 当前模型 · 立减标签（无折扣的分组不出标签） -->
        <div class="flex items-start justify-between gap-3">
          <div class="flex min-w-0 items-center gap-3">
            <span
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] text-sm font-semibold text-white"
              :style="{ background: ch.avatarBg }"
              aria-hidden="true"
            >{{ ch.avatar }}</span>
            <div class="min-w-0">
              <!-- 渠道名允许折行：Claude (Claude Code / Desktop) 这类长名截断后读不出是哪个渠道 -->
              <div class="text-[15px] font-semibold leading-snug text-[#161a17]">
                {{ channelName(ch) }}
              </div>
              <div class="mt-0.5 truncate text-xs text-[#6f7d75]">
                {{ selectedModel(ch).label }}
              </div>
            </div>
          </div>
          <div
            v-if="ch.discount > 0"
            class="shrink-0 rounded-full bg-[#161a17] px-3 py-1.5 text-xs font-semibold text-white"
          >
            {{ $t('pricing.discount') }} {{ ch.discount }}%
          </div>
        </div>

        <!-- 当前模型输入 / 输出价格（有折扣才出划线原价） -->
        <div class="mt-7 grid grid-cols-2 gap-4">
          <div
            v-for="side in (['input', 'output'] as const)"
            :key="side"
          >
            <div class="mb-1.5 text-xs font-medium text-[#6f7d75]">
              {{ $t(`pricing.${side}`) }}
            </div>
            <div
              v-if="ch.discount > 0"
              class="num text-sm font-medium text-[#a8b5ae] line-through"
            >
              {{ formatPrice(origOf(selectedModel(ch))[side]) }}
            </div>
            <div class="num text-[40px] font-medium leading-none text-[#161a17]">
              {{ payText(selectedModel(ch), side, ch.discount) }}
            </div>
          </div>
        </div>

        <!-- 模型切换：多模型走下拉，单模型分组直接标出唯一可用型号 -->
        <div
          class="relative mt-7 border-t border-[rgba(22,26,23,.09)] pt-5"
          data-model-select
        >
          <div
            v-if="ch.models.length === 1"
            class="rounded-xl bg-[rgba(20,194,138,.11)] px-5 py-3.5 text-sm font-medium text-[#3d5c4f]"
          >
            {{ $t('pricing.onlyModel', { model: ch.models[0].label }) }}
          </div>

          <button
            v-else
            type="button"
            class="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl bg-[rgba(20,194,138,.11)] px-5 py-3.5 text-sm font-semibold text-[#161a17]"
            :aria-expanded="!!open[ch.key]"
            aria-haspopup="listbox"
            @click="toggle(ch.key)"
          >
            <!-- 展示主推模型时提示「查看全部」，选过别的型号后换成该型号，免得收起后看不出选了谁 -->
            <span class="truncate">{{
              isFeatured(ch, selectedIdx(ch))
                ? $t('pricing.viewAll', { count: ch.models.length })
                : selectedModel(ch).label
            }}</span>
            <span
              class="shrink-0 text-xs transition-transform duration-200"
              :class="{ 'rotate-180': open[ch.key] }"
            >▾</span>
          </button>

          <!-- 下拉选项：型号 + 折后价摘要，选中项打勾。
               绝对定位浮层（不占文档流），否则展开会把卡片整体撑高、打乱网格 -->
          <div
            v-if="open[ch.key]"
            role="listbox"
            class="absolute inset-x-0 top-full z-20 mt-2 max-h-[320px] overflow-y-auto rounded-xl border border-[rgba(22,26,23,.09)] bg-white shadow-menu"
          >
            <button
              v-for="(m, idx) in ch.models"
              :key="m.id"
              type="button"
              role="option"
              :aria-selected="idx === selectedIdx(ch)"
              class="flex w-full cursor-pointer items-center justify-between gap-3 px-5 py-3 text-left text-sm"
              :class="
                idx === selectedIdx(ch) ? 'bg-[rgba(20,194,138,.13)]' : 'hover:bg-[rgba(20,194,138,.06)]'
              "
              @click="pick(ch.key, idx)"
            >
              <span class="flex min-w-0 items-center gap-2">
                <span class="truncate font-medium text-[#161a17]">{{ m.label }}</span>
                <span
                  v-if="isFeatured(ch, idx)"
                  class="shrink-0 text-[10px] font-normal text-[#6f7d75]"
                >{{ featuredTagText(ch) }}</span>
              </span>
              <span class="flex shrink-0 items-center gap-2">
                <span class="num text-xs text-[#6f7d75]">
                  {{ payText(m, 'input', ch.discount) }} / {{ payText(m, 'output', ch.discount) }}
                </span>
                <span class="w-3 text-xs text-[#161a17]">{{
                  idx === selectedIdx(ch) ? '✓' : ''
                }}</span>
              </span>
            </button>
          </div>
        </div>

        <!-- 计价单位 + 倍率说明（倍率行仅海外模型 + 中文展示） -->
        <div class="mt-6">
          <div class="text-xs font-medium text-[#6f7d75]">
            {{
              ch.models.length === 1
                ? $t('pricing.unitOne')
                : $t('pricing.unitAll', { count: ch.models.length })
            }}
          </div>
          <div
            v-if="ch.multiplier !== undefined && multiplierNote(ch.multiplier)"
            class="mt-1 text-xs text-[#93a29a]"
          >
            {{ multiplierNote(ch.multiplier) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/*
  卡片是固定的浅色面（深色主题下也保持浅底），与页面底色形成对比——这与改版前各渠道用
  品牌色块的做法一致，只是统一成一张白底薄荷渐变的面，品牌辨识交给左上角头像方块。
*/
.card-surface {
  background: linear-gradient(152deg, #e3f4ea 0%, #f6fcf9 46%, #ffffff 100%);
}
</style>
