<script setup lang="ts">
import { formatBalance, formatCost, formatRebateRate } from '@/utils/format'
import { SHOP_PAGE_URL } from '@/config/portal'

defineProps<{
  balance: number
  todayCost: number
  /** 邀请返利比例（0-100）；null/缺省 = 功能关闭或未加载，不展示角标 */
  inviteRatePercent?: number | null
}>()

const shopUrl = SHOP_PAGE_URL
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

    <!-- 角标区：贴卡片顶部、避开右侧网点装饰（装饰自右缘起约 220px，md 起左移让位）。
         用 flex 排列而非各自绝对定位——邀请返利可能关闭，谁不显示谁不占位。 -->
    <div class="absolute right-[42px] top-[30px] flex items-center gap-2 md:right-[250px]">
      <!-- MintPop Shop 外链：中性配色，把绿色让给邀请返利，主次分明；
           促销位文案用疑问句（顶栏是导航位，另用名词 nav.shop），
           完整说明沿用与顶栏同一份 nav.shopHint。
           md 以下整个角标不渲染：窄屏 hero 要留给 64px 大字余额，两个角标并排会压到数字上
           （英文文案更长会直接溢出被裁）；移动端入口由顶栏汉堡抽屉那条承担，不缺入口。 -->
      <span class="group relative hidden md:block">
        <a
          :href="shopUrl"
          target="_blank"
          rel="noopener"
          aria-describedby="hero-shop-hint"
          class="inline-block rounded-full bg-muted px-4 py-2 text-[13px] font-semibold text-text2 transition-colors hover:bg-track hover:text-text"
        >
          {{ $t('dashboard.hero.shopBadge') }} <span aria-hidden="true">↗</span>
        </a>
        <span
          id="hero-shop-hint"
          role="tooltip"
          class="pointer-events-none absolute right-0 top-full z-20 mt-1.5 hidden w-max max-w-[260px] rounded-xl border border-border bg-card px-3 py-2 text-xs font-normal leading-snug text-text2 opacity-0 shadow-menu transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 md:block"
        >
          {{ $t('nav.shopHint') }}
        </span>
      </span>

      <RouterLink
        v-if="inviteRatePercent != null"
        to="/invite"
        class="rounded-full bg-accent/10 px-4 py-2 text-[13px] font-semibold text-pos transition-colors hover:bg-accent/15"
      >
        {{ $t('dashboard.hero.inviteBadge', { rate: formatRebateRate(inviteRatePercent) }) }} →
      </RouterLink>
    </div>

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
