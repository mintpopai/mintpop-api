<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSubscriptionsStore } from '@/stores/subscriptions'
import { useSettingsStore } from '@/stores/settings'
import { daysRemaining } from '@/utils/subscription'

const router = useRouter()
const store = useSubscriptionsStore()
const settingsStore = useSettingsStore()

// 站点未开放订阅购买时不给「立即续费」按钮：充值页不渲染订阅 tab、深链也会直接 bail，
// 点过去只会落到余额充值 tab 且没有任何解释。横幅本身照常展示（到期信息仍然有用）。
const canPurchase = computed(() => settingsStore.settings?.purchase_subscription_enabled ?? false)

// 关闭状态只在本次会话生效：下次打开浏览器还没续费的话，该提醒应该再出现
const DISMISS_KEY = 'subscriptionExpiryBannerDismissed'
const dismissed = ref(false)

const soonest = computed(() => store.expiringSoon[0] ?? null)
const moreCount = computed(() => Math.max(0, store.expiringSoon.length - 1))
const visible = computed(() => !dismissed.value && soonest.value !== null)

const name = computed(() => soonest.value?.group?.name ?? `#${soonest.value?.group_id ?? ''}`)
// 剩余天数向上取整，最小显示 1 天（当天到期不该显示「0 天后到期」）
const days = computed(() => Math.max(1, daysRemaining(soonest.value?.expires_at)))

function dismiss() {
  dismissed.value = true
  try {
    sessionStorage.setItem(DISMISS_KEY, '1')
  } catch {
    // 隐私模式下 sessionStorage 可能不可用，忽略即可（本次渲染已关闭）
  }
}

function goRenew() {
  if (!soonest.value) return
  router.push({
    path: '/recharge',
    query: { tab: 'subscription', group: String(soonest.value.group_id) }
  })
}

onMounted(() => {
  try {
    dismissed.value = sessionStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    dismissed.value = false
  }
  void store.ensureLoaded()
  void settingsStore.ensureLoaded()
})
</script>

<template>
  <div
    v-if="visible"
    class="mb-[22px] flex flex-wrap items-center justify-between gap-3 rounded-xl3 border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-6 py-4"
    role="status"
  >
    <div class="min-w-0">
      <p class="text-sm font-medium text-text">
        <!-- 第三个参数是单复数选择值：英文有单/复数两式，中文单形式（不受影响） -->
        {{ $t('subscriptions.expiryBanner', { name, days }, days) }}
      </p>
      <button
        v-if="moreCount > 0"
        class="mt-1 text-xs text-subtle underline-offset-2 hover:underline"
        @click="router.push('/subscriptions')"
      >
        {{ $t('subscriptions.expiryBannerMore', { count: moreCount }, moreCount) }}
      </button>
    </div>
    <div class="flex shrink-0 items-center gap-2">
      <button
        v-if="canPurchase"
        class="rounded-full bg-accent px-5 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
        @click="goRenew"
      >
        {{ $t('subscriptions.expiryBannerAction') }}
      </button>
      <button
        class="rounded-full px-3 py-2 text-[13px] text-subtle hover:text-text"
        :aria-label="$t('subscriptions.dismiss')"
        @click="dismiss"
      >
        ✕
      </button>
    </div>
  </div>
</template>
