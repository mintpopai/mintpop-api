<script setup lang="ts">
defineProps<{ label: string; value: string; hint?: string; accent?: boolean }>()
</script>

<template>
  <div class="rounded-xl2 bg-card p-[22px] shadow-soft">
    <div class="mb-3.5 text-[11px] font-medium uppercase tracking-widest text-faint">
      {{ label }}
    </div>
    <div
      class="num text-[32px] font-medium leading-none"
      :class="accent ? 'text-accent' : 'text-text'"
    >
      {{ value }}
    </div>
    <div
      v-if="hint"
      class="mt-2.5 text-xs text-subtle"
    >
      {{ hint }}
    </div>
  </div>
</template>
