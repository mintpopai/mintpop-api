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

function barWidth(sub: UserSubscription): string {
  const w = quotaOf(sub)
  return w ? `${progressPercent(w.used, w.limit)}%` : '0%'
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
      <h2 class="font-serif text-[19px] font-medium text-text">
        {{ $t('subscriptions.overviewTitle') }}
      </h2>
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
            {{ sub.group?.name ?? `#${sub.group_id}` }}
          </span>
          <span class="shrink-0 text-subtle">
            {{ $t('subscriptions.daysRemaining', { days: daysRemaining(sub.expires_at) }) }}
          </span>
        </div>
        <div class="h-2 overflow-hidden rounded-full bg-track">
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
