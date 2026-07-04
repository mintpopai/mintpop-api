<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useLocaleStore } from '@/stores/locale'
import { type AppLocale } from '@/i18n'
import { LEGAL_SECTIONS } from './legal/_manifest'
import { loadLegal } from './legal/loaders'
import { renderMarkdown } from '@/utils/markdown'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const localeStore = useLocaleStore()

interface RenderedSection {
  slug: string
  title: string
  html: string
}

const sections = ref<RenderedSection[]>([])
const activeSlug = ref<string>(LEGAL_SECTIONS[0].slug)

// 仅中文界面提示「以英文版为准」（英文本身即权威版本）
const showTranslationNotice = computed(() => localeStore.current === 'zh-CN')
// 语言切换按钮展示「目标语言」名（点击即切到另一种）
const otherLocale = computed<AppLocale>(() => (localeStore.current === 'zh-CN' ? 'en-US' : 'zh-CN'))

// 加载并渲染当前语言的全部分节，完成后按 URL hash 深链定位
async function loadAll(locale: AppLocale): Promise<void> {
  sections.value = await Promise.all(
    LEGAL_SECTIONS.map(async (s) => ({
      slug: s.slug,
      title: s.title[locale],
      html: renderMarkdown(await loadLegal(s.slug, locale))
    }))
  )
  await nextTick()
  scrollToHash()
}

// 内容为异步渲染，进入路由时 scrollBehavior 找不到锚点元素，故渲染完再定位一次
function scrollToHash(): void {
  const id = route.hash.replace(/^#/, '')
  if (!id) return
  document.getElementById(id)?.scrollIntoView()
}

// 侧栏点击：平滑滚到分节，并静默同步 URL hash（不经 router，避免二次滚动）
function goToSection(slug: string): void {
  const el = document.getElementById(slug)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth' })
  history.replaceState(history.state, '', `#${slug}`)
  activeSlug.value = slug
}

function goBack(): void {
  if (window.history.length > 1) router.back()
  else router.push('/register')
}

// —— 滚动高亮当前分节 ——
let observer: IntersectionObserver | null = null
function setupObserver(): void {
  observer?.disconnect()
  observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) activeSlug.value = e.target.id
      }
    },
    { rootMargin: '-35% 0px -60% 0px', threshold: 0 }
  )
  for (const s of LEGAL_SECTIONS) {
    const el = document.getElementById(s.slug)
    if (el) observer.observe(el)
  }
}

onMounted(async () => {
  await loadAll(localeStore.current)
  setupObserver()
})

// 语言切换 → 重新加载并重建观察器（分节 id 不变，重建仅为稳妥）
watch(
  () => localeStore.current,
  async (locale) => {
    await loadAll(locale)
    setupObserver()
  }
)

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div class="min-h-screen bg-bg text-text">
    <!-- 顶栏：返回 / wordmark / 语言切换 -->
    <header class="sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur-sm">
      <div class="mx-auto flex max-w-[1080px] items-center justify-between px-6 py-4">
        <button
          class="inline-flex items-center gap-1.5 rounded-xl2 border-[1.5px] border-border2 px-3.5 py-2 text-[13px] font-medium text-text2 transition hover:bg-hover"
          @click="goBack"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
          ><path d="M15 6l-6 6 6 6" /></svg>
          {{ t('legal.back') }}
        </button>

        <img
          src="/wordmark-dark.png"
          alt="MintPop API"
          class="block h-7 w-auto dark:hidden"
        >
        <img
          src="/wordmark-light.png"
          alt="MintPop API"
          class="hidden h-7 w-auto dark:block"
        >

        <button
          v-if="!localeStore.locked"
          class="rounded-xl2 border-[1.5px] border-border2 px-3.5 py-2 text-[13px] font-medium text-text2 transition hover:bg-hover"
          @click="localeStore.toggle()"
        >
          {{ localeStore.label(otherLocale) }}
        </button>
        <span v-else />
      </div>
    </header>

    <main class="mx-auto max-w-[1080px] px-6 py-10 sm:py-12">
      <div class="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-pos">
        MintPop API
      </div>
      <h1 class="font-serif text-[34px] font-medium leading-tight tracking-tight text-text sm:text-[40px]">
        {{ t('legal.heading') }}
      </h1>
      <p class="mt-3 max-w-[640px] text-[15px] leading-relaxed text-text3">
        {{ t('legal.intro') }}
      </p>
      <p
        v-if="showTranslationNotice"
        class="mt-5 rounded-xl2 border border-border2 bg-muted px-4 py-3 text-[13px] leading-relaxed text-text2"
      >
        {{ t('legal.translationNotice') }}
      </p>

      <div class="mt-10 flex gap-12">
        <!-- 侧栏分节导航 -->
        <aside class="hidden w-52 shrink-0 lg:block">
          <nav class="sticky top-[92px] flex flex-col gap-1">
            <button
              v-for="s in sections"
              :key="s.slug"
              class="rounded-lg px-3 py-2 text-left text-sm font-medium transition"
              :class="activeSlug === s.slug ? 'bg-accent/10 text-accent' : 'text-text2 hover:bg-hover'"
              @click="goToSection(s.slug)"
            >
              {{ s.title }}
            </button>
          </nav>
        </aside>

        <!-- 正文 -->
        <div class="min-w-0 flex-1">
          <!-- eslint-disable vue/no-v-html -- 渲染的是本项目自有的可信条款 markdown（含译文），非用户输入 -->
          <section
            v-for="s in sections"
            :id="s.slug"
            :key="s.slug"
            class="scroll-mt-24 border-border2 pb-12 not-last:mb-12 not-last:border-b"
          >
            <h2 class="mb-6 font-serif text-[26px] font-medium tracking-tight text-text sm:text-[28px]">
              {{ s.title }}
            </h2>
            <div
              class="prose prose-neutral max-w-none dark:prose-invert prose-headings:font-serif prose-headings:font-medium prose-a:text-accent prose-a:no-underline prose-a:hover:underline"
              v-html="s.html"
            />
          </section>
          <!-- eslint-enable vue/no-v-html -->
        </div>
      </div>
    </main>
  </div>
</template>
