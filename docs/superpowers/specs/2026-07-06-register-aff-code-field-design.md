# 注册页好友邀请码输入框设计

日期：2026-07-06
组件：user-portal

## 背景与目标

注册页目前对邀请返利码（`aff_code`）是静默处理：用户经 `/register?aff=XXX` 进站后，码落地 localStorage（30 天 TTL），提交注册时自动携带，但页面上不可见、也无法手动填写。

目标：把返利码升级为**可见、可编辑的表单字段**——

1. 访问标准邀请链接（`/register?aff=V269J6HUH72F`，兼容 `?aff_code=`）时自动回填到输入框；
2. 未走链接的用户也能手动填写；
3. 用户可修改或清空自动回填的码。

注意区分两个概念：本设计针对**邀请返利码 `aff_code`**（用户互邀返利）；表单里已有的「邀请码」是**注册准入码 `invitation_code`**（管理员生成的兑换码，`invitation_code_enabled` 开启时必填），两者互不相干、继续共存。

## 设计（方案 A：可见输入框，随 `affiliate_enabled` 开关显示）

### 交互与展示

- 在注册表单新增「好友邀请码」输入框，标「选填」，与准入邀请码/优惠码同一区块风格。
- 仅当 `settings.affiliate_enabled === true` 时渲染（与优惠码 `promo_code_enabled` 同一模式）。
- 中文 label：**好友邀请码**，placeholder「填写好友分享的邀请码」；英文 label：**Referral code**，placeholder "Enter your friend's referral code"。与准入「邀请码」文案区分。
- 不做实时校验、不加自动回填提示文案：后端注册时绑定失败 fail-open（只记日志不阻断注册），加校验/提示属于过度设计。

### 数据流

- 现有 `affCode` ref 从隐藏状态改为表单字段（`v-model`）。
- 回填优先级：URL `?aff=` / `?aff_code=`（现有 watch，进站即落地 localStorage）→ 页面挂载时若 `affCode` 为空，回取 localStorage 中 30 天内未过期的码填入。
- 提交时 `aff_code: affCode.value.trim() || undefined`，以输入框内容为准；删除提交时刻的 `loadAffiliateReferralCode()` 兜底（回填已前移到进页时），用户清空输入框即视为不带邀请码。
- 注册成功后照旧 `clearAffiliateReferralCode()`。
- settings 拉取失败时输入框不渲染，但 `affCode`（来自 URL/localStorage）仍随提交静默携带，行为不劣化于现状；`affiliate_enabled` 为 false 时后端本就静默忽略 aff 参数，无害。

### 改动面

- `user-portal/src/views/RegisterView.vue`：脚本（挂载回填、提交取值）+ 模板（新增输入框）。
- `user-portal/src/i18n/locales/zh-CN/auth.ts`、`en-US/auth.ts`：新增 label/placeholder 文案。
- 测试：新增/扩展 RegisterView 用例——带 `?aff=` 进入时输入框自动回填、提交请求携带 `aff_code`、清空后提交不携带。
- 后端零改动。

## 错误处理

- 填错码不阻断注册（后端 fail-open），前端不额外报错。
- localStorage 读写异常已由 `affiliateReferral.ts` 工具内部吞掉。

## 测试策略

沿用 user-portal 现有 vitest 基建（`mise run test-user-portal`）：

1. 访问 `?aff=XXX` → 输入框值为 `XXX`，localStorage 已落地；
2. 无 URL 参数但 localStorage 有未过期码 → 输入框回填该码;
3. 提交时请求体 `aff_code` 与输入框一致；清空输入框 → 请求体不含 `aff_code`；
4. `affiliate_enabled` 为 false/未知 → 不渲染输入框。
