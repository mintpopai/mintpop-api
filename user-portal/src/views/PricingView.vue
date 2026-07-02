<script setup lang="ts">
import { computed } from 'vue'
import PortalLayout from '@/layouts/PortalLayout.vue'
import { useLocaleStore } from '@/stores/locale'

const localeStore = useLocaleStore()
// 「行业常见倍率」一行仅中文语言下展示（面向国内用户的 1元=1美金 换算说明）
const isZh = computed(() => localeStore.current === 'zh-CN')

// 各渠道价格（单位：美元 / 百万 tokens）。origInput/origOutput 为原价（划线展示），
// input/output 为折后现价；discount 为「立减」百分比；multiplier 为「1元=1美金体系」下的行业常见倍率。
// 品牌名（name）与型号（model）属技术标识，中英一致，不走 i18n。
interface Channel {
  key: string
  name: string
  model: string
  discount: number
  origInput: number
  input: number
  origOutput: number
  output: number
  multiplier: number
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
}

const channels: Channel[] = [
  {
    key: 'claudeCode',
    name: 'Claude (Claude Code / Desktop)',
    model: 'Opus 4.8',
    discount: 70,
    origInput: 5,
    input: 1.5,
    origOutput: 25,
    output: 7.5,
    multiplier: 1.9,
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
    dotOpacity: 0.07
  },
  {
    key: 'claudeApi',
    name: 'Claude (API)',
    model: 'Opus 4.8',
    discount: 55,
    origInput: 5,
    input: 2.25,
    origOutput: 25,
    output: 11.25,
    multiplier: 2.9,
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
    dotOpacity: 0.1
  },
  {
    key: 'chatgpt',
    name: 'ChatGPT',
    model: 'GPT-5.5',
    discount: 80,
    origInput: 5,
    input: 1,
    origOutput: 30,
    output: 6,
    multiplier: 0.9,
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
    dotOpacity: 0.16
  },
  {
    key: 'gemini',
    name: 'Gemini',
    model: '3.1 Pro',
    discount: 80,
    origInput: 2,
    input: 0.4,
    origOutput: 12,
    output: 2.4,
    multiplier: 0.9,
    bg: '#0E8F66',
    nameColor: '#ffffff',
    modelColor: 'rgba(255,255,255,.72)',
    labelColor: 'rgba(255,255,255,.85)',
    origColor: 'rgba(255,255,255,.45)',
    priceColor: '#ffffff',
    pillBg: '#063A2B',
    pillText: 'rgba(255,255,255,.92)',
    dividerColor: 'rgba(255,255,255,.22)',
    footColor: 'rgba(255,255,255,.82)',
    multColor: 'rgba(255,255,255,.6)',
    dotColor: '#063A2B',
    dotOpacity: 0.16
  }
]
</script>

<template>
  <PortalLayout>
    <!-- 页头 -->
    <div class="mb-[34px]">
      <h1 class="mb-2 font-serif text-4xl font-medium tracking-tight text-text">
        {{ $t('pricing.title') }}
      </h1>
      <p class="text-sm text-subtle">
        {{ $t('pricing.subtitle') }}
      </p>
    </div>

    <!-- 渠道价格卡片（2×2） -->
    <div class="grid grid-cols-1 gap-[22px] md:grid-cols-2">
      <div
        v-for="ch in channels"
        :key="ch.key"
        class="relative overflow-hidden rounded-xl3 px-7 py-8 shadow-card"
        :style="{ background: ch.bg }"
      >
        <!-- 点阵装饰 -->
        <div
          class="pointer-events-none absolute inset-0"
          :style="{
            color: ch.dotColor,
            backgroundImage: 'radial-gradient(currentColor 1.6px, transparent 1.8px)',
            backgroundSize: '13px 13px',
            opacity: ch.dotOpacity
          }"
        />

        <!-- 渠道名 + 型号 / 折扣标签 -->
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
              {{ ch.model }}
            </div>
          </div>
          <div
            class="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold"
            :style="{ background: ch.pillBg, color: ch.pillText }"
          >
            {{ $t('pricing.discount') }} {{ ch.discount }}%
          </div>
        </div>

        <!-- 输入 / 输出价格（原价划线 + 现价大字） -->
        <div class="relative mt-7 grid grid-cols-2 gap-4">
          <div>
            <div
              class="mb-1.5 text-xs font-medium"
              :style="{ color: ch.labelColor }"
            >
              {{ $t('pricing.input') }}
            </div>
            <div
              class="num text-sm font-medium line-through"
              :style="{ color: ch.origColor }"
            >
              ${{ ch.origInput.toFixed(2) }}
            </div>
            <div
              class="num text-[40px] font-medium leading-none"
              :style="{ color: ch.priceColor }"
            >
              ${{ ch.input.toFixed(2) }}
            </div>
          </div>
          <div>
            <div
              class="mb-1.5 text-xs font-medium"
              :style="{ color: ch.labelColor }"
            >
              {{ $t('pricing.output') }}
            </div>
            <div
              class="num text-sm font-medium line-through"
              :style="{ color: ch.origColor }"
            >
              ${{ ch.origOutput.toFixed(2) }}
            </div>
            <div
              class="num text-[40px] font-medium leading-none"
              :style="{ color: ch.priceColor }"
            >
              ${{ ch.output.toFixed(2) }}
            </div>
          </div>
        </div>

        <!-- 计价单位 + 倍率说明（倍率行仅中文展示） -->
        <div
          class="relative mt-7 border-t pt-3.5"
          :style="{ borderColor: ch.dividerColor }"
        >
          <div
            class="text-xs font-medium"
            :style="{ color: ch.footColor }"
          >
            {{ $t('pricing.unit') }}
          </div>
          <div
            v-if="isZh"
            class="mt-1 text-xs"
            :style="{ color: ch.multColor }"
          >
            行业常见倍率换算 ≈ {{ ch.multiplier }}（1元=1美金体系）
          </div>
        </div>
      </div>
    </div>
  </PortalLayout>
</template>
