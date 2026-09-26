# user-portal 套餐功能设计

日期：2026-08-13
范围：`user-portal/`（前端单组件，不改后端）

## 背景与现状

`user-portal` 已有**套餐购买**：`RechargeView` 的订阅 tab 渲染 `components/recharge/SubscriptionPlans.vue`，
经 `getPlans()`（`GET /payment/plans`）拉套餐、`submitSubscription()` 以 `order_type='subscription'` 下单。

缺失的是**「我的套餐」一侧**：没有订阅查询 API 封装、没有订阅 store、没有对标
`frontend/src/views/user/SubscriptionsView.vue` 的页面，仪表盘也没有订阅额度概览与到期提醒。

后端接口均已就绪（`backend/internal/server/routes/user.go:130`）：

| 接口 | 说明 |
| --- | --- |
| `GET /subscriptions` | 当前用户全部订阅，内嵌 `group`（含额度上限） |
| `GET /subscriptions/active` | 仅生效中 |
| `GET /subscriptions/progress` | 各订阅进度 |
| `GET /subscriptions/summary` | 仪表盘摘要 |

本次只用 `GET /subscriptions`：其返回已包含 `group` 的日/周/月上限、订阅的已用量与窗口起点，
其余三个接口的信息量是它的子集，前端本地计算即可，不重复封装。

## 目标

1. 新增「我的套餐」页（`/subscriptions`），列出全部订阅、额度进度、到期时间、续费入口。
2. 仪表盘增加订阅额度概览与到期提醒横幅。
3. 购买侧套餐卡片补齐 frontend 已有的四项展示。
4. 到期提醒与一键续费打通到充值页订阅 tab。

## 非目标

- 不改后端任何代码与 DTO。
- 不引入高峰期倍率（`peak_rate_*`）、货币标签（`currency`）、模型范围（`supported_model_scopes`）
  的展示——这三项 user-portal 的 `SubscriptionPlan` 类型里没有，补齐需改后端 DTO，按 YAGNI 略过。
- 不做订阅退订/暂停等操作类功能（后端也只对管理员开放）。

## 已知规范冲突（明确记录，本次不处理）

订阅 `status` 的后端取值是小写 `active` / `expired` / `suspended` / `revoked`
（`backend/internal/domain/constants.go:67`），与全局「枚举成员名与对外字符串取值统一
SCREAMING_SNAKE_CASE」规范不符。该取值是 backend + frontend + 数据库已固化的契约，
改动波及三方，超出本次范围。

**本次处理方式**：`status` 按后端现状用小写字面量联合类型；本次前端**新定义**的枚举
（进度等级、到期等级）一律 SCREAMING_SNAKE_CASE。

## 架构

```
api/subscriptions.ts        →  stores/subscriptions.ts  →  SubscriptionsView / Dashboard 组件
                               (Pinia，60s 缓存 + 去重)      SubscriptionPlans（续费文案）
utils/subscription.ts       →  纯函数：进度/色阶/到期/排序/倒计时（可单测）
```

### 数据层

**`user-portal/src/api/subscriptions.ts`**

```ts
export async function getMySubscriptions(): Promise<UserSubscription[]>  // GET /subscriptions
```

**`user-portal/src/api/types.ts`** 新增（字段对齐 `backend/internal/handler/dto/types.go:632`）：

```ts
/** 订阅所属分组（额度上限来自分组配置） */
export interface SubscriptionGroup {
  id: number
  name: string
  description?: string
  platform?: string
  rate_multiplier?: number
  daily_limit_usd?: number | null
  weekly_limit_usd?: number | null
  monthly_limit_usd?: number | null
}

/** 订阅状态：取值沿用后端既有契约（小写），见上文「已知规范冲突」 */
export type SubscriptionStatus = 'active' | 'expired' | 'suspended' | 'revoked'

export interface UserSubscription {
  id: number
  user_id: number
  group_id: number
  starts_at: string
  expires_at: string
  status: SubscriptionStatus
  daily_window_start: string | null
  weekly_window_start: string | null
  monthly_window_start: string | null
  daily_usage_usd: number
  weekly_usage_usd: number
  monthly_usage_usd: number
  created_at: string
  updated_at: string
  revoked_at?: string | null
  group?: SubscriptionGroup
}
```

**`user-portal/src/stores/subscriptions.ts`**（Pinia setup store，写法对齐现有 `stores/announcements.ts`）

- state：`items` / `loading` / `loaded` / `lastFetchedAt`
- 缓存 TTL 60 秒；in-flight 去重（仪表盘与套餐页同时挂载只打一次接口）
- 请求失败回滚 `lastFetchedAt`，允许下次立即重试
- 动作：`ensureLoaded()`（走缓存）、`refresh()`（强制）
- getters：
  - `sorted`：`active` 在前按 `expires_at` 升序；`expired`/`revoked`/`suspended` 置底按 `expires_at` 降序
  - `activeItems`：`status === 'active'` 且未过期
  - `expiringSoon`：`activeItems` 中剩余 ≤ 7 天的，按剩余天数升序

**`user-portal/src/utils/subscription.ts`**（纯函数，业务逻辑全部落此以便单测）

| 函数 | 说明 |
| --- | --- |
| `progressPercent(used, limit)` | 百分比，封顶 100；`limit` 为空/0 返回 0 |
| `progressLevel(used, limit)` | `'NORMAL' \| 'WARNING' \| 'DANGER'`，≥70 → WARNING，≥90 → DANGER |
| `daysRemaining(expiresAt)` | 向上取整的剩余天数，已过期返回 ≤0 |
| `expiryLevel(expiresAt)` | `'NORMAL' \| 'SOON' \| 'URGENT' \| 'EXPIRED'`，≤7 → SOON，≤3 → URGENT |
| `windowResetsIn(windowStart, windowHours)` | 距窗口重置的剩余毫秒；`windowStart` 为 null 返回 null |
| `formatRemaining(ms)` | `Nd Nh` / `Nh Nm` / `Nm` |
| `sortSubscriptions(list)` | 上述 `sorted` 的排序实现 |
| `hasAnyLimit(sub)` | 三个上限是否至少有一个 |
| `tightestQuota(sub)` | 返回占用比最高的那条额度（供仪表盘概览用），无上限返回 null |

## 页面与组件

### 我的套餐页

- 路由 `/subscriptions`，name `Subscriptions`，`meta: { requiresAuth: true, title: 'nav.subscriptions' }`
- 顶部导航（`layouts/PortalLayout.vue`）插到第二位：**仪表盘 / 我的套餐 / 用量 / 密钥 / 定价**
- 入口无条件显示（管理员分配的订阅也需要查看入口）；空态时给引导文案，
  仅在 `settings.purchase_subscription_enabled` 为真时附「去订阅」按钮跳 `/recharge`

**`views/SubscriptionsView.vue`**：`PageHeader` + `LoadingSpinner` 加载态 + 空态 + `grid sm:grid-cols-2` 卡片网格。
挂载时 `store.ensureLoaded()`，页头提供刷新按钮走 `store.refresh()`。

**`components/subscriptions/SubscriptionCard.vue`**：

- 头部：平台圆点（`utils/platform.ts` 的 `platformMeta()` 取色）+ 分组名 + 平台标签 + 分组描述
  + 状态徽标（复用 `ui/StatusBadge.vue`，`active → 'active'`、`expired/revoked/suspended → 'muted'`）
  + 续费按钮（仅 `active` 显示，跳 `/recharge?tab=subscription&group=<group_id>`）
- 到期行：文案按 `expiryLevel` 变色（URGENT 红 / SOON 橙 / 其余常规），显示到分钟的日期 + 剩余天数
- 额度区：日/周/月各渲染一条 `QuotaBar`，仅在对应 `*_limit_usd` 有值时渲染
- `hasAnyLimit(sub)` 为假时改渲染「不限额度」块

**`components/subscriptions/QuotaBar.vue`**：单条进度条，含标题、`$已用 / $上限`、
进度条（色阶来自 `progressLevel`）、窗口重置倒计时副文案（`windowResetsIn` 为 null 时显示「窗口未启动」）。

样式使用 user-portal 现有设计 token（`bg-card` / `shadow-card` / `text-subtle` / `text-faint` / `accent`），
不照搬 frontend 管理端风格。

### 仪表盘

**`components/dashboard/ExpiryBanner.vue`**：位置在页头之下、`HeroBalance` 之上。
`store.expiringSoon` 非空时渲染：展示最紧急的一条「《分组名》N 天后到期」+「立即续费」按钮
（跳 `/recharge?tab=subscription&group=<id>`）；多条时补一行「另有 N 个即将到期」链接到 `/subscriptions`。
可关闭，关闭状态写 sessionStorage（键 `subscriptionExpiryBannerDismissed`），仅本次会话生效。

**`components/dashboard/SubscriptionOverview.vue`**：位置在 `KpiRow` 之后。
每条生效中订阅一行：分组名 + `tightestQuota()` 那条额度的进度条 + 剩余天数；
整块可点击跳 `/subscriptions`。`activeItems` 为空时整块不渲染（不占位、不显示空态）。

两者都从 store 取数，`DashboardView` 挂载时调一次 `store.ensureLoaded()`。

### 购买侧卡片（`components/recharge/SubscriptionPlans.vue`）

在现有卡片（套餐名/描述/价格划线/有效期/倍率/日周月额度/特性列表）基础上补四项：

1. **平台标识与配色**：`plan.group_platform` 经 `platformMeta()` 取标签与圆点色，加在套餐名之上。
   现有 `MAP` 只收录 anthropic/claude、openai/gpt、gemini/google，需补 `antigravity`（标签 `antigravity`，
   色值 `#7C4DFF`，与 frontend 的紫色系一致）；未收录的平台仍走现有回退（原样显示 + `#1A1A1A`）
2. **折扣徽章**：有 `original_price` 且大于 `price` 时算 `-X%`（四舍五入取整，>0 才显示）贴在划线价旁
3. **不限额度**：三个 `*_limit_usd` 皆无值时，额度区渲染「不限额度」行，而非整块消失
4. **续费文案**：从 subscriptions store 取 `activeItems`，`group_id` 命中则按钮文案由「立即订阅」变「立即续费」

**`views/RechargeView.vue`** 支持 `?tab=subscription&group=<id>`：挂载时若带该 query
则把 `activeTab` 切到订阅 tab，待套餐加载完成后滚动到该 group 的首张套餐卡并短暂高亮（约 2 秒）。
group 不存在于当前套餐列表时静默忽略（只切 tab）。

## i18n

- 新增 `i18n/locales/zh-CN/subscriptions.ts` 与 `i18n/locales/en-US/subscriptions.ts`，
  覆盖页面标题/副标题、空态、卡片字段、状态名、额度标签、到期文案、窗口倒计时
- `nav` 增加 `subscriptions` 键
- `recharge` 增补 `renewNow`、`discountOff`、`unlimitedQuota`
- 中英同步新增，模板内不留裸中文

## 测试

统一走 `mise run test-user-portal`（vue-tsc + vitest）。

- `utils/__tests__/subscription.test.ts`
  - `progressPercent`：正常值、超额封顶 100、`limit` 为 0/null 返回 0
  - `progressLevel`：69.9/70/89.9/90 四个边界
  - `expiryLevel`：8 天/7 天/4 天/3 天/已过期 五个边界
  - `sortSubscriptions`：active 在前按到期升序、非 active 置底按到期降序
  - `windowResetsIn` / `formatRemaining`：窗口未启动返回 null、跨天/跨时/分钟三档格式
  - `tightestQuota`：多额度取占用比最高、无上限返回 null
- `stores/__tests__/subscriptions.test.ts`
  - TTL 内命中缓存不重复请求；TTL 过期重新请求
  - 并发调用 `ensureLoaded` 只发一次请求
  - `refresh()` 忽略缓存
  - 请求失败回滚时间戳，下次立即重试
- `components/subscriptions/__tests__/SubscriptionCard.test.ts`
  - 仅日限额 / 日周月全有 / 三者皆无（不限额度块）三种渲染
  - 各 `status` 对应的徽标 variant
  - 续费按钮仅 `active` 时出现，点击带正确 group query

## 实施顺序

1. 类型 + `api/subscriptions.ts` + `utils/subscription.ts`（含单测）
2. `stores/subscriptions.ts`（含单测）
3. `views/SubscriptionsView.vue` + `SubscriptionCard` + `QuotaBar` + 路由 + 导航 + i18n（含组件测试）
4. 仪表盘 `ExpiryBanner` + `SubscriptionOverview`
5. `SubscriptionPlans.vue` 四项补齐 + `RechargeView` 的 `?tab&group` 处理
6. `mise run lint-user-portal` + `mise run test-user-portal` 全绿
