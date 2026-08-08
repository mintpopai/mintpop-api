<script setup lang="ts">
import { useRouter } from 'vue-router'
import { SHOP_PAGE_URL } from '@/config/portal'

const router = useRouter()

/** 快捷操作项：`to` 为站内路由，`href` 为外链，二选一（外链新开页并标 ↗ 与站内区分） */
type QuickAction = {
  titleKey: string
  descKey: string
  to?: string
  href?: string
}

const actions: QuickAction[] = [
  { titleKey: 'dashboard.quickActions.createKey.title', descKey: 'dashboard.quickActions.createKey.desc', to: '/keys' },
  { titleKey: 'dashboard.quickActions.viewUsage.title', descKey: 'dashboard.quickActions.viewUsage.desc', to: '/usage' },
  { titleKey: 'dashboard.quickActions.redeem.title', descKey: 'dashboard.quickActions.redeem.desc', to: '/recharge#redeem' },
  { titleKey: 'dashboard.quickActions.shop.title', descKey: 'dashboard.quickActions.shop.desc', href: SHOP_PAGE_URL }
]

function go(to: string) {
  router.push(to)
}
</script>

<template>
  <div class="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
    <component
      :is="a.href ? 'a' : 'button'"
      v-for="a in actions"
      :key="a.titleKey"
      :href="a.href"
      :target="a.href ? '_blank' : undefined"
      :rel="a.href ? 'noopener' : undefined"
      class="flex items-center justify-between gap-3 rounded-xl2 bg-card px-[22px] py-5 text-left shadow-soft transition hover:shadow-card"
      @click="a.href ? undefined : go(a.to!)"
    >
      <div>
        <div class="text-sm font-semibold text-text">
          {{ $t(a.titleKey) }}
        </div>
        <div class="mt-1 text-xs text-subtle">
          {{ $t(a.descKey) }}
        </div>
      </div>
      <span
        class="shrink-0 text-lg text-accent"
        aria-hidden="true"
      >{{ a.href ? '↗' : '→' }}</span>
    </component>
  </div>
</template>
