# 用户门户页面落地 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 mint 设计稿（Keys / Usage / Recharge / Orders / Profile）实现为独立用户门户的可用 Vue 页面，全功能对齐 `frontend/`、外观换成 mint，仅改 `user-portal/`。

**Architecture:** 方案 C（混合粒度）——抽一组共享 UI 原语（`PageHeader/StatCard/StatusBadge/FilterBar/Pagination/Modal`），每页配一个 composable 管数据，大页面（Keys/Recharge）下钻子组件。沿用既有 `PortalLayout` 壳、`theme.css` token、`useDashboard` 数据范式。

**Tech Stack:** Vue 3.5（`<script setup lang="ts">`）、TypeScript、Vue Router 4、Pinia 2、Tailwind 3（语义 token）、Axios（`api/client.ts`）。无新增运行时依赖。

设计文档：`docs/specs/2026-06-24-user-portal-views-design.md`。

## ⚠️ 与 spec 的一处偏差（测试方式）

user-portal **没有单元测试运行器**（无 vitest）。`mise run test-user-portal` 实为 `vue-tsc --noEmit`（类型检查），`mise run lint-user-portal` 为 ESLint。本计划**不引入测试框架**（避免未被要求的范围蔓延），每个任务的验证回路为 **typecheck → lint → 必要时 build**，纯函数靠类型 + 调用点保证。若需要 vitest，请在执行前提出，会单列一个引入任务。

## Global Constraints

- **只改 `user-portal/`**：不得修改 `backend/`、`frontend/`。
- **包管理器固定 pnpm**；命令在 `user-portal/` 目录下跑：`pnpm run typecheck`、`pnpm run lint:check`、`pnpm run build`。
- **网络层既有约定**（`api/client.ts`）：baseURL `/api/v1`；响应已把 `{code,data}` 解包为内层 `data`；GET 自动注入 `timezone`；带 Bearer；401 自动续期。**api 模块路径相对 `/api/v1` 写**，返回值即内层数据。
- **样式只用既有 token**（`tailwind.config.js` + `theme.css`）：颜色 `bg/card/bar/border/border2/text/text2/text3/mtext/muted/track/hover/rowline/ink/accent/pos/neg/subtle/faint`；字体 `font-display`(Fredoka)/`font-serif`(Newsreader)/`font-sans`(Space Grotesk)；圆角 `xl2(16) xl3(18) xl4(22)`；阴影 `card/soft/pill/menu`；大数字用 `.num` 或 `font-serif`。设计稿用到的 token 已全部存在，**不新增颜色**。
- **枚举字符串值以后端实际序列化为准**（订单状态为小写 `pending/paid/completed/failed/refunded`），不强行改大小写。
- **提交信息用中文**，结尾加 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。当前分支 `user-portal`，直接在该分支提交。
- 文案、注释、文档一律简体中文。

## 通用：内联样式 → Tailwind token 映射表（所有组件任务引用，DRY）

设计稿 `.dc.html` 用内联 style。把内联值按下表换成 token 类，不要照搬 hex：

| 设计稿内联 | Tailwind |
| --- | --- |
| `background:var(--card,#fff)` | `bg-card` |
| `background:var(--bg)` / `#FAFAF8` | `bg-bg` |
| `background:var(--muted)` / `#F4F3EF` | `bg-muted` |
| `background:var(--track)` / `#F0EEE7` | `bg-track` |
| `background:var(--hover)` / `#FCFBF8` | `bg-hover` |
| `#14C28A`（主绿，按钮/强调） | `bg-accent` / `text-accent` |
| `#0E9E72`（正向数字/已支付） | `text-pos` |
| `#FB0682`（删除/退出/危险） | `text-neg` |
| `color:var(--text)` / `#1A1A1A` | `text-text` |
| `color:var(--text2)` / `#5A5852` | `text-text2` |
| `color:var(--text3)` / `#7A766C` | `text-text3` |
| `color:#9A968C`（副文案） | `text-subtle` |
| `color:#B0ACA2`（大写小标签） | `text-faint` |
| `border:1px solid var(--border)` | `border border-border` |
| `border:1.5px solid var(--border2)` | `border-[1.5px] border-border2` |
| `border-radius:16/18/22px` | `rounded-xl2/xl3/xl4` |
| `box-shadow:0 2px 14/10/...（卡片）` | `shadow-card` / `shadow-soft` |
| `box-shadow:0 1px 4px（pill）` | `shadow-pill` |
| `font:500 36px 'Newsreader'`（页面大标题） | `font-serif text-4xl font-medium tracking-tight` |
| `font:500 32px 'Newsreader'`（KPI 大数字） | `num text-[32px] font-medium leading-none` |
| `font:600 11px;letter-spacing:.1em;uppercase`（小标签） | `text-[11px] font-medium uppercase tracking-[0.1em] text-faint` |
| `'Space Grotesk'` 正文 | 默认（body 已设），无需显式 |

- 数字色块（微信绿 `#09BB07`、支付宝蓝 `#1677FF`、Stripe 紫 `#635BFF`、平台色点 claude 红/gpt 绿）属**品牌固定色**，可用任意值类 `bg-[#09BB07]`（不随深浅翻转），与设计稿一致。
- 间距/栅格保持设计稿像素，用任意值类（如 `gap-[18px]`、`px-[26px]`、`grid-cols-[1.4fr_1.5fr_1fr_1.3fr_0.9fr_1.7fr]`）。
- 深色由 `.dark` + token 自动生效，组件内不写深色分支。

每个页面统一骨架（照 `DashboardView.vue`）：

```vue
<PortalLayout>
  <PageHeader title="…" subtitle="…"><template #actions>…</template></PageHeader>
  <LoadingSpinner v-if="loading && !loaded" .../>
  <div v-else-if="error && !loaded" class="…虚线卡片…">{{ error }} + 重试</div>
  <template v-else> …内容… </template>
</PortalLayout>
```

---

## Task 1: 数据层类型对齐（types.ts）+ 修正 useDashboard

把占位类型校正到后端真实 DTO（后端为准）。这是后续所有任务的基础。

**Files:**
- Modify: `user-portal/src/api/types.ts`
- Modify: `user-portal/src/composables/useDashboard.ts`（`getRecentUsage` 读 `data` 而非 `items`）

**Interfaces:**
- Produces: `PaginatedResponse<T>{ data: T[]; total; page; page_size }`、`MethodLimit{ min; max; fee_rate }`、`SubscriptionPlan`、`CheckoutInfoResponse{ methods; global_min; global_max; plans; balance_disabled; balance_recharge_multiplier; recharge_fee_rate; stripe_publishable_key; alipay_force_qrcode? }`、`OrderStatus='pending'|'paid'|'completed'|'failed'|'refunded'`、`PaymentOrder`、`CreateOrderRequest`、`CreateOrderResult`、`Group`、`GroupRates`、`BindStartRequest/Result`、`PublicSettings`（补 `purchase_subscription_enabled`）。

- [ ] **Step 1: 改 `PaginatedResponse`**

```ts
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  page_size: number
}
```

- [ ] **Step 2: 修 `useDashboard.ts` 的 recent 读取**

把 `composables/useDashboard.ts` 中 `recent.value = r.items || []` 改为 `recent.value = r.data || []`。

- [ ] **Step 3: 改 `MethodLimit` 与 `CheckoutInfoResponse`，新增 `SubscriptionPlan`**

```ts
export interface MethodLimit {
  min: number
  max: number
  fee_rate: number
}

export interface SubscriptionPlan {
  id: number
  group_id: number
  group_platform?: string
  group_name?: string
  rate_multiplier?: number
  daily_limit_usd?: number
  weekly_limit_usd?: number
  monthly_limit_usd?: number
  name: string
  description?: string
  price: number
  original_price?: number
  validity_days: number
  validity_unit?: string
  features?: string[]
}

export interface CheckoutInfoResponse {
  methods: Record<string, MethodLimit>
  global_min: number
  global_max: number
  plans: SubscriptionPlan[]
  balance_disabled: boolean
  balance_recharge_multiplier: number
  recharge_fee_rate: number
  stripe_publishable_key: string
  alipay_force_qrcode?: boolean
}
```

- [ ] **Step 4: 改订单类型**

```ts
export type OrderStatus = 'pending' | 'paid' | 'completed' | 'failed' | 'refunded'

export interface PaymentOrder {
  id: number
  user_id: number
  amount: number
  pay_amount: number
  fee_rate: number
  currency?: string
  payment_type: string
  out_trade_no: string
  status: OrderStatus
  order_type: 'balance' | 'subscription'
  created_at: string
  expires_at: string
  paid_at?: string
  completed_at?: string
  refund_amount?: number
  refund_reason?: string
  plan_id?: number
  provider_instance_id?: string
}

export interface CreateOrderRequest {
  amount: number
  payment_type: string
  order_type: 'balance' | 'subscription'
  plan_id?: number
  return_url?: string
  is_mobile?: boolean
}

/**
 * 下单返回。pay_url / qr_code / result_type 等支付引导字段以后端 create-order
 * handler 实际返回为准——实现 Task 11 前先读 backend payment handler 的响应 DTO，
 * 缺哪个补哪个，不要凭此处猜测发请求。
 */
export interface CreateOrderResult extends PaymentOrder {
  pay_url?: string
  qr_code?: string
  result_type?: string
}
```

- [ ] **Step 5: 新增 Group / 绑定类型，补 PublicSettings**

```ts
export interface Group {
  id: number
  name: string
  description?: string
  platform?: string
  rate_multiplier?: number
  subscription_type?: string
}

export type GroupRates = Record<string, number>

export interface BindStartRequest {
  provider: string
  redirect_to?: string
}

export interface BindStartResult {
  authorize_url: string
}
```

在现有 `PublicSettings` 接口补一行：`purchase_subscription_enabled?: boolean`。

- [ ] **Step 6: 校正旧字段引用**

删除 `ApiKeyGroup` 若与新 `Group` 重复则保留其一；`ApiKey.group?: ApiKeyGroup` 改为 `group?: Group`。`CreateApiKeyRequest` 保持仅 `{ name; group_id?; expires_in_days?; quota? }`（精简范围）。

- [ ] **Step 7: typecheck + lint**

Run: `cd user-portal && pnpm run typecheck && pnpm run lint:check`
Expected: PASS（此时 keys.ts/payment.ts 仍引用旧名的地方会报错——在 Task 3 一并修；若本任务即报错，先把 keys.ts `PaginatedResponse` 用法从 `.items` 改 `.data`、把 payment.ts 暂时注释不影响编译。优先保证 types.ts 与 useDashboard 自洽）。

- [ ] **Step 8: 提交**

```bash
git add user-portal/src/api/types.ts user-portal/src/composables/useDashboard.ts
git commit -m "fix(user-portal): 数据层类型对齐后端 DTO（分页/支付/分组/绑定）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: 工具函数扩展（utils/format.ts）

**Files:**
- Modify: `user-portal/src/utils/format.ts`

**Interfaces:**
- Produces: `maskApiKey(key)`、`formatReasoningEffort(e)`、`orderStatusMeta(s)→{label,variant}`、`formatRegMonth(s)`、`formatCNY(n)`、`cacheHitRate(read,input)`。

- [ ] **Step 1: 追加函数**

```ts
/** 掩码密钥：前 6 + … + 后 4，对齐设计稿 sk-4d2…e32d */
export function maskApiKey(key: string | null | undefined): string {
  if (!key) return '—'
  if (key.length <= 12) return key
  return `${key.slice(0, 6)}…${key.slice(-4)}`
}

/** 推理强度标签 */
export function formatReasoningEffort(e: string | null | undefined): string {
  if (!e) return '—'
  const map: Record<string, string> = {
    minimal: 'Minimal', low: 'Low', medium: 'Medium', high: 'High', xhigh: 'XHigh'
  }
  return map[e] ?? (e.charAt(0).toUpperCase() + e.slice(1))
}

/** 订单状态 → 中文 + StatusBadge variant */
export function orderStatusMeta(s: string): { label: string; variant: string } {
  const m: Record<string, { label: string; variant: string }> = {
    pending: { label: '待支付', variant: 'pending' },
    paid: { label: '已支付', variant: 'paid' },
    completed: { label: '已完成', variant: 'paid' },
    failed: { label: '失败', variant: 'neg' },
    refunded: { label: '已退款', variant: 'muted' }
  }
  return m[s] ?? { label: s, variant: 'muted' }
}

/** 注册月份 Jun 2026 */
export function formatRegMonth(s: string | null | undefined): string {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(d)
}

const cny0 = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
/** 人民币金额（2 位小数，无符号，调用方自行加 ¥） */
export function formatCNY(n: number): string {
  return cny0.format(Number.isFinite(n) ? n : 0)
}

/** 缓存命中率 0-100 整数 */
export function cacheHitRate(cacheRead: number, input: number): number {
  return percent(cacheRead, (input ?? 0) + (cacheRead ?? 0))
}
```

- [ ] **Step 2: typecheck + lint**

Run: `cd user-portal && pnpm run typecheck && pnpm run lint:check`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add user-portal/src/utils/format.ts
git commit -m "feat(user-portal): 扩展格式化工具（掩码key/强度/订单状态/CNY/注册月）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: API 模块扩展与修正

**Files:**
- Create: `user-portal/src/api/groups.ts`
- Create: `user-portal/src/api/settings.ts`
- Create: `user-portal/src/api/binding.ts`
- Modify: `user-portal/src/api/keys.ts`（`PaginatedResponse` 已是 `data`，确认无 `.items` 引用）
- Modify: `user-portal/src/api/payment.ts`（加 `verifyOrder`、`getPlans`，对齐 `createOrder` body 与返回类型）
- Modify: `user-portal/src/api/redeem.ts`（加可选 `getRedeemHistory`）
- Modify: `user-portal/src/api/user.ts`（确认 `updateProfile` 走 `PUT /user`，含 `avatar_url`）

**Interfaces:**
- Produces：`groups.listAvailable()→Group[]`、`groups.getRates()→GroupRates`、`settings.getPublicSettings()→PublicSettings`、`binding.startBind(req)→BindStartResult`、`binding.unbind(provider)→User`、`payment.verifyOrder(out_trade_no)→PaymentOrder`、`payment.getPlans()→SubscriptionPlan[]`、`redeem.getRedeemHistory()→RedeemResult[]`（可选）。

- [ ] **Step 1: `api/groups.ts`**

```ts
// 分组 —— 用户可见分组列表与倍率（密钥筛选/创建表单用）
import { apiClient } from './client'
import type { Group, GroupRates } from './types'

export async function listAvailable(): Promise<Group[]> {
  const { data } = await apiClient.get<Group[]>('/groups/available')
  return data
}

export async function getRates(): Promise<GroupRates> {
  const { data } = await apiClient.get<GroupRates>('/groups/rates')
  return data
}
```

- [ ] **Step 2: `api/settings.ts`**

```ts
// 公开站点设置（注册/各 OAuth/支付开关等）
import { apiClient } from './client'
import type { PublicSettings } from './types'

export async function getPublicSettings(): Promise<PublicSettings> {
  const { data } = await apiClient.get<PublicSettings>('/settings/public')
  return data
}
```

- [ ] **Step 3: `api/binding.ts`**

```ts
// 登录方式绑定 —— 发起第三方绑定（拿授权跳转）/ 解绑
import { apiClient } from './client'
import type { BindStartRequest, BindStartResult, User } from './types'

/** 发起绑定：返回授权 URL，前端跳转 */
export async function startBind(req: BindStartRequest): Promise<BindStartResult> {
  const { data } = await apiClient.post<BindStartResult>('/user/auth-identities/bind/start', req)
  return data
}

/** 解绑指定 provider，返回更新后的用户资料 */
export async function unbind(provider: string): Promise<User> {
  const { data } = await apiClient.delete<User>(`/user/account-bindings/${provider}`)
  return data
}
```

- [ ] **Step 4: 扩展 `api/payment.ts`**

在现有基础上：`createOrder` 入参类型用新的 `CreateOrderRequest`、返回 `CreateOrderResult`；新增 `verifyOrder`、`getPlans`。

```ts
import type {
  CheckoutInfoResponse, CreateOrderRequest, CreateOrderResult,
  PaymentOrder, PaginatedResponse, SubscriptionPlan
} from './types'

export async function verifyOrder(outTradeNo: string): Promise<PaymentOrder> {
  const { data } = await apiClient.post<PaymentOrder>('/payment/orders/verify', {
    out_trade_no: outTradeNo
  })
  return data
}

export async function getPlans(): Promise<SubscriptionPlan[]> {
  const { data } = await apiClient.get<SubscriptionPlan[]>('/payment/plans')
  return data
}
```

`getMyOrders` 的返回 `PaginatedResponse<PaymentOrder>` 现在用 `.data`（消费方按此读）。

- [ ] **Step 5: `api/redeem.ts` 加历史（可选展示用）**

```ts
import type { RedeemResult } from './types'

export async function getRedeemHistory(): Promise<RedeemResult[]> {
  const { data } = await apiClient.get<RedeemResult[]>('/redeem/history')
  return data
}
```

- [ ] **Step 6: 确认 `api/user.ts`**

`updateProfile` 维持 `PUT /user`，入参 `{ username?; avatar_url?: string | null }`（头像即 data URL 字符串或 null）。无需 multipart。

- [ ] **Step 7: typecheck + lint（全绿）**

Run: `cd user-portal && pnpm run typecheck && pnpm run lint:check`
Expected: PASS（Task 1 遗留的引用此时应全部消除）

- [ ] **Step 8: 提交**

```bash
git add user-portal/src/api
git commit -m "feat(user-portal): 新增 groups/settings/binding api，扩展 payment/redeem

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: 共享 UI 原语（PageHeader / StatCard / StatusBadge）

**Files:**
- Create: `user-portal/src/components/ui/PageHeader.vue`
- Create: `user-portal/src/components/ui/StatCard.vue`
- Create: `user-portal/src/components/ui/StatusBadge.vue`

**Interfaces:**
- `PageHeader` props `{ title: string; subtitle?: string }` + slot `#actions`。
- `StatCard` props `{ label: string; value: string; hint?: string; accent?: boolean }`（`accent` 时大数字用 `text-accent`）。
- `StatusBadge` props `{ label: string; variant: 'active'|'inactive'|'paid'|'pending'|'neg'|'muted' }`。

- [ ] **Step 1: `PageHeader.vue`**

```vue
<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>()
</script>

<template>
  <div class="mb-[30px] flex items-start justify-between">
    <div>
      <h1 class="mb-2 font-serif text-4xl font-medium tracking-tight text-text">{{ title }}</h1>
      <p v-if="subtitle" class="text-sm text-subtle">{{ subtitle }}</p>
    </div>
    <div class="flex items-center gap-2.5">
      <slot name="actions" />
    </div>
  </div>
</template>
```

- [ ] **Step 2: `StatCard.vue`**

```vue
<script setup lang="ts">
defineProps<{ label: string; value: string; hint?: string; accent?: boolean }>()
</script>

<template>
  <div class="rounded-xl2 bg-card p-[22px] shadow-soft">
    <div class="mb-3.5 text-[11px] font-medium uppercase tracking-[0.1em] text-faint">{{ label }}</div>
    <div class="num text-[32px] font-medium leading-none" :class="accent ? 'text-accent' : 'text-text'">{{ value }}</div>
    <div v-if="hint" class="mt-2.5 text-xs text-subtle">{{ hint }}</div>
  </div>
</template>
```

- [ ] **Step 3: `StatusBadge.vue`**

variant → 前景/背景类映射（用品牌固定值类，绿色用 token）：

```vue
<script setup lang="ts">
const props = defineProps<{ label: string; variant: string }>()
const styles: Record<string, string> = {
  active: 'text-pos bg-accent/10',
  paid: 'text-pos bg-accent/10',
  inactive: 'text-subtle bg-track',
  muted: 'text-subtle bg-track',
  pending: 'text-[#C77800] bg-[#F59E0B]/[0.13]',
  neg: 'text-neg bg-neg/10'
}
const cls = () => styles[props.variant] ?? styles.muted
</script>

<template>
  <span :class="['inline-block rounded-full px-3 py-[5px] text-xs font-semibold', cls()]">● {{ label }}</span>
</template>
```

- [ ] **Step 4: typecheck + lint**

Run: `cd user-portal && pnpm run typecheck && pnpm run lint:check`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add user-portal/src/components/ui/PageHeader.vue user-portal/src/components/ui/StatCard.vue user-portal/src/components/ui/StatusBadge.vue
git commit -m "feat(user-portal): 共享 UI 原语 PageHeader/StatCard/StatusBadge

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: 共享 UI 原语（FilterBar / Pagination / Modal）

**Files:**
- Create: `user-portal/src/components/ui/Pagination.vue`
- Create: `user-portal/src/components/ui/Modal.vue`
- Create: `user-portal/src/components/ui/FilterBar.vue`

**Interfaces:**
- `Pagination` props `{ page: number; pageSize: number; total: number }`，emit `update:page`（点上一/下一页）。展示 `显示 a–b 共 n 条 · 每页 m`。
- `Modal` props `{ open: boolean; title?: string }`，emit `close`；slot 默认 + `#footer`。ESC / 点遮罩关闭。
- `FilterBar`：纯容器，默认 slot 横排筛选项（`flex gap-3 items-center mb-4`）。

- [ ] **Step 1: `Pagination.vue`**

```vue
<script setup lang="ts">
const props = defineProps<{ page: number; pageSize: number; total: number }>()
const emit = defineEmits<{ 'update:page': [n: number] }>()
const from = () => (props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1)
const to = () => Math.min(props.page * props.pageSize, props.total)
const hasPrev = () => props.page > 1
const hasNext = () => props.page * props.pageSize < props.total
</script>

<template>
  <div class="flex items-center justify-between border-t border-track bg-hover px-[26px] py-4">
    <span class="text-[13px] text-subtle">显示 {{ from() }}–{{ to() }} 共 {{ total }} 条 · 每页 {{ pageSize }} 条</span>
    <div class="flex items-center gap-1.5">
      <button class="rounded-lg border border-border px-[11px] py-1.5 text-[13px] text-faint disabled:opacity-50"
        :disabled="!hasPrev()" @click="emit('update:page', page - 1)">‹</button>
      <span class="rounded-lg bg-accent px-3 py-1.5 text-[13px] font-semibold text-white">{{ page }}</span>
      <button class="rounded-lg border border-border px-[11px] py-1.5 text-[13px] text-faint disabled:opacity-50"
        :disabled="!hasNext()" @click="emit('update:page', page + 1)">›</button>
    </div>
  </div>
</template>
```

- [ ] **Step 2: `Modal.vue`**

```vue
<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
const props = defineProps<{ open: boolean; title?: string }>()
const emit = defineEmits<{ close: [] }>()
function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && props.open) emit('close') }
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/40" @click="emit('close')" />
    <div class="relative z-10 w-full max-w-[460px] rounded-xl4 bg-card p-7 shadow-menu">
      <h3 v-if="title" class="mb-5 font-serif text-xl font-medium text-text">{{ title }}</h3>
      <slot />
      <div class="mt-6 flex justify-end gap-3"><slot name="footer" /></div>
    </div>
  </div>
</template>
```

- [ ] **Step 3: `FilterBar.vue`**

```vue
<template>
  <div class="mb-4 flex flex-wrap items-center gap-3"><slot /></div>
</template>
```

- [ ] **Step 4: typecheck + lint，提交**

```bash
cd user-portal && pnpm run typecheck && pnpm run lint:check
git add user-portal/src/components/ui/Pagination.vue user-portal/src/components/ui/Modal.vue user-portal/src/components/ui/FilterBar.vue
git commit -m "feat(user-portal): 共享 UI 原语 Pagination/Modal/FilterBar

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: 公开设置 store（usePublicSettings）

**Files:**
- Create: `user-portal/src/stores/settings.ts`

**Interfaces:**
- Produces: `useSettingsStore()` → `{ settings: Ref<PublicSettings|null>, ensureLoaded(): Promise<void> }`。供 Profile 绑定显隐、Recharge 订阅 tab 显隐使用。

- [ ] **Step 1: `stores/settings.ts`**

```ts
import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { PublicSettings } from '@/api/types'
import { getPublicSettings } from '@/api/settings'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<PublicSettings | null>(null)
  let inflight: Promise<void> | null = null

  async function ensureLoaded(): Promise<void> {
    if (settings.value) return
    if (!inflight) {
      inflight = getPublicSettings()
        .then((s) => { settings.value = s })
        .catch((e) => { console.warn('加载公开设置失败:', e) })
        .finally(() => { inflight = null })
    }
    return inflight
  }

  return { settings, ensureLoaded }
})
```

- [ ] **Step 2: typecheck + lint，提交**

```bash
cd user-portal && pnpm run typecheck && pnpm run lint:check
git add user-portal/src/stores/settings.ts
git commit -m "feat(user-portal): 公开设置 store（绑定/订阅开关显隐）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: API 密钥页（useKeys + KeyTable + 弹窗 + KeysView）

设计稿：`~/Desktop/user-portal/Mint API Keys.dc.html`。范围精简：创建/编辑只 名称/分组/有效期/配额。

**Files:**
- Create: `user-portal/src/composables/useKeys.ts`
- Create: `user-portal/src/components/keys/KeyTable.vue`
- Create: `user-portal/src/components/keys/CreateKeyModal.vue`
- Create: `user-portal/src/components/keys/EditKeyModal.vue`
- Rewrite: `user-portal/src/views/KeysView.vue`

**Interfaces:**
- `useKeys()` → `{ rows, total, page, pageSize, filters(reactive: search/status/group_id), groups, usage, loading, error, loaded, load(), setPage(n), create(payload), update(id, patch), toggle(id, status), remove(id) }`。`usage` 为 `Record<string, ApiKeyUsageStat>`。
- `KeyTable` props `{ rows: ApiKey[]; usage: Record<string,ApiKeyUsageStat> }`，emit `edit(key)`/`toggle(key)`/`remove(key)`/`copy(key)`。
- `CreateKeyModal` props `{ open; groups: Group[] }`，emit `close`、`submit(payload: CreateApiKeyRequest)`、内部成功后展示一次性明文（由父传回新 key 或组件内自管两步）。
- `EditKeyModal` props `{ open; target: ApiKey|null; groups: Group[] }`，emit `close`、`submit(id, patch: UpdateApiKeyRequest)`。

- [ ] **Step 1: `useKeys.ts`（完整逻辑）**

```ts
import { ref, reactive } from 'vue'
import * as keysApi from '@/api/keys'
import * as groupsApi from '@/api/groups'
import type { ApiKey, Group, ApiKeyUsageStat, CreateApiKeyRequest, UpdateApiKeyRequest } from '@/api/types'

export function useKeys() {
  const rows = ref<ApiKey[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(20)
  const filters = reactive<{ search: string; status: string; group_id: string }>({ search: '', status: '', group_id: '' })
  const groups = ref<Group[]>([])
  const usage = ref<Record<string, ApiKeyUsageStat>>({})
  const loading = ref(false)
  const error = ref<string | null>(null)
  const loaded = ref(false)

  async function load() {
    loading.value = true
    error.value = null
    try {
      const res = await keysApi.listKeys(page.value, pageSize.value, {
        search: filters.search || undefined,
        status: filters.status || undefined,
        group_id: filters.group_id || undefined
      })
      rows.value = res.data
      total.value = res.total
      loaded.value = true
      // 批量用量（非关键，失败不阻断）
      try {
        usage.value = await keysApi.getKeysUsage(res.data.map((k) => k.id))
      } catch { usage.value = {} }
    } catch (e) {
      error.value = (e as { message?: string }).message || '加载失败'
    } finally {
      loading.value = false
    }
  }

  async function loadGroups() {
    try { groups.value = await groupsApi.listAvailable() } catch { groups.value = [] }
  }

  function setPage(n: number) { page.value = n; load() }
  async function create(p: CreateApiKeyRequest) { const k = await keysApi.createKey(p); await load(); return k }
  async function update(id: number, patch: UpdateApiKeyRequest) { await keysApi.updateKey(id, patch); await load() }
  async function toggle(id: number, status: 'active' | 'inactive') { await keysApi.toggleKeyStatus(id, status); await load() }
  async function remove(id: number) { await keysApi.deleteKey(id); await load() }

  return { rows, total, page, pageSize, filters, groups, usage, loading, error, loaded, load, loadGroups, setPage, create, update, toggle, remove }
}
```

- [ ] **Step 2: `KeyTable.vue`**

把 `Mint API Keys.dc.html` 表格区（含表头、行、禁用行 `opacity`）按映射表译为 Tailwind。要点：
- 容器 `rounded-xl3 bg-card shadow-card overflow-hidden`。
- 表头/行栅格 `grid grid-cols-[1.4fr_1.5fr_1fr_1.3fr_0.9fr_1.7fr] gap-4 px-[26px]`。
- 名称列：名称 `font-semibold text-text` + 掩码 key（`maskApiKey(row.key)`）小药丸 `bg-muted` + 复制图标，点复制 `emit('copy', row.key)`。
- 分组列：平台色点（claude `bg-[#D8362C]`/gpt `bg-[#14C28A]`/其他 `bg-ink`）+ 名称 + 倍率徽章。平台取 `row.group?.platform`。
- 状态列：`<StatusBadge :variant="row.status==='active'?'active':'inactive'" :label="row.status==='active'?'活跃':'已禁用'" />`。
- 用量列：`今日 ${usage[row.id]?.today_actual_cost ?? 0}`、`30天 ${...total_actual_cost}`，金额用 `formatCost`。
- 速率列：`row.rate_limit_1d`（无则 `—`）。
- 操作列：`.rowact` 风格按钮——使用 / 编辑(emit edit) / 禁用·启用(emit toggle) / 删除(emit remove，`text-neg`)。
- 行 hover：`hover:bg-hover`；禁用行 `opacity-[0.72]`。
- script：`defineProps<{ rows: ApiKey[]; usage: Record<string, ApiKeyUsageStat> }>()`，`defineEmits` edit/toggle/remove/copy；import `maskApiKey, formatCost`、`StatusBadge`。

- [ ] **Step 3: `CreateKeyModal.vue`（两步：表单 → 明文展示）**

```vue
<script setup lang="ts">
import { ref, watch } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import type { Group, CreateApiKeyRequest, ApiKey } from '@/api/types'
import { maskApiKey } from '@/utils/format'

const props = defineProps<{ open: boolean; groups: Group[] }>()
const emit = defineEmits<{ close: []; submit: [payload: CreateApiKeyRequest, done: (k: ApiKey) => void] }>()

const name = ref('')
const groupId = ref<number | null>(null)
const expiresInDays = ref<number | null>(null)
const quota = ref<number | null>(null)
const submitting = ref(false)
const createdKey = ref<ApiKey | null>(null)
const copied = ref(false)

watch(() => props.open, (v) => { if (v) { name.value=''; groupId.value=null; expiresInDays.value=null; quota.value=null; createdKey.value=null; copied.value=false } })

function submit() {
  if (!name.value.trim() || submitting.value) return
  submitting.value = true
  emit('submit', {
    name: name.value.trim(),
    group_id: groupId.value ?? undefined,
    expires_in_days: expiresInDays.value ?? undefined,
    quota: quota.value ?? undefined
  }, (k) => { createdKey.value = k; submitting.value = false })
}
async function copyKey() {
  if (!createdKey.value) return
  try { await navigator.clipboard.writeText(createdKey.value.key); copied.value = true } catch { /* 忽略 */ }
}
</script>
```

模板：`<Modal :open="open" title="创建密钥" @close="emit('close')">`，未创建时显示表单（名称必填输入、分组下拉 `groups`、有效期天数、配额 USD），footer 取消/创建；`createdKey` 后显示明文 + 复制按钮 + 「请立即保存，关闭后不可再查看」提示，footer 完成（→ close）。输入框样式参照 `Mint Profile.dc.html` 的 `.ti`（`rounded-xl2 border-[1.5px] border-border2 px-4 py-3 focus:border-accent`）。

- [ ] **Step 4: `EditKeyModal.vue`**

`Modal` 标题「编辑密钥」。字段：名称（预填 `target.name`）、分组、启用开关（`status active/inactive`）。提交 `emit('submit', target.id, { name, group_id, status })`。`watch(target)` 回填。

- [ ] **Step 5: `KeysView.vue`（组装）**

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import PortalLayout from '@/layouts/PortalLayout.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatCard from '@/components/ui/StatCard.vue'
import FilterBar from '@/components/ui/FilterBar.vue'
import Pagination from '@/components/ui/Pagination.vue'
import Modal from '@/components/ui/Modal.vue'
import KeyTable from '@/components/keys/KeyTable.vue'
import CreateKeyModal from '@/components/keys/CreateKeyModal.vue'
import EditKeyModal from '@/components/keys/EditKeyModal.vue'
import { useKeys } from '@/composables/useKeys'
import { formatCost } from '@/utils/format'
import type { ApiKey } from '@/api/types'

const k = useKeys()
const showCreate = ref(false)
const editTarget = ref<ApiKey | null>(null)
const removeTarget = ref<ApiKey | null>(null)

onMounted(() => { k.load(); k.loadGroups() })

function onCopy(key: string) { navigator.clipboard?.writeText(key).catch(() => {}) }
async function doCreate(payload, done) { const nk = await k.create(payload); done(nk) }
async function doEdit(id, patch) { await k.update(id, patch); editTarget.value = null }
async function confirmRemove() { if (removeTarget.value) { await k.remove(removeTarget.value.id); removeTarget.value = null } }
</script>
```

模板：PageHeader（标题「API 密钥」副标题「管理您的 API 密钥与访问令牌。」，actions：刷新 `k.load` + 创建按钮 `bg-accent`）→ 两张 StatCard（密钥总数=`k.total`，hint 启用/禁用计数；近30天消费=`formatCost(usage 合计)`）→ FilterBar（搜索 `v-model=k.filters.search` @change=`k.load`、分组下拉、状态下拉）→ 三态 → `KeyTable` + `Pagination`（`:page` 等，`@update:page=k.setPage`）→ 三个弹窗 + 删除确认 `Modal`。

- [ ] **Step 6: typecheck + lint + build**

Run: `cd user-portal && pnpm run typecheck && pnpm run lint:check && pnpm run build`
Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add user-portal/src/composables/useKeys.ts user-portal/src/components/keys user-portal/src/views/KeysView.vue
git commit -m "feat(user-portal): API 密钥页（列表/筛选/创建/编辑/删除/复制）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: 使用记录页（useUsage + UsageLogTable + CSV + UsageView）

设计稿：`~/Desktop/user-portal/Mint Usage.dc.html`。

**Files:**
- Create: `user-portal/src/composables/useUsage.ts`
- Create: `user-portal/src/components/usage/UsageLogTable.vue`
- Create: `user-portal/src/utils/csv.ts`
- Rewrite: `user-portal/src/views/UsageView.vue`

**Interfaces:**
- `useUsage()` → `{ rows, total, page, pageSize, stats, keys(下拉用), filters(api_key_id/start_date/end_date), loading, error, loaded, load(), setPage(n), exportCsv() }`。
- `UsageLogTable` props `{ rows: UsageLog[] }`。
- `csv.ts`：`downloadCsv(filename: string, headers: string[], rows: (string|number)[][])`（UTF-8 BOM）。

- [ ] **Step 1: `utils/csv.ts`**

```ts
/** 生成带 UTF-8 BOM 的 CSV 并触发下载（中文不乱码） */
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const esc = (v: string | number) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const body = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\n')
  const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 2: `useUsage.ts`**

```ts
import { ref, reactive } from 'vue'
import { queryUsage, getDashboardStats, type UsageQueryParams } from '@/api/usage'
import { listKeys } from '@/api/keys'
import type { UsageLog, UserDashboardStats, ApiKey } from '@/api/types'
import { toLocalDate } from '@/utils/format'

export function useUsage() {
  const rows = ref<UsageLog[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(20)
  const stats = ref<UserDashboardStats | null>(null)
  const keys = ref<ApiKey[]>([])
  const filters = reactive({
    api_key_id: '' as number | '' ,
    start_date: toLocalDate(new Date(Date.now() - 6 * 86_400_000)),
    end_date: toLocalDate(new Date())
  })
  const loading = ref(false)
  const error = ref<string | null>(null)
  const loaded = ref(false)

  function params(pageSizeOverride?: number): UsageQueryParams {
    return {
      page: page.value, page_size: pageSizeOverride ?? pageSize.value,
      api_key_id: filters.api_key_id === '' ? undefined : Number(filters.api_key_id),
      start_date: filters.start_date, end_date: filters.end_date,
      sort_by: 'created_at', sort_order: 'desc'
    }
  }

  async function load() {
    loading.value = true; error.value = null
    try {
      const [res, s] = await Promise.all([queryUsage(params()), getDashboardStats()])
      rows.value = res.data; total.value = res.total; stats.value = s; loaded.value = true
    } catch (e) { error.value = (e as { message?: string }).message || '加载失败' }
    finally { loading.value = false }
  }
  async function loadKeys() { try { keys.value = (await listKeys(1, 100)).data } catch { keys.value = [] } }
  function setPage(n: number) { page.value = n; load() }
  async function fetchForExport(): Promise<UsageLog[]> { return (await queryUsage(params(1000))).data }

  return { rows, total, page, pageSize, stats, keys, filters, loading, error, loaded, load, loadKeys, setPage, fetchForExport }
}
```

- [ ] **Step 3: `UsageLogTable.vue`**

把 `Mint Usage.dc.html` 的 11 列表（横向滚动 `overflow-x-auto` + 内层 `min-w-[1180px]`）译为 Tailwind。列与字段：密钥(`row.api_key?.name`)、模型、强度(`formatReasoningEffort` + 紫徽章 `text-[#9B7BE0] bg-[#9B7BE0]/[0.12]`)、端点(`row.inbound_endpoint`)、类型(`row.stream?'流式':'同步'` 蓝徽章)、计费(`billing_type` 灰徽章)、Token(入↓蓝 `formatTokens(input_tokens)` / 出↑绿 / 缓存⊕黄 `cache_read_tokens`)、费用(`formatCost(actual_cost)` `text-pos font-serif`)、首Token(`formatDuration(first_token_ms)`)、耗时(`formatDuration(duration_ms)`)、时间·UA(`formatDateTime(created_at)` + `row.user_agent`)。

- [ ] **Step 4: `UsageView.vue`**

PageHeader（「使用记录」/「查看和分析您的 API 使用历史。」，actions：刷新、重置、导出 CSV）。KPI 用 4 张 StatCard：总请求(`stats.total_requests`)、总Token(`formatTokens(stats.total_tokens)`，hint 入/出/缓存/命中率 `cacheHitRate`)、总消费(`formatCost(stats.total_actual_cost)`，accent，hint 标准 `total_cost`)、平均耗时(`formatDuration(stats.average_duration_ms)`)。FilterBar：密钥下拉(`keys`)、时间范围（两个 date input 绑 `filters.start_date/end_date`，change → load）。三态 → UsageLogTable + Pagination。导出：`const data = await fetchForExport(); downloadCsv('usage.csv', [表头...], data.map(行→数组))`，列对齐 `frontend/`（密钥/模型/强度/端点/流式/计费/input/output/cache/created_at/actual_cost）。

- [ ] **Step 5: typecheck + lint + build + 提交**

```bash
cd user-portal && pnpm run typecheck && pnpm run lint:check && pnpm run build
git add user-portal/src/composables/useUsage.ts user-portal/src/components/usage user-portal/src/utils/csv.ts user-portal/src/views/UsageView.vue
git commit -m "feat(user-portal): 使用记录页（KPI/筛选/分页/CSV 导出）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: 我的订单页（useOrders + OrderTable + 详情 + OrdersView）

设计稿：`~/Desktop/user-portal/Mint Orders.dc.html`。

**Files:**
- Create: `user-portal/src/composables/useOrders.ts`
- Create: `user-portal/src/components/orders/OrderTable.vue`
- Create: `user-portal/src/components/orders/OrderDetailModal.vue`
- Create: `user-portal/src/views/OrdersView.vue`

**Interfaces:**
- `useOrders()` → `{ rows, total, page, pageSize, statusFilter, search, loading, error, loaded, load(), setPage(n), cancel(id) }`。
- `OrderTable` props `{ rows: PaymentOrder[] }`，emit `view(order)`/`pay(order)`/`cancel(order)`/`reorder(order)`。
- `OrderDetailModal` props `{ open; order: PaymentOrder|null }`，emit `close`。

- [ ] **Step 1: `useOrders.ts`**

```ts
import { ref } from 'vue'
import { getMyOrders, cancelOrder } from '@/api/payment'
import type { PaymentOrder } from '@/api/types'

export function useOrders() {
  const rows = ref<PaymentOrder[]>([])
  const total = ref(0); const page = ref(1); const pageSize = ref(20)
  const statusFilter = ref(''); const search = ref('')
  const loading = ref(false); const error = ref<string | null>(null); const loaded = ref(false)

  async function load() {
    loading.value = true; error.value = null
    try {
      const res = await getMyOrders({ page: page.value, page_size: pageSize.value, status: statusFilter.value || undefined })
      rows.value = res.data; total.value = res.total; loaded.value = true
    } catch (e) { error.value = (e as { message?: string }).message || '加载失败' }
    finally { loading.value = false }
  }
  function setPage(n: number) { page.value = n; load() }
  async function cancel(id: number) { await cancelOrder(id); await load() }
  return { rows, total, page, pageSize, statusFilter, search, loading, error, loaded, load, setPage, cancel }
}
```

- [ ] **Step 2: `OrderTable.vue`**

译 `Mint Orders.dc.html` 表格。列：订单编号(`out_trade_no` + 类型`order_type==='balance'?'账户充值':'订阅'`·ID)、实付(`¥formatCNY(pay_amount)` + `$formatBalance(amount)`)、支付方式(色点 + `payment_type`)、状态(`<StatusBadge v-bind="orderStatusMeta(row.status)" />`)、创建时间(`formatDateMinute(created_at)`)、操作（查看 emit view；按状态：`pending`→立即支付 emit pay（`text-accent`）+ 取消 emit cancel；`failed`/`refunded`→重新下单 emit reorder）。搜索过滤在父层对 `out_trade_no` 做。

- [ ] **Step 3: `OrderDetailModal.vue`**

`Modal` 标题「订单详情」，键值展示 `order` 各字段（编号、金额、应付、状态、类型、创建/到期时间）。

- [ ] **Step 4: `OrdersView.vue`**

PageHeader（「我的订单」/「查看所有充值与订阅订单记录。」，actions：刷新、返回充值 `router.push('/recharge')`）。三张 StatCard（订单总数、累计充值=已完成订单 `amount` 合计、最近订单）。状态 chip tab（全部/待支付/已支付/已完成/已退款，值映射到后端 status）+ 搜索框（绑 `search`，前端过滤 `out_trade_no`）。三态 → OrderTable（传过滤后 rows）+ Pagination。`pay` 行为：`router.push('/recharge')` 并带 `order_id`（或打开 PaymentResultModal——Task 11 完成后回填；本任务先 `router.push` 占位到充值页）。

- [ ] **Step 5: typecheck + lint + build + 提交**

```bash
cd user-portal && pnpm run typecheck && pnpm run lint:check && pnpm run build
git add user-portal/src/composables/useOrders.ts user-portal/src/components/orders user-portal/src/views/OrdersView.vue
git commit -m "feat(user-portal): 我的订单页（统计/状态筛选/搜索/取消/详情）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: 个人资料页（useProfile + 头像压缩 + 三块组件 + ProfileView）

设计稿：`~/Desktop/user-portal/Mint Profile.dc.html`。

**Files:**
- Create: `user-portal/src/composables/useProfile.ts`
- Create: `user-portal/src/utils/avatar.ts`（压缩至 ≤20KB → data URL）
- Create: `user-portal/src/components/profile/AccountHero.vue`
- Create: `user-portal/src/components/profile/ProfileForm.vue`
- Create: `user-portal/src/components/profile/BindingList.vue`
- Create: `user-portal/src/views/ProfileView.vue`

**Interfaces:**
- `useProfile()` → `{ user, loading, error, load(), saveUsername(name), saveAvatar(dataUrl), removeAvatar(), bind(provider), unbind(provider) }`（user 来自 authStore）。
- `avatar.ts`：`compressToDataUrl(file: File, maxBytes=20480): Promise<string>`。
- `AccountHero` props `{ user: User }`；`ProfileForm` props `{ user: User }` emit `save-username`/`upload`/`remove-avatar`；`BindingList` props `{ user: User; settings: PublicSettings|null }` emit `bind(provider)`/`unbind(provider)`。

- [ ] **Step 1: `utils/avatar.ts`**

```ts
/** 把图片文件压缩到 ≤maxBytes（缩放×质量双重降档），返回 WebP data URL */
export async function compressToDataUrl(file: File, maxBytes = 20480): Promise<string> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file)
  })
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl
  })
  const scales = [1, 0.92, 0.84, 0.72, 0.6, 0.5, 0.4]
  const qualities = [0.92, 0.84, 0.72, 0.6, 0.5, 0.4]
  for (const sc of scales) {
    const cv = document.createElement('canvas')
    cv.width = Math.max(1, Math.round(img.width * sc)); cv.height = Math.max(1, Math.round(img.height * sc))
    cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height)
    for (const q of qualities) {
      const out = cv.toDataURL('image/webp', q)
      if (out.length * 0.75 <= maxBytes) return out  // base64 长度 ≈ 字节×4/3
    }
  }
  throw new Error('图片过大，请换一张更小的图片')
}
```

- [ ] **Step 2: `useProfile.ts`**

```ts
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { updateProfile } from '@/api/user'
import { startBind, unbind as unbindApi } from '@/api/binding'

export function useProfile() {
  const authStore = useAuthStore()
  const { user } = storeToRefs(authStore)
  const loading = ref(false); const error = ref<string | null>(null)

  async function load() { loading.value = true; try { await authStore.fetchUser() } finally { loading.value = false } }
  async function saveUsername(username: string) { await updateProfile({ username }); await authStore.fetchUser() }
  async function saveAvatar(dataUrl: string) { await updateProfile({ avatar_url: dataUrl }); await authStore.fetchUser() }
  async function removeAvatar() { await updateProfile({ avatar_url: null }); await authStore.fetchUser() }
  async function bind(provider: string) {
    const { authorize_url } = await startBind({ provider, redirect_to: '/profile' })
    window.location.href = authorize_url
  }
  async function unbind(provider: string) { await unbindApi(provider); await authStore.fetchUser() }

  return { user, loading, error, load, saveUsername, saveAvatar, removeAvatar, bind, unbind }
}
```

- [ ] **Step 3: 三块组件**

- `AccountHero.vue`：译设计稿 hero（头像方块/用户名/角色·状态徽章/邮箱 + 三格 余额`formatBalance(user.balance)`/并发`user.concurrency`/注册`formatRegMonth(user.created_at)`）。
- `ProfileForm.vue`：头像（点「上传图片」→ `<input type=file>` → `compressToDataUrl` → emit `upload(dataUrl)`；「删除」→ emit `remove-avatar`）+ 用户名输入 + 「更新资料」按钮 emit `save-username(name)`。校验 1–50 字符。
- `BindingList.vue`：邮箱行（始终显示，「管理邮箱」轻量占位按钮，不接流程）；LinuxDo/钉钉/OIDC（名 `settings.oidc_oauth_provider_name`）/微信——`v-if` 各 `settings?.*_oauth_enabled`；已绑(`user.*_bound`)显示「已绑定」徽章+解绑，未绑显示「绑定」按钮 emit `bind(provider)`。

- [ ] **Step 4: `ProfileView.vue`**

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import PortalLayout from '@/layouts/PortalLayout.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import AccountHero from '@/components/profile/AccountHero.vue'
import ProfileForm from '@/components/profile/ProfileForm.vue'
import BindingList from '@/components/profile/BindingList.vue'
import { useProfile } from '@/composables/useProfile'
import { useSettingsStore } from '@/stores/settings'
import { storeToRefs } from 'pinia'

const p = useProfile()
const settingsStore = useSettingsStore()
const { settings } = storeToRefs(settingsStore)
onMounted(() => { p.load(); settingsStore.ensureLoaded() })
</script>
```

模板：PageHeader（「个人资料」/「管理您的账户信息与登录方式。」无 actions）→ `v-if p.user`：AccountHero + ProfileForm（@save-username=`p.saveUsername` @upload=`p.saveAvatar` @remove-avatar=`p.removeAvatar`）+ BindingList（@bind=`p.bind` @unbind=`p.unbind`）。

- [ ] **Step 5: typecheck + lint + build + 提交**

```bash
cd user-portal && pnpm run typecheck && pnpm run lint:check && pnpm run build
git add user-portal/src/composables/useProfile.ts user-portal/src/utils/avatar.ts user-portal/src/components/profile user-portal/src/views/ProfileView.vue
git commit -m "feat(user-portal): 个人资料页（概览/改名/头像压缩/登录绑定）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 11: 充值页 —— 充值 tab + 兑换 + 支付结果（useRecharge + 子组件 + RechargeView）

设计稿：`~/Desktop/user-portal/Mint Recharge.dc.html`。**实现前先读后端 create-order handler 的响应 DTO**，把 `CreateOrderResult` 的 `pay_url/qr_code/result_type` 等对齐真实字段（见 Task 1 Step 4 注释）。

**Files:**
- Create: `user-portal/src/composables/useRecharge.ts`
- Create: `user-portal/src/components/recharge/AmountPicker.vue`
- Create: `user-portal/src/components/recharge/PayMethodPicker.vue`
- Create: `user-portal/src/components/recharge/OrderSummary.vue`
- Create: `user-portal/src/components/recharge/RedeemCard.vue`
- Create: `user-portal/src/components/payment/PaymentResultModal.vue`
- Create: `user-portal/src/views/RechargeView.vue`

**Interfaces:**
- `useRecharge()` → `{ checkout, loading, error, load(), selected(amount/custom/method state), submitRecharge(): Promise<CreateOrderResult>, poll(outTradeNo): start/stop, redeem(code) }`。
- `AmountPicker` props `{ presets: number[]; multiplier: number; min: number; modelValue: number|null }` emit `update:modelValue`（自定义与预设合一，返回最终金额）。
- `PayMethodPicker` props `{ methods: Record<string,MethodLimit>; modelValue: string }` emit `update:modelValue`。
- `OrderSummary` props `{ amount: number; multiplier: number; balance: number; feeRate: number }`。
- `RedeemCard` emit `redeemed`（成功后父刷新余额）。
- `PaymentResultModal` props `{ open: boolean; order: CreateOrderResult|null }` emit `close`/`paid`；内部轮询 `verifyOrder`。

- [ ] **Step 1: `useRecharge.ts`**

```ts
import { ref } from 'vue'
import { getCheckoutInfo, createOrder, verifyOrder } from '@/api/payment'
import { redeem as redeemApi } from '@/api/redeem'
import type { CheckoutInfoResponse, CreateOrderResult, RedeemResult } from '@/api/types'

const PRESETS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000]

export function useRecharge() {
  const checkout = ref<CheckoutInfoResponse | null>(null)
  const loading = ref(false); const error = ref<string | null>(null); const loaded = ref(false)
  const amount = ref<number | null>(100)
  const method = ref('')

  async function load() {
    loading.value = true; error.value = null
    try {
      checkout.value = await getCheckoutInfo()
      const keys = Object.keys(checkout.value.methods)
      if (keys.length && !method.value) method.value = keys[0]
      loaded.value = true
    } catch (e) { error.value = (e as { message?: string }).message || '加载失败' }
    finally { loading.value = false }
  }

  async function submitRecharge(): Promise<CreateOrderResult> {
    return createOrder({ amount: amount.value!, payment_type: method.value, order_type: 'balance' })
  }
  async function redeem(code: string): Promise<RedeemResult> { return redeemApi(code) }

  return { checkout, loading, error, loaded, amount, method, presets: PRESETS, load, submitRecharge, verifyOrder, redeem }
}
```

- [ ] **Step 2: 子组件 AmountPicker / PayMethodPicker / OrderSummary**

- `AmountPicker`：3 列预设卡（选中 `border-accent bg-accent/[0.07] shadow`，未选 `border-border2`，hover `border-[#9FE6CD]`）+ 自定义金额输入（`min` 校验）。bonus = `Math.round(value * (multiplier - 1) * 100)/100`，>0 时注脚显示「赠 $x」绿色。`v-model` 反映最终选定金额。
- `PayMethodPicker`：按 `methods` 渲染微信/支付宝/Stripe（图标用品牌色块如映射表所列），选中描点。仅渲染 `methods` 中存在的方式。
- `OrderSummary`：充值金额、赠送(`amount*(multiplier-1)`)、到账后余额(`balance+amount+bonus`)、应付（USD 预览 = `amount*(1+feeRate)`，`formatBalance`）。CNY 文案标注「实际应付以下单结果为准」，下单前不写死汇率。

- [ ] **Step 3: `PaymentResultModal.vue`（扫码/跳转/轮询）**

```vue
<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import { verifyOrder } from '@/api/payment'
import type { CreateOrderResult } from '@/api/types'

const props = defineProps<{ open: boolean; order: CreateOrderResult | null }>()
const emit = defineEmits<{ close: []; paid: [] }>()
const status = ref('')
let timer: number | null = null

function stop() { if (timer) { clearInterval(timer); timer = null } }
function start(outTradeNo: string) {
  stop()
  timer = window.setInterval(async () => {
    try {
      const o = await verifyOrder(outTradeNo)
      status.value = o.status
      if (o.status === 'paid' || o.status === 'completed') { stop(); emit('paid') }
      if (o.status === 'failed') stop()
    } catch { /* 轮询失败下次再试 */ }
  }, 2000)
}
watch(() => props.open, (v) => {
  if (v && props.order) {
    if (props.order.pay_url) { window.location.href = props.order.pay_url; return }
    start(props.order.out_trade_no)
  } else stop()
})
onBeforeUnmount(stop)
</script>
```

模板：`Modal`，若 `order.qr_code` 显示二维码图 + 倒计时（`expires_at`）+ 当前 `status` 文案 + 「我已支付/刷新」手动 `verifyOrder`。

- [ ] **Step 4: `RedeemCard.vue`**

输入框 + 「兑换」按钮 → `useRecharge().redeem(code)`；成功显示新余额/并发（绿框）并 `emit('redeemed')`（父 `authStore.fetchUser()`），失败红框提示。

- [ ] **Step 5: `RechargeView.vue`（充值 tab + 兑换；订阅 tab 占位见 Task 12）**

PageHeader（「充值 / 订阅」/「为账户余额充值，按量计费即充即用。」，actions：我的订单 → `/orders`）。充值/订阅分段（订阅段 `v-if settings?.purchase_subscription_enabled`，内容 Task 12 填）。充值段两栏：左 AmountPicker + PayMethodPicker + RedeemCard；右 sticky 账户卡 + OrderSummary + 「确认支付」按钮（金额≥min 才可点）→ `submitRecharge()` → 打开 PaymentResultModal；`@paid` → `authStore.fetchUser()` + 关闭 + 提示。

- [ ] **Step 6: typecheck + lint + build + 提交**

```bash
cd user-portal && pnpm run typecheck && pnpm run lint:check && pnpm run build
git add user-portal/src/composables/useRecharge.ts user-portal/src/components/recharge user-portal/src/components/payment user-portal/src/views/RechargeView.vue
git commit -m "feat(user-portal): 充值页（金额/支付方式/订单摘要/兑换码/支付轮询）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 12: 订阅 tab（SubscriptionPlans）

按 `frontend/` 补齐：计划卡片 + 确认下单，复用 `PaymentResultModal`。

**Files:**
- Create: `user-portal/src/components/recharge/SubscriptionPlans.vue`
- Modify: `user-portal/src/views/RechargeView.vue`（接入订阅段）

**Interfaces:**
- `SubscriptionPlans` props `{ plans: SubscriptionPlan[] }` emit `subscribe(plan)`。父收到后弹确认 → `createOrder({ amount: plan.price, payment_type: method, order_type: 'subscription', plan_id: plan.id })` → PaymentResultModal。

- [ ] **Step 1: `SubscriptionPlans.vue`**

卡片网格渲染 `plans`：名称、价格(`formatBalance(plan.price)`)/原价删除线、有效期(`plan.validity_days` 天)、分组(`plan.group_name`)、额度限制(日/周/月 `*_limit_usd`)、特性列表(`plan.features`)。每卡「选择」按钮 emit `subscribe(plan)`。空集显示 empty 态。

- [ ] **Step 2: 接入 `RechargeView.vue`**

订阅段渲染 `<SubscriptionPlans :plans="checkout?.plans ?? []" @subscribe="onSubscribe" />`。`onSubscribe(plan)`：用同一支付方式（或默认 method）`createOrder(order_type:'subscription', plan_id)` → 打开 PaymentResultModal → `@paid` 刷新用户 + 提示。计划数据优先取 `checkout.plans`，为空再 `getPlans()`。

- [ ] **Step 3: typecheck + lint + build + 提交**

```bash
cd user-portal && pnpm run typecheck && pnpm run lint:check && pnpm run build
git add user-portal/src/components/recharge/SubscriptionPlans.vue user-portal/src/views/RechargeView.vue
git commit -m "feat(user-portal): 充值页订阅 tab（计划卡片 + 下单）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 13: 收尾（订单「立即支付」回填 + 路由/菜单核对 + 全量校验）

**Files:**
- Modify: `user-portal/src/views/OrdersView.vue`（`pay` 行为接入 PaymentResultModal，复用 Task 11 组件）
- Modify（按需）: `user-portal/src/router/index.ts`、`user-portal/src/layouts/PortalLayout.vue`

**Interfaces:** 无新增。

- [ ] **Step 1: 订单「立即支付」接入支付弹窗**

`OrdersView` 引入 `PaymentResultModal`；`pay(order)` 时以该订单（含 `out_trade_no`）打开弹窗启动轮询；`@paid` → `useOrders().load()` + `authStore.fetchUser()`。

- [ ] **Step 2: 核对路由与菜单**

确认 `router/index.ts` 七条用户路由齐全（dashboard/usage/keys/recharge/orders/profile + login/register），`PortalLayout` 顶栏 tabs（仪表盘/使用记录/API 密钥）与用户菜单（充值/我的订单/个人资料）跳转正确。`payment_enabled=false` 时充值/订单入口的隐藏按需在菜单/路由守卫处理（读 settings store）。

- [ ] **Step 3: 全量校验**

Run: `cd user-portal && pnpm run typecheck && pnpm run lint:check && pnpm run build`
Expected: 全 PASS

或仓库根：`mise run lint-user-portal && mise run test-user-portal`。

- [ ] **Step 4: 提交**

```bash
git add user-portal/src
git commit -m "feat(user-portal): 订单立即支付接入支付弹窗，路由/菜单收尾

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## 自查映射（spec → task）

| spec 要求 | 对应 task |
| --- | --- |
| 数据层与后端 DTO 对齐（5 处偏差） | Task 1、3 |
| 工具扩展（maskApiKey/强度/状态/CNY/注册月） | Task 2 |
| 新增 groups/settings/binding api、扩展 payment/redeem | Task 3 |
| 共享 UI 原语 6 个 | Task 4、5 |
| public settings 消费 | Task 6（store）；Task 10/11/12 使用 |
| API 密钥页（精简创建/编辑） | Task 7 |
| 使用记录页 + CSV | Task 8 |
| 我的订单页 | Task 9、13 |
| 个人资料页（头像 20KB 压缩 + 绑定） | Task 10 |
| 充值页 + 兑换码 + 支付轮询 | Task 11 |
| 订阅 tab 补齐 | Task 12 |
| 三态/错误处理/仅改 user-portal | 各 task 骨架 + Global Constraints |

## YAGNI（不做）

密钥高级项（自定义 key/IP/多档限流/重置）、退款全流程、使用记录 errors tab 与每日图、邮箱换绑完整流程——均不在本计划内。
