<script setup lang="ts">
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import i18n from '@/i18n'
import { useThemeStore } from '@/stores/theme'
import { useLocaleStore } from '@/stores/locale'
import ToastHost from '@/components/common/ToastHost.vue'

// 实例化即应用主题（store 内部已在创建时 apply 到 <html>）
useThemeStore()

// 切换语言不触发导航、router.afterEach 不会重跑，这里补一次标题刷新（与 afterEach 同款格式）
const route = useRoute()
const localeStore = useLocaleStore()
watch(
  () => localeStore.current,
  () => {
    const key = route.meta.title as string | undefined
    const title = key ? i18n.global.t(key) : 'MintPop API'
    document.title = `${title} · MintPop API`
  }
)
</script>

<template>
  <router-view />
  <ToastHost />
</template>
