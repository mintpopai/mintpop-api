<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { useLocaleStore } from '@/stores/locale'
import { useAnnouncementStore } from '@/stores/announcements'
import { LOCALE_LABELS, type AppLocale } from '@/i18n'
import { formatBalance } from '@/utils/format'
import { CONTACT_PAGE_URLS, SHOP_PAGE_URL } from '@/config/portal'
import AnnouncementBell from '@/components/common/AnnouncementBell.vue'
import AnnouncementPopup from '@/components/common/AnnouncementPopup.vue'

// fluid：内容区占满全宽（供文档中心这类「侧栏贴左 + 正文自行限宽」的页面用），默认仍居中限宽
defineProps<{ fluid?: boolean }>()

const router = useRouter()
const { t } = useI18n()
const authStore = useAuthStore()
const themeStore = useThemeStore()
const localeStore = useLocaleStore()
const announcementStore = useAnnouncementStore()

const menuOpen = ref(false)
const menuRef = ref<HTMLElement | null>(null)
const closeMenu = () => (menuOpen.value = false)

// 移动端（<md）导航抽屉：桌面 tabs 收进汉堡菜单
const navOpen = ref(false)
const navBtnRef = ref<HTMLElement | null>(null)
const navPanelRef = ref<HTMLElement | null>(null)
const closeNav = () => (navOpen.value = false)

// 两个弹层互斥，开一个就收起另一个
const toggleMenu = () => {
  menuOpen.value = !menuOpen.value
  if (menuOpen.value) closeNav()
}
const toggleNav = () => {
  navOpen.value = !navOpen.value
  if (navOpen.value) closeMenu()
}

// 「定价」tab 无条件展示（不再受分布模式 VITE_PORTAL_DISTRIBUTION_MODE 约束）
const tabs = computed(() => [
  { name: 'Dashboard', label: t('nav.dashboard'), to: '/dashboard' },
  { name: 'Subscriptions', label: t('nav.subscriptions'), to: '/subscriptions' },
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
// 官网联系页入口：与登录页一致，外链新开页、语言跟随门户当前语言
const contactUrl = computed(() => CONTACT_PAGE_URLS[localeStore.current])
// MintPop Shop 成品账号商店：不分语言，中英文共用同一地址
const shopUrl = SHOP_PAGE_URL

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
  if (e.key === 'Escape') {
    closeMenu()
    closeNav()
  }
}

// 点弹层外部即关闭。注意不能用「fixed inset-0 全屏遮罩」那套：顶栏带 backdrop-filter，
// 而 backdrop-filter 会使该元素成为 fixed 定位后代的包含块，遮罩只会铺满顶栏那一条，
// 点正文区根本收不到事件。故改为文档级监听 + contains 判定。
function onPointerDown(e: PointerEvent) {
  const target = e.target as Node | null
  if (!target) return
  if (menuOpen.value && !menuRef.value?.contains(target)) closeMenu()
  if (
    navOpen.value &&
    !navBtnRef.value?.contains(target) &&
    !navPanelRef.value?.contains(target)
  ) {
    closeNav()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  document.addEventListener('pointerdown', onPointerDown)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  document.removeEventListener('pointerdown', onPointerDown)
})

onMounted(() => {
  if (!authStore.user) authStore.fetchUser()
  // 兜底 + 保鲜：进站那次 force 拉取在 App.vue / 登录成功时已发生，这里只是长时间停留期间
  // 随路由切换顺带刷新（受 store 内 20 分钟节流约束，正常导航基本是 no-op）
  announcementStore.fetchAnnouncements()
})
</script>

<template>
  <!-- 应用壳：视口定高、窗口不滚动，滚动收进下方 main。这样滚动条只出现在顶栏下方，
       且 main 上的 scrollbar-gutter: stable 预留槽位落在纯色内容背景上（无滚动条时不可见），
       避免「长页有滚动条、短页没有」切页时挤压宽度导致布局左右晃动，顶栏也永远占满全宽。 -->
  <div class="flex h-dvh flex-col bg-bg">
    <!-- ============ 顶栏 ============ -->
    <header
      class="sticky top-0 z-30 flex h-[66px] items-center gap-4 border-b border-border px-5 backdrop-blur-md sm:px-8 md:gap-7 lg:px-12"
      style="background: var(--bar)"
    >
      <!-- 移动端汉堡按钮 -->
      <button
        ref="navBtnRef"
        class="flex h-9 w-9 items-center justify-center rounded-[10px] text-text2 transition-colors hover:bg-muted md:hidden"
        :aria-label="t('nav.menu')"
        :aria-expanded="navOpen"
        @click="toggleNav"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <path
            v-if="!navOpen"
            d="M4 7h16M4 12h16M4 17h16"
          />
          <path
            v-else
            d="M6 6l12 12M18 6L6 18"
          />
        </svg>
      </button>

      <!-- logo -->
      <div class="flex shrink-0 items-center">
        <img
          :src="isDark ? 'https://standards.mintpop.ai/assets/brand/wordmark/mintpop-wordmark-light.png' : 'https://standards.mintpop.ai/assets/brand/wordmark/mintpop-wordmark-dark.png'"
          alt="mintpop"
          class="h-[26px] w-auto"
        >
      </div>

      <!-- 导航 tabs（桌面） -->
      <nav class="hidden items-center gap-1 md:flex">
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

      <!-- 移动端导航抽屉（汉堡展开；文档 / 联系方式入口一并收入） -->
      <Transition name="pop-down">
        <nav
          v-if="navOpen"
          ref="navPanelRef"
          class="pop-origin-top absolute inset-x-3 top-[60px] z-50 flex flex-col gap-0.5 rounded-2xl border border-border bg-card p-2 shadow-menu md:hidden"
        >
          <router-link
            v-for="tab in tabs"
            :key="tab.name"
            :to="tab.to"
            class="tab"
            active-class="tab-on"
            @click="closeNav"
          >
            {{ tab.label }}
          </router-link>
          <router-link
            to="/docs"
            class="tab"
            active-class="tab-on"
            @click="closeNav"
          >
            {{ t('nav.docs') }}
          </router-link>
          <a
            :href="contactUrl"
            target="_blank"
            rel="noopener"
            class="tab"
            @click="closeNav"
          >
            {{ t('nav.contact') }} <span aria-hidden="true">↗</span>
          </a>
          <!-- 抽屉里没有 hover，说明直接作为第二行常驻展示 -->
          <a
            :href="shopUrl"
            target="_blank"
            rel="noopener"
            class="tab flex flex-col items-start gap-0.5 whitespace-normal"
            @click="closeNav"
          >
            <span>{{ t('nav.shop') }} <span aria-hidden="true">↗</span></span>
            <span class="text-[11px] font-normal leading-snug text-subtle">{{ t('nav.shopHint') }}</span>
          </a>
        </nav>
      </Transition>

      <!-- 右侧：公告铃铛 + 使用文档 / 联系方式 / MintPop Shop 入口 + 用户菜单（彼此平级） -->
      <div class="ml-auto flex items-center gap-3">
        <AnnouncementBell />
        <router-link
          to="/docs"
          class="doc-link hidden md:inline-block"
          active-class="doc-link-on"
        >
          {{ t('nav.docs') }}
        </router-link>
        <a
          :href="contactUrl"
          target="_blank"
          rel="noopener"
          class="doc-link hidden md:inline-block"
        >
          {{ t('nav.contact') }} <span aria-hidden="true">↗</span>
        </a>
        <!-- MintPop Shop：顶栏只放功能名，完整说明用页面内自绘 tooltip 即时展示
             （不用原生 title：Chrome 要悬停 1 秒以上才弹、由浏览器层绘制无法定制、触屏还完全不触发） -->
        <span class="group relative hidden md:inline-block">
          <a
            :href="shopUrl"
            target="_blank"
            rel="noopener"
            aria-describedby="shop-hint"
            class="doc-link inline-block"
          >
            {{ t('nav.shop') }} <span aria-hidden="true">↗</span>
          </a>
          <span
            id="shop-hint"
            role="tooltip"
            class="pointer-events-none absolute right-0 top-full z-50 mt-1.5 w-max max-w-[260px] rounded-xl border border-border bg-card px-3 py-2 text-xs leading-snug text-text2 opacity-0 shadow-menu transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
          >
            {{ t('nav.shopHint') }}
          </span>
        </span>

        <!-- 用户菜单 -->
        <div
          ref="menuRef"
          class="relative"
        >
          <button
            class="flex items-center gap-2.5 rounded-full border border-border bg-card py-[5px] pl-3.5 pr-1.5 shadow-pill transition-colors hover:bg-muted"
            aria-haspopup="menu"
            :aria-expanded="menuOpen"
            @click="toggleMenu"
          >
            <span class="whitespace-nowrap text-[13px] font-medium text-mtext">{{ username }}</span>
            <span
              class="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-[13px] font-semibold text-white"
            >
              {{ initial }}
            </span>
          </button>

          <Transition name="pop-down">
            <div
              v-if="menuOpen"
              role="menu"
              class="pop-origin-right absolute right-0 top-[54px] z-50 w-[268px] rounded-2xl border border-border bg-card p-2 shadow-menu"
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

              <button
                type="button"
                role="menuitem"
                class="mi font-semibold text-accent"
                @click="go('/recharge')"
              >
                {{ t('nav.recharge') }}<span class="text-accent">→</span>
              </button>
              <button
                type="button"
                role="menuitem"
                class="mi"
                @click="go('/orders')"
              >
                {{ t('nav.orders') }}<span>→</span>
              </button>
              <button
                type="button"
                role="menuitem"
                class="mi"
                @click="go('/profile')"
              >
                {{ t('nav.profile') }}<span>→</span>
              </button>

              <div class="mx-1.5 my-1.5 h-px bg-track" />

              <button
                type="button"
                role="menuitem"
                class="mi text-mtext"
                @click="themeStore.toggle()"
              >
                {{ isDark ? t('nav.lightMode') : t('nav.darkMode') }}<span>{{ isDark ? '☀' : '☾' }}</span>
              </button>
              <button
                v-if="!localeStore.locked"
                type="button"
                role="menuitem"
                class="mi text-mtext"
                @click="localeStore.toggle()"
              >
                {{ t('nav.language') }}<span>{{ otherLocaleLabel }} ⇄</span>
              </button>
              <button
                type="button"
                role="menuitem"
                class="mi text-neg"
                @click="handleLogout"
              >
                {{ t('nav.logout') }}<span class="text-neg">↪</span>
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </header>

    <!-- ============ 主体 ============ -->
    <main class="min-w-0 flex-1 overflow-y-auto px-5 py-8 [scrollbar-gutter:stable] sm:px-8 lg:px-12 lg:py-11">
      <div :class="fluid ? '' : 'mx-auto max-w-[1240px]'">
        <slot />
      </div>
    </main>

    <!-- 强提醒公告：登录后自动弹出，必须确认 -->
    <AnnouncementPopup />
  </div>
</template>

<style scoped>
/* 弹层展开/收起：从触发点方向轻微缩放下落，出场比入场快一点，手感更利落 */
.pop-origin-right {
  transform-origin: top right;
}
.pop-origin-top {
  transform-origin: top center;
}
.pop-down-enter-active {
  transition:
    opacity 0.16s ease-out,
    transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}
.pop-down-leave-active {
  /* 收起期间还在 DOM 里，别再吃点击 */
  pointer-events: none;
  transition:
    opacity 0.12s ease-in,
    transform 0.12s ease-in;
}
.pop-down-enter-from,
.pop-down-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.96);
}
@media (prefers-reduced-motion: reduce) {
  .pop-down-enter-active,
  .pop-down-leave-active {
    transition: opacity 0.1s linear;
  }
  .pop-down-enter-from,
  .pop-down-leave-to {
    transform: none;
  }
}
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
  width: 100%;
  padding: 10px 14px;
  border: 0;
  border-radius: 9px;
  background: none;
  font: 500 13px 'Space Grotesk', sans-serif;
  text-align: left;
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
  color: var(--faint);
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
