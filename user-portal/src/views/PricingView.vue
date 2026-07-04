<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import PortalLayout from '@/layouts/PortalLayout.vue'
import { PRICING_CHANNELS } from '@/config/pricing'

const { t } = useI18n()

// 每渠道卡片配色（纯展示层，价格等事实数据在 config/pricing.ts 单独维护）
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
    dotOpacity: 0.07
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
    dotOpacity: 0.1
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
    dotOpacity: 0.16
  },
  gemini: {
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
}

const channels = PRICING_CHANNELS.map((ch) => ({ ...ch, ...palettes[ch.key] }))

// 倍率说明行：文案存在才渲染（en-US 侧为空串 → 不展示），语言差异由词条驱动而非模板判断
function multiplierNote(multiplier: number): string {
  return t('pricing.multiplierNote', { multiplier })
}
</script>

<template>
  <PortalLayout>
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
            v-if="multiplierNote(ch.multiplier)"
            class="mt-1 text-xs"
            :style="{ color: ch.multColor }"
          >
            {{ multiplierNote(ch.multiplier) }}
          </div>
        </div>
      </div>
    </div>
  </PortalLayout>
</template>
