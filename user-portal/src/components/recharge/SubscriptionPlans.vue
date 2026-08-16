<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SubscriptionPlan } from '@/api/types'
import { discountPercent, formatBalance, formatValidity } from '@/utils/format'
import { platformMeta, type PlatformMeta } from '@/utils/platform'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    plans: SubscriptionPlan[]
    /** 用户当前生效订阅的分组 ID：命中则该套餐按钮显示为「续费」 */
    activeGroupIds?: number[]
    /** 需要高亮的分组 ID（续费深链跳转定位用），null 表示不高亮 */
    highlightGroupId?: number | null
  }>(),
  { activeGroupIds: () => [], highlightGroupId: null }
)

const emit = defineEmits<{
  subscribe: [plan: SubscriptionPlan]
}>()

interface LimitLine {
  label: string
  value: string
}

interface PlanCard {
  plan: SubscriptionPlan
  /** 原价 > 现价时显示划线 */
  hasDiscount: boolean
  /** 折扣百分比（整数，>0 才展示徽章） */
  discount: number
  /** 仅含后端有值的额度限制行（每张卡只计算一次） */
  limitLines: LimitLine[]
  /** 三个额度上限皆无：展示「不限额度」而非整块消失 */
  unlimited: boolean
  /** 平台标签与圆点色 */
  platform: PlatformMeta
  /** 用户已有该分组的生效订阅 → 按钮文案变「续费」 */
  isRenewal: boolean
}

/** 额度限制行：只展示后端有值的那几行 */
function buildLimitLines(plan: SubscriptionPlan): LimitLine[] {
  const lines: LimitLine[] = []
  if (typeof plan.daily_limit_usd === 'number') {
    lines.push({ label: t('recharge.dailyLimit'), value: `$${formatBalance(plan.daily_limit_usd)}` })
  }
  if (typeof plan.weekly_limit_usd === 'number') {
    lines.push({ label: t('recharge.weeklyLimit'), value: `$${formatBalance(plan.weekly_limit_usd)}` })
  }
  if (typeof plan.monthly_limit_usd === 'number') {
    lines.push({ label: t('recharge.monthlyLimit'), value: `$${formatBalance(plan.monthly_limit_usd)}` })
  }
  return lines
}

// 每张卡的派生数据预计算一次，模板只读不再重复计算
const cards = computed<PlanCard[]>(() =>
  props.plans.map((plan) => {
    const limitLines = buildLimitLines(plan)
    return {
      plan,
      hasDiscount: typeof plan.original_price === 'number' && plan.original_price > plan.price,
      discount: discountPercent(plan.price, plan.original_price),
      limitLines,
      unlimited: limitLines.length === 0,
      platform: platformMeta(plan.group_platform),
      isRenewal: props.activeGroupIds.includes(plan.group_id)
    }
  })
)

const isEmpty = computed(() => props.plans.length === 0)
</script>

<template>
  <!-- 空态 -->
  <div
    v-if="isEmpty"
    class="rounded-xl3 border border-dashed border-border2 bg-card px-7 py-20 text-center"
  >
    <div class="mb-3 flex justify-center">
      <svg
        width="36"
        height="36"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        class="text-faint"
      >
        <rect
          x="2"
          y="7"
          width="20"
          height="14"
          rx="2.5"
        />
        <path d="M16 7V5a2 2 0 0 0-4 0v2" />
        <path
          d="M12 12v3"
          stroke-linecap="round"
        />
        <circle
          cx="12"
          cy="16"
          r=".5"
          fill="currentColor"
        />
      </svg>
    </div>
    <p class="text-sm text-subtle">
      {{ $t('recharge.noPlans') }}
    </p>
  </div>

  <!-- 套餐卡片网格
       卡片用 grid-template-rows: subgrid 把自己的 8 个区块映射到父网格的行轨道上，
       同一行的卡片逐行等高（标题换行数、描述长短不同也不会错位）；
       故卡片自身不能有 padding（会让内部轨道相对父轨道偏移），左右内边距下放到每个直接子元素。 -->
  <div
    v-else
    class="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
  >
    <div
      v-for="{ plan, hasDiscount, discount, limitLines, unlimited, platform, isRenewal } in cards"
      :key="plan.id"
      :data-plan-group="plan.group_id"
      class="row-span-8 grid grid-rows-subgrid gap-y-0 rounded-[20px] bg-card shadow-card transition-shadow duration-150 [&>*]:px-[26px] hover:shadow-[0_6px_24px_rgba(0,0,0,0.10)]"
      :class="{ 'ring-2 ring-accent': plan.group_id === highlightGroupId }"
    >
      <!-- 套餐名：平台圆点 + 分组名 + 平台标签 -->
      <div class="mb-1 flex items-center gap-2 pt-6 text-[11px] font-medium uppercase tracking-[0.12em] text-faint">
        <span
          class="h-1.5 w-1.5 shrink-0 rounded-full"
          :style="{ backgroundColor: platform.color }"
        />
        <span class="truncate">{{ plan.group_name ?? $t('recharge.planFallback') }}</span>
        <span class="shrink-0 text-faint/70">{{ platform.label }}</span>
      </div>
      <h3 class="mb-4 font-serif text-[22px] font-medium leading-snug text-text">
        {{ plan.name }}
      </h3>

      <!-- 描述：无描述时也保留空行占位，否则后面的区块会串到上一行轨道 -->
      <div :class="plan.description ? 'mb-5' : ''">
        <p
          v-if="plan.description"
          class="text-sm leading-relaxed text-subtle"
        >
          {{ plan.description }}
        </p>
      </div>

      <!-- 价格区域 -->
      <div class="mb-5 flex items-baseline gap-2">
        <span class="font-serif text-[34px] font-medium leading-none text-text">
          ${{ formatBalance(plan.price) }}
        </span>
        <span
          v-if="hasDiscount"
          class="text-sm text-faint line-through"
        >
          ${{ formatBalance(plan.original_price!) }}
        </span>
        <span
          v-if="discount > 0"
          class="rounded px-1.5 py-0.5 text-[11px] font-semibold text-neg"
          :title="$t('recharge.discountOff', { percent: discount })"
        >
          -{{ discount }}%
        </span>
      </div>

      <!-- 元信息网格：有效期 + 倍率（外层只负责占一行轨道，灰底块自己的内边距要独立一层，
           否则会被卡片的 [&>*]:px-[26px] 覆盖掉） -->
      <div class="mb-4">
        <div class="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl2 bg-muted px-4 py-3 text-[13px]">
          <div class="text-subtle">
            {{ $t('recharge.validity') }}
          </div>
          <div class="font-medium text-text">
            {{ formatValidity(plan.validity_days, plan.validity_unit) }}
          </div>
          <template v-if="typeof plan.rate_multiplier === 'number'">
            <div class="text-subtle">
              {{ $t('recharge.rateMultiplier') }}
            </div>
            <div class="font-medium text-text">
              {{ plan.rate_multiplier }}×
            </div>
          </template>
        </div>
      </div>

      <!-- 额度限制（有上限逐条列出，全空则「不限额度」，两种形态共用同一行轨道） -->
      <div class="mb-4 text-[13px]">
        <div
          v-if="limitLines.length"
          class="flex flex-col gap-1.5"
        >
          <div
            v-for="line in limitLines"
            :key="line.label"
            class="flex items-center justify-between rounded-xl border border-dashed border-border2 px-3 py-1.5"
          >
            <span class="text-subtle">{{ line.label }}</span>
            <span class="font-medium text-accent">{{ line.value }}</span>
          </div>
        </div>
        <div
          v-else-if="unlimited"
          class="flex items-center justify-between rounded-xl border border-dashed border-border2 px-3 py-1.5"
        >
          <span class="text-subtle">{{ $t('recharge.quotaLabel') }}</span>
          <span class="font-medium text-accent">{{ $t('recharge.unlimitedQuota') }}</span>
        </div>
      </div>

      <!-- 特性列表：无特性时同样保留空行占位 -->
      <div :class="plan.features && plan.features.length ? 'mb-6' : ''">
        <ul
          v-if="plan.features && plan.features.length"
          class="flex flex-col gap-1.5"
        >
          <li
            v-for="(feat, idx) in plan.features"
            :key="idx"
            class="flex items-start gap-2 text-[13px] text-text2"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              class="mt-[2px] flex-none text-accent"
            >
              <path
                d="M20 6L9 17l-5-5"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            {{ feat }}
          </li>
        </ul>
      </div>

      <!-- 选择按钮：处在最后一行轨道，同行卡片的按钮天然底部对齐 -->
      <div class="flex items-end pb-6">
        <button
          class="w-full cursor-pointer rounded-xl2 bg-accent py-[13px] text-[14px] font-semibold text-white shadow-[0_4px_14px_rgba(20,194,138,0.28)] transition-[background,box-shadow,opacity] duration-150 hover:bg-accent/90"
          @click="emit('subscribe', plan)"
        >
          {{ isRenewal ? $t('recharge.renewPlan') : $t('recharge.selectPlan') }}
        </button>
      </div>
    </div>
  </div>
</template>
