<script setup lang="ts">
const props = defineProps<{ label: string; variant: string }>()
const styles: Record<string, string> = {
  active: 'text-pos bg-accent/10',
  paid: 'text-pos bg-accent/10',
  inactive: 'text-subtle bg-track',
  muted: 'text-subtle bg-track',
  pending: 'text-[#C77800] bg-[#F59E0B]/13',
  neg: 'text-neg bg-neg/10'
}
const cls = () => styles[props.variant] ?? styles.muted
</script>

<template>
  <span :class="['inline-block rounded-full px-3 py-[5px] text-xs font-semibold', cls()]">● {{ label }}</span>
</template>
