# 文档页图片点击放大（ImageLightbox）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** user-portal 文档页正文中的图片支持点击后全屏遮罩放大查看，点击任意处或 Esc 关闭。

**Architecture:** 新建可复用组件 `ui/ImageLightbox.vue`（对齐现有 `ui/Modal.vue` 的 Teleport / Esc / 锁滚动 / 还焦模式，`src=null` 即关闭）；`DocsView.vue` 在 `v-html` 的 `.prose` 容器上做点击事件委托（点到 `IMG` 即打开），重渲染无需重绑事件。

**Tech Stack:** Vue 3 `<script setup>` + TypeScript + Tailwind；测试 vitest + @vue/test-utils（jsdom）。

**Spec:** `docs/superpowers/specs/2026-07-05-docs-image-lightbox-design.md`

## Global Constraints

- 不引入任何新依赖（不用 medium-zoom / viewerjs）。
- 所有代码注释、提交信息用简体中文；提交信息末尾带 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。
- 质量门禁命令：`mise run lint-user-portal`、`mise run test-user-portal`（在仓库根执行）。
- 不做滚轮缩放 / 拖拽 / 旋转 / 多图翻页（YAGNI，见设计文档）。
- `docs/superpowers/` 被 `.gitignore` 排除，规格与计划文档不提交。

---

### Task 1: ImageLightbox 组件 + DocsView 接线（TDD）

**Files:**
- Test: `user-portal/src/views/__tests__/DocsView.test.ts`（追加用例）
- Create: `user-portal/src/components/ui/ImageLightbox.vue`
- Modify: `user-portal/src/views/DocsView.vue`

**Interfaces:**
- Consumes: 现有 `ui/Modal.vue` 的模式（仅参考，不引用）；i18n 词条 `ui.dialog`（zh-CN/en-US 均已存在）。
- Produces: `ImageLightbox` 组件 —— `props: { src: string | null; alt?: string }`，`emits: { close: [] }`。`src` 非 null 即打开、null 即关闭。

- [ ] **Step 1: 写失败测试**

在 `user-portal/src/views/__tests__/DocsView.test.ts` 中：

顶部 import 区追加（`loadDoc` 已被文件顶部的 `vi.mock('@/docs/loaders', ...)` mock，此处 import 拿到的是 mock 引用）：

```ts
import { loadDoc } from '@/docs/loaders'
```

文件末尾追加 describe 块：

```ts
describe('DocsView 图片点击放大', () => {
  it('点击正文图片打开全屏预览，Esc 关闭', async () => {
    // 本用例需要正文里有图片：覆盖一次 loadDoc 的返回
    vi.mocked(loadDoc).mockResolvedValueOnce('# 快速开始\n\n![示例图](/img/use-claude-code-api-key.png)')
    const router = makeRouter()
    router.push(`/docs/${DOCS[0].slug}`)
    await router.isReady()
    const wrapper = mountDocs(router)
    await flushPromises()

    // 点击正文图片 → Teleport 到 body 的 dialog 出现，大图 src 与被点图片一致
    await wrapper.get('.prose img').trigger('click')
    const dialog = document.body.querySelector('[role="dialog"]')
    expect(dialog).not.toBeNull()
    expect(dialog!.querySelector('img')?.getAttribute('src')).toContain('use-claude-code-api-key.png')

    // Esc → 预览关闭
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    // Teleport 内容挂在 document.body，显式卸载避免污染后续用例
    wrapper.unmount()
  })

  it('点击遮罩任意处关闭预览', async () => {
    vi.mocked(loadDoc).mockResolvedValueOnce('# 快速开始\n\n![示例图](/img/use-claude-code-api-key.png)')
    const router = makeRouter()
    router.push(`/docs/${DOCS[0].slug}`)
    await router.isReady()
    const wrapper = mountDocs(router)
    await flushPromises()

    await wrapper.get('.prose img').trigger('click')
    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')
    expect(dialog).not.toBeNull()

    // 点击遮罩层（整层任意处均可关闭）
    dialog!.click()
    await flushPromises()
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    wrapper.unmount()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd user-portal && pnpm exec vitest run src/views/__tests__/DocsView.test.ts
```

预期：原有 3 条通过，新增 2 条失败（`wrapper.get('.prose img')` 后查不到 `[role="dialog"]`）。

- [ ] **Step 3: 新建 ImageLightbox 组件**

创建 `user-portal/src/components/ui/ImageLightbox.vue`：

```vue
<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    /** 大图地址：null 即关闭，非 null 即打开 */
    src: string | null
    alt?: string
  }>(),
  { alt: '' }
)
const emit = defineEmits<{ close: [] }>()

// alt 为空时用通用词条兜底，保证屏幕阅读器始终能播报对话框名称（与 Modal 同策略）
const ariaLabel = computed(() => props.alt || t('ui.dialog'))

// 打开前的焦点元素，关闭时还焦（与 Modal 的 lastFocused 模式一致）
let lastFocused: HTMLElement | null = null

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

function teardown() {
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
  lastFocused?.focus()
  lastFocused = null
}

watch(
  () => props.src,
  (src, prev) => {
    if (src && !prev) {
      lastFocused = document.activeElement as HTMLElement | null
      document.body.style.overflow = 'hidden' // 锁定底层页面滚动
      window.addEventListener('keydown', onKey) // 只在打开期间监听
    } else if (!src && prev) {
      teardown()
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (props.src) teardown()
})
</script>

<template>
  <!-- Teleport 到 body：不受祖先 transform/overflow/层叠上下文影响（与 Modal 同策略） -->
  <Teleport to="body">
    <!-- 看图场景遮罩比 Modal 更深（black/80），整层任意处点击即关闭 -->
    <div
      v-if="src"
      role="dialog"
      aria-modal="true"
      :aria-label="ariaLabel"
      class="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/80 p-4"
      @click="emit('close')"
    >
      <img
        :src="src"
        :alt="alt"
        class="max-h-[92vh] max-w-[92vw] rounded-xl2 object-contain"
      >
    </div>
  </Teleport>
</template>
```

- [ ] **Step 4: DocsView 接线**

修改 `user-portal/src/views/DocsView.vue`：

① script 的 import 区追加：

```ts
import ImageLightbox from '@/components/ui/ImageLightbox.vue'
```

② script 末尾（`watch([activeSlug, ...])` 之后）追加：

```ts
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
```

③ 模板：给 `.prose` 那个 div（`v-html="html"` 所在元素）加 `@click="onProseClick"`：

```html
<div
  v-else
  class="prose prose-neutral max-w-none dark:prose-invert prose-a:text-accent prose-a:no-underline prose-a:hover:underline"
  @click="onProseClick"
  v-html="html"
/>
```

④ 模板末尾、`</PortalLayout>` 之前（右侧 `<aside>` 之后）追加：

```html
<!-- 图片全屏预览（Teleport 到 body，放哪都行，挂在布局末尾便于阅读） -->
<ImageLightbox
  :src="lightboxSrc"
  :alt="lightboxAlt"
  @close="lightboxSrc = null"
/>
```

⑤ `<style scoped>` 末尾追加：

```css
/* 正文图片可点击放大，光标提示 */
.prose :deep(img) {
  cursor: zoom-in;
}
```

- [ ] **Step 5: 跑测试确认通过**

```bash
cd user-portal && pnpm exec vitest run src/views/__tests__/DocsView.test.ts
```

预期：5 条全部通过。

- [ ] **Step 6: 全量质量门禁**

在仓库根执行：

```bash
mise run lint-user-portal && mise run test-user-portal
```

预期：lint 无报错；vue-tsc 类型检查通过；全部 vitest 用例通过。

- [ ] **Step 7: 提交**

```bash
git add user-portal/src/components/ui/ImageLightbox.vue user-portal/src/views/DocsView.vue user-portal/src/views/__tests__/DocsView.test.ts
git commit -m "feat(user-portal): 文档页图片点击放大全屏预览

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- user-portal/src/components/ui/ImageLightbox.vue user-portal/src/views/DocsView.vue user-portal/src/views/__tests__/DocsView.test.ts
```

注意：工作区已有其它未提交改动（`_manifest.ts`、`claude-desktop.*.md`），提交时用上面的 pathspec 限定，只提交本任务三个文件。
