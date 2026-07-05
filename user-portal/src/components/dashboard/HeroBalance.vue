<script setup lang="ts">
import { formatBalance, formatCost, formatRebateRate } from '@/utils/format'

defineProps<{
  balance: number
  todayCost: number
  /** 邀请返利比例（0-100）；null/缺省 = 功能关闭或未加载，不展示角标 */
  inviteRatePercent?: number | null
}>()
</script>

<template>
  <div
    class="relative mb-[22px] flex items-end justify-between overflow-hidden rounded-xl4 bg-card px-[42px] py-[38px] shadow-card"
  >
    <!-- 网点装饰 -->
    <div
      class="pointer-events-none absolute bottom-[-50px] -right-10 h-[260px] w-[260px] opacity-60"
      style="
        background: linear-gradient(150deg, #0e9e72 0%, #14c28a 45%, rgba(20, 194, 138, 0) 92%);
        -webkit-mask-image: radial-gradient(#000 2px, transparent 2.2px);
        mask-image: radial-gradient(#000 2px, transparent 2.2px);
        -webkit-mask-size: 17px 17px;
        mask-size: 17px 17px;
      "
    />

    <div class="relative">
      <div class="mb-3.5 text-xs font-semibold uppercase tracking-[0.12em] text-faint">
        {{ $t('dashboard.hero.balanceAvailable') }}
      </div>
      <div class="num text-[64px] font-medium leading-[0.95] tracking-tight text-text">
        ${{ formatBalance(balance) }}
      </div>
      <div class="mt-[18px] inline-block h-1 w-[60px] rounded-xs bg-accent" />
      <div class="mt-[13px] text-sm text-subtle">
        {{ $t('dashboard.hero.todayCost', { cost: formatCost(todayCost) }) }}
      </div>
    </div>

    <!-- 邀请返利角标：贴卡片顶部、避开右侧网点装饰（装饰自右缘起约 220px，md 起左移让位） -->
    <RouterLink
      v-if="inviteRatePercent != null"
      to="/invite"
      class="absolute right-[42px] top-[30px] rounded-full bg-accent/10 px-4 py-2 text-[13px] font-semibold text-pos transition-colors hover:bg-accent/15 md:right-[250px]"
    >
      {{ $t('dashboard.hero.inviteBadge', { rate: formatRebateRate(inviteRatePercent) }) }} →
    </RouterLink>

    <div class="relative">
      <RouterLink
        to="/recharge"
        class="inline-block cursor-pointer rounded-full border-[1.5px] border-text bg-card px-7 py-3 text-sm font-semibold text-text"
      >
        {{ $t('dashboard.hero.recharge') }} →
      </RouterLink>
    </div>
  </div>
</template>
