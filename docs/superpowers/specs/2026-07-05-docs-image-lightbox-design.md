# 设计：user-portal 文档页图片点击放大（Lightbox）

日期：2026-07-05
状态：已确认

## 背景与目标

user-portal 的文档页（`DocsView.vue`）用 markdown 渲染接入文档，正文里的截图（如 `use-api-key.png`）以普通 `<img>` 呈现，受 800px 正文限宽约束，细节看不清。目标：点击文档正文中的任意图片，全屏遮罩居中放大查看；再点击任意处或按 Esc 关闭。

不做（YAGNI）：滚轮缩放、拖拽平移、旋转、多图翻页、平滑过渡动画。文档截图场景只需要"看大图"。

## 方案选型

- **选定：独立 `ui/ImageLightbox.vue` 组件 + DocsView 事件委托。** 与现有 `ui/Modal.vue` 同层同设计语言，职责清晰、可复用、可测试。
- 否决：全部内联在 DocsView（弹层通用逻辑与页面逻辑耦合，不可复用）。
- 否决：medium-zoom / viewerjs 等库（对文档截图场景过重，自研十几行可覆盖）。

## 组件设计：`src/components/ui/ImageLightbox.vue`

接口：

- `props`：`src: string | null`（null 即关闭，非 null 即打开）、`alt?: string`。
- `emit`：`close`。

行为（对齐 `Modal.vue` 的既有模式）：

- `Teleport to="body"`，`fixed inset-0 z-50` 全屏层；遮罩用 `bg-black/80`（比 Modal 的 `/40` 更深，看图需要压暗背景）。
- 图片 `max-width: 92vw; max-height: 92vh`，居中显示；图片上用 `cursor: zoom-out` 暗示可点击关闭。
- 打开期间：`document.body.style.overflow = 'hidden'` 锁底层滚动；监听 `keydown` 的 Escape 关闭；打开前记录焦点元素，关闭时还焦（与 Modal 的 `lastFocused` 模式一致）。
- 点击遮罩或图片本身均 emit `close`（整层任意处点击关闭）。
- 无障碍：`role="dialog"` + `aria-modal="true"`，`aria-label` 取 `alt`（空时回退 i18n 通用词条 `ui.dialog`）。
- 组件卸载时若仍打开，执行同样的清理（teardown）。

## DocsView 接线

- 状态：`lightboxSrc: string | null`、`lightboxAlt: string`。
- 在 `.prose` 容器（`v-html` 那个 div）上加 `@click` 事件委托：`e.target` 是 `IMG` 时取其 `currentSrc || src` 与 `alt`，打开 lightbox。委托挂在容器上，`v-html` 重渲染不需要重新绑事件。
- 样式：`.prose :deep(img) { cursor: zoom-in; }` 提示可点。
- 模板末尾挂 `<ImageLightbox :src="lightboxSrc" :alt="lightboxAlt" @close="lightboxSrc = null" />`。

## 测试

在 `DocsView` 现有测试（`src/views/__tests__/` 或对应位置）补一条用例：

1. 渲染含图片的文档 → 点击正文 `img` → 出现 `role="dialog"` 的全屏预览，且大图 `src` 与被点图片一致；
2. 按 Esc（或点击遮罩）→ 预览关闭。

组件逻辑简单，随视图测试覆盖，不单独建组件测试文件。

## 错误处理

- 大图加载失败：`<img>` 自然显示 broken 态，用户点击即可关闭，不做额外兜底（源图与正文同一张，正文能显示则大图必然可用）。
- 点击非图片区域：委托里类型判断直接忽略。
