<script setup lang="ts">
// 换页首屏的占位骨架，替代原先居中转圈的 spinner。
// 目的不是「显示正在加载」（那 spinner 也能做），而是让内容区在数据到达前就先占住
// 接近真实结果的版面：切 tab 时不再出现「空白/转圈 → 内容整块砸下来」的二次跳变。
// 形状按页面大类分三种，与各页首屏真实结构对齐：
//   cards — 卡片/网格页（仪表盘、订阅、充值、邀请）
//   table — 列表页（用量、密钥、订单）
//   form  — 表单页（个人资料）
withDefaults(defineProps<{ variant?: 'cards' | 'table' | 'form'; rows?: number }>(), {
  variant: 'cards',
  rows: 6
})
</script>

<template>
  <div
    class="animate-pulse"
    role="status"
    :aria-label="$t('common.loading')"
  >
    <!-- 卡片/网格页：主卡 + 一排指标 + 两栏内容 -->
    <template v-if="variant === 'cards'">
      <div class="mb-[22px] h-[132px] rounded-xl3 bg-muted" />
      <div class="mb-[22px] grid grid-cols-1 gap-[22px] sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="i in 4"
          :key="i"
          class="h-[104px] rounded-xl3 bg-muted"
        />
      </div>
      <div class="grid grid-cols-1 gap-[22px] lg:grid-cols-2">
        <div class="h-[240px] rounded-xl3 bg-muted" />
        <div class="h-[240px] rounded-xl3 bg-muted" />
      </div>
    </template>

    <!-- 列表页：筛选条 + 等高行（行数按 rows） -->
    <template v-else-if="variant === 'table'">
      <div class="mb-[22px] h-[52px] rounded-full bg-muted" />
      <div class="overflow-hidden rounded-xl3 bg-card shadow-card">
        <div class="h-[46px] bg-muted" />
        <div
          v-for="i in rows"
          :key="i"
          class="flex items-center gap-4 border-t border-border px-6 py-[18px]"
        >
          <div class="h-3.5 flex-1 rounded bg-track" />
          <div class="h-3.5 w-1/6 rounded bg-track" />
          <div class="h-3.5 w-1/12 rounded bg-track" />
        </div>
      </div>
    </template>

    <!-- 表单页：主卡 + 若干字段行 -->
    <template v-else>
      <div class="mb-[22px] h-[120px] rounded-xl3 bg-muted" />
      <div class="rounded-xl3 bg-card px-7 py-8 shadow-card">
        <div
          v-for="i in rows"
          :key="i"
          class="mb-5 last:mb-0"
        >
          <div class="mb-2.5 h-3 w-24 rounded bg-track" />
          <div class="h-[42px] rounded-[11px] bg-muted" />
        </div>
      </div>
    </template>
  </div>
</template>
