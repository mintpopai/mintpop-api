# 设计：user-portal 个人资料页加入邀请码卡片

日期：2026-07-06
状态：已确认
实现说明：本设计未产出实施计划，由会话直接按本文实现（提交 8743e6be7）。

## 背景与目标

user-portal 的邀请返利页（`InviteView.vue`）已有「我的邀请码 + 邀请链接 + 复制」的展示块，但用户在个人资料页（`ProfileView.vue`）看不到自己的邀请码。目标：在 profile 页加入个人邀请码信息（邀请码 + 邀请链接 + 复制按钮，样式与 invite 页一致），并提供一个按钮跳转到 `/invite` 邀请页。

不做（YAGNI）：不在 profile 页展示返利统计/已邀请用户等其余邀请数据（那些留在 invite 页）；不新增后端接口。

## 方案选型

- **选定：抽共享组件 `InviteShareBox`，InviteView 与 profile 新卡片共用。** 样式天然一致，以后改一处两处生效。
- 否决：profile 里独立照抄一份展示块（样式重复、易漂移）。

## 组件设计

### 共享块：`src/components/invite/InviteShareBox.vue`

从 `InviteView.vue` 的「分享邀请」两栏块原样抽出：

- `props`：`affCode: string`。
- 内部：`inviteLink = ${window.location.origin}/register?aff=${encodeURIComponent(affCode)}`（沿用 InviteView 现逻辑）；复制用 `useCopy()`（copiedKey 取 `'code' | 'link'`）。
- 模板：`md:grid-cols-2` 两栏，「我的邀请码」「邀请链接」各一个 `bg-muted` 圆角框 + 「复制/已复制」按钮，文案复用现有 `invite.share.*` i18n 键。
- `InviteView.vue` 中原 grid 块替换为 `<InviteShareBox :aff-code="detail.aff_code" />`，其余（标题、使用说明）不动。

### profile 卡片：`src/components/profile/InviteCard.vue`

- 卡片外壳对齐 profile 页其它卡（`rounded-xl3 bg-card px-[30px] py-[28px] shadow-soft`，`font-serif text-[20px]` 标题 + 13px 副标题）。
- 头部右侧放「前往邀请页」按钮，`RouterLink to="/invite"`，样式对齐 profile 页现有次级按钮（pill 描边风格）。
- 数据自取：挂载时调 `getAffiliateDetail()`（GET /user/aff）取 `aff_code`；`User` 对象不含该字段，不改动 useProfile。
- 状态：加载中显示小号 `LoadingSpinner`；失败显示错误文案 + 重试按钮；成功渲染 `InviteShareBox`。

### ProfileView 接线

- 位置：`ProfileForm` 与 `BindingList` 之间。
- 门控：`v-if="settings?.affiliate_enabled"`（与 InviteView 的开关同语义，站点关闭邀请返利时整卡不渲染；settingsStore 已在本页 ensureLoaded）。

## i18n

`zh-CN/profile.ts` 与 `en-US/profile.ts` 各加：

```ts
invite: {
  title: '邀请返利' / 'Referral',
  subtitle: '分享邀请码或链接，邀请新用户获得返利。' / 'Share your code or link to invite users and earn rebates.',
  goToInvite: '前往邀请页' / 'Open referral page',
  loadFailed: '加载邀请码失败' / 'Failed to load referral code'
}
```

邀请码/链接/复制等字段文案继续复用 `invite.share.*`，两处不重复定义。

## 测试

- `InviteShareBox` 组件测试（`components/invite/__tests__/`）：渲染 affCode → 展示邀请码文本与 `?aff=` 链接；点击复制按钮 → `navigator.clipboard.writeText` 被以邀请码调用、按钮文案变「已复制」。
- InviteCard 逻辑简单（一次 API 拉取 + 三态渲染），随组件测试与现有 lint/type 门禁覆盖，不单独建视图测试。

## 错误处理

- GET /user/aff 失败：卡片内显示 `profile.invite.loadFailed` + 重试按钮，不影响页面其余部分。
- 复制失败：`useCopy` 已内置 toast 提示，无需额外处理。
