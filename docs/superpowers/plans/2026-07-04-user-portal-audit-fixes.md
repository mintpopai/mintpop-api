# user-portal 审查修复计划（2026-07-04）

来源：全项目审查（已完成三方核实：backend 接口能力、frontend 用户端行为基线、user-portal 源码）。
本计划只改 user-portal 与仓库基础设施，不改 backend/frontend 代码。

**Spec:** 无独立设计文档（本计划来源于全项目审查报告，非 brainstorming 产出）

## Global Constraints（全部任务生效）

- **行为基线**：frontend 用户端为一致性基准（已核实：支付轮询 CANCELLED/EXPIRED/FAILED 全停表、RECHARGING 属成功集合显示「充值中」、注册月份跟随 locale）。后端契约已核实：`GET /user/profile` 与 `/auth/me` 的用户对象含 `total_recharged`（后端累加的累计充值总额）；订单状态全集恰为 13 个（PENDING/PAID/RECHARGING/COMPLETED/EXPIRED/CANCELLED/FAILED/REFUND_REQUESTED/REFUNDING/REFUND_PENDING/PARTIALLY_REFUNDED/REFUNDED/REFUND_FAILED）；verify 接口仅在订单为 PENDING/EXPIRED 时查上游对账。
- **语言**：代码注释、commit message 一律中文（约定式提交，如 `fix(user-portal): ...`）。i18n 词条改动必须 zh-CN 与 en-US 双端同步（`src/i18n/__tests__/messages-align.test.ts` 会拦截漏改）。
- **门禁**：每任务提交前 `mise run lint-user-portal` 与 `mise run test-user-portal`（仓库根执行）必须全绿；迭代期间可在 user-portal/ 下 `pnpm exec vitest run <文件>` 做针对性运行。
- **风格**：Vue 3.5 `<script setup lang="ts">`；跟随现有注释密度（解释「为什么」）；枚举字符串取值 SCREAMING_SNAKE_CASE；禁止 `@ts-ignore`/`as any`/无注释空 catch；不在 package.json 加 scripts；不引入新依赖（任务明说除外）。
- **提交**：直接在 `mintpop` 分支提交（本仓先例），每任务一个或多个独立提交，不 push。

## Task 1: 订单统计口径 + 支付轮询终态 + RECHARGING 文案 + 金额守卫

对应审查条目 #1（高）、#2（中）、#17（低）、#4（中）。

1. **`src/api/types.ts`**：User 类型加 `total_recharged?: number`，注释说明来源（后端 `GET /user/profile`、`/auth/me` 返回，充值成功后端累加，是「累计充值」的权威口径）。
2. **`src/views/OrdersView.vue`**：
   - 「累计充值」StatCard 的值改用 auth store 用户对象的 `total_recharged`（不再用当前页订单 reduce）。页面加载时调用 `authStore.fetchUser()` 刷新以拿最新值（读 `src/stores/auth.ts` 确认现有方法签名与失败语义；失败时展示兜底 `—` 或沿用现有错误处理，不得让页面崩）。
   - 已支付/待支付笔数保留当前页计算，但 hint 词条改为明示「本页」口径（zh：本页口径；en：this page 等价表述），改 `src/i18n/locales/{zh-CN,en-US}/orders.ts` 对应词条。
3. **`src/components/payment/PaymentResultModal.vue`**（对齐 frontend 基线）：
   - 把「下一步动作」判定抽成纯函数（建议放在组件旁或 `src/utils/format.ts` 附近合适位置）：输入订单状态字符串，返回 `'CONTINUE' | 'SETTLED' | 'TERMINAL'`——`ORDER_SETTLING_STATUSES`（PAID/COMPLETED/RECHARGING，复用 `src/utils/format.ts` 现有常量）→ `SETTLED`；`PENDING` → `CONTINUE`；其余一切状态（FAILED/CANCELLED/EXPIRED/退款系列/未知）→ `TERMINAL`。
   - verifyOnce 按纯函数结果行动：SETTLED → stopPoll + stopCountdown + emit('paid')（注意 RECHARGING 也算成功，与 frontend SUCCESS_STATUSES 一致）；TERMINAL → stopPoll + stopCountdown（不 emit）；CONTINUE → 继续。
   - 倒计时归零时同时 stopPoll（读现有 updateTick 实现后接入），界面呈现过期态（沿用现有过期展示，若无则状态文案显示 EXPIRED 对应文案即可）。
   - statusLabel 补 `RECHARGING` 映射：i18n 新增词条（zh「充值中」/en「Recharging」，命名空间与现有 payment 词条风格一致，双端同步）。
   - **TDD**：先为纯函数写测试（覆盖：PENDING→CONTINUE；PAID/COMPLETED/RECHARGING→SETTLED；FAILED/CANCELLED/EXPIRED/REFUNDED/未知字符串→TERMINAL），红→绿。组件级定时器测试不强制。
4. **`src/composables/useRecharge.ts`**：`submitRecharge` 去掉 `amount.value!`，入口显式守卫：`amount.value == null` 时抛 `Error`（中文注释说明契约——视图层提交前必须已把自定义金额写回 amount，此守卫防重构漏掉隐式约定）。

## Task 2: 格式化 locale 修正 + 订单状态类型守护 + 取消错误处理

对应 #6（中）、#3（低）、#22 之 errMessage。

1. **`src/utils/format.ts` `formatRegMonth`**：locale 从钉死 `'en-US'` 改为跟随当前门户语言（`i18n.global.locale.value`，文件已 import i18n）。注释说明：frontend 跟随浏览器 locale，本门户有显式语言切换故跟随门户语言，中文界面不再出现「Jun 2026」。
2. **`src/utils/format.ts` `orderStatusMeta`**：`variants` 类型从 `Record<string, string>` 改为 `Record<OrderStatus, string>`（`OrderStatus` 从 `@/api/types` 导入）——后端/类型加状态时漏配编译报错。入参 `s` 仍是 string，索引处用安全适配（如 `(variants as Record<string, string | undefined>)[s]`），未知状态回退 `muted` 的现有行为不得变。
3. **`src/utils/error.ts` `errMessage`**：axios 取消错误（`isCancel` 或 `code === 'ERR_CANCELED'`）返回 fallback 而非英文原文 "canceled"，加注释（请求取消不是用户可见错误）。
4. **测试**（TDD，加到 `src/utils/__tests__/format.test.ts` 及 error 相关测试）：
   - `formatDateTime` / `toLocalDate`：用本地时区构造的 `new Date(y, m, d, ...)` 固定输入断言输出（避免 ISO UTC 字符串带来的时区不稳定）。
   - `ORDER_SETTLING_STATUSES` 守护：断言集合恰为 PAID/COMPLETED/RECHARGING，注释注明与 frontend SUCCESS_STATUSES 及后端履约链（PAID→RECHARGING→COMPLETED）对齐。
   - `orderStatusMeta`：13 个后端状态全部返回非 muted 兜底的正确 variant + 未知状态回退 muted。
   - `errMessage`：取消错误返回 fallback。

## Task 3: 基座修补（标题合一 / 注释漂移 / 占位符转义 / slug 纠正）

对应 #7（中）、#16（低）、#8（中）、#22 之 DocsView 与 doRefresh。

1. **标题函数合一**：新建 `src/utils/title.ts` 导出 `setDocumentTitle(titleKey?: string)`（key 有值 → `` `${t(key)} · MintPop API` ``，无值 → `'MintPop API'`；t 用 `i18n.global.t`）。`src/router/index.ts` afterEach 与 `src/App.vue` 语言切换补刷两处改为共用它，删除两份手写副本；router 处保留「防漏配 meta.title」注释语义。
2. **`src/i18n/index.ts`** 头注释：`见 .env.example` 改为 `见 .env.prod`。
3. **`src/docs/placeholders.ts`**：来自后端公开设置的 URL 值（api_base_url/BASE_URL 占位符）注入前做 `encodeURI`，注释说明（注入发生在 markdown 渲染前且 markdown-it 开着 html:true，管理员配置值需无害化防 HTML 注入；encodeURI 保留 URL 合法字符不破坏正常地址）。**TDD**：在 `src/docs/__tests__/placeholders.test.ts` 先加用例（含 `<script>` 字样的值注入后不含 `<`）。
4. **`src/views/DocsView.vue`**：非法 slug 从「静默回退首篇但 URL 不变」改为 `router.replace` 到首篇文档路由（URL 与内容一致；注意不得造成合法 slug 的重定向环）。相关测试（`src/__tests__/docs-route.test.ts`、`src/views/__tests__/DocsView.test.ts`）如受影响需同步更新并保持真实行为断言。
5. **`src/api/client.ts` doRefresh**：给「`body?.code === 0 ? body.data : (resp.data as ...)`」兜底分支补注释：兼容「响应体未走统一包装」的历史契约；业务失败（code!==0）时该分支读不到 token、自然返回 null 走登出。仅加注释，不改逻辑。

## Task 4: client.test 补洞（鉴权关键分支）

对应 #11（中）。只改 `src/api/__tests__/client.test.ts`，不改实现。

新增三个用例（沿用现有测试风格与 mock 方式；jsdom 下 `window.location.href` 断言方式由实现者根据现有测试基建决定，可 spy/替换）：
1. 401 + 刷新失败（refresh 请求 reject 或返回无 token）→ `auth_token`/`refresh_token` 被清除，跳转 `/login?redirect=<原路径编码>`。
2. 401 + 无 refresh_token → 不发 refresh 请求，直接清库并跳转。
3. auth 端点豁免：`/auth/login` 返回 401 → 不触发刷新流程，错误直接 reject（包含业务 message）。

注意 client.ts 模块级 `isRefreshing/waiters` 状态：失败路径 `onRefreshed(null)` 会自清，但用例间若有残留请在 beforeEach 里防御（说明原因）。

## Task 5: 可访问性补齐

对应 #9（中）。全程不改视觉样式；正解依据 WAI-ARIA Authoring Practices（radio group 方向键 + roving tabindex；menu button 需 role="menu"/menuitem）与 HTML label 关联规范。

1. **`src/components/keys/KeyTable.vue`、`orders/OrderTable.vue`、`usage/UsageLogTable.vue`**：div+grid 结构补 ARIA 表格语义（容器 `role="table"`，表头行/数据行 `role="row"`，表头格 `role="columnheader"`，数据格 `role="cell"`），布局与类名不动。
2. **`src/components/keys/CreateKeyModal.vue`、`EditKeyModal.vue`、`src/components/profile/ProfileForm.vue`**：label 补 `for`/`id` 关联（参考 RegisterView 的规范写法；id 用 Vue 3.5 `useId()` 保证弹窗多实例不撞）。
3. **`src/components/ui/Modal.vue`**：无 title 时 `aria-label` 兜底为通用词条（i18n 新增 `ui` 命名空间词条，zh「对话框」/en「Dialog」，双端同步）。
4. **`src/components/recharge/AmountPicker.vue`、`PayMethodPicker.vue`**：radio 组补方向键移动（←→↑↓ 在组内循环移动并选中）+ roving tabindex（选中项 tabindex=0、其余 -1）。
5. **`src/layouts/PortalLayout.vue`**：用户菜单面板补 `role="menu"`、菜单项 `role="menuitem"`，与现有 `aria-haspopup="menu"` 配平。
6. **`src/components/common/ToastHost.vue`**：关闭交互改为真 `<button>`（键盘可达）+ `aria-label`（i18n 词条，双端同步）。

## Task 6: composable 抽象与组件杂项

对应 #5（中）、#22 之 useToast/UserAvatar/TrendChart/UsageView/checkout!。

1. **新建 `src/composables/useLatestRequest.ts`**：统一「序号守卫只认最新请求 + 可选 AbortController 取消旧请求」模式，替换 `useDashboard.ts`/`useKeys.ts`/`useOrders.ts`/`useUsage.ts` 四处手写守卫。先读 `src/api/*.ts` 确认哪些请求函数接受 AbortSignal：接受的传 signal 真取消（useUsage 现有 abort 行为不得回退），不接受的仅序号丢弃结果，不改 API 签名。**TDD**：新 composable 先写单测（后发请求先返回时旧结果被丢弃；abort 场景）。四个 composable 的现有对外行为不变。
2. **`src/composables/useToast.ts`**：保存自动消失定时器 handle，dismiss 时 clearTimeout（注释：防已关 toast 的定时器空跑，为将来 hover 暂停留口）。
3. **`src/components/common/UserAvatar.vue`**：背景图改为 `:style` 对象绑定且 `url("...")` 引号包裹（防 avatar_url 含 `)`/引号破坏样式声明）。
4. **`src/components/dashboard/TrendChart.vue`**：监听主题 store 的明暗切换，切换后重读 `--accent` 并更新图表颜色（现在只在 onMounted 读一次）。
5. **`src/views/UsageView.vue` + `src/composables/useUsage.ts`**：「默认 7 天区间」收口为单一定义（useUsage 导出 defaultRange 之类），handleReset 复用，删除手抄副本。
6. **`src/views/RechargeView.vue`**：消除模板 `checkout!.methods` 非空断言（订阅确认 Modal 区块包 `v-if="checkout"` 或等效最小改动）。

## Task 7: keySnippets 单一来源 + SearchInput 抽取

对应 #18（低）、#19（低，部分）。

1. **`src/components/keys/keySnippets.ts`**：消除 `content` 与 `highlighted` 双份维护同一文本——高亮版作为唯一手写源，`content`（复制用纯文本）由剥标签 + HTML 反转义派生（写 `stripHighlightMarkup` 之类小函数）；或反向由 content + 着色规则生成高亮，两案取改动小者。**加守护测试**：派生结果与另一形态一致（防改一漏一）。现有复制/展示行为不变。
2. **抽 `src/components/ui/SearchInput.vue`**（放大镜 SVG + input，defineModel，placeholder 用 prop 传入），替换 `OrdersView.vue` 与 `KeysView.vue` 两处逐字重复的结构，视觉不变。
3. BaseButton/AsyncState 本任务不做（churn 大，另行专项）。

## Task 8: 基础设施与文档漂移

对应 #12（中）、#13（中）、#15（低）、#21（低）。不涉及 user-portal 源码。

1. **`user-portal/nginx.conf`**：改正失实注释——删除「后端地址可用 BACKEND_ORIGIN 覆盖」（该变量无任何 envsubst 模板机制，纯属失效承诺），如实注明 proxy_pass 固定为 compose 网络内服务名 `backend:8080`，要改地址需改本文件并重建镜像。
2. **`.github/audit-exceptions.yml`**：两条 xlsx 例外 `expires_on` 从 `2026-07-06` 延至 `2026-10-06`（季度复评），其余字段不动。
3. **`user-portal/.env.prod`**（在库）与 **`.env.prod` 同款注释的 `.env.local`**（未入库，本地一并改）：头注释改正——`.env.prod` 由 `mise run build-user-portal --env prod`（= `vite build --mode prod`）加载；镜像构建任务名是 `mise run image-user-portal`（原注释写的 `user-portal-image`、「build:prod 脚本」均已不存在）；`.env.local` 注释如实描述其加载语义（dev server 与本地默认构建加载；vite 在任意 mode 下都会加载 `.env.local`，同名变量优先级低于 `.env.prod`，Docker 构建上下文已排除它）。
4. **根 `.gitignore`** 清理：去重 `docker-compose.override.yml`、`.serena/`；`backend/internal/web/dist` 四行简化为等效两行（`backend/internal/web/dist/*` + `!backend/internal/web/dist/.keep`）并把该段英文注释改中文；不改变任何实际忽略语义（可用 `git status --porcelain` 前后对比验证仍干净、`git check-ignore` 抽查关键路径行为不变）。
5. **`CLAUDE.md`**（本地未入库）：「改动须知」里 `mise run generate` 改为 `mise run generate-backend`（与实际 task 名一致）。此文件被 gitignore，改动不会出现在提交里，属预期。
