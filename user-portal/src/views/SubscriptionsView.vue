<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import PortalLayout from '@/layouts/PortalLayout.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import SubscriptionCard from '@/components/subscriptions/SubscriptionCard.vue'
import { useSubscriptionsStore } from '@/stores/subscriptions'
import { useSettingsStore } from '@/stores/settings'

const router = useRouter()
const store = useSubscriptionsStore()
const settingsStore = useSettingsStore()

// 站点未开放订阅购买时不给「去订阅」按钮（点进去也是空的），
// 但页面本身照常展示——管理员分配的订阅同样要能看到。
const canPurchase = computed(() => settingsStore.settings?.purchase_subscription_enabled ?? false)

/** 续费：跳到充值页订阅 tab 并定位到该分组的套餐 */
function goRenew(groupId: number) {
  router.push({ path: '/recharge', query: { tab: 'subscription', group: String(groupId) } })
}

onMounted(async () => {
  await settingsStore.ensureLoaded()
  await store.ensureLoaded()
})
</script>

<template>
  <PortalLayout>
    <PageHeader
      :title="$t('subscriptions.pageTitle')"
      :subtitle="$t('subscriptions.pageSubtitle')"
    >
      <template #actions>
        <button
          class="rounded-full bg-card px-4 py-2.5 text-[13px] font-medium text-text2 shadow-pill hover:text-text"
          :disabled="store.loading"
          @click="store.refresh()"
        >
          {{ $t('common.refresh') }}
        </button>
      </template>
    </PageHeader>

    <!-- 加载态 -->
    <div
      v-if="store.loading && !store.loaded"
      class="flex items-center justify-center py-24"
    >
      <LoadingSpinner :size="32" />
    </div>

    <!-- 错误态：与「没有套餐」区分开，给重试 -->
    <div
      v-else-if="store.error && !store.loaded"
      class="rounded-xl3 border border-dashed border-border2 bg-card px-7 py-16 text-center"
    >
      <p class="text-sm text-subtle">
        {{ store.error }}
      </p>
      <button
        class="mt-4 rounded-full border border-text px-5 py-2 text-sm font-semibold text-text"
        @click="store.refresh()"
      >
        {{ $t('common.retry') }}
      </button>
    </div>

    <!-- 空态 -->
    <div
      v-else-if="store.sorted.length === 0"
      class="rounded-xl3 border border-dashed border-border2 bg-card px-7 py-20 text-center"
    >
      <p class="mb-2 font-serif text-lg font-medium text-text">
        {{ $t('subscriptions.empty') }}
      </p>
      <p class="text-sm text-subtle">
        {{ $t('subscriptions.emptyDesc') }}
      </p>
      <button
        v-if="canPurchase"
        class="mt-5 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        @click="router.push({ path: '/recharge', query: { tab: 'subscription' } })"
      >
        {{ $t('subscriptions.emptyAction') }}
      </button>
    </div>

    <!-- 卡片网格 -->
    <div
      v-else
      class="grid grid-cols-1 gap-[22px] lg:grid-cols-2"
    >
      <SubscriptionCard
        v-for="sub in store.sorted"
        :key="sub.id"
        :sub="sub"
        @renew="goRenew"
      />
    </div>
  </PortalLayout>
</template>
