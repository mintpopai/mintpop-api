<script setup lang="ts">
import { onMounted, ref } from 'vue'
import PageSkeleton from '@/components/common/PageSkeleton.vue'
import HeroBalance from '@/components/dashboard/HeroBalance.vue'
import KpiRow from '@/components/dashboard/KpiRow.vue'
import ModelDistribution from '@/components/dashboard/ModelDistribution.vue'
import VendorDistribution from '@/components/dashboard/VendorDistribution.vue'
import TrendChart from '@/components/dashboard/TrendChart.vue'
import LifetimeStrip from '@/components/dashboard/LifetimeStrip.vue'
import QuickActions from '@/components/dashboard/QuickActions.vue'
import ExpiryBanner from '@/components/dashboard/ExpiryBanner.vue'
import SubscriptionOverview from '@/components/dashboard/SubscriptionOverview.vue'
import { useDashboard } from '@/composables/useDashboard'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { getAffiliateDetail } from '@/api/user'

const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const { stats, trend, models, loading, error, loadAll } = useDashboard()

// 邀请返利角标：站点开启邀请返利时展示当前用户实际生效的返利比例；
// 拉取失败只影响角标（静默隐藏），不影响仪表盘主体
const inviteRatePercent = ref<number | null>(null)

async function loadInviteRate(): Promise<void> {
  await settingsStore.ensureLoaded()
  if (!settingsStore.settings?.affiliate_enabled) return
  try {
    inviteRatePercent.value = (await getAffiliateDetail()).effective_rebate_rate_percent
  } catch {
    inviteRatePercent.value = null
  }
}

onMounted(() => {
  loadAll()
  void loadInviteRate()
})
</script>

<template>
  <div>
    <!-- 页头 -->
    <div class="mb-[34px] flex items-start justify-between">
      <div>
        <h1 class="mb-2 font-serif text-4xl font-medium tracking-tight text-text">
          {{ $t('dashboard.title') }}
        </h1>
        <p class="text-sm text-subtle">
          {{ $t('dashboard.welcome') }}
        </p>
      </div>
      <div class="flex items-center gap-2.5">
        <span class="rounded-full bg-card px-4 py-2.5 text-[13px] font-medium text-text2 shadow-pill">{{ $t('dashboard.last7Days') }}</span>
        <button
          class="rounded-full bg-card px-4 py-2.5 text-[13px] font-medium text-text2 shadow-pill hover:text-text"
          :disabled="loading"
          @click="loadAll"
        >
          {{ $t('common.refresh') }}
        </button>
      </div>
    </div>

    <!-- 订阅到期提醒（独立于仪表盘统计的加载状态） -->
    <ExpiryBanner />

    <!-- 加载态 -->
    <PageSkeleton
      v-if="loading && !stats"
      variant="cards"
    />

    <!-- 错误态 -->
    <div
      v-else-if="error && !stats"
      class="rounded-xl3 border border-dashed border-border2 bg-card px-7 py-16 text-center"
    >
      <p class="text-sm text-subtle">
        {{ error }}
      </p>
      <button
        class="mt-4 rounded-full border border-text px-5 py-2 text-sm font-semibold text-text"
        @click="loadAll"
      >
        {{ $t('common.retry') }}
      </button>
    </div>

    <!-- 内容 -->
    <template v-else-if="stats">
      <HeroBalance
        :balance="authStore.balance"
        :today-cost="stats.today_actual_cost"
        :invite-rate-percent="inviteRatePercent"
      />

      <KpiRow :stats="stats" />

      <SubscriptionOverview />

      <div class="mb-[22px] grid grid-cols-1 gap-[22px] lg:grid-cols-2">
        <ModelDistribution :models="models" />
        <VendorDistribution :by-platform="stats.by_platform || []" />
      </div>

      <TrendChart :trend="trend" />

      <LifetimeStrip :stats="stats" />

      <QuickActions />
    </template>
  </div>
</template>
