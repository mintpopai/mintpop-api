# user-portal 忘记密码/重置密码 设计文档

日期：2026-07-07
状态：已确认

## 背景与目标

后端已具备完整的密码重置能力（`POST /api/v1/auth/forgot-password`、`POST /api/v1/auth/reset-password`，含防枚举、限流、Turnstile 校验、重置后吊销全部会话），主前端（frontend）有完整页面，但用户门户（user-portal）没有任何入口。

目标：在 user-portal 补全忘记密码/重置密码功能，**功能行为一比一对齐 frontend，视觉设计跟随 user-portal 现有风格**。

## 关键决策（已与用户确认）

1. **后端零改动**。重置邮件链接由后端用站点设置 `frontend_url` 拼出（`<frontend_url>/reset-password?email=...&token=...`）；部署上约定 `frontend_url` 配置为 user-portal 的域名，邮件链接自然落到门户新页面。
2. **抽共享布局组件并重构四页**。当前 LoginView / RegisterView 各自复制一份「左侧品牌区 + 右侧表单」双栏布局；本次新建 `AuthShell` 组件，新两页使用它，同时把 Login / Register 重构过去，一次性消除重复。

## 后端接口契约（现状，不改动）

- `POST /api/v1/auth/forgot-password`
  - 入参：`{ email: string(必填、邮箱格式), turnstile_token?: string }`
  - 站点开启 Turnstile 时后端强制校验 token；限流每分钟 5 次。
  - 无论邮箱是否存在都返回成功（防枚举）。
- `POST /api/v1/auth/reset-password`
  - 入参：`{ email: string, token: string, new_password: string(≥6 位) }`
  - token 一次性消费；无效/过期返回错误码 `INVALID_RESET_TOKEN`；限流每分钟 10 次。
  - 成功后递增 TokenVersion 并吊销全部 refresh token（旧会话全部失效）。
- 功能开关：公开设置 `password_reset_enabled`（user-portal 的 `PublicSettings` 类型中已存在该字段）。

## 组件设计

### 1. `components/layout/AuthShell.vue`（新建）

共享认证页骨架，承载四页共用的双栏布局：

- **左侧品牌区**（`lg` 以上显示）：点阵晕染装饰、字标（明暗双图）、编辑式文案块（kicker + 衬线大标题带薄荷绿下划线高亮词 + 描述）。
- **右侧表单区**：居中 `max-w-[392px]` 容器 + 移动端字标。
- **Props**：`kicker`、`headlinePre`、`headlineMark`、`headlineEnd`、`desc`（均为已翻译字符串，由各页传入）。
- **默认插槽**：右侧表单区全部内容。h1 标题留在各页内（登录页标题随 TOTP 步骤切换，无法上提）。
- **`brand-footer` 插槽**：左栏底部区。**默认渲染登录页的模型/能力标签行**（含 `IS_APPLICATION_MODE` 分发模式逻辑，收口进 AuthShell）；注册页用「三步骤」内容覆盖；忘记/重置页用默认值。
- **共享输入框样式**：四页重复的 `.fld` / `.ico` scoped 样式提取为一份共享样式（跟随项目现有全局样式组织方式），页面不再各拷一份。

### 2. `views/ForgotPasswordView.vue`（新建，路由 `/forgot-password`）

- 表单：邮箱输入（必填 + 正则格式校验）。
- Turnstile：站点开启时渲染（复用 `components/common/TurnstileWidget.vue`），未完成验证禁止提交；token 一次性，请求失败后 reset 重新挑战（与门户登录页同款处理）。
- 提交调 `forgotPassword` API；加载态用 `LoadingSpinner`。
- 成功后切换**成功态**：门户风格确认卡片（“重置邮件已发送，请查收”）+「返回登录」链接。
- 错误展示走门户惯例的**表单内联红字**（`errMessage` 兜底），不用 toast。
- 左栏文案新写一组（kicker「账号找回」方向，编辑式排版与登录/注册一致）。

### 3. `views/ResetPasswordView.vue`（新建，路由 `/reset-password`）

- 挂载时读 `route.query.email` / `route.query.token`；任一缺失 → **无效链接态**：警示卡片 +「重新申请重置链接」链接跳 `/forgot-password`。
- 表单：邮箱只读展示；新密码 + 确认密码，均带显隐切换；校验必填、≥6 位、两次一致。
- 提交调 `resetPassword` API；后端返回 `INVALID_RESET_TOKEN` 时展示专门文案（“链接已失效或过期”），其余错误走 `errMessage` 兜底。
- **成功态**：确认卡片 +「去登录」按钮（后端已吊销全部旧会话，引导重新登录）。

### 4. `LoginView.vue`（改动）

- 重构为使用 AuthShell（行为不变）。
- 密码 label 行右侧新增「忘记密码？」链接，仅当 `settings.password_reset_enabled` 为 true 时展示（门户无 backend_mode 概念，条件比 frontend 少一项）。

### 5. `RegisterView.vue`（改动）

- 重构为使用 AuthShell（`brand-footer` 传三步骤内容），行为不变。

## 路由与 API

- 路由新增（`requiresAuth: false`）：
  - `/forgot-password` → `ForgotPasswordView`，`meta.title` 对应新增 nav key。
  - `/reset-password` → `ResetPasswordView`，同上。
- **不加**「已登录跳走」限制：已登录用户点邮件链接也应能重置（与 frontend 行为一致）；全局守卫与 catch-all 不变。
- `api/auth.ts` 新增：
  - `forgotPassword({ email, turnstile_token? })` → `POST /auth/forgot-password`
  - `resetPassword({ email, token, new_password })` → `POST /auth/reset-password`
  - 对应请求/响应类型加入 `api/types.ts`（门户 API 类型的统一收口处）。

## i18n

- `zh-CN/auth.ts` 与 `en-US/auth.ts` 同步新增全部文案 key（页面标题/副标题、左栏 kicker/标题/描述、表单 label/placeholder、校验错误、成功/无效链接态、按钮各状态文案、「忘记密码？」入口）。
- `nav.ts` 新增两个路由标题 key。
- 双语对齐由现有 `i18n/__tests__/messages-align.test.ts` 自动兜底。

## 错误处理汇总

| 场景 | 处理 |
|---|---|
| 邮箱为空/格式错 | 前端内联校验文案，不发请求 |
| Turnstile 开启但未完成 | 内联提示，不发请求 |
| forgot-password 请求失败 | 内联红字（`errMessage` 兜底）+ Turnstile reset 重挑战 |
| 重置链接缺 email/token | 无效链接态卡片 + 引导重新申请 |
| `INVALID_RESET_TOKEN` | 专门文案“链接已失效或过期” |
| reset-password 其它失败 | 内联红字（`errMessage` 兜底） |
| 后端功能未开启（`PASSWORD_RESET_DISABLED`） | 登录页不展示入口（`password_reset_enabled=false`）；直接访问页面提交时按普通错误内联展示 |

## 测试

- 两个新视图的单测（参照 `views/__tests__` 现有惯例）：校验逻辑、无效链接态、成功态切换、Turnstile 条件渲染、`INVALID_RESET_TOKEN` 专门文案。
- Login / Register 重构后现有测试必须全绿。
- 质量门禁：`mise run lint-user-portal` + `mise run test-user-portal` 全部通过。

## 明确不做

- 不改后端任何代码与配置结构。
- 不加「重置成功自动登录」（后端语义是吊销全部会话）。
- 不为 frontend 与 user-portal 抽跨项目共享组件（两端设计体系不同）。
