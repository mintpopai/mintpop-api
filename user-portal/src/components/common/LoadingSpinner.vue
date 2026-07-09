<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 28 })
</script>

<template>
  <span
    class="inline-block animate-spin rounded-full border-2 border-track border-t-accent"
    :style="{ width: `${size}px`, height: `${size}px` }"
    role="status"
    :aria-label="$t('common.loading')"
  />
</template>
