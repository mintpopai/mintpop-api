<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ImageLightbox from '@/components/ui/ImageLightbox.vue'
import { DOCS, DOC_GROUPS } from '@/docs/_manifest'
import { loadDoc } from '@/docs/loaders'
import { docPlaceholderValues, resolveDocPlaceholders } from '@/docs/placeholders'
import { renderMarkdown } from '@/utils/markdown'
import { useLocaleStore } from '@/stores/locale'
import { useSettingsStore } from '@/stores/settings'

const route = useRoute()
const router = useRouter()
const localeStore = useLocaleStore()
const settingsStore = useSettingsStore()

// 当前篇 slug：路由无 / 非法 → 回退首篇（无 slug 是合法的「未指定」，非法 slug 见下方 replace）
const activeSlug = computed(() => {
  const raw = route.params.slug
  const slug = Array.isArray(raw) ? raw[0] : raw
  return slug && DOCS.some((d) => d.slug === slug) ? slug : DOCS[0].slug
})

// 非法 slug（指定了但查无此篇）：replace 到首篇文档路由，让 URL 与实际渲染内容一致。
// 只在「有 slug 但非法」时触发；无 slug（/docs）本就合法，不重定向。
// 不会成环：replace 后的目标 slug 恒为 DOCS[0].slug（合法），不会再次落入本分支。
watch(
  () => route.params.slug,
  (raw) => {
    const slug = Array.isArray(raw) ? raw[0] : raw
    if (slug && !DOCS.some((d) => d.slug === slug)) {
      router.replace(`/docs/${DOCS[0].slug}`)
    }
  },
  { immediate: true }
)

// 目录标题随当前语言
function navTitle(slug: string): string {
  const entry = DOCS.find((d) => d.slug === slug)
  return entry ? entry.title[localeStore.current] : slug
}

const html = ref('')
const loadError = ref(false)

/** 本页目录条目（取正文的 h2/h3） */
interface TocItem {
  id: string
  text: string
  level: number
}
const toc = ref<TocItem[]>([])
const activeId = ref('')

// 给渲染后 HTML 的 h2/h3 注入锚点 id，并提取本页目录。
// markdown-it 不产 id，这里统一后处理；DOMParser 在 jsdom（测试环境）同样可用。
function extractToc(rawHtml: string): { html: string; toc: TocItem[] } {
  const doc = new DOMParser().parseFromString(rawHtml, 'text/html')
  const items: TocItem[] = []
  const seen = new Map<string, number>()
  doc.body.querySelectorAll('h2, h3').forEach((el) => {
    const text = (el.textContent || '').trim()
    // 标题文本 → 锚点 id（保留中英文与数字）；重复标题追加序号防撞
    let id = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}-]/gu, '')
    const dup = seen.get(id) ?? 0
    seen.set(id, dup + 1)
    if (dup) id = `${id}-${dup}`
    el.id = id
    items.push({ id, text, level: el.tagName === 'H3' ? 3 : 2 })
  })
  return { html: doc.body.innerHTML, toc: items }
}

// 滚动高亮：标题进入视口顶部 25% 判定带时点亮对应目录项
let spy: IntersectionObserver | null = null
async function setupScrollSpy() {
  await nextTick()
  spy?.disconnect()
  spy = null
  activeId.value = toc.value[0]?.id ?? ''
  // jsdom 无 IntersectionObserver；无目录也不必观察
  if (!toc.value.length || typeof IntersectionObserver === 'undefined') return
  spy = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          activeId.value = e.target.id
          return
        }
      }
    },
    { rootMargin: '0px 0px -75% 0px' }
  )
  for (const item of toc.value) {
    const el = document.getElementById(item.id)
    if (el) spy.observe(el)
  }
}
onBeforeUnmount(() => spy?.disconnect())

function scrollToHeading(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  activeId.value = id
}

// slug 或语言变化 → 重新加载并渲染
// 竞态守卫：快速切换 slug/语言连发加载时只让最后一次的结果落地（与 useKeys/useUsage 的 loadSeq 模式一致）
let loadSeq = 0
watch(
  [activeSlug, () => localeStore.current],
  async ([slug, locale]) => {
    const seq = ++loadSeq
    loadError.value = false
    try {
      // 占位符（BASE_URL 等）取自公开设置；ensureLoaded 失败不抛，settings 为 null 时占位符回退站点 origin
      await settingsStore.ensureLoaded()
      const src = await loadDoc(slug, locale)
      if (seq !== loadSeq) return
      const rendered = renderMarkdown(resolveDocPlaceholders(src, docPlaceholderValues(settingsStore.settings, locale)))
      const extracted = extractToc(rendered)
      html.value = extracted.html
      toc.value = extracted.toc
      setupScrollSpy()
    } catch {
      if (seq !== loadSeq) return
      // 加载失败（如网络异常拉不到 chunk）：展示可见的失败态而非静默空白
      html.value = ''
      toc.value = []
      loadError.value = true
    }
  },
  { immediate: true }
)

// —— 图片点击放大 ——
// v-html 内容上的事件委托：点到 IMG 即打开全屏预览。委托挂在容器上，正文重渲染无需重绑。
const lightboxSrc = ref<string | null>(null)
const lightboxAlt = ref('')
function onProseClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.tagName !== 'IMG') return
  const img = target as HTMLImageElement
  lightboxSrc.value = img.currentSrc || img.src
  lightboxAlt.value = img.alt
}
</script>

<template>
  <!-- fluid：文档页占满全宽，左侧目录贴页面左缘，正文在剩余空间内自行限宽居中 -->
  <div>
    <div class="flex gap-10">
      <!-- 左侧目录（移动端隐藏，与 LegalView 目录同策略） -->
      <aside class="hidden w-56 shrink-0 lg:block">
        <!-- 吸顶相对 PortalLayout 的 main 滚动容器（顶栏在容器外），偏移只需留一点呼吸间距 -->
        <nav class="sticky top-6 flex flex-col gap-7">
          <!-- 一级分组标题（衬线大字号，不可点击），组内二级条目才是文档链接 -->
          <div
            v-for="group in DOC_GROUPS"
            :key="group.title['zh-CN']"
          >
            <div class="doc-nav-group">
              {{ group.title[localeStore.current] }}
            </div>
            <div class="doc-nav-items">
              <router-link
                v-for="doc in group.items"
                :key="doc.slug"
                :to="`/docs/${doc.slug}`"
                class="doc-nav"
                :class="{ 'doc-nav-on': doc.slug === activeSlug }"
              >
                {{ navTitle(doc.slug) }}
              </router-link>
            </div>
          </div>
        </nav>
      </aside>

      <!-- 中间正文：限宽保证阅读行长，居中于两侧栏之间 -->
      <article class="min-w-0 flex-1">
        <div class="mx-auto max-w-[800px]">
          <div
            v-if="loadError"
            class="rounded-xl2 bg-card p-6 text-sm text-text3"
          >
            {{ $t('common.loadFailed') }}
          </div>
          <!-- v-html 注入的是本项目自有的可信文档 markdown 渲染结果（非用户输入），故禁用该规则 -->
          <!-- eslint-disable vue/no-v-html -->
          <div
            v-else
            class="prose prose-neutral max-w-none dark:prose-invert prose-a:text-accent prose-a:no-underline prose-a:hover:underline"
            @click="onProseClick"
            v-html="html"
          />
          <!-- eslint-enable vue/no-v-html -->
        </div>
      </article>

      <!-- 右侧本页目录（窄屏隐藏）：h2/h3 锚点导航 + 滚动高亮 -->
      <aside class="hidden w-48 shrink-0 xl:block">
        <nav
          v-if="toc.length"
          class="sticky top-6"
        >
          <div class="toc-title">
            {{ $t('docs.toc') }}
          </div>
          <div class="toc-items">
            <button
              v-for="item in toc"
              :key="item.id"
              type="button"
              class="toc-link"
              :class="{ 'toc-on': item.id === activeId, 'toc-sub': item.level === 3 }"
              @click="scrollToHeading(item.id)"
            >
              {{ item.text }}
            </button>
          </div>
        </nav>
      </aside>
    </div>
    <!-- 图片全屏预览（Teleport 到 body，放哪都行，挂在布局末尾便于阅读） -->
    <ImageLightbox
      :src="lightboxSrc"
      :alt="lightboxAlt"
      @close="lightboxSrc = null"
    />
  </div>
</template>

<style scoped>
/* 一级目录：与全站标题同款 Newsreader 衬线（见 LegalView h1/h2），靠字号与字体对比压住二级 */
.doc-nav-group {
  padding: 0 12px;
  font: 500 18px/1.3 'Newsreader', serif;
  letter-spacing: -0.01em;
  color: var(--text);
}
/* 二级条目挂在一条细导引线下，形成树状层级 */
.doc-nav-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 8px 0 0 12px;
  padding-left: 10px;
  border-left: 1px solid var(--border2);
}
.doc-nav {
  padding: 7px 12px;
  border-radius: 9px;
  font: 500 13px 'Space Grotesk', sans-serif;
  color: var(--text2);
  text-decoration: none;
  white-space: nowrap;
  transition: background 0.12s, color 0.12s;
}
.doc-nav:hover {
  background: var(--hover);
  color: var(--text);
}
/* 激活态与 LegalView 侧栏同语言：薄荷 accent 淡底 + accent 文字 */
.doc-nav-on {
  background: rgba(20, 194, 138, 0.1);
  color: var(--accent);
  font-weight: 600;
}
.doc-nav-on:hover {
  background: rgba(20, 194, 138, 0.1);
  color: var(--accent);
}

/* 本页目录：与左侧二级条目同语言（细导引线 + accent 激活态），字号再小一档以示层级 */
.toc-title {
  padding: 0 10px;
  font: 600 12px 'Space Grotesk', sans-serif;
  letter-spacing: 0.02em;
  color: var(--text3);
}
.toc-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 8px;
  padding-left: 0;
  border-left: 1px solid var(--border2);
}
.toc-link {
  padding: 5px 10px;
  border: 0;
  border-radius: 8px;
  background: none;
  font: 500 12.5px 'Space Grotesk', sans-serif;
  text-align: left;
  color: var(--text3);
  cursor: pointer;
  transition: color 0.12s, background 0.12s;
}
.toc-link:hover {
  color: var(--text);
  background: var(--hover);
}
.toc-sub {
  padding-left: 22px;
}
.toc-on {
  color: var(--accent);
  font-weight: 600;
}

/* 锚点跳转时给标题留一点顶部呼吸空间（滚动容器是 PortalLayout 的 main） */
.prose :deep(h2),
.prose :deep(h3) {
  scroll-margin-top: 16px;
}

/* 正文行内代码（不含 pre 里的代码块）：芯片样式，盖掉 typography 默认的反引号伪元素 */
.prose :deep(:not(pre) > code) {
  padding: 2px 6px;
  border: 1px solid var(--border2);
  border-radius: 6px;
  background: var(--muted);
  font-size: 0.85em;
  font-weight: 500;
  color: var(--text);
}
.prose :deep(:not(pre) > code::before),
.prose :deep(:not(pre) > code::after) {
  content: none;
}

/* 正文图片可点击放大，光标提示 */
.prose :deep(img) {
  cursor: zoom-in;
}
</style>
