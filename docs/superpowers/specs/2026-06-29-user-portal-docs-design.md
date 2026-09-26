# user-portal 使用文档功能 — 设计文档

日期：2026-06-29
范围：`user-portal`（Vue3 + Vite + TS 用户门户）

## 目标

在用户门户新增「使用文档」功能：顶栏头像左侧放一个与头像平级的「使用文档」入口，点击进入门户内的文档页。文档支持多篇、左侧目录导航，内容随中英语言切换。

## 核心决策

- **内容来源**：Markdown 文件随前端打包（不依赖后端 / 运行时远程拉取）。
- **加载方式**：Vite `import.meta.glob`（**懒加载、非 eager**），每篇 md 编译为独立 chunk 按需 fetch，`?raw` 取原文字符串，运行时用 `markdown-it` 渲染。
- **双语**：每篇文档维护 `<slug>.zh-CN.md` 与 `<slug>.en-US.md` 两份，页面跟随 `localeStore.current` 加载对应版本；缺失当前语言版本时回退 `zh-CN`。
- **结构**：多篇文档 + 左侧目录导航，路由 `/docs/:slug?`。
- **入口**：顶栏头像**左侧**、与头像平级的独立链接（不进下拉菜单）。

## 文件结构

```
user-portal/src/
  docs/
    _manifest.ts              # 文档清单：slug + 顺序 + 中英标题（导航唯一数据源）
    loaders.ts                # import.meta.glob 懒加载映射 + loadDoc(slug, locale)（含 zh 回退）
    quick-start.zh-CN.md      # 首批：快速开始（占位骨架，跑通整条链路）
    quick-start.en-US.md
  utils/
    markdown.ts               # markdown-it 单例 + renderMarkdown(src)（与 utils/format.ts 同风格）
  views/
    DocsView.vue              # 文档页：左侧目录 + 右侧正文
```

`loaders.ts` 把 glob 收口到 `src/docs/` 自身（`import.meta.glob('./*.md', …)`），key 形如 `./quick-start.zh-CN.md`，稳定且 DocsView 与测试共用同一映射。

新增一篇文档 = 放 `<slug>.zh-CN.md` + `<slug>.en-US.md` 两个文件 + 在 `_manifest.ts` 登记一行。

### `_manifest.ts` 形状

```ts
// 导航顺序与中英标题集中声明，省掉 frontmatter 解析依赖
export interface DocEntry {
  slug: string
  title: { 'zh-CN': string; 'en-US': string }
}

export const DOCS: DocEntry[] = [
  { slug: 'quick-start', title: { 'zh-CN': '快速开始', 'en-US': 'Quick Start' } }
]
```

## 加载机制（核心）

```ts
// 懒加载：每篇 md 独立 chunk，按需 fetch；?raw 拿原文字符串
const loaders = import.meta.glob('../docs/*.md', { query: '?raw', import: 'default' })
// key 形如 '../docs/quick-start.zh-CN.md' → () => Promise<string>
```

DocsView 监听 `route.params.slug` + `localeStore.current` 变化：

1. 由 `slug` + 当前 `locale` 拼出 key `../docs/${slug}.${locale}.md`。
2. 命中 loader → 调用拉取原文；未命中当前语言版本 → 回退 `zh-CN`。
3. `markdown-it` 渲染为 HTML，注入正文区。

## 路由（`src/router/index.ts`）

```ts
{
  path: '/docs/:slug?',
  name: 'Docs',
  component: () => import('@/views/DocsView.vue'),
  meta: { requiresAuth: true, title: 'nav.docs' }
}
```

- `requiresAuth: true`：与其它门户页一致（入口在登录态顶栏）。
- 无 slug / slug 非法 → 回退到 `DOCS` 第一篇。

## 入口（`PortalLayout.vue`）

把「使用文档」链接与原用户菜单用一个 flex 容器并排，`ml-auto` 整体推到右侧，二者平级：

```html
<div class="ml-auto flex items-center gap-3">
  <router-link to="/docs" class="doc-link" active-class="doc-link-on">
    {{ t('nav.docs') }}
  </router-link>
  <div class="relative">
    <!-- 原头像按钮 + 下拉菜单，原样保留 -->
  </div>
</div>
```

- 样式：克制的文字/胶囊链接，与顶栏 tab 视觉协调（复用 `.tab` 风格或单独 `.doc-link`）。
- 下拉菜单内**不**放文档项。
- 新增 i18n key `nav.docs`（zh-CN: `使用文档` / en-US: `Docs`），中英两份 `nav.ts` 同步。

## 渲染与样式

- `markdown-it` 单例：`{ html: true, linkify: true, typographer: true }`（文档为自有可信内容，允许内嵌 HTML）。
- 正文排版用 `@tailwindcss/typography` 的 `prose` 类，配深浅色主题微调。
- DocsView 套 `PortalLayout`，内部两栏：左侧 sticky 目录（`DOCS` 渲染、当前篇高亮），右侧 `prose` 正文。
- 目录暂为**扁平列表**（manifest 顺序），不分组（YAGNI；日后文档多了再加 `group` 字段）。

## 新增依赖

- 运行时：`markdown-it`
- 开发：`@types/markdown-it`、`@tailwindcss/typography`
- 测试基础设施（user-portal 原本无测试运行器，本功能一并引入）：`vitest`、`@vue/test-utils`、`jsdom`
- 安装后提交 `pnpm-lock.yaml`（CI 用 `--frozen-lockfile`）。

## 测试（`mise run test-user-portal`）

user-portal 原 `test-user-portal` 仅 `vue-tsc --noEmit`。本功能引入 vitest，并把该任务改为 `vue-tsc --noEmit && vitest run`；vitest 配置写进 `vite.config.ts`（`environment: 'jsdom'`、`globals: true`）。

- **markdown 渲染单测**：`renderMarkdown('# Hi')` 输出含 `<h1>`。
- **manifest 完整性单测**：`DOCS` 每个 slug 的 `zh-CN`/`en-US` 两个 md 文件都能在 `loaders.ts` 的 glob 映射中找到；`loadDoc` 命中返回内容、缺失语言回退 `zh-CN`。
- **DocsView 冒烟测**：挂载后渲染出目录项、正文 HTML 非空（测试中 stub 掉 `PortalLayout` 以隔离布局重依赖）。
- **路由测**：`routes` 中存在 `Docs` 命名路由（path `/docs/:slug?`、`requiresAuth`、`title=nav.docs`）。
- 顶栏 `/docs` 入口链接的渲染由类型检查 + 手动端到端核验保证（mount 整个 PortalLayout 会触发 auth 网络请求、过脆，不纳入自动化单测）。

## 非目标（Out of Scope）

- 不做后端 / 运行时远程文档拉取。
- 不做目录分组、全文搜索、文档版本化。
- 不解析 md frontmatter（标题/顺序由 manifest 承载）。
