<script setup lang="ts">
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import { useThemeStore } from '@/stores/theme'
import { useLocaleStore } from '@/stores/locale'
import { useAnnouncementStore } from '@/stores/announcements'
import { TOKEN_KEY } from '@/api/client'
import { setDocumentTitle } from '@/utils/title'
import ToastHost from '@/components/common/ToastHost.vue'

// 实例化即应用主题（store 内部已在创建时 apply 到 <html>）
useThemeStore()

// 带登录态进站（打开站点 / 刷新 / 深链）立刻强制拉一次公告，未读的强提醒公告即刻弹出。
// 放在应用根而不是 PortalLayout：路由是懒加载的，等布局挂载要先下完该页 chunk，会白等一截；
// 且这里 force 拉取，不受 20 分钟节流影响——「进站必拉一次」是硬保证，不靠 store 恰好是新的。
if (localStorage.getItem(TOKEN_KEY)) {
  void useAnnouncementStore().fetchAnnouncements(true)
}

// 切换语言不触发导航、router.afterEach 不会重跑，这里补一次标题刷新（与 afterEach 共用同一格式）
const route = useRoute()
const localeStore = useLocaleStore()
watch(
  () => localeStore.current,
  () => setDocumentTitle(route.meta.title)
)
</script>

<template>
  <router-view />
  <ToastHost />
</template>
