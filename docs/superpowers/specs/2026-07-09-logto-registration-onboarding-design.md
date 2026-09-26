# Logto 认证 + mintpop-api 业务开户分离 —— 设计文档

- 日期：2026-07-09
- 分支：mintpop
- 状态：设计已确认，待写实现计划

## 1. 背景与目标

user-portal 已迁移到 **Logto 统一登录**（自托管，独立仓库 `~/workspace/mintpop-auth`）。当前后端把 Logto/OIDC 当作通用 OIDC provider，首次登录时若"邮箱已验证且未开邀请码"会走**快捷路径静默自动建号**（`tryOIDCVerifiedEmailFastPath`），三个业务码（优惠码/返利码/邀请码）只能靠 URL 参数在登录前预透传（cookie / localStorage）。

**目标**：把「身份认证」与「业务开户」两个关注点彻底分离，落成清晰的分层：

- **Logto 只管"你是谁"**（authentication）——不管新老用户，都必须先登录拿到一个可信身份。
- **mintpop-api 管"你能不能在本站开户、开户带什么权益"**（business onboarding / provisioning）——三个业务码属于业务系统，在**显式开户屏**上采集。

用户到达 user-portal 后由后端判断：已注册直接登录；未注册则进入**统一开户屏**，按各码的必填规则填写后才建号。

## 2. 现状关键代码锚点

- 回调核心：`backend/internal/handler/auth_oidc_oauth.go`
  - `OIDCOAuthCallback`（`:198`）：换 token → 验 id_token → 拉 userinfo → 组装 identity 三元组 `{oidc, issuer, sub}` → 分支
  - `tryOIDCVerifiedEmailFastPath`（`:1231`）：**本次要砍掉的静默建号路径**；`IsInvitationCodeEnabled` 时才禁用它（`:1247`）
  - `CompleteOIDCOAuthRegistration`（`:614`）：现仅为邀请码服务，请求体 `invitation_code` 无条件 `binding:"required"`（`:605`）
- pending 流转：`backend/internal/handler/auth_oauth_pending_flow.go`
  - promo 捕获/承载：`captureOAuthPromoCode`（`:166`）、`readOAuthPromoCode`（`:195`）、`pendingOAuthPromoCode`（`:206`）、`invitation_required` 状态判定（`:329`）
- 注册 service 汇聚点：`backend/internal/service/auth_service.go`
  - `loginOrRegisterOAuthWithTokenPair`（`:600`）：处理 invitation（`:628-738`）、绑定 affiliate（`bindOAuthAffiliate` `:711/:732`）、应用 promo（`:757/:773`）
  - `RegisterWithVerification`（`:137`）：传统邮箱注册的四码汇聚（promo/invitation/affiliate）
- 快捷路径 service：`backend/internal/service/auth_email_oauth_auto.go`
  - `LoginOrRegisterVerifiedEmailOAuthWithSignupCodes`（`:41`）、`createEmailOAuthUser`（`:157`）、`bindOAuthAffiliate`（`:207`）
- 身份映射表：`backend/ent/schema/auth_identity.go`（唯一键 `provider_type+provider_key+provider_subject`）
- 前端：
  - `user-portal/src/views/OidcCallbackView.vue`（回调落地页，三条出路）
  - `user-portal/src/views/RegisterView.vue`（**旧注册表单，代码仍在，路由被 redirect 雪藏**——开户屏复用基础）
  - `user-portal/src/router/index.ts:15-17`（`/register`、`/forgot-password`、`/reset-password` 均 redirect 到 `/login`）
  - `user-portal/src/utils/affiliateReferral.ts`（`?aff=` 落地 localStorage，30 天 TTL）

## 3. 已注册 / 未注册判断口径

在 `OIDCOAuthCallback` 里按序短路：

| 顺序 | 条件 | 结果 |
|---|---|---|
| ① | `auth_identities` 命中该 OIDC 身份三元组 | **已注册** → 直接发 token 登录 |
| ② | 未命中，但本地存在**同邮箱**账号（compat email） | **保留现状**：落 choice pending，由用户用邮箱密码 bind-login 绑定（迁移后基本不触发，见下） |
| ③ | 都不满足 | **未注册** → 落 `registration_required` pending session → 前端开户屏 |

> **修订（2026-07-09）**：**存量用户已迁移**——历史数据迁移时存量用户已连同 OIDC 身份预建到 `auth_identities`，故存量用户首登直接命中 ①、直接登录，**不存在"同邮箱但无身份映射、需自动绑定"的场景**。因此**不实现自动绑定**（原设计的 ② 自动绑定分支作废，对应 Task 1 作废）。② 保留现有 compat email 的 choice 分支仅作**防御兜底**（如 Logto sub 变更等罕见撞库时防 `users.email` 唯一约束报错），**零改动**。从现在起所有用户都走 Logto：命中身份→登录 / 未命中→开户屏。

## 4. 后端改动

### 4.1 移除静默建号

删除/改造 `tryOIDCVerifiedEmailFastPath` 中"未开邀请码即 auto-register"的逻辑。未注册用户（③）不再静默建号，一律落 `registration_required` pending session（沿用现有 `createOIDCOAuthChoicePendingSession` 的落 session 能力，新增/复用一个明确的 `registration_required` 状态）。

### 4.2 自动绑定（②）—— 作废，不实现

原计划的"同邮箱已验证自动绑定"**不做**（见 §3 修订）：存量用户已随迁移预建身份映射、首登命中 ①，无此场景。现有 compat email 的 choice 分支**零改动**保留作兜底。本节无后端改动。

### 4.3 新增 OIDC 无密码开户接口 `POST /oidc/onboard`

**方案修订（2026-07-09）**：原"复用 `complete-registration` 建号"**作废**——调研证实它被 `legacyCompleteRegistrationSessionStatus`（`pending_flow.go:423`）的 `step != ""` short-circuit，且用 synthetic 占位邮箱（`session.ResolvedEmail` = `oidc-<hash>@oidc-connect.invalid`）建号而非真实邮箱。真正"真实已验证邮箱无密码建号"的能力在被删的快捷路径里。故**新增 OIDC 专用开户接口**，把该能力从 callback 挪到开户屏触发的端点：

- 新 handler `OnboardOIDCOAuthAccount` → 路由 `POST /api/v1/auth/oauth/oidc/onboard`。
- 读 pending session（cookie）→ 校验为 `registration_required` 的全新待开户 session（`ensurePendingOAuthCompleteRegistrationSession` + payload `registration_required==true`）→ `ensureBackendModeAllowsNewUserLogin` 兜底。
- 从 `session.UpstreamIdentityClaims` 取 `compat_email`（真实上游邮箱）、`email_verified`、`username`、`suggested_display_name`/`suggested_avatar_url`；身份三元组取 `session.ProviderType/ProviderKey/ProviderSubject`。
- **安全红线**：`email_verified==true` 且 `compat_email` 非空才建号（无真实已验证邮箱不能无密码开户）。
- 请求体 `invitation_code?/promo_code?/aff_code?`；promo 优先请求体、回退 `pendingOAuthPromoCode(session)`。
- 调既有 `LoginOrRegisterVerifiedEmailOAuthWithSignupCodes(input, invitationCode, affCode, promoCode)`（被删快捷路径调的同一 service）无密码建号：内部按 `IsInvitationCodeEnabled` 校验邀请码、建号、绑 aff、赠 promo、绑身份、发 token；同邮箱已存在则复用不重建。
- 消费 session、清 cookie，返回裸 `{access_token, refresh_token, expires_in, token_type}`（对齐既有 OAuth token 端点风格，前端拦截器原样透传）。
- 另：`ExchangePendingOAuthCompletion` 返回 registration pending payload 时带上 `promo_code`（从 session 读）供开户屏回填。
- **不碰** `complete-registration`/`legacy` 共用状态机与 admin 前端流程。

建号后三码副作用沿用现有 service 逻辑，不新造：invitation 消费准入 + 标记已用、aff 绑定 inviter、promo 赠余额。

## 5. 前端改动（user-portal）

- `OidcCallbackView.vue`：新增/对齐分支——收到 pending `registration_required` 时跳转开户屏（不再等待静默 token）。
- **开户屏**：复用 `RegisterView.vue` 表单骨架。
  - 路由：放开为可达（复用 `/register`，或新增 `/onboarding`，实现时二选一，倾向 `/onboarding` 以语义清晰、与旧邮箱注册区分）。
  - 三个码输入框：Promo 选填（实时校验、显示赠额）、Aff 选填（`?aff=` 预透传自动回填、可改可清空）、Invitation 按 `IsInvitationCodeEnabled` 开关必填或整块隐藏。
  - 提交 → `POST /auth/oauth/oidc/onboard` → 建号发 token → `/dashboard`。
- 旧邮箱注册相关的失效交互（找回密码等）保持 redirect 到 login，不在本次范围。

## 6. 必填矩阵（沿用旧语义，前后端一致）

| 码 | 必填性 | 校验时机 |
|---|---|---|
| Promo（优惠码） | 选填 | 前端实时校验有效性；建号后赠余额 |
| Aff（返利码） | 选填 | 建号时绑定 inviter |
| Invitation（邀请码） | 后台开关决定：开=必填，关=隐藏 | 提交时后端按开关校验准入 |

## 7. 测试

- 后端集成测试覆盖 ①②③ 三条分支：
  - ① 身份映射命中直接登录；
  - ② 同邮箱 + 邮箱已验证自动绑定登录；**邮箱未验证不自动绑定**（安全用例）；
  - ③ 未注册落 `registration_required`。
- `complete-registration` 在开关开/关两态下的必填校验；三码各自的建号副作用（invitation 消费/标记、aff 绑定、promo 赠额）。
- 前端：`RegisterView-invitation.test.ts` / `RegisterView-aff.test.ts` 迁移到开户屏语境；新增"收到 registration_required 跳开户屏"用例。

## 8. 非目标 / YAGNI

- 不新建独立 onboarding 状态机与接口（复用现有 pending + complete-registration 机制）。
- 不改动三个码底层数据模型与 service 计算逻辑（`promo_codes` / `redeem_codes(invitation)` / `user_affiliates`）。
- 不恢复本地邮箱密码注册；开户屏只承接 Logto 已认证身份。
- 不处理 Logto 邮箱未验证的存量并号（本次仅提示，不自动化）。
