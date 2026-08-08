<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const actions = [
  { titleKey: 'dashboard.quickActions.createKey.title', descKey: 'dashboard.quickActions.createKey.desc', to: '/keys' },
  { titleKey: 'dashboard.quickActions.viewUsage.title', descKey: 'dashboard.quickActions.viewUsage.desc', to: '/usage' },
  { titleKey: 'dashboard.quickActions.redeem.title', descKey: 'dashboard.quickActions.redeem.desc', to: '/recharge#redeem' }
]

function go(to: string) {
  router.push(to)
}
</script>

<template>
  <div class="grid grid-cols-1 gap-[18px] sm:grid-cols-3">
    <button
      v-for="a in actions"
      :key="a.titleKey"
      class="flex items-center justify-between rounded-xl2 bg-card px-[22px] py-5 text-left shadow-soft transition hover:shadow-card"
      @click="go(a.to)"
    >
      <div>
        <div class="text-sm font-semibold text-text">
          {{ $t(a.titleKey) }}
        </div>
        <div class="mt-1 text-xs text-subtle">
          {{ $t(a.descKey) }}
        </div>
      </div>
      <span class="text-lg text-accent">→</span>
    </button>
  </div>
</template>
