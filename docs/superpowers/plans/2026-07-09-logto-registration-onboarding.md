# Logto 认证 + mintpop-api 业务开户分离 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 OIDC 首次登录后的"业务开户"显式化——已注册用户直接登录，未注册用户一律进入统一开户屏（填优惠码/返利码/邀请码）后才建号，砍掉静默自动建号。

**Architecture:** 后端在 OIDC 回调里按三档口径分流（身份命中→登录 / 同邮箱已验证→自动绑定 / 全新→落 `registration_required` pending session）；前端 exchange 拿到 `registration_required` 后跳新开户屏 `/onboarding`（从雪藏的 `RegisterView.vue` 裁剪而来），提交 `complete-registration` 建号。复用既有 pending-session + `complete-registration` 机制，仅放宽其邀请码必填约束。

**Tech Stack:** Go（Gin + Ent + testify）后端；Vue3 + TS + Vite + vitest 前端。测试用 `mise run test-backend` / `mise run test-user-portal`。

**Spec:** `docs/superpowers/specs/2026-07-09-logto-registration-onboarding-design.md`

## Global Constraints

- 语言：所有注释、文档、commit message 用简体中文；枚举成员名与字符串取值 SCREAMING_SNAKE_CASE。
- 必填矩阵沿用旧 `RegisterView.vue` 语义：Promo 选填、Aff 选填（`?aff=` 自动回填）、Invitation 由 `invitation_code_enabled` 开关决定（开=必填，关=隐藏）。
- 安全红线：同邮箱自动绑定**必须** Logto 邮箱已验证（`email_verified == true`）；未验证不自动并号，退回需密码的 choice 绑定。
- `docs/*` 被 `.gitignore` 忽略：本计划与 spec 均为本地稿，不入库。
- 后端改 handler 不涉及 Ent schema / Wire，无需 `mise run generate-backend`。
- 提交前分支：当前在 `mintpop`（非默认 `mint`），可直接提交。

---

## File Structure

**后端（`backend/`）**
- `internal/handler/auth_oidc_oauth.go` — 回调分支重排（自动绑定分支 + 删快捷路径）；`createOIDCOAuthChoicePendingSession` 给全新用户打 `registration_required` 标志；`completeOIDCOAuthRequest` 放宽 invitation、接收 promo。
- `internal/handler/auth_oauth_pending_flow.go` — `ExchangePendingOAuthCompletion` 在返回 registration pending 的 payload 时带上 `promo_code` 供前端回填。
- `internal/handler/auth_oidc_oauth_test.go` — 改/删/增回调与 complete-registration 测试。
- `internal/handler/auth_oauth_pending_flow_test.go` — 删除 `tryOIDCVerifiedEmailFastPath` 相关测试。

**前端（`user-portal/`）**
- `src/api/types.ts` — `OidcPendingExchangeResult` 增字段；新增 `OnboardOidcRequest`。
- `src/api/auth.ts` — 新增 `onboardOidcAccount()`。
- `src/views/OnboardingView.vue` — 新开户屏（从 `RegisterView.vue` 裁剪，仅三码 + 提交）。
- `src/views/OidcCallbackView.vue` — exchange 返回 `registration_required` 时跳 `/onboarding`。
- `src/router/index.ts` — 新增 `/onboarding` 路由。
- `src/i18n/locales/{zh-CN,en}/auth.ts` — 开户屏文案键。
- `src/views/__tests__/OnboardingView.test.ts`、`OidcCallbackView.test.ts` — 新增/对齐测试。

---

## Task 1: 后端 —— 同邮箱已验证用户自动绑定 ⚠️ 作废（跳过，不实现）

> **作废（2026-07-09 用户澄清）**：历史数据迁移时存量用户已连同 OIDC 身份预建到 `auth_identities`，存量用户首登直接命中身份映射登录，**不存在需自动绑定的场景**。现有 compat email 的 choice 分支**零改动**保留作兜底（迁移后基本不触发）。**执行从 Task 2 开始，跳过本任务。** 详见 spec §3 修订。

~~把 OIDC 回调里"同邮箱存量账号"的处理从"choice 页让用户选/密码绑定"改为"邮箱已验证即自动绑定登录"。~~（下述步骤全部作废，勿执行。）

**Files:**
- Modify: `backend/internal/handler/auth_oidc_oauth.go`（callback 分支，约 `:446-513`）
- Test: `backend/internal/handler/auth_oidc_oauth_test.go`（改 `:422` 处测试，新增未验证用例）

**Interfaces:**
- Consumes: `h.createOAuthPendingSession(c, oauthPendingSessionPayload{...})`（`auth_oauth_pending_flow.go:229`）；`h.findOIDCCompatEmailUser`（`auth_oidc_oauth.go:515`）；`h.isForceEmailOnThirdPartySignup(ctx)`（`auth_oauth_pending_flow.go:505`）；常量 `oauthIntentLogin`。
- Produces: 回调对 `compatEmailUser != nil && emailVerified && !forceEmail` 落 `intent=login, TargetUserID=compatEmailUser.ID` 的 pending session（exchange 侧 `pendingOAuthCompletionCanIssueTokenPair` 会认它、自动 upsert identity 并发 token）。

- [ ] **Step 1: 改现有测试为"自动绑定"断言（先让它失败）**

把 `TestOIDCOAuthCallbackCreatesBindPendingSessionForCompatEmailUser`（`auth_oidc_oauth_test.go:422`）整体重写为下面内容（重命名为 `TestOIDCOAuthCallbackAutoBindsVerifiedCompatEmailUser`）：

```go
func TestOIDCOAuthCallbackAutoBindsVerifiedCompatEmailUser(t *testing.T) {
	cfg, cleanup := newOIDCTestProvider(t, oidcProviderFixture{
		Subject:           "oidc-subject-compat",
		PreferredUsername: "oidc_compat",
		DisplayName:       "OIDC Compat Display",
		AvatarURL:         "https://cdn.example/oidc-compat.png",
		Email:             "legacy@example.com",
		EmailVerified:     true,
	})
	defer cleanup()

	handler, client := newOIDCOAuthHandlerAndClient(t, false, cfg)
	t.Cleanup(func() { _ = client.Close() })

	ctx := context.Background()
	existingUser, err := client.User.Create().
		SetEmail("legacy@example.com").
		SetUsername("legacy-user").
		SetPasswordHash("hash").
		SetRole(service.RoleUser).
		SetStatus(service.StatusActive).
		Save(ctx)
	require.NoError(t, err)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/oauth/oidc/callback?code=oidc-code&state=state-compat", nil)
	req.AddCookie(encodedCookie(oidcOAuthStateCookieName, "state-compat"))
	req.AddCookie(encodedCookie(oidcOAuthRedirectCookie, "/dashboard"))
	req.AddCookie(encodedCookie(oidcOAuthVerifierCookie, "verifier-compat"))
	req.AddCookie(encodedCookie(oidcOAuthNonceCookie, "nonce-oidc-subject-compat"))
	req.AddCookie(encodedCookie(oidcOAuthIntentCookieName, oauthIntentLogin))
	req.AddCookie(encodedCookie(oauthPendingBrowserCookieName, "browser-compat"))
	c.Request = req

	handler.OIDCOAuthCallback(c)

	require.Equal(t, http.StatusFound, recorder.Code)
	require.Equal(t, "/auth/oidc/callback", recorder.Header().Get("Location"))

	sessionCookie := findCookie(recorder.Result().Cookies(), oauthPendingSessionCookieName)
	require.NotNil(t, sessionCookie)

	session, err := client.PendingAuthSession.Query().
		Where(pendingauthsession.SessionTokenEQ(decodeCookieValueForTest(t, sessionCookie.Value))).
		Only(ctx)
	require.NoError(t, err)
	// 自动绑定：落 login pending + TargetUserID，无 choice step、不需用户选择
	require.Equal(t, oauthIntentLogin, session.Intent)
	require.NotNil(t, session.TargetUserID)
	require.Equal(t, existingUser.ID, *session.TargetUserID)

	completion, ok := session.LocalFlowState[oauthCompletionResponseKey].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "/dashboard", completion["redirect"])
	require.Nil(t, completion["step"])                      // 不再停在 choice 页
	require.NotEqual(t, true, completion["existing_account_bindable"])
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && go test -tags=unit ./internal/handler/ -run TestOIDCOAuthCallbackAutoBindsVerifiedCompatEmailUser -v`
Expected: FAIL —— 现状对 compat email 落的是 `step=choose_account_action_required` 的 choice session，`completion["step"]` 非 nil。

- [ ] **Step 3: 在回调里插入自动绑定分支**

在 `auth_oidc_oauth.go` 的 `RequireEmailVerified` 检查之后、快捷路径之前（现约 `:457` 与 `:459` 之间）插入：

```go
	// 同邮箱存量账号 + 上游邮箱已验证 + 非强制补邮箱：自动把该 OIDC 身份绑定到存量账号并登录。
	// 邮箱已验证 = 用户已证明对该邮箱的控制权，故免密码直接并号（未验证时下方走需密码的 choice 绑定）。
	if compatEmailUser != nil &&
		emailVerified != nil && *emailVerified &&
		!h.isForceEmailOnThirdPartySignup(c.Request.Context()) {
		if err := h.createOAuthPendingSession(c, oauthPendingSessionPayload{
			Intent:                 oauthIntentLogin,
			Identity:               identityRef,
			TargetUserID:           &compatEmailUser.ID,
			ResolvedEmail:          compatEmailUser.Email,
			RedirectTo:             redirectTo,
			BrowserSessionKey:      browserSessionKey,
			UpstreamIdentityClaims: upstreamClaims,
			CompletionResponse: map[string]any{
				"redirect": redirectTo,
			},
		}); err != nil {
			redirectOAuthError(c, frontendCallback, "session_error", "failed to continue oauth login", "")
			return
		}
		redirectToFrontendCallback(c, frontendCallback)
		return
	}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd backend && go test -tags=unit ./internal/handler/ -run TestOIDCOAuthCallbackAutoBindsVerifiedCompatEmailUser -v`
Expected: PASS

- [ ] **Step 5: 新增"未验证 compat 邮箱走 choice 绑定"用例**

在同文件追加（验证未验证邮箱不自动并号，仍落 bindable choice；用不要求全局验证的 handler，使 callback 不在 `RequireEmailVerified` 处提前拦截）：

```go
func TestOIDCOAuthCallbackKeepsChoiceBindForUnverifiedCompatEmail(t *testing.T) {
	cfg, cleanup := newOIDCTestProvider(t, oidcProviderFixture{
		Subject:           "oidc-subject-unverified-choice",
		PreferredUsername: "oidc_unverified_choice",
		Email:             "owner2@example.com",
		EmailVerified:     false,
	})
	defer cleanup()
	// 不设 cfg.RequireEmailVerified：让流程走到 compat 分支而非在验证门槛处返回错误。

	handler, client := newOIDCOAuthHandlerAndClient(t, false, cfg)
	t.Cleanup(func() { _ = client.Close() })

	ctx := context.Background()
	existingUser, err := client.User.Create().
		SetEmail("owner2@example.com").
		SetUsername("owner2-user").
		SetPasswordHash("hash").
		SetRole(service.RoleUser).
		SetStatus(service.StatusActive).
		Save(ctx)
	require.NoError(t, err)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/oauth/oidc/callback?code=oidc-code&state=state-unverified-choice", nil)
	req.AddCookie(encodedCookie(oidcOAuthStateCookieName, "state-unverified-choice"))
	req.AddCookie(encodedCookie(oidcOAuthRedirectCookie, "/dashboard"))
	req.AddCookie(encodedCookie(oidcOAuthVerifierCookie, "verifier-unverified-choice"))
	req.AddCookie(encodedCookie(oidcOAuthNonceCookie, "nonce-oidc-subject-unverified-choice"))
	req.AddCookie(encodedCookie(oidcOAuthIntentCookieName, oauthIntentLogin))
	req.AddCookie(encodedCookie(oauthPendingBrowserCookieName, "browser-unverified-choice"))
	c.Request = req

	handler.OIDCOAuthCallback(c)

	require.Equal(t, http.StatusFound, recorder.Code)
	sessionCookie := findCookie(recorder.Result().Cookies(), oauthPendingSessionCookieName)
	require.NotNil(t, sessionCookie)

	session, err := client.PendingAuthSession.Query().
		Where(pendingauthsession.SessionTokenEQ(decodeCookieValueForTest(t, sessionCookie.Value))).
		Only(ctx)
	require.NoError(t, err)
	completion, ok := session.LocalFlowState[oauthCompletionResponseKey].(map[string]any)
	require.True(t, ok)
	// 未验证：不自动绑定，仍需用户用密码 bind-login
	require.Equal(t, oauthPendingChoiceStep, completion["step"])
	require.Equal(t, true, completion["existing_account_bindable"])
	require.Equal(t, existingUser.Email, completion["existing_account_email"])
}
```

- [ ] **Step 6: 运行两个 compat 用例确认通过**

Run: `cd backend && go test -tags=unit ./internal/handler/ -run 'TestOIDCOAuthCallback(AutoBindsVerifiedCompatEmailUser|KeepsChoiceBindForUnverifiedCompatEmail)' -v`
Expected: PASS（两个都过）

- [ ] **Step 7: Commit**

```bash
cd /Users/yuebai/workspace/mintpop-api
git add backend/internal/handler/auth_oidc_oauth.go backend/internal/handler/auth_oidc_oauth_test.go
git commit -m "feat(auth): OIDC 同邮箱已验证用户首登自动绑定存量账号

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: 后端 —— 砍掉静默建号，全新用户落 registration_required

移除快捷路径静默建号；全新用户（无身份、无同邮箱）落一个带 `registration_required` 标志、可被 `complete-registration` 消费的 pending session。

**Files:**
- Modify: `backend/internal/handler/auth_oidc_oauth.go`（删快捷路径块 `:459-475`；删 `tryOIDCVerifiedEmailFastPath` 函数 `:1229-1300`；`createOIDCOAuthChoicePendingSession` 内 `:558-581` 打标）
- Modify: `backend/internal/handler/auth_oidc_oauth_test.go`（重写快捷路径测试；删 3 个 fastpath 单测）
- Modify: `backend/internal/handler/auth_oauth_pending_flow_test.go`（删 `TestTryOIDCVerifiedEmailFastPathSkipped*` 若在此文件）

**Interfaces:**
- Consumes: `createOIDCOAuthChoicePendingSession`（`auth_oidc_oauth.go:540`）。
- Produces: 全新用户 pending session 的 `completion["registration_required"] == true`；`completion["adoption_required"] == true`（确保 exchange 返回 payload 而不误建号/误 apply）。

- [ ] **Step 1: 重写快捷路径回调测试为"落 registration pending"（先失败）**

把 `TestOIDCOAuthCallbackVerifiedEmailFastPathIssuesTokenWithoutPendingSession`（`auth_oidc_oauth_test.go:1013`）整体替换为（重命名 `TestOIDCOAuthCallbackNewUserFallsToRegistrationPending`）：

```go
func TestOIDCOAuthCallbackNewUserFallsToRegistrationPending(t *testing.T) {
	cfg, cleanup := newOIDCTestProvider(t, oidcProviderFixture{
		Subject:           "oidc-fast-callback-subject",
		PreferredUsername: "oidc_fast_callback",
		DisplayName:       "OIDC Fast Callback",
		AvatarURL:         "https://cdn.example/oidc-fast.png",
		Email:             "oidc-fast-callback@example.com",
		EmailVerified:     true,
	})
	defer cleanup()

	handler, client := newOIDCOAuthHandlerAndClientWithSettings(t, false, cfg, nil)
	t.Cleanup(func() { _ = client.Close() })

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/oauth/oidc/callback?code=oidc-code&state=state-fast-callback", nil)
	req.AddCookie(encodedCookie(oidcOAuthStateCookieName, "state-fast-callback"))
	req.AddCookie(encodedCookie(oidcOAuthRedirectCookie, "/dashboard"))
	req.AddCookie(encodedCookie(oidcOAuthVerifierCookie, "verifier-fast-callback"))
	req.AddCookie(encodedCookie(oidcOAuthNonceCookie, "nonce-oidc-fast-callback-subject"))
	req.AddCookie(encodedCookie(oidcOAuthIntentCookieName, oauthIntentLogin))
	req.AddCookie(encodedCookie(oauthPendingBrowserCookieName, "browser-fast-callback"))
	c.Request = req

	handler.OIDCOAuthCallback(c)

	require.Equal(t, http.StatusFound, recorder.Code)
	// 不再直接发 token，而是重定向回前端回调页（走 pending exchange）
	require.Equal(t, "/auth/oidc/callback", recorder.Header().Get("Location"))

	ctx := context.Background()
	// 关键：全新用户不静默建号
	userCount, err := client.User.Query().Where(dbuser.EmailEQ("oidc-fast-callback@example.com")).Count(ctx)
	require.NoError(t, err)
	require.Zero(t, userCount)

	sessionCookie := findCookie(recorder.Result().Cookies(), oauthPendingSessionCookieName)
	require.NotNil(t, sessionCookie)
	session, err := client.PendingAuthSession.Query().
		Where(pendingauthsession.SessionTokenEQ(decodeCookieValueForTest(t, sessionCookie.Value))).
		Only(ctx)
	require.NoError(t, err)
	require.Equal(t, oauthIntentLogin, session.Intent)
	require.Nil(t, session.TargetUserID)

	completion, ok := session.LocalFlowState[oauthCompletionResponseKey].(map[string]any)
	require.True(t, ok)
	require.Equal(t, true, completion["registration_required"])
	require.Equal(t, true, completion["adoption_required"])
	require.NotEqual(t, true, completion["existing_account_bindable"])
}
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && go test -tags=unit ./internal/handler/ -run TestOIDCOAuthCallbackNewUserFallsToRegistrationPending -v`
Expected: FAIL —— 现状快捷路径会建号并发 token（`userCount` 非零、无 pending session）。

- [ ] **Step 3: 删除快捷路径调用块**

删除 `auth_oidc_oauth.go` 中这段（现约 `:458-475`，含前面的注释）：

```go
	// 快捷路径：当上游返回已验证邮箱、部署不要求额外确认且本地没有同邮箱账号时，
	// 直接信任上游身份完成注册/登录，避免展示 choice 页。
	if compatEmailUser == nil &&
		strings.TrimSpace(compatEmail) != "" &&
		emailVerified != nil && *emailVerified {
		if handled := h.tryOIDCVerifiedEmailFastPath(
			c, frontendCallback, redirectTo, identityRef, compatEmail, username, upstreamClaims,
		); handled {
			return
		}
	}
```

删除后，全新用户直接 fall through 到 `createOIDCOAuthChoicePendingSession`（`:497`）。

- [ ] **Step 4: 给全新用户 pending 打 registration_required 标志**

在 `createOIDCOAuthChoicePendingSession` 的 `completionResponse` 组装处（`auth_oidc_oauth.go:558-569`），把默认 map 补两个字段：

```go
	completionResponse := map[string]any{
		"step":                      oauthPendingChoiceStep,
		"adoption_required":         true,
		"registration_required":     true, // 全新用户默认待开户；下方命中 compat 账号时改回 false
		"redirect":                  strings.TrimSpace(redirectTo),
		"email":                     suggestionEmail,
		"resolved_email":            canonicalEmail,
		"existing_account_email":    "",
		"existing_account_bindable": false,
		"create_account_allowed":    true,
		"force_email_on_signup":     forceEmailOnSignup,
		"choice_reason":             "third_party_signup",
	}
```

并在命中 compat 账号的分支（`:573-578` 内）追加一行，把标志翻回 false（该场景是"绑定已有账号"，非开户）：

```go
	if compatEmailUser != nil {
		completionResponse["email"] = strings.TrimSpace(compatEmailUser.Email)
		completionResponse["existing_account_email"] = strings.TrimSpace(compatEmailUser.Email)
		completionResponse["existing_account_bindable"] = true
		completionResponse["registration_required"] = false
		completionResponse["choice_reason"] = "compat_email_match"
	}
```

- [ ] **Step 5: 删除 tryOIDCVerifiedEmailFastPath 函数及其单测**

- 删除函数 `tryOIDCVerifiedEmailFastPath`（`auth_oidc_oauth.go:1229-1300`，含其上方注释 `:1229-1230`）。
- 删除测试函数：`TestTryOIDCVerifiedEmailFastPathCreatesUserAndIdentity`（`:958`）、`TestOIDCOAuthCallbackVerifiedEmailFastPathBackendModeBlocksBeforeUserCreation`（`:1074`）、`TestTryOIDCVerifiedEmailFastPathSkippedWhenInvitationCodeRequired`（`:1121`）、`TestTryOIDCVerifiedEmailFastPathSkippedWhenForceEmailEnabled`（`:1151`）。
- 若 `auth_oauth_pending_flow_test.go` 内也有引用 `tryOIDCVerifiedEmailFastPath` 的测试，一并删除。

验证无残留引用：

Run: `cd backend && grep -rn "tryOIDCVerifiedEmailFastPath\|readOAuthPromoCode(c)" internal/handler/`
Expected: 仅 `readOAuthPromoCode` 的定义（`auth_oauth_pending_flow.go:195`）与其它非快捷路径调用；无 `tryOIDCVerifiedEmailFastPath` 任何出现。

> 注：`readOAuthPromoCode` 仍被 `createOAuthPendingSession`（`:238`）用来把 promo 存入 session，删函数不影响。后端模式（backend mode）对新用户的拦截已保留在 `CompleteOIDCOAuthRegistration`（`auth_oidc_oauth.go:661` 的 `ensureBackendModeAllowsNewUserLogin`）。

- [ ] **Step 6: 运行整个 handler 包测试**

Run: `cd backend && go test -tags=unit ./internal/handler/ -run 'TestOIDCOAuthCallback' -v`
Expected: PASS（含新 registration pending 用例；确认无编译错误、无遗留 fastpath 引用）

- [ ] **Step 7: Commit**

```bash
cd /Users/yuebai/workspace/mintpop-api
git add backend/internal/handler/auth_oidc_oauth.go backend/internal/handler/auth_oidc_oauth_test.go backend/internal/handler/auth_oauth_pending_flow_test.go
git commit -m "feat(auth): 砍掉 OIDC 静默建号，全新用户落 registration_required 待开户

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: 后端 —— 新增 OIDC 无密码开户接口 `POST /oidc/onboard`

> **方案修订（2026-07-09）**：原"复用 `complete-registration` 建号"作废——调研证实它被 `legacyCompleteRegistrationSessionStatus`（pending_flow.go:423）的 `step != ""` short-circuit 掐死，且它用 synthetic 占位邮箱（`session.ResolvedEmail`）建号而非真实邮箱。真正"真实已验证邮箱无密码建号"的能力在被删的快捷路径里（调 `LoginOrRegisterVerifiedEmailOAuthWithSignupCodes`）。故**新增一个 OIDC 专用开户接口**，把该能力从 callback 挪到开户屏触发的端点，中间隔填码屏；不碰共用的 `complete-registration`/`legacy` 状态机，不影响 admin 前端与其它 provider。**本任务的完整、权威步骤见 `.superpowers/sdd/task-3-brief.md` 与 spec §4.3；下方旧 complete-registration 步骤全部作废、勿执行。**

~~`complete-registration` 从"邀请码无条件必填"改成"按开关条件必填"，并显式接收 `promo_code`。~~（作废，见上）

**Files:**
- Modify: `backend/internal/handler/auth_oidc_oauth.go`（`completeOIDCOAuthRequest` `:604-609`；调用处 `:690-698`）
- Modify: `backend/internal/handler/auth_oauth_pending_flow.go`（`ExchangePendingOAuthCompletion` 返回 payload 时带 `promo_code`，约 `:1979`）
- Test: `backend/internal/handler/auth_oidc_oauth_test.go`

**Interfaces:**
- Consumes: `h.authService.LoginOrRegisterOAuthWithTokenPairAndPromoCode(ctx, email, username, invitationCode, affCode, promoCode, "oidc")`（`auth_service.go:596`，内部已按 `IsInvitationCodeEnabled` 校验邀请码）；`pendingOAuthPromoCode(session)`（`auth_oauth_pending_flow.go:206`）。
- Produces: 开关关闭时空邀请码可建号；`promo_code` 优先取请求体、空则取 session。

- [ ] **Step 1: 新增"开关关闭时空邀请码可建号"测试（先失败）**

在 `auth_oidc_oauth_test.go` 追加。该用例先驱动一次全新用户回调建立 registration pending，再带空邀请码调 `complete-registration`：

```go
func TestCompleteOIDCOAuthRegistrationAllowsEmptyInviteWhenSwitchOff(t *testing.T) {
	cfg, cleanup := newOIDCTestProvider(t, oidcProviderFixture{
		Subject:           "oidc-noinvite-subject",
		PreferredUsername: "oidc_noinvite",
		DisplayName:       "OIDC NoInvite",
		Email:             "oidc-noinvite@example.com",
		EmailVerified:     true,
	})
	defer cleanup()

	// invitationEnabled=false：邀请码开关关闭
	handler, client := newOIDCOAuthHandlerAndClient(t, false, cfg)
	t.Cleanup(func() { _ = client.Close() })

	// 1) 回调：全新用户落 registration pending
	rec1 := httptest.NewRecorder()
	c1, _ := gin.CreateTestContext(rec1)
	req1 := httptest.NewRequest(http.MethodGet, "/api/v1/auth/oauth/oidc/callback?code=oidc-code&state=state-noinvite", nil)
	req1.AddCookie(encodedCookie(oidcOAuthStateCookieName, "state-noinvite"))
	req1.AddCookie(encodedCookie(oidcOAuthRedirectCookie, "/dashboard"))
	req1.AddCookie(encodedCookie(oidcOAuthVerifierCookie, "verifier-noinvite"))
	req1.AddCookie(encodedCookie(oidcOAuthNonceCookie, "nonce-oidc-noinvite-subject"))
	req1.AddCookie(encodedCookie(oidcOAuthIntentCookieName, oauthIntentLogin))
	req1.AddCookie(encodedCookie(oauthPendingBrowserCookieName, "browser-noinvite"))
	c1.Request = req1
	handler.OIDCOAuthCallback(c1)
	require.Equal(t, http.StatusFound, rec1.Code)

	sessCookie := findCookie(rec1.Result().Cookies(), oauthPendingSessionCookieName)
	require.NotNil(t, sessCookie)

	// 2) complete-registration：空邀请码
	rec2 := httptest.NewRecorder()
	c2, _ := gin.CreateTestContext(rec2)
	req2 := httptest.NewRequest(http.MethodPost, "/api/v1/auth/oauth/oidc/onboard",
		strings.NewReader(`{}`))
	req2.Header.Set("Content-Type", "application/json")
	req2.AddCookie(encodedCookie(oauthPendingSessionCookieName, decodeCookieValueForTest(t, sessCookie.Value)))
	req2.AddCookie(encodedCookie(oauthPendingBrowserCookieName, "browser-noinvite"))
	c2.Request = req2
	handler.CompleteOIDCOAuthRegistration(c2)

	require.Equal(t, http.StatusOK, rec2.Code)
	ctx := context.Background()
	user, err := client.User.Query().Where(dbuser.EmailEQ("oidc-noinvite@example.com")).Only(ctx)
	require.NoError(t, err)
	require.Equal(t, "oidc", user.SignupSource)
}
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && go test -tags=unit ./internal/handler/ -run TestCompleteOIDCOAuthRegistrationAllowsEmptyInviteWhenSwitchOff -v`
Expected: FAIL —— 现 `completeOIDCOAuthRequest.InvitationCode` 有 `binding:"required"`，空 body 在 `ShouldBindJSON` 处 400。

- [ ] **Step 3: 放宽请求体并接收 promo_code**

改 `auth_oidc_oauth.go:604-609`：

```go
type completeOIDCOAuthRequest struct {
	InvitationCode   string `json:"invitation_code,omitempty"` // 去掉 required：是否必填由后端按开关判定
	PromoCode        string `json:"promo_code,omitempty"`
	AffCode          string `json:"aff_code,omitempty"`
	AdoptDisplayName *bool  `json:"adopt_display_name,omitempty"`
	AdoptAvatar      *bool  `json:"adopt_avatar,omitempty"`
}
```

改调用处 `auth_oidc_oauth.go:690-698`，promo 优先请求体、回退 session：

```go
	promoCode := strings.TrimSpace(req.PromoCode)
	if promoCode == "" {
		promoCode = pendingOAuthPromoCode(session)
	}
	tokenPair, user, err := h.authService.LoginOrRegisterOAuthWithTokenPairAndPromoCode(
		c.Request.Context(),
		email,
		username,
		req.InvitationCode,
		req.AffCode,
		promoCode,
		"oidc",
	)
```

- [ ] **Step 4: 运行确认通过 + 邀请码开启用例回归**

Run: `cd backend && go test -tags=unit ./internal/handler/ -run 'TestCompleteOIDCOAuthRegistration' -v`
Expected: PASS —— 新用例过；既有 `TestCompleteOIDCOAuthRegistration*`（`:646` 起，含邀请码/adoption 场景）仍过。

> 若既有测试有断言"空 body 返回 400"，按新语义调整为"开关开启时空邀请码返回 `OAUTH_INVITATION_REQUIRED`"（该错误由 service `ErrOAuthInvitationRequired`，`auth_service.go:632` 抛出）。

- [ ] **Step 5: exchange payload 带 promo_code 供前端回填**

在 `ExchangePendingOAuthCompletion` 里，返回 registration pending payload 之前把 session 的 promo 注入 payload。定位 `:1990-1996` 的 `adoption_required` 提前返回分支，改为：

```go
	if !adoptionDecision.hasDecision() {
		adoptionRequired, _ := payload["adoption_required"].(bool)
		if adoptionRequired {
			if promo := pendingOAuthPromoCode(session); promo != "" {
				payload["promo_code"] = promo
			}
			response.Success(c, payload)
			return
		}
	}
```

- [ ] **Step 6: 运行 handler 包全量 unit 测试**

Run: `cd backend && mise run test-backend`
Expected: PASS（全绿）

- [ ] **Step 7: Commit**

```bash
cd /Users/yuebai/workspace/mintpop-api
git add backend/internal/handler/auth_oidc_oauth.go backend/internal/handler/auth_oauth_pending_flow.go backend/internal/handler/auth_oidc_oauth_test.go
git commit -m "feat(auth): complete-registration 邀请码按开关条件必填，显式接收优惠码

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: 前端 —— onboardOidcAccount API 与类型

**Files:**
- Modify: `user-portal/src/api/types.ts`（`OidcPendingExchangeResult` 增字段；新增 `OnboardOidcRequest`）
- Modify: `user-portal/src/api/auth.ts`（新增 `onboardOidcAccount`）

**Interfaces:**
- Produces: `onboardOidcAccount(payload: OnboardOidcRequest): Promise<OidcPendingExchangeResult>` → `POST /auth/oauth/oidc/onboard`，成功后把 `access_token`/`refresh_token` 写入 localStorage（复用 `exchangePendingOAuth` 的落地方式）。
- Consumes（供 Task 6/5）：`OidcPendingExchangeResult.registration_required?: boolean`、`.promo_code?: string`、`.redirect?: string`。

> 后端 `/oidc/onboard`（`OnboardOIDCOAuthAccount`）返回**裸** `{access_token, refresh_token, expires_in, token_type}`（无 `ApiResponse` 包装，对齐既有 OAuth token 端点风格）。前端拦截器仅对含 `code` 字段的响应解包（`client.ts:109`），裸返回被原样透传——故前端直接取 `response.data`，**不要**再 `.data.data` 解包。

- [ ] **Step 1: 扩展类型**

在 `types.ts` 的 `OidcPendingExchangeResult`（`:361-371`）增字段：

```ts
export interface OidcPendingExchangeResult {
  access_token?: string
  refresh_token?: string
  redirect?: string
  error?: string
  requires_2fa?: boolean
  temp_token?: string
  user_email_masked?: string
  auth_result?: string
  registration_required?: boolean   // 全新用户待开户信号
  promo_code?: string               // 预透传的优惠码，供开户屏回填
}
```

在 `types.ts` 追加请求类型：

```ts
export interface OnboardOidcRequest {
  invitation_code?: string
  promo_code?: string
  aff_code?: string
}
```

- [ ] **Step 2: 新增 API 函数**

参照 `exchangePendingOAuth`（`auth.ts:77-82`）的 token 落地方式，在 `auth.ts` 追加。注意后端此接口返回裸对象、拦截器原样透传，故 `response.data` 即结果，不再 `.data` 二次解包：

```ts
export async function onboardOidcAccount(
  payload: OnboardOidcRequest
): Promise<OidcPendingExchangeResult> {
  const { data } = await apiClient.post<OidcPendingExchangeResult>(
    '/auth/oauth/oidc/onboard',
    payload
  )
  if (data?.access_token) {
    localStorage.setItem(TOKEN_KEY, data.access_token)
    if (data.refresh_token) localStorage.setItem(REFRESH_KEY, data.refresh_token)
  }
  return data
}
```

> `apiClient`、`TOKEN_KEY`/`REFRESH_KEY` 来源 `@/api/client`；`OnboardOidcRequest`、`OidcPendingExchangeResult` 从 `./types` import——逐字对齐同文件 `exchangePendingOAuth` 的写法。

- [ ] **Step 3: 类型检查**

Run: `cd /Users/yuebai/workspace/mintpop-api && mise run test-user-portal`（含 vue-tsc）
Expected: 类型通过（此步仅确保新代码不破坏编译；无新测试）

- [ ] **Step 4: Commit**

```bash
cd /Users/yuebai/workspace/mintpop-api
git add user-portal/src/api/types.ts user-portal/src/api/auth.ts
git commit -m "feat(user-portal): 新增 onboardOidcAccount 接口与开户信号类型

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: 前端 —— 开户屏 OnboardingView

从 `RegisterView.vue` 裁剪出只含三个码 + 提交的开户屏（去掉邮箱/密码/验证码等 Logto 已接管的字段）。

**Files:**
- Create: `user-portal/src/views/OnboardingView.vue`
- Create: `user-portal/src/views/__tests__/OnboardingView.test.ts`
- Modify: `user-portal/src/i18n/locales/zh-CN/auth.ts`、`en/auth.ts`（若需新键）

**Interfaces:**
- Consumes: `getPublicSettings()`（`@/api/settings`）读 `invitation_code_enabled`/`promo_code_enabled`/`affiliate_enabled`；`validatePromoCode`/`validateInvitationCode`（`@/api/auth`）；`loadAffiliateReferralCode`/`pickAffiliateCode`/`clearAffiliateReferralCode`（`@/utils/affiliateReferral`）；`onboardOidcAccount`（Task 4）；`useAuthStore().fetchUser`。
- Produces: 挂载于路由 `/onboarding`（Task 7）的开户组件；提交成功后 `fetchUser()` + `router.replace(redirect || '/dashboard')`。

- [ ] **Step 1: 写组件测试（先失败）**

`user-portal/src/views/__tests__/OnboardingView.test.ts`：

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import OnboardingView from '../OnboardingView.vue'

vi.mock('@/api/settings', () => ({
  getPublicSettings: vi.fn().mockResolvedValue({
    invitation_code_enabled: true,
    promo_code_enabled: true,
    affiliate_enabled: true
  })
}))
const completeMock = vi.fn().mockResolvedValue({ access_token: 'tok', redirect: '/dashboard' })
vi.mock('@/api/auth', () => ({
  onboardOidcAccount: (...a: unknown[]) => completeMock(...a),
  validatePromoCode: vi.fn().mockResolvedValue({ valid: true, bonus_amount: 5 }),
  validateInvitationCode: vi.fn().mockResolvedValue({ valid: true })
}))
vi.mock('@/utils/affiliateReferral', () => ({
  loadAffiliateReferralCode: vi.fn().mockReturnValue('AFF123'),
  pickAffiliateCode: vi.fn(),
  storeAffiliateReferralCode: vi.fn(),
  clearAffiliateReferralCode: vi.fn()
}))

const router = createRouter({ history: createWebHistory(), routes: [
  { path: '/onboarding', component: OnboardingView },
  { path: '/dashboard', component: { template: '<div/>' } }
]})

describe('OnboardingView', () => {
  beforeEach(() => { setActivePinia(createPinia()); completeMock.mockClear() })

  it('开关开启时，邀请码为空则拦截提交', async () => {
    await router.push('/onboarding'); await router.isReady()
    const wrapper = mount(OnboardingView, { global: { plugins: [router] } })
    await flushPromises()
    await wrapper.find('[data-test="onboarding-submit"]').trigger('click')
    await flushPromises()
    expect(completeMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('邀请码')
  })

  it('填入邀请码后提交，携带 aff 回填值调用 onboardOidcAccount', async () => {
    await router.push('/onboarding'); await router.isReady()
    const wrapper = mount(OnboardingView, { global: { plugins: [router] } })
    await flushPromises()
    await wrapper.find('[data-test="onboarding-invitation"]').setValue('INV-OK')
    await flushPromises()
    await wrapper.find('[data-test="onboarding-submit"]').trigger('click')
    await flushPromises()
    expect(completeMock).toHaveBeenCalledWith(
      expect.objectContaining({ invitation_code: 'INV-OK', aff_code: 'AFF123' })
    )
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `cd /Users/yuebai/workspace/mintpop-api && mise run test-user-portal -- src/views/__tests__/OnboardingView.test.ts`
Expected: FAIL —— `OnboardingView.vue` 不存在。

> 若 `mise run test-user-portal` 不支持透传单文件参数，改用项目既有前端测试命令跑该文件（查 `mise.toml` 的 `test-user-portal` 定义确认 `--` 透传方式）。

- [ ] **Step 3: 实现 OnboardingView.vue**

新建 `user-portal/src/views/OnboardingView.vue`。以 `RegisterView.vue` 为蓝本，**保留**：三码字段与校验（`invitation`/`promo`/`affCode` 及 `promoValidating/promoBonus/invValid` 等，逻辑照搬 `RegisterView.vue:30-32,57-70,107-185`）、aff 回填（`RegisterView.vue:72-98`）、settings 本地加载（`getPublicSettings()`）、邀请码必填提交校验（`RegisterView.vue:236-253`）。**删除**：email/password/username/verifyCode/turnstile 字段与相关 UI。提交改为：

```vue
<script setup lang="ts">
// ... 三码 ref、settings、校验逻辑照搬 RegisterView（去掉邮箱/密码部分）
import { onboardOidcAccount } from '@/api/auth'
import { loadAffiliateReferralCode, clearAffiliateReferralCode } from '@/utils/affiliateReferral'
import { useAuthStore } from '@/stores/auth'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

async function onSubmit() {
  error.value = ''
  // 邀请码必填校验（照搬 RegisterView:236-253）
  if (settings.value?.invitation_code_enabled === true) {
    const code = invitation.value.trim()
    if (!code) { error.value = t('auth.errInvitationRequired'); return }
    if (!invValid.value && !invInvalid.value) { await runInvitationValidation(code) }
    if (invInvalid.value) { error.value = t('auth.errInvitationInvalid'); return }
  }
  submitting.value = true
  try {
    const aff = affCode.value.trim() || loadAffiliateReferralCode()
    const res = await onboardOidcAccount({
      invitation_code: invitation.value.trim() || undefined,
      promo_code: promo.value.trim() || undefined,
      aff_code: aff || undefined
    })
    clearAffiliateReferralCode()
    await authStore.fetchUser()
    const redirect = (route.query.redirect as string) || res?.redirect || '/dashboard'
    router.replace(redirect)
  } catch (e) {
    error.value = errMessage(e, t('auth.onboardingFailed'))
  } finally {
    submitting.value = false
  }
}
</script>
```

模板给三个输入框加测试锚点属性：邀请码输入 `data-test="onboarding-invitation"`（`v-model="invitation"`，`v-if="settings?.invitation_code_enabled"`）、promo 输入 `v-model="promo"`、aff 输入 `v-model="affCode"`、提交按钮 `data-test="onboarding-submit"`。用 `AuthShell` 包壳与 `RegisterView` 一致。

- [ ] **Step 4: 运行测试确认通过**

Run: `cd /Users/yuebai/workspace/mintpop-api && mise run test-user-portal -- src/views/__tests__/OnboardingView.test.ts`
Expected: PASS

- [ ] **Step 5: 补 i18n 键**

若引用了新键（`auth.onboardingFailed`、开户屏标题/说明等），在 `src/i18n/locales/zh-CN/auth.ts` 与 `en/auth.ts` 各补一条（中文如 `onboardingFailed: '开户失败，请重试'`）。已有 `errInvitationRequired`/`errInvitationInvalid` 复用不新增。

- [ ] **Step 6: 删除被取代的死代码 RegisterView**

`OnboardingView` 取代迁 Logto 后已废弃的 `RegisterView.vue`（三码逻辑此后只存 OnboardingView 一份，不构成重复）。删除：
- `user-portal/src/views/RegisterView.vue`
- `user-portal/src/views/__tests__/RegisterView-invitation.test.ts`
- `user-portal/src/views/__tests__/RegisterView-aff.test.ts`（若存在其它 `RegisterView-*.test.ts` 一并删）

保留 `router/index.ts` 的 `/register → /login` redirect（`:15`，不引用组件）。清理 `beforeEach` 里对不存在的 `'Register'` 路由名的死判断（`router/index.ts:114`）。

验证无残留引用：

Run: `cd /Users/yuebai/workspace/mintpop-api && grep -rn "RegisterView" user-portal/src/`
Expected: 无任何命中（组件与测试均已删除，路由用 redirect 不 import 组件）。

Run: `cd /Users/yuebai/workspace/mintpop-api && mise run test-user-portal`
Expected: PASS（删测试后全套仍绿；vue-tsc 无悬空 import）

- [ ] **Step 7: Commit**

```bash
cd /Users/yuebai/workspace/mintpop-api
git add -A
git commit -m "feat(user-portal): 新增 OIDC 开户屏 OnboardingView 取代废弃 RegisterView

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: 前端 —— 回调页识别 registration_required 跳开户屏

**Files:**
- Modify: `user-portal/src/views/OidcCallbackView.vue`（`onMounted` exchange 分支，`:49-67`）
- Test: `user-portal/src/views/__tests__/OidcCallbackView.test.ts`（新增或对齐）

**Interfaces:**
- Consumes: `exchangePendingOAuth()` 返回的 `OidcPendingExchangeResult.registration_required`（Task 4）。
- Produces: 收到 `registration_required === true` 时 `router.replace({ path: '/onboarding', query: { redirect } })`，不落 GUIDE 态。

- [ ] **Step 1: 写测试（先失败）**

在 `OidcCallbackView.test.ts`（无则新建）加：mock `exchangePendingOAuth` 返回 `{ registration_required: true, redirect: '/dashboard' }`，断言路由跳到 `/onboarding`。

```ts
it('exchange 返回 registration_required 时跳转开户屏', async () => {
  exchangeMock.mockResolvedValueOnce({ registration_required: true, redirect: '/dashboard' })
  const replace = vi.fn()
  // ... 挂载 OidcCallbackView，注入 router.replace = replace（沿用该测试文件既有挂载方式）
  await flushPromises()
  expect(replace).toHaveBeenCalledWith(
    expect.objectContaining({ path: '/onboarding' })
  )
})
```

> 该测试文件的 mock/挂载脚手架以仓库现有前端测试（如 `RegisterView-invitation.test.ts`）为模板对齐。

- [ ] **Step 2: 运行确认失败**

Run: `cd /Users/yuebai/workspace/mintpop-api && mise run test-user-portal -- src/views/__tests__/OidcCallbackView.test.ts`
Expected: FAIL —— 现状 `registration_required` 未被读取，会落到 `state.value = 'GUIDE'`。

- [ ] **Step 3: 插入分支**

在 `OidcCallbackView.vue` exchange 结果处理里，`if (resp.access_token)` 分支（`:57`）**之前**插入：

```ts
    if (resp.registration_required) {
      const redirect = resp.redirect || '/dashboard'
      router.replace({ path: '/onboarding', query: { redirect } })
      return
    }
```

- [ ] **Step 4: 运行确认通过**

Run: `cd /Users/yuebai/workspace/mintpop-api && mise run test-user-portal -- src/views/__tests__/OidcCallbackView.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/yuebai/workspace/mintpop-api
git add user-portal/src/views/OidcCallbackView.vue user-portal/src/views/__tests__/OidcCallbackView.test.ts
git commit -m "feat(user-portal): OIDC 回调识别 registration_required 跳开户屏

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: 前端 —— /onboarding 路由

**Files:**
- Modify: `user-portal/src/router/index.ts`

**Interfaces:**
- Produces: 路由记录 `{ path: '/onboarding', name: 'Onboarding', component: () => import('@/views/OnboardingView.vue'), meta: { requiresAuth: false } }`。

- [ ] **Step 1: 加路由记录**

在 `router/index.ts` 的 `/auth/oidc/callback`（`:92-98`）之后、通配 `:99` 之前插入：

```ts
  {
    path: '/onboarding',
    name: 'Onboarding',
    component: () => import('@/views/OnboardingView.vue'),
    meta: { requiresAuth: false, title: 'nav.onboarding' }
  },
```

`requiresAuth: false`：用户此时尚未持 token（开户后才发 token），守卫不能拦。若 `nav.onboarding` i18n 键不存在则在 `zh-CN`/`en` 的 `nav` 里各补一条（如 `onboarding: '完善账号'`）。

- [ ] **Step 2: 构建校验路由与组件解析正常**

Run: `cd /Users/yuebai/workspace/mintpop-api && mise run test-user-portal`
Expected: PASS（vue-tsc + 全部 vitest 绿）

- [ ] **Step 3: Commit**

```bash
cd /Users/yuebai/workspace/mintpop-api
git add user-portal/src/router/index.ts user-portal/src/i18n/locales/
git commit -m "feat(user-portal): 新增 /onboarding 开户屏路由

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: 端到端手动核验 + 全量门禁

**Files:** 无（验证任务）

- [ ] **Step 1: 后端全量门禁**

Run: `cd /Users/yuebai/workspace/mintpop-api && mise run lint-backend && mise run test-backend`
Expected: PASS

- [ ] **Step 2: 前端全量门禁**

Run: `cd /Users/yuebai/workspace/mintpop-api && mise run lint-user-portal && mise run test-user-portal`
Expected: PASS

- [ ] **Step 3: 用 verify skill 驱动真实开户流程**

用 `/verify` 或本地起服务（`cd backend && go run ./cmd/server/` + `mise run run-user-portal`）走查三条口径：
1. 已有 OIDC 身份 → 直接进 dashboard（不经开户屏）。
2. 同邮箱存量账号 + Logto 邮箱已验证 → 自动绑定直接登录。
3. 全新用户 → exchange 后跳 `/onboarding`，开关开时邀请码必填、Promo/Aff 选填并回填，提交后进 dashboard。

记录实际观察（不是"应该"）。若无本地 Logto/DB 环境，按 `mintpop-auth` 的 rollout.md 清单顺延到装 Docker 后执行，并在此标注"顺延"。

- [ ] **Step 4: 汇总提交（如有 lint 修复）**

```bash
cd /Users/yuebai/workspace/mintpop-api
git add -A && git commit -m "chore(auth): OIDC 开户分离门禁修复与收尾" || echo "无待提交改动"
```

---

## 附：与 spec 的覆盖对照

- spec §3 判断口径（修订后两档）→ Task 2（③ 未注册落开户屏；① 命中登录、② compat choice 均保持现状不改）。
- spec §4.1 砍静默建号 → Task 2。
- spec §4.2 自动绑定 → **作废，不实现**（Task 1 作废；存量已迁移预建身份，compat choice 兜底零改动）。
- spec §4.3 complete-registration 泛化 → Task 3。
- spec §5 前端流程 → Task 4/5/6/7。
- spec §6 必填矩阵 → Task 5（沿用 RegisterView 语义）。
- spec §7 测试 → 各 Task 内 TDD + Task 8 端到端。
- spec §8 非目标 → 未新建独立 onboarding 状态机（复用 pending + complete-registration）；未动码底层模型；未处理未验证邮箱自动并号（Task 1 Step 5 保留 choice 密码绑定）。
