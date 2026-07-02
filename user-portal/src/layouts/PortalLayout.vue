<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { useLocaleStore } from '@/stores/locale'
import { LOCALE_LABELS, type AppLocale } from '@/i18n'
import { formatBalance } from '@/utils/format'

const router = useRouter()
const { t } = useI18n()
const authStore = useAuthStore()
const themeStore = useThemeStore()
const localeStore = useLocaleStore()

const menuOpen = ref(false)
const toggleMenu = () => (menuOpen.value = !menuOpen.value)
const closeMenu = () => (menuOpen.value = false)

// 「定价」tab 无条件展示（不再受分布模式 VITE_PORTAL_DISTRIBUTION_MODE 约束）
const tabs = computed(() => [
  { name: 'Dashboard', label: t('nav.dashboard'), to: '/dashboard' },
  { name: 'Usage', label: t('nav.usage'), to: '/usage' },
  { name: 'Keys', label: t('nav.keys'), to: '/keys' },
  { name: 'Pricing', label: t('nav.pricing'), to: '/pricing' }
])

const username = computed(() => authStore.user?.username || t('nav.defaultUser'))
const email = computed(() => authStore.user?.email || '')
const initial = computed(() => (username.value || '?').charAt(0).toUpperCase())
const isDark = computed(() => themeStore.mode === 'dark')
// 语言切换项展示「目标语言」名（点击即切到另一种语言）
const otherLocaleLabel = computed(
  () => LOCALE_LABELS[(localeStore.current === 'zh-CN' ? 'en-US' : 'zh-CN') as AppLocale]
)

function go(path: string) {
  closeMenu()
  router.push(path)
}

async function handleLogout() {
  closeMenu()
  await authStore.logout()
  router.push('/login')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') closeMenu()
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

onMounted(() => {
  if (!authStore.user) authStore.fetchUser()
})
</script>

<template>
  <div class="flex min-h-screen flex-col bg-bg">
    <!-- ============ 顶栏 ============ -->
    <header
      class="sticky top-0 z-30 flex h-[66px] items-center gap-7 border-b border-border px-12 backdrop-blur-md"
      style="background: var(--bar)"
    >
      <!-- logo -->
      <div class="flex shrink-0 items-center">
        <img
          :src="isDark ? '/wordmark-light.png' : '/wordmark-dark.png'"
          alt="mintpop"
          class="h-[26px] w-auto"
        >
      </div>

      <!-- 导航 tabs -->
      <nav class="flex items-center gap-1">
        <router-link
          v-for="tab in tabs"
          :key="tab.name"
          :to="tab.to"
          class="tab"
          active-class="tab-on"
        >
          {{ tab.label }}
        </router-link>
      </nav>

      <!-- 右侧：使用文档入口 + 用户菜单（二者平级） -->
      <div class="ml-auto flex items-center gap-3">
        <router-link
          to="/docs"
          class="doc-link"
          active-class="doc-link-on"
        >
          {{ t('nav.docs') }}
        </router-link>

        <!-- 用户菜单 -->
        <div class="relative">
          <button
            class="flex items-center gap-2.5 rounded-full border border-border bg-card py-[5px] pl-3.5 pr-1.5 shadow-pill"
            @click="toggleMenu"
          >
            <span class="whitespace-nowrap text-[13px] font-medium text-mtext">{{ username }}</span>
            <span
              class="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-[13px] font-semibold text-white"
            >
              {{ initial }}
            </span>
          </button>

          <template v-if="menuOpen">
            <div
              class="fixed inset-0 z-40"
              @click="closeMenu"
            />
            <div
              class="absolute right-0 top-[54px] z-50 w-[268px] rounded-2xl border border-border bg-card p-2 shadow-menu"
            >
              <!-- 用户信息 -->
              <div class="flex items-center gap-3 px-3 pb-3.5 pt-3">
                <span
                  class="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-accent text-base font-semibold text-white"
                >
                  {{ initial }}
                </span>
                <div class="min-w-0">
                  <div class="text-sm font-semibold text-text">
                    {{ username }}
                  </div>
                  <div class="truncate text-xs text-subtle">
                    {{ email }}
                  </div>
                </div>
              </div>

              <!-- 余额 -->
              <div class="mx-3 mb-2 flex items-center justify-between rounded-[11px] bg-muted px-3.5 py-[11px]">
                <span class="whitespace-nowrap text-xs font-medium text-subtle">{{ t('nav.balance') }}</span>
                <span class="num text-[17px] font-medium text-text">${{ formatBalance(authStore.balance) }}</span>
              </div>

              <div class="mx-1.5 my-1 h-px bg-track" />

              <a
                class="mi font-semibold text-accent"
                @click="go('/recharge')"
              >{{ t('nav.recharge') }}<span class="text-accent">→</span></a>
              <a
                class="mi"
                @click="go('/orders')"
              >{{ t('nav.orders') }}<span>→</span></a>
              <a
                class="mi"
                @click="go('/profile')"
              >{{ t('nav.profile') }}<span>→</span></a>

              <div class="mx-1.5 my-1.5 h-px bg-track" />

              <a
                class="mi text-mtext"
                @click="themeStore.toggle()"
              >
                {{ isDark ? t('nav.lightMode') : t('nav.darkMode') }}<span>{{ isDark ? '☀' : '☾' }}</span>
              </a>
              <a
                v-if="!localeStore.locked"
                class="mi text-mtext"
                @click="localeStore.toggle()"
              >
                {{ t('nav.language') }}<span>{{ otherLocaleLabel }} ⇄</span>
              </a>
              <a
                class="mi text-neg"
                @click="handleLogout"
              >{{ t('nav.logout') }}<span class="text-neg">↪</span></a>
            </div>
          </template>
        </div>
      </div>
    </header>

    <!-- ============ 主体 ============ -->
    <main class="min-w-0 flex-1 px-12 py-11">
      <div class="mx-auto max-w-[1240px]">
        <slot />
      </div>
    </main>
  </div>
</template>

<style scoped>
.tab {
  font: 500 14px 'Space Grotesk', sans-serif;
  padding: 8px 14px;
  border-radius: 10px;
  color: var(--text2);
  cursor: pointer;
  text-decoration: none;
  white-space: nowrap;
  transition:
    background 0.15s,
    color 0.15s;
}
.tab:hover {
  background: var(--muted);
}
.tab-on {
  background: var(--card);
  color: var(--text);
  font-weight: 600;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.07);
}
.mi {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 10px 14px;
  border-radius: 9px;
  font: 500 13px 'Space Grotesk';
  color: var(--mtext);
  cursor: pointer;
  text-decoration: none;
  white-space: nowrap;
  transition: background 0.12s;
}
.mi:hover {
  background: var(--muted);
}
.mi span:last-child {
  color: #c0bcb2;
  font-size: 13px;
}
.doc-link {
  font: 500 13px 'Space Grotesk', sans-serif;
  padding: 7px 13px;
  border-radius: 10px;
  color: var(--text2);
  text-decoration: none;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s;
}
.doc-link:hover {
  background: var(--muted);
}
.doc-link-on {
  background: var(--card);
  color: var(--text);
  font-weight: 600;
}
</style>
