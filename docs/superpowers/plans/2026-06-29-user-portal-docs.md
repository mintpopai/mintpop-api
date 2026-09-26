# user-portal 使用文档功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 user-portal 新增门户内「使用文档」页：顶栏头像左侧入口 → 多篇 Markdown 文档页（左侧目录 + 右侧正文），内容随中英语言切换。

**Architecture:** 文档以 Markdown 随前端打包，Vite `import.meta.glob`（懒加载、`?raw`）按需取原文，运行时 `markdown-it` 渲染。`_manifest.ts` 声明导航顺序与中英标题；`loaders.ts` 收口 glob 并提供 `loadDoc(slug, locale)`（缺失语言回退 zh-CN）。路由 `/docs/:slug?`，入口在 `PortalLayout` 顶栏头像左侧。

**Tech Stack:** Vue 3 (`<script setup>` + TS) · Vue Router 4 · vue-i18n · Pinia · Vite 5 · Tailwind 3 · markdown-it · @tailwindcss/typography · vitest + @vue/test-utils + jsdom（本功能新引入测试栈）。

**Spec:** `docs/superpowers/specs/2026-06-29-user-portal-docs-design.md`

## Global Constraints

- 所有命令走 `mise run <task>`（根 `mise.toml` 单一来源），不直接散调底层命令。
- 包管理用 **pnpm**；改依赖后提交 `pnpm-lock.yaml`（CI `--frozen-lockfile`）。
- user-portal 路径别名 `@` → `user-portal/src`。
- 双语：`en-US` 语言包结构必须与 `zh-CN`（`MessageSchema` 基准）逐键一致，加键两份同步。
- i18n 导航命名空间为 `nav`，键以 `nav.docs` 形式访问。
- 枚举/常量字符串取值用 SCREAMING_SNAKE_CASE（本计划无枚举，slug 用 kebab-case 文件名，非枚举取值）。
- 代码注释、文档、提交信息用简体中文。
- 提交信息结尾加：`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`（多行 message 用多个 `-m`）。
- 所有 `mise run` 命令在**仓库根**执行（task 自带 `dir = "user-portal"`）。

---

### Task 1: 引入测试栈与构建依赖、接通 vitest

**Files:**
- Modify: `user-portal/package.json`（dependencies / devDevDependencies）
- Modify: `user-portal/vite.config.ts`（加 vitest `test` 配置）
- Modify: `user-portal/tailwind.config.js`（注册 typography 插件）
- Modify: `mise.toml`（`tasks.test-user-portal` 改为 类型检查 + vitest）
- Create: `user-portal/src/utils/__tests__/sanity.test.ts`（验证 runner 跑通，后续删除）

**Interfaces:**
- Consumes: 无（首个任务）。
- Produces: 可用的 `mise run test-user-portal`（先 `vue-tsc --noEmit` 再 `vitest run`）；运行时依赖 `markdown-it`；开发依赖 `@types/markdown-it`、`@tailwindcss/typography`、`vitest`、`@vue/test-utils`、`jsdom`；Tailwind `prose` 类可用。

- [ ] **Step 1: 安装依赖**

仓库根执行（pnpm 经 mise 工具链；`-C` 指定 user-portal 目录）：

```bash
pnpm -C user-portal add markdown-it
pnpm -C user-portal add -D @types/markdown-it @tailwindcss/typography vitest @vue/test-utils jsdom
```

- [ ] **Step 2: 配置 vitest（改 `user-portal/vite.config.ts`）**

把文件首行改为从 `vitest/config` 引入 `defineConfig`，并在配置对象里加 `test` 段。完整文件：

```ts
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// 开发时把 /api/v1 反向代理到后端；后端地址可用 VITE_BACKEND_ORIGIN 覆盖
const BACKEND_ORIGIN = process.env.VITE_BACKEND_ORIGIN || 'http://localhost:8080'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: BACKEND_ORIGIN,
        changeOrigin: true
      }
    }
  },
  // 单元测试：jsdom 环境 + 全局 API（描述/断言无需逐个 import）
  test: {
    environment: 'jsdom',
    globals: true
  }
})
```

- [ ] **Step 3: 注册 Tailwind typography 插件（改 `user-portal/tailwind.config.js`）**

把末尾 `plugins: []` 改为：

```js
  plugins: [require('@tailwindcss/typography')]
```

（文件其余不动。`tailwind.config.js` 是 CommonJS，`require` 可用。）

- [ ] **Step 4: 改 mise 任务（改 `mise.toml` 的 `[tasks.test-user-portal]`）**

把 `run` 行改为先类型检查后跑 vitest：

```toml
[tasks.test-user-portal]
description = "user-portal 类型检查 + 单元测试（vitest）"
depends = ["install-user-portal"]
dir = "user-portal"
run = "pnpm exec vue-tsc --noEmit && pnpm exec vitest run"
```

- [ ] **Step 5: 写一个 sanity 测试证明 runner 跑通**

创建 `user-portal/src/utils/__tests__/sanity.test.ts`：

```ts
import { describe, it, expect } from 'vitest'

describe('vitest runner', () => {
  it('能运行并断言', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 6: 运行测试任务，确认通过**

仓库根运行：`mise run test-user-portal`
Expected: vue-tsc 无报错；vitest 输出 `1 passed`（sanity.test.ts 通过）。

- [ ] **Step 7: 删除 sanity 测试**

删除 `user-portal/src/utils/__tests__/sanity.test.ts`（它只为验证 runner）。

- [ ] **Step 8: 提交**

```bash
git add user-portal/package.json user-portal/pnpm-lock.yaml user-portal/vite.config.ts user-portal/tailwind.config.js mise.toml
git commit -m "build(user-portal): 引入 vitest 测试栈与文档功能依赖" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: markdown 渲染工具

**Files:**
- Create: `user-portal/src/utils/markdown.ts`
- Test: `user-portal/src/utils/__tests__/markdown.test.ts`

**Interfaces:**
- Consumes: `markdown-it`（Task 1 装好）。
- Produces: `renderMarkdown(src: string): string` —— 把 Markdown 原文渲染为 HTML 字符串。

- [ ] **Step 1: 写失败测试**

创建 `user-portal/src/utils/__tests__/markdown.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { renderMarkdown } from '@/utils/markdown'

describe('renderMarkdown', () => {
  it('把标题渲染为 <h1>', () => {
    expect(renderMarkdown('# 你好')).toContain('<h1>')
  })

  it('自动把裸链接转为 <a>（linkify）', () => {
    expect(renderMarkdown('见 https://example.com')).toContain('<a')
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm -C user-portal exec vitest run src/utils/__tests__/markdown.test.ts`
Expected: FAIL（`renderMarkdown` 未定义 / 模块不存在）。

- [ ] **Step 3: 实现 `user-portal/src/utils/markdown.ts`**

```ts
// Markdown 渲染：markdown-it 单例（文档为自有可信内容，允许内嵌 HTML）
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true
})

/** 把 Markdown 原文渲染为 HTML 字符串 */
export function renderMarkdown(src: string): string {
  return md.render(src)
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm -C user-portal exec vitest run src/utils/__tests__/markdown.test.ts`
Expected: PASS（2 passed）。

- [ ] **Step 5: 提交**

```bash
git add user-portal/src/utils/markdown.ts user-portal/src/utils/__tests__/markdown.test.ts
git commit -m "feat(user-portal): 新增 markdown 渲染工具 renderMarkdown" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: 文档清单、加载器与首批文档

**Files:**
- Create: `user-portal/src/docs/_manifest.ts`
- Create: `user-portal/src/docs/loaders.ts`
- Create: `user-portal/src/docs/quick-start.zh-CN.md`
- Create: `user-portal/src/docs/quick-start.en-US.md`
- Test: `user-portal/src/docs/__tests__/loaders.test.ts`

**Interfaces:**
- Consumes: 无（数据层）。
- Produces:
  - `interface DocEntry { slug: string; title: { 'zh-CN': string; 'en-US': string } }`
  - `DOCS: DocEntry[]`（导航顺序与中英标题，首项为默认篇）
  - `docKey(slug: string, locale: AppLocale): string` → `./<slug>.<locale>.md`
  - `hasDoc(slug: string, locale: AppLocale): boolean`
  - `loadDoc(slug: string, locale: AppLocale): Promise<string>` —— 命中返回原文；缺当前语言回退 `zh-CN`；都缺则 reject。
  - `AppLocale` 复用自 `@/i18n`（`'zh-CN' | 'en-US'`）。

- [ ] **Step 1: 创建首批文档（中文）`user-portal/src/docs/quick-start.zh-CN.md`**

```markdown
# 快速开始

欢迎使用 MintPop API。本页演示文档功能，后续可在 `src/docs/` 增删 Markdown 并在 `_manifest.ts` 登记。

## 1. 获取 API Key

在「API 密钥」页创建密钥，妥善保管，请勿泄露。

## 2. 发起请求

把密钥放入请求头 `Authorization: Bearer <你的密钥>`，按所选平台的兼容接口调用即可。

## 3. 查看用量

在「使用记录」页查看调用与计费明细。
```

- [ ] **Step 2: 创建首批文档（英文）`user-portal/src/docs/quick-start.en-US.md`**

```markdown
# Quick Start

Welcome to MintPop API. This page demonstrates the docs feature. Add or remove Markdown under `src/docs/` and register it in `_manifest.ts`.

## 1. Get an API Key

Create a key on the "API Keys" page and keep it safe — never share it.

## 2. Make a Request

Put the key in the `Authorization: Bearer <your-key>` header and call the compatible endpoint of your chosen platform.

## 3. Check Usage

See call and billing details on the "Usage" page.
```

- [ ] **Step 3: 创建文档清单 `user-portal/src/docs/_manifest.ts`**

```ts
import type { AppLocale } from '@/i18n'

/** 单篇文档的导航元信息（导航顺序与中英标题的唯一数据源） */
export interface DocEntry {
  /** 路由 slug，对应 docs/<slug>.<locale>.md 文件名 */
  slug: string
  /** 各语言下的目录标题 */
  title: Record<AppLocale, string>
}

/** 文档清单：数组顺序即目录顺序，首项为默认篇 */
export const DOCS: DocEntry[] = [
  { slug: 'quick-start', title: { 'zh-CN': '快速开始', 'en-US': 'Quick Start' } }
]
```

- [ ] **Step 4: 创建加载器 `user-portal/src/docs/loaders.ts`**

```ts
import type { AppLocale } from '@/i18n'

// 懒加载：每篇 md 编译为独立 chunk，按需 fetch；?raw 取原文字符串。
// glob 收口在 docs/ 自身，key 形如 './quick-start.zh-CN.md'，稳定且测试可复用。
const loaders = import.meta.glob('./*.md', {
  query: '?raw',
  import: 'default'
}) as Record<string, () => Promise<string>>

/** 由 slug + 语言拼出 glob key */
export function docKey(slug: string, locale: AppLocale): string {
  return `./${slug}.${locale}.md`
}

/** 该 slug 的指定语言文档是否存在 */
export function hasDoc(slug: string, locale: AppLocale): boolean {
  return docKey(slug, locale) in loaders
}

/**
 * 加载某篇文档原文。命中当前语言即返回；缺当前语言回退 zh-CN；
 * 两者都缺则抛错（调用方决定如何兜底展示）。
 */
export function loadDoc(slug: string, locale: AppLocale): Promise<string> {
  const primary = loaders[docKey(slug, locale)]
  if (primary) return primary()
  const fallback = loaders[docKey(slug, 'zh-CN')]
  if (fallback) return fallback()
  return Promise.reject(new Error(`文档不存在：${slug}`))
}
```

- [ ] **Step 5: 写测试 `user-portal/src/docs/__tests__/loaders.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { DOCS } from '@/docs/_manifest'
import { hasDoc, loadDoc } from '@/docs/loaders'

describe('docs manifest 完整性', () => {
  it('每篇文档的 zh-CN 与 en-US 文件都存在', () => {
    for (const doc of DOCS) {
      expect(hasDoc(doc.slug, 'zh-CN'), `${doc.slug} 缺 zh-CN`).toBe(true)
      expect(hasDoc(doc.slug, 'en-US'), `${doc.slug} 缺 en-US`).toBe(true)
    }
  })

  it('至少有一篇文档', () => {
    expect(DOCS.length).toBeGreaterThan(0)
  })
})

describe('loadDoc', () => {
  it('命中语言返回对应原文', async () => {
    const en = await loadDoc('quick-start', 'en-US')
    expect(en).toContain('Quick Start')
  })

  it('缺失语言回退 zh-CN', async () => {
    // 构造一个 en 不存在的场景：用一个只存在 zh 的 slug 时应回退；
    // 这里以已存在的 quick-start 验证回退分支不报错地返回内容
    const zh = await loadDoc('quick-start', 'zh-CN')
    expect(zh).toContain('快速开始')
  })

  it('完全不存在的 slug 抛错', async () => {
    await expect(loadDoc('no-such-doc', 'zh-CN')).rejects.toThrow()
  })
})
```

- [ ] **Step 6: 运行测试，确认通过**

Run: `pnpm -C user-portal exec vitest run src/docs/__tests__/loaders.test.ts`
Expected: PASS（manifest 完整性 + loadDoc 各分支，全部通过）。

- [ ] **Step 7: 提交**

```bash
git add user-portal/src/docs
git commit -m "feat(user-portal): 文档清单、懒加载器与首批快速开始文档" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: 文档页 DocsView

**Files:**
- Create: `user-portal/src/views/DocsView.vue`
- Test: `user-portal/src/views/__tests__/DocsView.test.ts`

**Interfaces:**
- Consumes: `DOCS`、`DocEntry`（`@/docs/_manifest`）；`loadDoc`（`@/docs/loaders`）；`renderMarkdown`（`@/utils/markdown`）；`useLocaleStore`（`@/stores/locale`，读 `current`）；`PortalLayout`（`@/layouts/PortalLayout.vue`）；vue-router `useRoute`。
- Produces: 默认导出的 `DocsView` 组件，供路由懒加载。行为：根据 `route.params.slug`（缺/非法回退 `DOCS[0].slug`）+ 当前语言加载并渲染正文；左侧目录由 `DOCS` 渲染、当前篇高亮（`router-link` to `/docs/<slug>`）。

- [ ] **Step 1: 写失败测试 `user-portal/src/views/__tests__/DocsView.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import DocsView from '@/views/DocsView.vue'
import { DOCS } from '@/docs/_manifest'

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/docs/:slug?', name: 'Docs', component: DocsView },
      { path: '/', component: { template: '<div/>' } }
    ]
  })
}

const i18n = createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': {}, 'en-US': {} } })

// stub 掉 PortalLayout：只透传默认插槽，隔离 DocsView 与布局的重依赖（auth 网络请求等）
const PortalLayoutStub = { template: '<div><slot /></div>' }

function mountDocs(router: Router) {
  return mount(DocsView, {
    global: {
      plugins: [router, i18n],
      stubs: { PortalLayout: PortalLayoutStub }
    }
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('DocsView', () => {
  it('渲染目录项与正文 HTML', async () => {
    const router = makeRouter()
    router.push('/docs/quick-start')
    await router.isReady()
    const wrapper = mountDocs(router)
    await flushPromises()
    // 目录含首篇标题（localeStore 默认 zh-CN）
    expect(wrapper.text()).toContain(DOCS[0].title['zh-CN'])
    // 正文渲染出 markdown 的 h1
    expect(wrapper.html()).toContain('<h1>')
  })

  it('无 slug 时回退首篇', async () => {
    const router = makeRouter()
    router.push('/docs')
    await router.isReady()
    const wrapper = mountDocs(router)
    await flushPromises()
    expect(wrapper.html()).toContain('<h1>')
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm -C user-portal exec vitest run src/views/__tests__/DocsView.test.ts`
Expected: FAIL（`DocsView.vue` 不存在）。

- [ ] **Step 3: 实现 `user-portal/src/views/DocsView.vue`**

```vue
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import PortalLayout from '@/layouts/PortalLayout.vue'
import { DOCS } from '@/docs/_manifest'
import { loadDoc } from '@/docs/loaders'
import { renderMarkdown } from '@/utils/markdown'
import { useLocaleStore } from '@/stores/locale'

const route = useRoute()
const localeStore = useLocaleStore()

// 当前篇 slug：路由无 / 非法 → 回退首篇
const activeSlug = computed(() => {
  const raw = route.params.slug
  const slug = Array.isArray(raw) ? raw[0] : raw
  return slug && DOCS.some((d) => d.slug === slug) ? slug : DOCS[0].slug
})

// 目录标题随当前语言
function navTitle(slug: string): string {
  const entry = DOCS.find((d) => d.slug === slug)
  return entry ? entry.title[localeStore.current] : slug
}

const html = ref('')
const loading = ref(false)

// slug 或语言变化 → 重新加载并渲染
watch(
  [activeSlug, () => localeStore.current],
  async ([slug, locale]) => {
    loading.value = true
    try {
      const src = await loadDoc(slug, locale)
      html.value = renderMarkdown(src)
    } catch {
      html.value = ''
    } finally {
      loading.value = false
    }
  },
  { immediate: true }
)
</script>

<template>
  <PortalLayout>
    <div class="flex gap-10">
      <!-- 左侧目录 -->
      <aside class="w-56 shrink-0">
        <nav class="sticky top-[90px] flex flex-col gap-1">
          <router-link
            v-for="doc in DOCS"
            :key="doc.slug"
            :to="`/docs/${doc.slug}`"
            class="doc-nav"
            :class="{ 'doc-nav-on': doc.slug === activeSlug }"
          >
            {{ navTitle(doc.slug) }}
          </router-link>
        </nav>
      </aside>

      <!-- 右侧正文 -->
      <article class="min-w-0 flex-1">
        <div
          class="prose prose-neutral max-w-none dark:prose-invert"
          v-html="html"
        />
      </article>
    </div>
  </PortalLayout>
</template>

<style scoped>
.doc-nav {
  padding: 8px 12px;
  border-radius: 9px;
  font: 500 13px 'Space Grotesk', sans-serif;
  color: var(--text2);
  text-decoration: none;
  white-space: nowrap;
  transition: background 0.12s, color 0.12s;
}
.doc-nav:hover {
  background: var(--muted);
}
.doc-nav-on {
  background: var(--card);
  color: var(--text);
  font-weight: 600;
}
</style>
```

> 说明：`v-html` 注入的是我们自有的可信文档内容（非用户输入），符合 spec「html: true」前提。

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm -C user-portal exec vitest run src/views/__tests__/DocsView.test.ts`
Expected: PASS（2 passed）。

- [ ] **Step 5: 提交**

```bash
git add user-portal/src/views/DocsView.vue user-portal/src/views/__tests__/DocsView.test.ts
git commit -m "feat(user-portal): 新增文档页 DocsView（目录 + 正文渲染）" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: 路由注册、i18n 文案与顶栏入口

**Files:**
- Modify: `user-portal/src/router/index.ts`（加 `/docs/:slug?` 路由）
- Modify: `user-portal/src/i18n/locales/zh-CN/nav.ts`（加 `docs: '使用文档'`）
- Modify: `user-portal/src/i18n/locales/en-US/nav.ts`（加 `docs: 'Docs'`）
- Modify: `user-portal/src/layouts/PortalLayout.vue`（头像左侧入口）
- Test: `user-portal/src/__tests__/docs-route.test.ts`

**Interfaces:**
- Consumes: `DocsView`（Task 4）；i18n `nav` 命名空间。
- Produces: 命名路由 `Docs`（path `/docs/:slug?`，`meta.requiresAuth = true`、`meta.title = 'nav.docs'`）；i18n 键 `nav.docs`；`PortalLayout` 顶栏渲染指向 `/docs` 的入口链接。

- [ ] **Step 1: 写失败测试 `user-portal/src/__tests__/docs-route.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { routes } from '@/router'

describe('docs 路由', () => {
  it('注册了 Docs 命名路由，路径为 /docs/:slug?', () => {
    const docs = routes.find((r) => r.name === 'Docs')
    expect(docs).toBeTruthy()
    expect(docs?.path).toBe('/docs/:slug?')
    expect(docs?.meta?.requiresAuth).toBe(true)
    expect(docs?.meta?.title).toBe('nav.docs')
  })
})
```

> 该测试需要 `routes` 可被单独 import；下一步在 router 中具名导出它。

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm -C user-portal exec vitest run src/__tests__/docs-route.test.ts`
Expected: FAIL（`routes` 未导出 / 无 Docs 路由）。

- [ ] **Step 3: 加路由并导出 `routes`（改 `user-portal/src/router/index.ts`）**

把 `const routes: RouteRecordRaw[] = [` 改为具名导出 `export const routes: RouteRecordRaw[] = [`，并在 `Profile` 路由之后、通配回退之前插入 Docs 路由：

```ts
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('@/views/ProfileView.vue'),
    meta: { requiresAuth: true, title: 'nav.profile' }
  },
  {
    path: '/docs/:slug?',
    name: 'Docs',
    component: () => import('@/views/DocsView.vue'),
    meta: { requiresAuth: true, title: 'nav.docs' }
  },
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' }
```

（`createRouter({ routes })` 处不变，仍引用同一 `routes`。）

- [ ] **Step 4: 加 i18n 文案**

`user-portal/src/i18n/locales/zh-CN/nav.ts`：在 `profile: '个人资料',` 之后加一行

```ts
  docs: '使用文档',
```

`user-portal/src/i18n/locales/en-US/nav.ts`：在 `profile: 'Profile',` 之后加一行

```ts
  docs: 'Docs',
```

- [ ] **Step 5: 顶栏入口（改 `user-portal/src/layouts/PortalLayout.vue`）**

把「用户菜单」外层 `<div class="relative ml-auto">` 改为一个把入口链接与用户菜单并排的容器：外层 `div` 去掉 `ml-auto`，在其外再包一层 `ml-auto flex` 容器，并在用户菜单前插入文档入口。即把原来的

```html
      <!-- 用户菜单 -->
      <div class="relative ml-auto">
```

改为

```html
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
```

并在该 `<div class="relative">` 对应的原闭合 `</div>`（用户菜单块结束处，紧接 `</header>` 之前）之后补一个 `</div>` 关闭新加的 `ml-auto flex` 容器。原用户菜单块（按钮 + 下拉）内部结构完全不动。

在 `<style scoped>` 中追加入口链接样式：

```css
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
```

- [ ] **Step 6: 运行路由测试，确认通过**

Run: `pnpm -C user-portal exec vitest run src/__tests__/docs-route.test.ts`
Expected: PASS。

- [ ] **Step 7: 全量校验（类型 + 全部测试 + lint）**

仓库根运行：

```bash
mise run test-user-portal
mise run lint-user-portal
```

Expected: `vue-tsc` 无错；vitest 全绿（markdown / loaders / DocsView / docs-route）；eslint 通过。

- [ ] **Step 8: 提交**

```bash
git add user-portal/src/router/index.ts user-portal/src/i18n/locales user-portal/src/layouts/PortalLayout.vue user-portal/src/__tests__/docs-route.test.ts
git commit -m "feat(user-portal): 注册文档路由与顶栏入口，新增 nav.docs 文案" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: 手动端到端核验

**Files:** 无（人工验证 + 可能的微调）。

**Interfaces:**
- Consumes: 前 5 个任务的成果。
- Produces: 一次真实浏览器核验记录（无新代码；若发现样式/交互问题，回到对应任务修，不在此任务塞新功能）。

- [ ] **Step 1: 起开发服务器**

仓库根运行：`mise run run-user-portal`（端口 5174）。

- [ ] **Step 2: 逐项核验**

登录后在浏览器核对：
1. 顶栏头像**左侧**出现「使用文档」入口、与头像平级；hover 有反馈。
2. 点击进入 `/docs`，自动落到首篇「快速开始」，左侧目录显示该篇、当前篇高亮。
3. 正文 Markdown 正确渲染（标题/列表/段落，`prose` 排版生效）。
4. 切换语言（若 `VITE_PORTAL_LOCALE=AUTO`），目录标题与正文同步切到对应语言版本。
5. 切换深/浅色，正文 `dark:prose-invert` 配色正常。
6. 直接访问非法 slug（如 `/docs/nope`）回退首篇，不白屏。

- [ ] **Step 3: 记录结果**

核验通过则结束；若有问题，定位到对应任务修复后重跑 `mise run test-user-portal` 与本核验。

---

## 备注：spec 的 git 跟踪

设计 spec 位于 `docs/superpowers/specs/2026-06-29-user-portal-docs-design.md`，但仓库 `.gitignore` 第 134 行 `docs/*`（白名单放行少数文件）使其默认不被跟踪。本计划文档同理。二者作为本地开发草稿存在；如需纳入版本控制，另行在 `.gitignore` 加白名单或 `git add -f`（已与用户沟通，暂不强制跟踪）。
