<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PortalLayout from '@/layouts/PortalLayout.vue'
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
      html.value = renderMarkdown(resolveDocPlaceholders(src, docPlaceholderValues(settingsStore.settings)))
    } catch {
      if (seq !== loadSeq) return
      // 加载失败（如网络异常拉不到 chunk）：展示可见的失败态而非静默空白
      html.value = ''
      loadError.value = true
    }
  },
  { immediate: true }
)
</script>

<template>
  <PortalLayout>
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

      <!-- 右侧正文 -->
      <article class="min-w-0 flex-1">
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
          class="prose prose-neutral max-w-none dark:prose-invert"
          v-html="html"
        />
        <!-- eslint-enable vue/no-v-html -->
      </article>
    </div>
  </PortalLayout>
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
</style>
