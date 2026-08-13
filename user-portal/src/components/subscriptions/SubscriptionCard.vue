<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UserSubscription } from '@/api/types'
import type { ExpiryLevel, QuotaWindow } from '@/utils/subscription'
import {
  quotaWindows,
  hasAnyLimit,
  progressLevel,
  expiryLevel,
  daysRemaining,
  windowResetsIn,
  formatRemaining,
  isActive
} from '@/utils/subscription'
import { platformMeta } from '@/utils/platform'
import { formatDateMinute } from '@/utils/format'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import QuotaBar from './QuotaBar.vue'

const props = defineProps<{ sub: UserSubscription }>()
const emit = defineEmits<{ renew: [groupId: number] }>()

const { t } = useI18n()

const platform = computed(() => platformMeta(props.sub.group?.platform))
const groupName = computed(() => props.sub.group?.name ?? `#${props.sub.group_id}`)
const windows = computed(() => quotaWindows(props.sub))
const unlimited = computed(() => !hasAnyLimit(props.sub))
const active = computed(() => isActive(props.sub))

// 状态徽标：只有生效中走正向色，过期/暂停/撤销一律灰
const badgeVariant = computed(() => (active.value ? 'active' : 'muted'))
const badgeLabel = computed(() => t(`subscriptions.status.${props.sub.status}`))

const level = computed<ExpiryLevel>(() => expiryLevel(props.sub.expires_at))

// 到期文案色阶：紧急红、临近橙、已过期灰
const EXPIRY_CLASS: Record<ExpiryLevel, string> = {
  NORMAL: 'text-text2',
  SOON: 'text-[#C77800]',
  URGENT: 'text-neg',
  EXPIRED: 'text-subtle'
}

const expiryText = computed(() => {
  const date = formatDateMinute(props.sub.expires_at)
  if (level.value === 'EXPIRED') return `${date}（${t('subscriptions.expiredAlready')}）`
  return `${date}（${t('subscriptions.daysRemaining', { days: daysRemaining(props.sub.expires_at) })}）`
})

function quotaLabel(w: QuotaWindow): string {
  return t(`subscriptions.quota.${w.key}`)
}

function quotaLevel(w: QuotaWindow) {
  return progressLevel(w.used, w.limit)
}

function resetText(w: QuotaWindow): string {
  const ms = windowResetsIn(w.windowStart, w.windowHours)
  if (ms === null) return t('subscriptions.windowNotStarted')
  return t('subscriptions.resetIn', { time: formatRemaining(ms) })
}
</script>

<template>
  <div class="flex flex-col rounded-xl3 bg-card p-[22px_24px] shadow-card">
    <!-- 头部：平台圆点 + 分组名 + 状态 + 续费 -->
    <div class="mb-4 flex items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <span
            class="h-1.5 w-1.5 shrink-0 rounded-full"
            :style="{ backgroundColor: platform.color }"
          />
          <h3 class="truncate font-serif text-[19px] font-medium text-text">
            {{ groupName }}
          </h3>
          <span class="shrink-0 text-[11px] font-medium uppercase tracking-[0.1em] text-faint">
            {{ platform.label }}
          </span>
        </div>
        <p
          v-if="sub.group?.description"
          class="mt-1 truncate text-xs text-subtle"
        >
          {{ sub.group.description }}
        </p>
        <p
          v-if="typeof sub.group?.rate_multiplier === 'number'"
          class="mt-1 text-[11px] text-faint"
        >
          {{ $t('subscriptions.rate') }}：{{ sub.group.rate_multiplier }}×
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <StatusBadge
          :label="badgeLabel"
          :variant="badgeVariant"
        />
        <button
          v-if="active"
          class="rounded-full bg-accent px-4 py-[7px] text-xs font-semibold text-white transition-opacity hover:opacity-90"
          @click="emit('renew', sub.group_id)"
        >
          {{ $t('subscriptions.renew') }}
        </button>
      </div>
    </div>

    <!-- 到期时间 -->
    <div class="mb-4 flex items-center justify-between rounded-xl2 bg-muted px-4 py-2.5 text-[13px]">
      <span class="text-subtle">{{ $t('subscriptions.expiresAt') }}</span>
      <span
        class="font-medium"
        :class="EXPIRY_CLASS[level]"
      >{{ expiryText }}</span>
    </div>

    <!-- 额度进度 -->
    <div
      v-if="!unlimited"
      class="flex flex-col gap-4"
    >
      <QuotaBar
        v-for="w in windows"
        :key="w.key"
        :label="quotaLabel(w)"
        :used="w.used"
        :limit="w.limit"
        :level="quotaLevel(w)"
        :reset-text="resetText(w)"
      />
    </div>

    <!-- 无额度上限 -->
    <div
      v-else
      class="flex items-center gap-3 rounded-xl2 bg-muted px-4 py-5"
      data-testid="unlimited-block"
    >
      <span class="text-3xl leading-none text-accent">∞</span>
      <div>
        <p class="text-sm font-medium text-text">
          {{ $t('subscriptions.unlimited') }}
        </p>
        <p class="text-xs text-subtle">
          {{ $t('subscriptions.unlimitedDesc') }}
        </p>
      </div>
    </div>
  </div>
</template>
