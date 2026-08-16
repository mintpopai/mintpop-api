<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SubscriptionPlan } from '@/api/types'
import { pickBilingual } from '@/utils/bilingual'
import { discountPercent, formatBalance, formatValidity } from '@/utils/format'
import { platformMeta, type PlatformMeta } from '@/utils/platform'

const { t, locale } = useI18n()

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

interface SpecRow {
  label: string
  value: string
  /** 「不限额度」这类正向结论用强调色，普通数值保持常规色 */
  highlight?: boolean
}

interface PlanCard {
  plan: SubscriptionPlan
  /** 说明块按行拆成条目（按当前语言取块，见 pickBilingual） */
  bullets: string[]
  /** 分组名，与套餐名重复时置空（后端两处常写同一串，避免同一句话展示两遍） */
  groupTag: string
  /** 有效期展示串，跟在价格后面（「/ 30天」） */
  validity: string
  /** 原价 > 现价时显示划线 */
  hasDiscount: boolean
  /** 折扣百分比（整数，>0 才展示徽章） */
  discount: number
  /** 规格表：倍率 + 各档额度上限，全空时退化为一行「不限额度」 */
  specRows: SpecRow[]
  /** 平台标签与圆点色 */
  platform: PlatformMeta
  /** 用户已有该分组的生效订阅 → 标「当前套餐」、按钮文案变「续费」 */
  isRenewal: boolean
}

/**
 * 说明块拆条：后端文本每行自带「· / • / - / *」前缀，统一剥掉，
 * 圆点改由样式画，免得和下方特性列表的 ✓ 形成两套符号语言。
 */
function toBullets(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.replace(/^\s*[·•・‧-]\s*/, '').trim())
    .filter(Boolean)
}

/** 规格表：倍率 + 后端有值的额度行；三档额度皆空时给一行「不限额度」 */
function buildSpecRows(plan: SubscriptionPlan): SpecRow[] {
  const rows: SpecRow[] = []
  if (typeof plan.rate_multiplier === 'number') {
    rows.push({ label: t('recharge.rateMultiplier'), value: `${plan.rate_multiplier}×` })
  }
  const quota: SpecRow[] = []
  if (typeof plan.daily_limit_usd === 'number') {
    quota.push({ label: t('recharge.dailyLimit'), value: `$${formatBalance(plan.daily_limit_usd)}` })
  }
  if (typeof plan.weekly_limit_usd === 'number') {
    quota.push({ label: t('recharge.weeklyLimit'), value: `$${formatBalance(plan.weekly_limit_usd)}` })
  }
  if (typeof plan.monthly_limit_usd === 'number') {
    quota.push({ label: t('recharge.monthlyLimit'), value: `$${formatBalance(plan.monthly_limit_usd)}` })
  }
  if (quota.length === 0) {
    quota.push({ label: t('recharge.quotaLabel'), value: t('recharge.unlimitedQuota'), highlight: true })
  }
  return rows.concat(quota)
}

// 每张卡的派生数据预计算一次，模板只读不再重复计算
const cards = computed<PlanCard[]>(() =>
  props.plans.map((plan) => {
    const group = plan.group_name?.trim() ?? ''
    return {
      plan,
      bullets: toBullets(pickBilingual(plan.description, locale.value)),
      groupTag: group && !plan.name.includes(group) ? group : '',
      validity: formatValidity(plan.validity_days, plan.validity_unit),
      hasDiscount: typeof plan.original_price === 'number' && plan.original_price > plan.price,
      discount: discountPercent(plan.price, plan.original_price),
      specRows: buildSpecRows(plan),
      platform: platformMeta(plan.group_platform),
      isRenewal: props.activeGroupIds.includes(plan.group_id)
    }
  })
)

const isEmpty = computed(() => props.plans.length === 0)

/**
 * 列数按在售套餐数收敛：只有 1~2 个套餐时仍开三列，会在右侧留下一整格空位，
 * 看着像没加载完；故少于三个时压成对应列数并限宽，卡片保持与三列时相近的宽度。
 */
const gridClass = computed(() => {
  switch (props.plans.length) {
    case 1:
      return 'max-w-[400px]'
    case 2:
      return 'md:grid-cols-2 max-w-[820px]'
    default:
      return 'md:grid-cols-2 lg:grid-cols-3'
  }
})
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
       卡片用 grid-template-rows: subgrid 把自己映射到父网格的行轨道上，跨卡片对齐**四个段落**
       （头部 / 价格 / 规格 / 按钮）而不是每个小元素：段内高度差只在段末尾留白，不会像逐元素对齐
       那样在标题与说明之间撑出一条空缝；价格与按钮仍严格同高，方便横向比价。
       故卡片自身不能有 padding（会让内部轨道相对父轨道偏移），左右内边距下放到每个段落。 -->
  <div
    v-else
    class="grid grid-cols-1 gap-5"
    :class="gridClass"
  >
    <div
      v-for="{
        plan,
        bullets,
        groupTag,
        validity,
        hasDiscount,
        discount,
        specRows,
        platform,
        isRenewal
      } in cards"
      :key="plan.id"
      :data-plan-group="plan.group_id"
      class="row-span-4 grid grid-rows-subgrid gap-y-0 rounded-[20px] bg-card shadow-card transition-shadow duration-150 [&>*]:px-7 hover:shadow-[0_6px_22px_rgba(0,0,0,0.08)]"
      :class="
        plan.group_id === highlightGroupId
          ? 'ring-2 ring-accent'
          : isRenewal
            ? 'ring-1 ring-accent/35'
            : ''
      "
    >
      <!-- ① 头部：平台徽章 + 套餐名 + 说明 -->
      <div class="pb-6 pt-7">
        <div class="mb-3 flex items-center gap-2">
          <span
            class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-[3px] text-[10.5px] font-semibold uppercase tracking-[0.1em] text-text2"
            :style="{ backgroundColor: `${platform.color}1f` }"
          >
            <span
              class="h-1.5 w-1.5 rounded-full"
              :style="{ backgroundColor: platform.color }"
            />
            {{ platform.label }}
          </span>
          <span
            v-if="groupTag"
            class="truncate text-[11.5px] text-faint"
          >{{ groupTag }}</span>
          <span
            v-if="isRenewal"
            class="ml-auto shrink-0 rounded-full bg-muted px-2 py-[3px] text-[10.5px] font-semibold text-text2"
          >{{ $t('recharge.currentPlan') }}</span>
        </div>

        <h3 class="font-serif text-[20px] font-medium leading-[1.35] text-text">
          {{ plan.name }}
        </h3>

        <ul
          v-if="bullets.length"
          class="mt-2.5 flex flex-col gap-1"
        >
          <li
            v-for="(line, idx) in bullets"
            :key="idx"
            class="flex gap-2 text-[13px] leading-[1.55] text-text2"
          >
            <span class="mt-[8px] h-[3px] w-[3px] shrink-0 rounded-full bg-faint" />
            <span>{{ line }}</span>
          </li>
        </ul>
      </div>

      <!-- ② 价格：现价 + 有效期同排，折扣信息降为次行 -->
      <div class="pb-6">
        <div class="flex flex-wrap items-baseline gap-x-2">
          <span class="font-serif text-[34px] font-medium leading-none text-text">
            ${{ formatBalance(plan.price) }}
          </span>
          <span class="text-[13px] text-subtle">/ {{ validity }}</span>
        </div>
        <div
          v-if="hasDiscount || discount > 0"
          class="mt-2 flex items-center gap-2 text-[12px]"
        >
          <span
            v-if="hasDiscount"
            class="text-faint line-through"
          >
            ${{ formatBalance(plan.original_price!) }}
          </span>
          <span
            v-if="discount > 0"
            class="rounded-full bg-accent/12 px-1.5 py-[2px] font-semibold text-pos"
            :title="$t('recharge.discountOff', { percent: discount })"
          >
            -{{ discount }}%
          </span>
        </div>
      </div>

      <!-- ③ 规格表：倍率 / 各档额度逐行对照，附加特性跟在表下 -->
      <div class="pb-6">
        <div class="border-t border-border">
          <div
            v-for="row in specRows"
            :key="row.label"
            class="flex items-center justify-between border-b border-border py-[9px] text-[13px]"
          >
            <span class="text-subtle">{{ row.label }}</span>
            <span
              class="font-medium"
              :class="row.highlight ? 'text-pos' : 'text-text'"
            >{{ row.value }}</span>
          </div>
        </div>

        <ul
          v-if="plan.features && plan.features.length"
          class="mt-3.5 flex flex-col gap-1.5"
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
              class="mt-[3px] flex-none text-accent"
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

      <!-- ④ 选择按钮：处在最后一段轨道，同行卡片的按钮天然底部对齐 -->
      <div class="flex items-end pb-7">
        <button
          class="w-full cursor-pointer rounded-xl2 bg-accent py-[13px] text-[14px] font-semibold text-white transition-colors duration-150 hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          @click="emit('subscribe', plan)"
        >
          {{ isRenewal ? $t('recharge.renewPlan') : $t('recharge.selectPlan') }}
        </button>
      </div>
    </div>
  </div>
</template>
