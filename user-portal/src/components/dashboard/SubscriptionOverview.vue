<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useSubscriptionsStore } from '@/stores/subscriptions'
import type { UserSubscription } from '@/api/types'
import {
  tightestQuota,
  progressPercent,
  progressLevel,
  daysRemaining,
  type QuotaLevel
} from '@/utils/subscription'
import { formatBalance } from '@/utils/format'

const router = useRouter()
const store = useSubscriptionsStore()
const { t } = useI18n()

const BAR_CLASS: Record<QuotaLevel, string> = {
  NORMAL: 'bg-accent',
  WARNING: 'bg-[#F59E0B]',
  DANGER: 'bg-neg'
}

/** 概览每行只展示「用得最满」的那条额度；无上限时展示不限额度 */
function quotaOf(sub: UserSubscription) {
  return tightestQuota(sub)
}

function quotaText(sub: UserSubscription): string {
  const w = quotaOf(sub)
  if (!w) return t('subscriptions.unlimited')
  return `${t(`subscriptions.quota.${w.key}`)} $${formatBalance(w.used)} / $${formatBalance(w.limit)}`
}

/** 进度百分比：既用于条宽，也用于 aria-valuenow（与 QuotaBar 口径一致） */
function barPercent(sub: UserSubscription): number {
  const w = quotaOf(sub)
  return w ? progressPercent(w.used, w.limit) : 0
}

function barWidth(sub: UserSubscription): string {
  return `${barPercent(sub)}%`
}

/** 订阅行的展示名（分组名缺失时退化成 #id），同时用作进度条的 aria-label */
function subName(sub: UserSubscription): string {
  return sub.group?.name ?? `#${sub.group_id}`
}

function barClass(sub: UserSubscription): string {
  const w = quotaOf(sub)
  return BAR_CLASS[w ? progressLevel(w.used, w.limit) : 'NORMAL']
}

onMounted(() => {
  void store.ensureLoaded()
})
</script>

<template>
  <!-- 无生效订阅时整块不渲染：仪表盘不该为一个用不上的功能占位 -->
  <div
    v-if="store.activeItems.length > 0"
    class="mb-[22px] rounded-xl3 bg-card p-[22px_24px] shadow-card"
  >
    <div class="mb-4 flex items-center justify-between">
      <h3 class="font-serif text-xl font-medium text-text">
        {{ $t('subscriptions.overviewTitle') }}
      </h3>
      <button
        class="text-[13px] font-medium text-subtle hover:text-text"
        @click="router.push('/subscriptions')"
      >
        {{ $t('subscriptions.overviewMore') }}
      </button>
    </div>

    <div class="flex flex-col gap-4">
      <div
        v-for="sub in store.activeItems"
        :key="sub.id"
        class="flex flex-col gap-1.5"
      >
        <div class="flex items-center justify-between text-[13px]">
          <span class="truncate font-medium text-text2">
            {{ subName(sub) }}
          </span>
          <span class="shrink-0 text-subtle">
            <!-- 第三个参数是单复数选择值：英文有单/复数两式，中文单形式（不受影响） -->
            {{
              $t(
                'subscriptions.daysRemaining',
                { days: daysRemaining(sub.expires_at) },
                daysRemaining(sub.expires_at)
              )
            }}
          </span>
        </div>
        <div
          class="h-2 overflow-hidden rounded-full bg-track"
          role="progressbar"
          :aria-valuenow="Math.round(barPercent(sub))"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-label="subName(sub)"
        >
          <div
            class="h-full rounded-full"
            :class="barClass(sub)"
            :style="{ width: barWidth(sub) }"
          />
        </div>
        <p class="text-[11px] text-faint">
          {{ quotaText(sub) }}
        </p>
      </div>
    </div>
  </div>
</template>
