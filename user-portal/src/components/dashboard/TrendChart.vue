<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Filler,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  type ChartData,
  type ChartOptions,
  type ScriptableContext
} from 'chart.js'
import type { TrendDataPoint } from '@/api/types'
import { formatTokens } from '@/utils/format'
import { useThemeStore } from '@/stores/theme'

ChartJS.register(Filler, LineElement, PointElement, LinearScale, CategoryScale, Tooltip)

const props = defineProps<{ trend: TrendDataPoint[] }>()

const themeStore = useThemeStore()

const accent = ref('#14C28A')

function readAccentFromCss() {
  const c = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
  if (c) accent.value = c
}

onMounted(readAccentFromCss)

// 明暗切换会让 --accent 的计算值随之改变（class .dark 的 CSS 变量重定义），
// 监听主题 store 的模式变化并重读取，图表配色（chartData/chartOptions 依赖 accent）随之刷新；
// watch 在 <script setup> 内同步创建，绑定组件生命周期，随组件卸载自动停止，无需手动清理
watch(() => themeStore.mode, readAccentFromCss)

// 把 #RRGGBB 转成带透明度的 rgba
function withAlpha(hex: string, alpha: number): string {
  const m = hex.replace('#', '')
  if (m.length !== 6) return hex
  const r = parseInt(m.slice(0, 2), 16)
  const g = parseInt(m.slice(2, 4), 16)
  const b = parseInt(m.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const hasData = computed(() => (props.trend?.length ?? 0) > 0)

const chartData = computed<ChartData<'line'>>(() => ({
  labels: props.trend.map((p) => p.date),
  datasets: [
    {
      label: 'Token',
      data: props.trend.map((p) => p.total_tokens || 0),
      borderColor: accent.value,
      borderWidth: 2.5,
      fill: true,
      backgroundColor: (ctx: ScriptableContext<'line'>) => {
        const { chart } = ctx
        const { ctx: c, chartArea } = chart
        if (!chartArea) return withAlpha(accent.value, 0.12)
        const grad = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
        grad.addColorStop(0, withAlpha(accent.value, 0.16))
        grad.addColorStop(1, withAlpha(accent.value, 0))
        return grad
      },
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointHoverBackgroundColor: accent.value
    }
  ]
}))

const chartOptions = computed<ChartOptions<'line'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx) => `Token ${formatTokens(ctx.parsed.y ?? 0)}`
      }
    }
  },
  scales: {
    x: { display: false },
    y: { display: false, beginAtZero: true }
  }
}))
</script>

<template>
  <div class="mb-3.5 rounded-xl3 bg-card px-7 py-[26px] shadow-soft">
    <div class="mb-5 flex items-center justify-between">
      <h3 class="font-serif text-lg font-medium text-text">
        {{ $t('dashboard.trend.title') }}
      </h3>
      <span class="text-xs font-medium text-pos">● {{ $t('dashboard.last7Days') }}</span>
    </div>
    <div class="h-40">
      <Line
        v-if="hasData"
        :data="chartData"
        :options="chartOptions"
      />
      <div
        v-else
        class="flex h-full items-center justify-center text-sm text-subtle"
      >
        {{ $t('common.noData') }}
      </div>
    </div>
  </div>
</template>
