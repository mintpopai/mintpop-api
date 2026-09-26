# 用户门户（user-portal）页面落地设计

- 日期：2026-06-24
- 分支：`user-portal`
- 范围：仅改动 `user-portal/`。后端与主前端 `frontend/` 均不动。

## 背景与目标

把 `~/Desktop/user-portal/*.dc.html` 这批 **mint 风格设计稿**实现为独立用户门户的 Vue 页面。门户是单拎出来给最终用户的一版独立前端站点，功能在主前端 `frontend/` 中均已实现、接口由 `backend/` 提供。本次按设计稿把剩余页面做成**真正可用**的页面（全功能，对齐 `frontend/` 行为），只换 mint 外观。

已完成（参照范式，不在本次范围）：`DashboardView`、`LoginView`、`RegisterView`。

本次要做的页面（均有设计稿）：

| 页面 | 设计稿 | 路由 | 现状 |
| --- | --- | --- | --- |
| API 密钥 | Mint API Keys | `/keys` | 占位 stub，待实现 |
| 使用记录 | Mint Usage | `/usage` | 占位 stub，待实现 |
| 充值（含兑换码 + 订阅） | Mint Recharge | `/recharge` | 路由已挂，View 未建 |
| 我的订单 | Mint Orders | `/orders` | 路由已挂，View 未建 |
| 个人资料 | Mint Profile | `/profile` | 路由已挂，View 未建 |

## 范围决策（已与需求方确认）

1. **功能完整度**：全功能、对齐 `frontend/`。交互逻辑（弹窗、支付流程、绑定、CSV 导出等）从 `frontend/` 移植，仅外观换成 mint。
2. **功能深度**：**以设计稿为准、精简实现**。设计稿未画的交互（如创建密钥弹窗）只做核心字段，不照搬 `frontend/` 的全部高级字段。
   - 创建/编辑密钥：仅 **名称、分组、有效期、配额**。**不做**自定义 key、IP 白/黑名单、多档速率限制（5h/1d/7d）、配额重置等高级项。
   - 订单行操作精简：查看、立即支付（PENDING）、取消（PENDING）、重新下单（→ 充值）。退款申请/发票按设计稿文案做轻量占位，不接退款全流程。
3. **兑换码**：并入充值页，做成一个 mint 风格的 `RedeemCard` 区块（复用现有 `redeem` api）。
4. **订阅**：充值页的「订阅」tab 按 `frontend/` **补齐**（计划卡片 + 确认下单）——这是「以设计稿为准」之外明确放宽的一处。

## 既有范式（必须沿用）

- **样式系统**：`styles/theme.css` 定义 CSS 变量 + `tailwind.config.js` 语义 token；`.dark` 类切换深浅色。字体：`font-display`(Fredoka·logo)、`font-serif`(Newsreader·数字/标题，或 `.num` 工具类)、`font-sans`(Space Grotesk·正文)。圆角 `xl2/xl3/xl4`，阴影 `card/soft/pill/menu`。**设计稿用到的全部 token 已存在**，无需新增颜色。
- **壳**：`layouts/PortalLayout.vue` 已提供顶栏 + 用户菜单（含余额、充值/订单/资料入口、深浅色切换、退出）。每个页面只写 `<main>` 内容并用 `<PortalLayout>` 包裹。
- **数据加载范式**：仿 `composables/useDashboard.ts`——composable 暴露 `refs + loading/error + load/动作函数`，View 里 `onMounted(load)`。
- **三态**：loading（`LoadingSpinner`）/ error（虚线卡片 + 重试）/ empty，沿用 `DashboardView` 写法。
- **网络层**：`api/client.ts` baseURL `/api/v1`，自动带 Bearer、GET 注入 timezone、把 `{code,data}` 解包为 `data`、401 自动续期。**api 模块里的路径都相对 `/api/v1` 写**，拿到的已是解包后的内层数据。

## 架构（方案 C：混合粒度）

抽一组**共享 UI 原语**，页面 View 组合它们；仅大页面（Keys、Recharge）再下钻子组件。每页配一个 composable 管数据。

```
views/
  KeysView.vue  UsageView.vue  RechargeView.vue  OrdersView.vue  ProfileView.vue
composables/
  useKeys.ts  useUsage.ts  useRecharge.ts  useOrders.ts  useProfile.ts  usePublicSettings.ts
components/
  ui/        PageHeader  Pagination  Modal  StatCard  FilterBar  StatusBadge
  keys/      KeyTable  CreateKeyModal  EditKeyModal
  recharge/  AmountPicker  PayMethodPicker  OrderSummary  RedeemCard  SubscriptionPlans
  orders/    OrderTable  OrderDetailModal
  profile/   AccountHero  ProfileForm  BindingList
  payment/   PaymentResultModal      # 扫码/跳转/轮询；Recharge 与 Orders「立即支付」复用
api/  types/  utils/                  # 按需小幅扩展（见下）
```

**共享 UI 原语职责**（无业务、纯 props）：

- `PageHeader`：标题(`font-serif`) + 副标题 + 右侧操作插槽。所有页头一致。
- `StatCard`：mini 统计卡（大写小标签 + `.num` 大数字 + 注脚）。Keys/Orders/Usage 的统计条复用。
- `FilterBar`：搜索框 + 下拉/筛选插槽的容器。
- `Pagination`：`显示 a–b 共 n 条 · 每页 m` + 上一页/页码/下一页。三张表复用。
- `StatusBadge`：圆点 + 文案 + 前景/背景色，按 `variant`（active/inactive/paid/pending/...）取色。
- `Modal`：遮罩 + 居中卡片 + ESC/点遮罩关闭，承载各弹窗。

## 数据层对齐（关键：现有占位 api/types 与真实后端 DTO 存在偏差，需逐一校正）

本次落地前先把以下偏差按**后端实际 DTO**校正（后端为准）。后端路由前缀统一 `/api/v1`。

1. **分页包装键**：后端列表返回 `{ data: T[], total, page, page_size }`，而现有 `PaginatedResponse<T>` 用的是 `items`。统一改为 `data`（并修正 `useDashboard` 的 `getRecentUsage` 读取 `data`，当前读 `items` 实际拿不到数据，仅因非关键被吞掉）。
2. **`MethodLimit` 形态**：`checkout-info.methods[x]` 实际为 `{ min, max, fee_rate, ... }`，而非现有的 `single_min/single_max`。改字段名。
3. **`CheckoutInfoResponse` 补字段**：`plans[]`（订阅计划）、`alipay_force_qrcode`、`balance_disabled`、`balance_recharge_multiplier`、`recharge_fee_rate`、`stripe_publishable_key`。
4. **订单状态枚举**：后端 `PaymentOrderResult.status` 实际取值为小写 `pending/paid/completed/failed/refunded`，`order_type` 为 `balance/subscription`。现有 `OrderStatus` 为大写多值，需以后端实际序列化值为准重定义；状态→中文+色 映射据此对齐。`PaymentOrder` 字段补 `pay_amount/currency/paid_at/completed_at/refund_amount/refund_reason/plan_id/provider_instance_id`。
5. **头像机制**：后端**无 multipart 上传接口**，头像通过 `PUT /api/v1/user` 的 `avatar_url` 字段提交。故头像流程为：选图 → 前端压缩至 ≤20KB → 转 data URL → 作为 `avatar_url` PUT。（与 `frontend/` 的 multipart 写法不同，以后端为准。）

> 落地时每接一个接口，对照后端 DTO 核对字段名/类型，避免沿用占位假设。

### 接口清单（确切路径，已核对后端路由）

- 密钥：`GET /keys`（page/page_size/search/status/group_id/sort_by/sort_order）、`POST /keys`、`PUT /keys/:id`、`DELETE /keys/:id`、批量用量 `POST /usage/dashboard/api-keys-usage`（body `{ api_key_ids }`，返回 `{ stats }`）。
- 分组（新增 `api/groups.ts`）：`GET /groups/available`、`GET /groups/rates`。
- 使用记录：`GET /usage`（page/page_size/api_key_id/start_date/end_date/sort_*）、`GET /usage/dashboard/stats|trend|models`。**无后端 CSV 导出**，前端拼（UTF-8 BOM）。
- 支付/订单：`GET /payment/checkout-info`、`GET /payment/plans`、`POST /payment/orders`（body `{ amount, payment_type, order_type, plan_id?, return_url?, is_mobile? }`）、`GET /payment/orders/my`（status/order_type 过滤）、`GET /payment/orders/:id`、`POST /payment/orders/verify`（body `{ out_trade_no }`，用于轮询）、`POST /payment/orders/:id/cancel`。
- 资料：`GET /user/profile`、`PUT /user`（username / avatar_url）。
- 绑定（新增 `api/binding.ts`）：`POST /user/auth-identities/bind/start`（body `{ provider, redirect_to }` → `{ authorize_url }`）、`DELETE /user/account-bindings/:provider`。邮箱「管理」按设计稿走轻量占位。
- 兑换：`POST /redeem`（已具备）；可选 `GET /redeem/history`。
- 公开设置（新增 `api/settings.ts` + `usePublicSettings`）：`GET /settings/public`。用户侧消费：`registration_enabled`、各 `*_oauth_enabled`、`oidc_oauth_provider_name`、`payment_enabled`、`purchase_subscription_enabled`、`site_name` 等。

### 工具扩展（`utils/`）

在 `format.ts` 既有基础上补：`maskApiKey`（前缀+后6位）、`formatReasoningEffort`、订单状态→`{label,variant}` 映射、注册月份（如 `Jun 2026`）。CNY/汇率展示见下「充值」说明。

## 各页面设计

通用结构：`PortalLayout` → `PageHeader` → 三态 → 内容。下述只列各页特有部分。

### 1. API 密钥 `/keys` · `useKeys`

- 顶部两张 `StatCard`：密钥总数（X 启用 · Y 禁用）、近 30 天消费（批量用量合计）。
- `FilterBar`：搜索（名称/key）+ 分组下拉（`groups/available`）+ 状态下拉（active/inactive/quota_exhausted/expired）。改动触发重查（搜索去抖）。
- `KeyTable`：名称 + 掩码 key（复制按钮，复制成功反馈）、分组（平台色点 + 倍率徽章）、状态 `StatusBadge`、用量（今日/30天，来自 `api-keys-usage`）、速率、行操作（使用 / 编辑 / 启用·禁用 / 删除）。禁用行 `opacity` 降低。
- `Pagination`。
- `CreateKeyModal`：字段仅 名称、分组、有效期（→ `expires_in_days`）、配额（0=无限）。提交后**一次性明文展示新 key + 复制**，关闭即不可再得。
- `EditKeyModal`：改 名称 / 分组 / 启用状态。
- 删除：`Modal` 二次确认。
- 复制：`navigator.clipboard`，失败回退 + toast。

### 2. 使用记录 `/usage` · `useUsage`

- 4 张 `StatCard`：总请求、总 Token（细分 入/出/缓存命中/缓存创建 + 命中率）、总消费（实际 `actual_cost`，标准 `total_cost` 删除线）、平均耗时。来源 `dashboard/stats`（按当前时间范围）。
- `FilterBar`：API 密钥下拉（取自 `keys` 列表）+ 时间范围（预设近 7/30 天，沿用 `useDashboard` 的 `toLocalDate`）。刷新 / 重置。
- `UsageLogTable`（11 列，横向滚动，`min-width` 容器）：密钥、模型、强度（`formatReasoningEffort`）、端点、类型（流式/同步）、计费、Token（入↓/出↑/缓存⊕ 多色）、费用、首 Token、耗时、时间·UA。
- `Pagination`。
- **导出 CSV**：拉 `page_size` 较大的一页 → 前端拼 CSV（UTF-8 BOM），列对齐 `frontend/`。

### 3. 充值 `/recharge` · `useRecharge`

- 「充值 / 订阅」分段切换。
- **充值 tab**：
  - 左：`AmountPicker`（预设 `[10,20,50,100,200,500,1000,2000,5000]`，赠送额度按 `balance_recharge_multiplier` 计算并标注；自定义金额输入，校验 `global_min/global_max`）；`PayMethodPicker`（微信/支付宝/Stripe，可用项由 `checkout-info.methods` 决定，各自 `fee_rate`）。
  - 右（sticky）：账户卡（账号 + 当前余额）+ `OrderSummary`（充值金额 / 赠送 / 到账后余额 / 应付）。
  - **CNY/汇率**：输入按 USD；**应付 CNY 以下单返回的 `pay_amount`+`currency` 为准**展示，下单前预览用 `checkout-info` 的费率推算 USD 应付。设计稿里的 `¥`/`7.10` 为示意，不写死汇率。
  - 下单 → `PaymentResultModal`：按返回处理（`pay_url` 跳转 / `qr_code` 扫码 + 倒计时 / Stripe 跳转），并以 `POST /payment/orders/verify` **轮询**（约 2s/次）订单状态，成功后刷新余额并提示。
  - `RedeemCard`：兑换码输入 + 提交（`POST /redeem`），成功展示新余额/并发并刷新用户，失败提示。
- **订阅 tab**（按 `frontend/` 补齐）：`SubscriptionPlans` 计划卡片（取自 `checkout-info.plans` 或 `GET /payment/plans`：名称、价格/原价、有效期、分组、额度限制、特性）→ 选中弹确认 → `POST /payment/orders`（`order_type=subscription`,`plan_id`）→ 同一 `PaymentResultModal` 流程。订阅 tab 显隐受 `purchase_subscription_enabled` 控制。

### 4. 我的订单 `/orders` · `useOrders`

- 3 张 `StatCard`：订单总数（X 已支付 · Y 待支付）、累计充值（已完成订单合计）、最近订单。
- 状态 chip tab（全部/待支付/已支付/已退款/已取消，对应后端状态值）+ 搜索（订单编号）。
- `OrderTable`：订单编号（+ 类型·ID）、实付（¥ + $）、支付方式（色点 + 名称）、状态 `StatusBadge`、创建时间、行操作。
- 行操作：查看（`OrderDetailModal`）、立即支付（PENDING → `PaymentResultModal`）、取消（PENDING → `orders/:id/cancel` + 确认）、重新下单（→ `/recharge`）。发票/退款详情按设计稿做轻量占位。
- `Pagination`。

### 5. 个人资料 `/profile` · `useProfile`

- `AccountHero`：头像、用户名、角色/状态徽章、邮箱；下方三格（账户余额 / 并发限制 / 注册月份）。
- `ProfileForm`：改用户名（`PUT /user`，1–50 字符校验）；头像上传（**前端压缩 ≤20KB → data URL → `avatar_url`**；删除 = 置空 `avatar_url`）。
- `BindingList`：邮箱（始终显示，「管理邮箱」轻量占位）、LinuxDo / 钉钉 / OIDC（名称取 `oidc_oauth_provider_name`）/ 微信等——**显隐由 `usePublicSettings` 的各 `*_oauth_enabled` 决定**；绑定状态读 `user` 的 `*_bound`。绑定：`bind/start` 拿 `authorize_url` 跳转；解绑：`DELETE /user/account-bindings/:provider` + 确认，完成后刷新用户。

## 错误处理与边界

- 所有 composable：`loading/error`，列表空集走 empty 态。网络层已统一 401 续期与错误归一化（`{status,code,message}`），页面只需展示 `message`。
- 写操作（创建/删除/取消/绑定/兑换/下单）：按钮置 `disabled` 防重复提交，成功/失败 toast。
- 复制、剪贴板、轮询定时器在组件卸载时清理。
- 金额/Token/时间一律走 `utils/format`，与主前端口径一致。

## 测试与验收

- 类型与 lint：`mise run lint-user-portal`、`mise run test-user-portal`（含 `vue-tsc` 类型检查）。
- 关键路径 vitest：金额/赠送计算、CSV 拼装、状态映射、掩码 key 等纯函数优先覆盖；composable 的加载/错误分支按需。
- 仅改 `user-portal/`，不触碰 `backend/`、`frontend/`。

## 不做（YAGNI / 留待后续）

- 密钥高级项：自定义 key、IP 白/黑名单、多档速率限制、配额/限流重置。
- 订单退款全流程（退款申请/退款详情/发票），仅占位。
- 使用记录的错误请求（errors）tab、每日用量图。
- 邮箱换绑/验证码完整流程（仅占位入口）。
