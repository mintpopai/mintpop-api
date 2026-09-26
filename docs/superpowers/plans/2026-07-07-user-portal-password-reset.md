# user-portal 忘记密码/重置密码 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 user-portal 补全忘记密码/重置密码功能（功能对齐 frontend、视觉走门户风格），并抽出 AuthShell 共享认证页骨架消除 Login/Register 的布局重复。

**Architecture:** 后端零改动（`POST /auth/forgot-password`、`POST /auth/reset-password` 已具备）。门户侧：client.ts 透传响应体的字符串错误码 `reason` → 新增 API 函数与类型 → 新增双语文案 → 新建 `AuthShell.vue` 并重构 Login/Register → 新建 ForgotPasswordView/ResetPasswordView 两页 + 路由 + 登录页入口。

**Tech Stack:** Vue 3 `<script setup>` + TS、vue-router、pinia、vue-i18n、Tailwind v4（主题 token 见 `user-portal/src/styles/theme.css`）、vitest + @vue/test-utils。

**Spec:** `docs/superpowers/specs/2026-07-07-user-portal-password-reset-design.md`

## Global Constraints

- 后端与 frontend 目录**零改动**；只动 `user-portal/`。
- 所有注释、i18n zh-CN 文案用简体中文；en-US 文件用英文；git 提交信息用中文（约定式提交），提交信息尾行加 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。
- i18n 新 key 必须 zh-CN / en-US 两边同步（`src/i18n/__tests__/messages-align.test.ts` 强制对齐，跑一次即验证）。
- 命令统一走 mise：全量门禁 `mise run lint-user-portal`、`mise run test-user-portal`；单文件测试属临时调试，用 `cd user-portal && pnpm exec vitest run <file>`。
- lint 若报 Vue 模板格式问题，先 `cd user-portal && pnpm exec eslint --fix src` 再复检。
- 每个任务一次 commit（只 add 本任务涉及的文件）。

## 后端契约速查（不改，只消费）

- `POST /api/v1/auth/forgot-password`，body `{ email: string, turnstile_token?: string }`。站点开启 Turnstile 时缺 token 即拒绝；防枚举：邮箱存在与否都返回成功。
- `POST /api/v1/auth/reset-password`，body `{ email: string, token: string, new_password: string }`（new_password ≥6 位）。token 无效/过期时响应体 `reason` 字段为 `"INVALID_RESET_TOKEN"`。
- 统一响应体 `{ code: int, message: string, reason?: string, data }`；HTTP 状态码 4xx/5xx 走 axios error 路径。
- 邮件重置链接形如 `<frontend_url>/reset-password?email=<url编码>&token=<url编码>`（部署上 `frontend_url` 指向门户域名）。

---

### Task 1: client.ts 透传字符串错误码 `reason`

门户 `client.ts` 目前 reject 出 `{ status, code, message }`，把响应体里的字符串错误码 `reason`（如 `INVALID_RESET_TOKEN`）丢掉了。本任务补透传。

**Files:**
- Modify: `user-portal/src/api/types.ts`（`ApiResponse` 加 `reason?`；`ApiError` 加 `reason?`）
- Modify: `user-portal/src/api/client.ts`（两处 reject 补 `reason`）
- Test: `user-portal/src/api/__tests__/client.test.ts`

**Interfaces:**
- Produces: reject 对象新增可选字段 `reason?: string`；`ApiError` 类型含 `reason?: string`（Task 7 的 ResetPasswordView 依赖它识别 `INVALID_RESET_TOKEN`）。

- [ ] **Step 1: 写失败测试**

在 `user-portal/src/api/__tests__/client.test.ts` 的「统一返回体解包」describe 块末尾追加（文件已有 `ok()` 帮助函数与 `AxiosError`/`AxiosResponse` 导入，直接复用）：

```ts
  it('code!==0 时同时透传字符串错误码 reason（HTTP 200）', async () => {
    apiClient.defaults.adapter = async (config) =>
      ok(config, { code: 400, message: 'invalid token', reason: 'INVALID_RESET_TOKEN', data: null })
    await expect(apiClient.post('/auth/reset-password', {})).rejects.toMatchObject({
      code: 400,
      reason: 'INVALID_RESET_TOKEN',
      message: 'invalid token'
    })
  })

  it('HTTP 4xx 时透传响应体的字符串错误码 reason', async () => {
    apiClient.defaults.adapter = async (config) => {
      const response = {
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config,
        data: { code: 400, message: 'invalid or expired password reset token', reason: 'INVALID_RESET_TOKEN', data: null }
      } as AxiosResponse
      throw new AxiosError('Request failed with status code 400', 'ERR_BAD_REQUEST', config, {}, response)
    }
    await expect(apiClient.post('/auth/reset-password', {})).rejects.toMatchObject({
      status: 400,
      reason: 'INVALID_RESET_TOKEN'
    })
  })
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd user-portal && pnpm exec vitest run src/api/__tests__/client.test.ts`
Expected: 新增 2 个用例 FAIL（reject 对象上没有 `reason` 字段）。

- [ ] **Step 3: 实现**

`user-portal/src/api/types.ts`——`ApiResponse` 与 `ApiError` 各加一行：

```ts
export interface ApiResponse<T> {
  code: number
  message?: string
  /** 字符串错误码（后端 infraerrors 的 Reason，如 INVALID_RESET_TOKEN），供页面识别语义错误 */
  reason?: string
  data: T
}

/** 调用方收到的标准化错误 */
export interface ApiError {
  status?: number
  code?: number | string
  /** 字符串错误码（同 ApiResponse.reason），语义分支优先用它、不要解析 message 文本 */
  reason?: string
  message: string
}
```

`user-portal/src/api/client.ts`——响应拦截器业务失败分支（`body.code !== 0`）：

```ts
        return Promise.reject({
          status: response.status,
          code: body.code,
          reason: body.reason,
          message: body.message || 'Unknown error'
        })
```

同文件底部 `normalize()`：

```ts
  return {
    status: error.response?.status,
    code: data?.code ?? error.code,
    reason: data?.reason,
    message: data?.message || (error.response ? error.message : '') || fallback
  }
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd user-portal && pnpm exec vitest run src/api/__tests__/client.test.ts`
Expected: 全部 PASS（含既有用例）。

- [ ] **Step 5: Commit**

```bash
git add user-portal/src/api/types.ts user-portal/src/api/client.ts user-portal/src/api/__tests__/client.test.ts
git commit -m "feat(user-portal): apiClient 透传后端字符串错误码 reason

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: 忘记/重置密码的 API 类型与函数

**Files:**
- Modify: `user-portal/src/api/types.ts`（`RegisterRequest` 之后追加两个请求类型）
- Modify: `user-portal/src/api/auth.ts`（`sendVerifyCode` 之后追加两个函数）

**Interfaces:**
- Consumes: Task 1 的 `ApiError.reason`（间接，本任务不直接用）。
- Produces: `forgotPassword(payload: ForgotPasswordRequest): Promise<void>`、`resetPassword(payload: ResetPasswordRequest): Promise<void>`（Task 6/7 的视图与测试 mock 依赖这两个导出名）。

- [ ] **Step 1: types.ts 追加类型**

在 `user-portal/src/api/types.ts` 的 `RegisterRequest` 接口之后追加：

```ts
/** 忘记密码：请求发送重置邮件 */
export interface ForgotPasswordRequest {
  email: string
  /** Cloudflare Turnstile token（站点开启人机验证时后端强制校验，缺失即拒绝） */
  turnstile_token?: string
}

/** 凭邮件里的一次性 token 重置密码 */
export interface ResetPasswordRequest {
  email: string
  token: string
  new_password: string
}
```

- [ ] **Step 2: auth.ts 追加函数**

在 `user-portal/src/api/auth.ts` 的 `sendVerifyCode` 之后追加（并把 `ForgotPasswordRequest, ResetPasswordRequest` 加进顶部的 `import type` 列表）：

```ts
/** 忘记密码：请求发送重置邮件（后端防枚举——无论邮箱是否注册都返回成功） */
export async function forgotPassword(payload: ForgotPasswordRequest): Promise<void> {
  await apiClient.post('/auth/forgot-password', payload)
}

/** 凭邮件链接里的一次性 token 重置密码（成功后后端吊销全部旧会话，须重新登录） */
export async function resetPassword(payload: ResetPasswordRequest): Promise<void> {
  await apiClient.post('/auth/reset-password', payload)
}
```

- [ ] **Step 3: 类型检查通过**

Run: `cd user-portal && pnpm exec vue-tsc -b`
Expected: 0 错误。

- [ ] **Step 4: Commit**

```bash
git add user-portal/src/api/types.ts user-portal/src/api/auth.ts
git commit -m "feat(user-portal): 新增 forgotPassword/resetPassword API 封装

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: i18n 双语文案

**Files:**
- Modify: `user-portal/src/i18n/locales/zh-CN/auth.ts`
- Modify: `user-portal/src/i18n/locales/en-US/auth.ts`
- Modify: `user-portal/src/i18n/locales/zh-CN/nav.ts`
- Modify: `user-portal/src/i18n/locales/en-US/nav.ts`
- Test: 现有 `user-portal/src/i18n/__tests__/messages-align.test.ts`（不新写）

**Interfaces:**
- Produces: `auth.*`/`nav.*` 下列全部 key（Task 4–7 的模板逐字引用）。

- [ ] **Step 1: zh-CN/auth.ts 追加**

在 `user-portal/src/i18n/locales/zh-CN/auth.ts` 对象末尾（`errRegisterFailed` 之后）追加：

```ts
  // —— 忘记/重置密码页左侧品牌区（两页共用） ——
  forgotKicker: '账号找回',
  forgotHeadlinePre: '几步之内，',
  forgotHeadlineMark: '重新拿回',
  forgotHeadlineEnd: '访问权限。',
  forgotBrandDesc: '输入注册邮箱获取重置链接，设置新密码后即可继续使用你的密钥与额度。',
  // —— 忘记密码页 ——
  forgotEntry: '忘记密码？',
  forgotTitle: '重置密码',
  forgotSubtitle: '输入注册邮箱，我们将发送密码重置链接。',
  sendResetLink: '发送重置链接',
  sendingResetLink: '发送中…',
  resetEmailSent: '重置邮件已发送',
  resetEmailSentHint: '如果该邮箱已注册，几分钟内会收到一封带重置链接的邮件，请留意收件箱与垃圾邮件。',
  backToLogin: '返回登录',
  rememberedPassword: '想起密码了？',
  errEmailInvalid: '请输入有效的邮箱地址',
  errSendResetFailed: '发送失败，请稍后重试',
  // —— 重置密码页 ——
  resetTitle: '设置新密码',
  resetSubtitle: '请为你的账户设置一个新密码。',
  newPasswordLabel: '新密码',
  resetPasswordBtn: '重置密码',
  resettingPassword: '重置中…',
  resetSuccess: '密码重置成功',
  resetSuccessHint: '原有登录已全部失效，请使用新密码重新登录。',
  goSignIn: '去登录',
  invalidResetLink: '重置链接无效',
  invalidResetLinkHint: '链接缺少必要参数，可能已过期或被截断，请重新申请一封重置邮件。',
  requestNewLink: '重新申请重置链接',
  errTokenInvalid: '重置链接已失效或过期，请重新申请',
  errResetFailed: '重置失败，请稍后重试',
  showPassword: '显示密码',
  hidePassword: '隐藏密码'
```

（注意给原末尾的 `errRegisterFailed: …` 行补逗号。）

- [ ] **Step 2: en-US/auth.ts 追加**

在 `user-portal/src/i18n/locales/en-US/auth.ts` 对象末尾追加（同样给原末行补逗号）：

```ts
  // —— Forgot/reset password left brand panel (shared by both pages) ——
  forgotKicker: 'Account recovery',
  forgotHeadlinePre: 'Regain ',
  forgotHeadlineMark: 'access',
  forgotHeadlineEnd: ' in just a few steps.',
  forgotBrandDesc: 'Enter your registered email to get a reset link, set a new password, and keep using your keys and credit.',
  // —— Forgot password page ——
  forgotEntry: 'Forgot password?',
  forgotTitle: 'Reset your password',
  forgotSubtitle: "Enter your registered email and we'll send you a reset link.",
  sendResetLink: 'Send reset link',
  sendingResetLink: 'Sending…',
  resetEmailSent: 'Reset email sent',
  resetEmailSentHint: 'If this email is registered, a message with a reset link will arrive within minutes. Check your inbox and spam folder.',
  backToLogin: 'Back to sign in',
  rememberedPassword: 'Remembered your password?',
  errEmailInvalid: 'Please enter a valid email address',
  errSendResetFailed: 'Failed to send. Please try again later.',
  // —— Reset password page ——
  resetTitle: 'Set a new password',
  resetSubtitle: 'Choose a new password for your account.',
  newPasswordLabel: 'New password',
  resetPasswordBtn: 'Reset password',
  resettingPassword: 'Resetting…',
  resetSuccess: 'Password reset successfully',
  resetSuccessHint: 'All previous sessions have been signed out. Sign in with your new password.',
  goSignIn: 'Go to sign in',
  invalidResetLink: 'Invalid reset link',
  invalidResetLinkHint: 'The link is missing required parameters — it may have expired or been truncated. Please request a new reset email.',
  requestNewLink: 'Request a new reset link',
  errTokenInvalid: 'The reset link is invalid or has expired. Please request a new one.',
  errResetFailed: 'Reset failed. Please try again later.',
  showPassword: 'Show password',
  hidePassword: 'Hide password'
```

- [ ] **Step 3: nav.ts 双语追加**

`zh-CN/nav.ts` 的 `paymentResult: '支付结果'` 之后追加：

```ts
  forgotPassword: '忘记密码',
  resetPassword: '重置密码'
```

`en-US/nav.ts` 的 `paymentResult: 'Payment Result'` 之后追加：

```ts
  forgotPassword: 'Forgot Password',
  resetPassword: 'Reset Password'
```

- [ ] **Step 4: 跑对齐测试确认双语 key 一致**

Run: `cd user-portal && pnpm exec vitest run src/i18n/__tests__/messages-align.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add user-portal/src/i18n/locales/zh-CN/auth.ts user-portal/src/i18n/locales/en-US/auth.ts user-portal/src/i18n/locales/zh-CN/nav.ts user-portal/src/i18n/locales/en-US/nav.ts
git commit -m "feat(user-portal): 新增忘记/重置密码双语文案

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: AuthShell 共享骨架组件 + LoginView 重构

**Files:**
- Create: `user-portal/src/components/auth/AuthShell.vue`
- Modify: `user-portal/src/views/LoginView.vue`

**Interfaces:**
- Produces: `AuthShell` 组件——props `kicker/headlinePre/headlineMark/headlineEnd/desc`（均为已翻译字符串）；默认插槽 = 右侧表单区内容；`brand-footer` 具名插槽 = 左栏底部（缺省渲染模型/能力标签行）；全局（非 scoped）提供 `.fld`/`.ico` 输入框样式。Task 5/6/7 都消费它。

- [ ] **Step 1: 新建 AuthShell.vue**

完整内容（左栏结构与样式逐字取自现有 LoginView，`.fld` 样式取自 LoginView、`.ico` 取自 RegisterView）：

```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { IS_APPLICATION_MODE } from '@/config/portal'

// 四个认证页（登录/注册/忘记密码/重置密码）共用的双栏骨架：
// 左侧品牌区（点阵晕染 + 字标 + 编辑式文案 + 底部插槽），右侧表单插槽（含移动端字标）。
defineProps<{
  /** 左栏 kicker 小标（已翻译） */
  kicker: string
  /** 左栏衬线大标题三段：前缀 + 高亮词（薄荷绿下划线标记）+ 后缀 */
  headlinePre: string
  headlineMark: string
  headlineEnd: string
  /** 左栏描述（已翻译） */
  desc: string
}>()

const { t } = useI18n()

// brand-footer 插槽缺省内容：模型/能力标签行，随分发模式切换（注册页用「三步骤」覆盖）
const brandTags = IS_APPLICATION_MODE ? ['Text', 'Vision', 'Voice'] : ['Claude', 'GPT', 'Gemini']
</script>

<template>
  <div class="flex min-h-screen font-sans">
    <!-- ============ 左侧品牌区 ============ -->
    <div
      class="relative hidden w-[46%] flex-none flex-col justify-between overflow-hidden border-r border-border bg-muted px-14 py-[54px] lg:flex"
    >
      <!-- warhol 点阵晕染 -->
      <div
        class="pointer-events-none absolute right-[-90px] top-[-70px] h-[340px] w-[340px] opacity-50"
        style="background: linear-gradient(150deg, #0e9e72 0%, #14c28a 45%, rgba(20, 194, 138, 0) 92%); -webkit-mask-image: radial-gradient(#000 2px, transparent 2.2px); mask-image: radial-gradient(#000 2px, transparent 2.2px); -webkit-mask-size: 18px 18px; mask-size: 18px 18px;"
      />
      <div
        class="pointer-events-none absolute -bottom-20 left-[-70px] h-[260px] w-[260px] opacity-[0.06]"
        style="background: radial-gradient(#1a1a1a 1.7px, transparent 1.9px); background-size: 15px 15px;"
      />

      <!-- 字标 -->
      <div class="relative flex items-center">
        <img
          src="/wordmark-dark.png"
          alt="MintPop API"
          class="block h-8 w-auto dark:hidden"
        >
        <img
          src="/wordmark-light.png"
          alt="MintPop API"
          class="hidden h-8 w-auto dark:block"
        >
      </div>

      <!-- 编辑式标语 -->
      <div class="relative max-w-[420px]">
        <div class="mb-5 text-xs font-semibold uppercase tracking-[0.14em] text-pos">
          {{ kicker }}
        </div>
        <h2 class="font-serif text-[42px] font-medium leading-[1.12] tracking-tight text-text">
          {{ headlinePre }}<span class="relative whitespace-nowrap">{{ headlineMark }}<span
            class="absolute inset-x-0 bottom-0.5 -z-10 h-[9px] rounded-xs bg-accent opacity-[0.28]"
          /></span>{{ headlineEnd }}
        </h2>
        <p class="mt-5 text-[15px] leading-relaxed text-text3">
          {{ desc }}
        </p>
      </div>

      <!-- 左栏底部：缺省渲染模型/能力标签，页面可用 #brand-footer 覆盖 -->
      <div class="relative">
        <slot name="brand-footer">
          <div class="flex flex-wrap gap-2.5">
            <span
              v-for="tag in brandTags"
              :key="tag"
              class="rounded-full border border-border bg-card px-3.5 py-[7px] text-xs font-medium text-text2"
            >● {{ tag }}</span>
            <span class="rounded-full border border-dashed border-border2 px-3.5 py-[7px] text-xs font-medium text-faint">{{ t('auth.moreComing') }}</span>
          </div>
        </slot>
      </div>
    </div>

    <!-- ============ 右侧表单 ============ -->
    <div class="flex min-w-0 flex-1 items-center justify-center bg-bg px-10 py-12">
      <div class="w-full max-w-[392px]">
        <!-- 移动端字标 -->
        <div class="mb-8 flex items-center lg:hidden">
          <img
            src="/wordmark-dark.png"
            alt="MintPop API"
            class="block h-7 w-auto dark:hidden"
          >
          <img
            src="/wordmark-light.png"
            alt="MintPop API"
            class="hidden h-7 w-auto dark:block"
          >
        </div>
        <slot />
      </div>
    </div>
  </div>
</template>

<style>
/* 认证页共享的输入框样式（供各页插槽内容使用，须全局生效，故不加 scoped） */
.fld {
  width: 100%;
  font: 400 15px 'Space Grotesk', sans-serif;
  color: var(--text);
  background: var(--card);
  border: 1.5px solid var(--border2);
  border-radius: 12px;
  padding: 14px 16px 14px 44px;
  outline: none;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}
.fld::placeholder {
  color: var(--faint);
}
.fld:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(20, 194, 138, 0.13);
}
.ico {
  position: absolute;
  left: 15px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--faint);
  pointer-events: none;
}
</style>
```

- [ ] **Step 2: 重构 LoginView.vue**

script 部分三处改动：

1. imports 增加：`import AuthShell from '@/components/auth/AuthShell.vue'`
2. 删除 `brandTags` 常量及其上方「模型/能力标签」注释行（标签渲染已收进 AuthShell 缺省插槽）。`IS_APPLICATION`/`brandDescKey` 保留（desc 仍按分发模式切换）。
3. 逻辑其余不动。

template 部分：把最外层 `<div class="flex min-h-screen font-sans">` 到 `<div class="w-full max-w-[392px]">`（含左侧品牌区整块、右侧包裹层、移动端字标块）替换为 AuthShell 开标签；对应的三层闭合 `</div>` 换成 `</AuthShell>`：

```vue
<template>
  <AuthShell
    :kicker="t('auth.loginKicker')"
    :headline-pre="t('auth.loginHeadlinePre')"
    :headline-mark="t('auth.loginHeadlineMark')"
    :headline-end="t('auth.loginHeadlineEnd')"
    :desc="t(brandDescKey)"
  >
    <div class="mb-8">
      <h1 class="mb-2 font-serif text-4xl font-medium tracking-tight text-text">
        {{ step === 'TOTP' ? t('auth.totpTitle') : t('auth.welcomeBack') }}
      </h1>
      <p class="text-sm text-subtle">
        {{ step === 'TOTP' ? t('auth.totpHint') : t('auth.loginSubtitle') }}
      </p>
    </div>

    <!-- 两个 form（TOTP / 邮箱密码）与底部「免费注册」段落：原样保留，不改一字 -->
    …（原 `<form v-if="step === 'TOTP'">…</form>`、`<form v-else>…</form>`、`<p class="mt-[30px] …">…</p>` 三块逐字搬入，此处不重复）…
  </AuthShell>
</template>
```

具体搬移边界（对照重构前文件行号）：删除 116–195 行（外层 div、左侧品牌区、右侧包裹两层 div、移动端字标）换成上面的 `<AuthShell …>` 开标签 + 标题块；197–371 行（两个 form + 底部注册引导 `<p>`）原样保留；372–374 行的三个闭合 `</div>` 换成 `</AuthShell>`。注意原 188–195 行的标题块已由上面代码接管，勿重复。

最后删除文件底部整个 `<style scoped>` 块（`.fld` 系列样式已上收到 AuthShell）。

- [ ] **Step 3: 类型检查 + 全量测试**

Run: `cd user-portal && pnpm exec vue-tsc -b && pnpm exec vitest run`
Expected: 0 类型错误、全部测试 PASS。

- [ ] **Step 4: 手动冒烟（可选但推荐）**

Run: `mise run run-user-portal`（端口 5174），浏览器打开 `http://localhost:5174/login`。
Expected: 登录页视觉与重构前一致（左栏品牌区、标签行、移动端窄屏字标、输入框样式）。确认后 Ctrl-C 退出。

- [ ] **Step 5: Commit**

```bash
git add user-portal/src/components/auth/AuthShell.vue user-portal/src/views/LoginView.vue
git commit -m "refactor(user-portal): 抽出 AuthShell 认证页骨架，LoginView 迁入

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: RegisterView 重构到 AuthShell

**Files:**
- Modify: `user-portal/src/views/RegisterView.vue`

**Interfaces:**
- Consumes: Task 4 的 `AuthShell`（props + `#brand-footer` 插槽）。

- [ ] **Step 1: 重构 RegisterView.vue**

script 增加 `import AuthShell from '@/components/auth/AuthShell.vue'`。

template：把外层 `<div class="flex min-h-screen font-sans">`、整个左侧品牌区（点阵、字标、编辑式标语、三步骤）、右侧两层包裹 div 替换为：

```vue
<template>
  <AuthShell
    :kicker="t('auth.registerKicker')"
    :headline-pre="t('auth.registerHeadlinePre')"
    :headline-mark="t('auth.registerHeadlineMark')"
    :headline-end="t('auth.registerHeadlineEnd')"
    :desc="t('auth.registerBrandDesc')"
  >
    <template #brand-footer>
      <!-- 三步骤（覆盖缺省的模型标签行） -->
      <div class="flex flex-col gap-3.5">
        <div class="flex items-center gap-[13px]">
          <span class="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-accent text-[13px] font-semibold text-white">1</span>
          <span class="text-sm font-medium text-text2">{{ t('auth.step1') }}</span>
        </div>
        <div class="flex items-center gap-[13px]">
          <span class="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full border-[1.5px] border-border2 bg-card text-[13px] font-semibold text-subtle">2</span>
          <span class="text-sm font-medium text-subtle">{{ t('auth.step2') }}</span>
        </div>
        <div class="flex items-center gap-[13px]">
          <span class="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full border-[1.5px] border-border2 bg-card text-[13px] font-semibold text-subtle">3</span>
          <span class="text-sm font-medium text-subtle">{{ t('auth.step3') }}</span>
        </div>
      </div>
    </template>

    <!-- 原右栏内容（标题块 <div class="mb-[30px]">…、<form>…、底部「直接登录」<p>…）原样搬入默认插槽，不改一字 -->
  </AuthShell>
</template>
```

具体搬移边界（对照重构前文件）：308 行外层 div 到 368 行 `max-w-[392px]` 包裹层（含 310–365 的整个左栏与右栏两层包裹）删除，换成上面的 AuthShell 开标签 + `#brand-footer`；369 行起的标题块、`<form>`、底部 `<p>` 原样保留为默认插槽内容；文件末尾模板的三个闭合 `</div>` 换成 `</AuthShell>`。

`<style scoped>` 中删除 `.fld`、`.fld::placeholder`、`.fld:focus`、`.ico` 四条规则（已收进 AuthShell）；若删完 style 块为空则整块删除。

注意：重构后注册页会多出「移动端窄屏字标」（AuthShell 自带，重构前注册页没有）——这是有意统一，不是回归。

- [ ] **Step 2: 跑 Register 相关测试**

Run: `cd user-portal && pnpm exec vitest run src/views/__tests__/RegisterView-aff.test.ts src/views/__tests__/RegisterView-invitation.test.ts`
Expected: 全部 PASS。

- [ ] **Step 3: 类型检查 + 全量测试**

Run: `cd user-portal && pnpm exec vue-tsc -b && pnpm exec vitest run`
Expected: 全绿。

- [ ] **Step 4: Commit**

```bash
git add user-portal/src/views/RegisterView.vue
git commit -m "refactor(user-portal): RegisterView 迁入 AuthShell 骨架

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: ForgotPasswordView + 路由 + 登录页入口

**Files:**
- Create: `user-portal/src/views/ForgotPasswordView.vue`
- Modify: `user-portal/src/router/index.ts`（Register 路由后加一条）
- Modify: `user-portal/src/views/LoginView.vue`（密码 label 行加入口链接）
- Test: `user-portal/src/views/__tests__/ForgotPasswordView.test.ts`

**Interfaces:**
- Consumes: Task 2 的 `forgotPassword`、Task 3 的 `auth.forgot*` 等 key、Task 4 的 `AuthShell`。
- Produces: 路由 `/forgot-password`（name `ForgotPassword`）；Task 7 的无效链接态引用该路径。

- [ ] **Step 1: 写失败测试**

新建 `user-portal/src/views/__tests__/ForgotPasswordView.test.ts`：

```ts
import { vi } from 'vitest'

// 只测视图编排：settings/auth 接口全部 mock 掉，避免 jsdom 真实 XHR
vi.mock('@/api/settings', () => ({
  getPublicSettings: vi.fn()
}))
vi.mock('@/api/auth', () => ({
  forgotPassword: vi.fn()
}))

import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import ForgotPasswordView from '@/views/ForgotPasswordView.vue'
import { getPublicSettings } from '@/api/settings'
import { forgotPassword } from '@/api/auth'
import type { PublicSettings } from '@/api/types'

const mockSettings = vi.mocked(getPublicSettings)
const mockForgot = vi.mocked(forgotPassword)

function settingsWith(overrides: Partial<PublicSettings> = {}): PublicSettings {
  return {
    registration_enabled: true,
    email_verify_enabled: false,
    invitation_code_enabled: false,
    promo_code_enabled: false,
    password_reset_enabled: true,
    payment_enabled: false,
    linuxdo_oauth_enabled: false,
    oidc_oauth_enabled: false,
    oidc_oauth_provider_name: '',
    wechat_oauth_enabled: false,
    site_name: 'Test',
    ...overrides
  } as PublicSettings
}

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/forgot-password', component: ForgotPasswordView },
      { path: '/login', component: { template: '<div/>' } },
      { path: '/:pathMatch(.*)*', component: { template: '<div/>' } }
    ]
  })
}

async function mountView(overrides: Partial<PublicSettings> = {}) {
  mockSettings.mockResolvedValue(settingsWith(overrides))
  const router = makeRouter()
  router.push('/forgot-password')
  await router.isReady()
  const wrapper = mount(ForgotPasswordView, { global: { plugins: [router, i18n] } })
  await flushPromises()
  return wrapper
}

async function submit(wrapper: Awaited<ReturnType<typeof mountView>>) {
  await wrapper.find('form').trigger('submit.prevent')
  await flushPromises()
}

beforeEach(() => {
  setActivePinia(createPinia())
  mockForgot.mockReset()
})

describe('ForgotPasswordView', () => {
  it('空邮箱提交：不发请求，展示校验错误', async () => {
    const wrapper = await mountView()
    await submit(wrapper)
    expect(mockForgot).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('请先填写邮箱')
  })

  it('邮箱格式非法：不发请求', async () => {
    const wrapper = await mountView()
    await wrapper.find('#forgot-email').setValue('not-an-email')
    await submit(wrapper)
    expect(mockForgot).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('请输入有效的邮箱地址')
  })

  it('提交成功：调用接口并切到「邮件已发送」态，表单消失', async () => {
    mockForgot.mockResolvedValue(undefined)
    const wrapper = await mountView()
    await wrapper.find('#forgot-email').setValue('a@b.com')
    await submit(wrapper)
    expect(mockForgot).toHaveBeenCalledWith({ email: 'a@b.com', turnstile_token: undefined })
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).toContain('重置邮件已发送')
  })

  it('turnstile 开启且无 token：拦截提交并提示', async () => {
    const wrapper = await mountView({ turnstile_enabled: true, turnstile_site_key: 'site-key' })
    await wrapper.find('#forgot-email').setValue('a@b.com')
    await submit(wrapper)
    expect(mockForgot).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('请先完成人机验证')
  })

  it('请求失败：内联展示错误信息，停留在表单态', async () => {
    mockForgot.mockRejectedValue({ code: 500, message: '服务暂不可用' })
    const wrapper = await mountView()
    await wrapper.find('#forgot-email').setValue('a@b.com')
    await submit(wrapper)
    expect(wrapper.text()).toContain('服务暂不可用')
    expect(wrapper.find('form').exists()).toBe(true)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd user-portal && pnpm exec vitest run src/views/__tests__/ForgotPasswordView.test.ts`
Expected: FAIL（`ForgotPasswordView.vue` 不存在，模块解析报错）。

- [ ] **Step 3: 新建 ForgotPasswordView.vue**

完整内容：

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settings'
import AuthShell from '@/components/auth/AuthShell.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import TurnstileWidget from '@/components/common/TurnstileWidget.vue'
import { forgotPassword } from '@/api/auth'
import { errMessage } from '@/utils/error'

const { t } = useI18n()
const settingsStore = useSettingsStore()

const email = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
// 提交成功后切到「邮件已发送」态（后端防枚举：无论邮箱是否注册都返回成功）
const submitted = ref(false)

// ===== Cloudflare Turnstile（站点开启时后端强制校验，缺 token 即拒绝）=====
const turnstileEnabled = computed(
  () => !!settingsStore.settings?.turnstile_enabled && !!settingsStore.settings?.turnstile_site_key
)
const turnstileSiteKey = computed(() => settingsStore.settings?.turnstile_site_key ?? '')
const turnstileToken = ref('')
const turnstileRef = ref<InstanceType<typeof TurnstileWidget> | null>(null)

// token 是一次性的：每次请求（无论成败）都会消费掉，之后必须 reset 重新挑战
function consumeTurnstile() {
  turnstileToken.value = ''
  turnstileRef.value?.reset()
}

onMounted(() => {
  settingsStore.ensureLoaded()
})

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function onSubmit() {
  const value = email.value.trim()
  if (!value) {
    error.value = t('auth.errEmailRequired')
    return
  }
  if (!EMAIL_RE.test(value)) {
    error.value = t('auth.errEmailInvalid')
    return
  }
  if (turnstileEnabled.value && !turnstileToken.value) {
    error.value = t('auth.errTurnstileRequired')
    return
  }
  loading.value = true
  error.value = null
  try {
    await forgotPassword({
      email: value,
      turnstile_token: turnstileToken.value || undefined
    })
    submitted.value = true
  } catch (e) {
    error.value = errMessage(e, t('auth.errSendResetFailed'))
    // 失败后 token 已被后端消费，须重新挑战
    consumeTurnstile()
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell
    :kicker="t('auth.forgotKicker')"
    :headline-pre="t('auth.forgotHeadlinePre')"
    :headline-mark="t('auth.forgotHeadlineMark')"
    :headline-end="t('auth.forgotHeadlineEnd')"
    :desc="t('auth.forgotBrandDesc')"
  >
    <div class="mb-8">
      <h1 class="mb-2 font-serif text-4xl font-medium tracking-tight text-text">
        {{ t('auth.forgotTitle') }}
      </h1>
      <p class="text-sm text-subtle">
        {{ t('auth.forgotSubtitle') }}
      </p>
    </div>

    <!-- ===== 成功态：邮件已发送 ===== -->
    <div v-if="submitted">
      <div class="rounded-xl3 border border-border bg-muted p-6 text-center">
        <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
          <svg
            class="text-pos"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          ><path d="M20 6L9 17l-5-5" /></svg>
        </div>
        <h2 class="text-base font-semibold text-text">
          {{ t('auth.resetEmailSent') }}
        </h2>
        <p class="mt-2 text-sm leading-relaxed text-text3">
          {{ t('auth.resetEmailSentHint') }}
        </p>
      </div>
      <p class="mt-[26px] text-center text-sm text-subtle">
        <router-link
          to="/login"
          class="border-b-2 border-accent pb-px font-semibold text-text"
        >
          {{ t('auth.backToLogin') }}
        </router-link>
      </p>
    </div>

    <!-- ===== 表单态 ===== -->
    <template v-else>
      <form @submit.prevent="onSubmit">
        <div class="mb-[18px]">
          <label
            for="forgot-email"
            class="mb-[9px] block text-xs font-semibold tracking-wide text-text2"
          >{{ t('auth.emailLabel') }}</label>
          <div class="relative">
            <svg
              class="ico"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
            ><rect
              x="3"
              y="5"
              width="18"
              height="14"
              rx="2.5"
            /><path d="M3.5 7l8.5 6 8.5-6" /></svg>
            <input
              id="forgot-email"
              v-model="email"
              type="email"
              autocomplete="email"
              class="fld"
              placeholder="you@example.com"
            >
          </div>
        </div>

        <!-- Turnstile 人机验证（站点开启时展示；token 一次性，失败后自动重挑战） -->
        <div
          v-if="turnstileEnabled"
          class="mb-[18px]"
        >
          <TurnstileWidget
            ref="turnstileRef"
            :site-key="turnstileSiteKey"
            @verify="turnstileToken = $event"
            @expire="turnstileToken = ''"
            @error="turnstileToken = ''"
          />
        </div>

        <p
          v-if="error"
          class="mb-4 text-sm text-neg"
        >
          {{ error }}
        </p>

        <button
          type="submit"
          :disabled="loading"
          class="flex w-full items-center justify-center gap-2 rounded-xl2 bg-accent py-[15px] text-[15px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          style="box-shadow: 0 4px 14px rgba(20, 194, 138, 0.32)"
        >
          <LoadingSpinner
            v-if="loading"
            :size="16"
          />
          <span>{{ loading ? t('auth.sendingResetLink') : t('auth.sendResetLink') }}</span>
          <span
            v-if="!loading"
            class="text-base"
          >→</span>
        </button>
      </form>

      <p class="mt-[30px] text-center text-sm text-subtle">
        {{ t('auth.rememberedPassword') }}<router-link
          to="/login"
          class="border-b-2 border-accent pb-px font-semibold text-text"
        >
          {{ t('auth.signIn') }}
        </router-link>
      </p>
    </template>
  </AuthShell>
</template>
```

- [ ] **Step 4: 注册路由**

`user-portal/src/router/index.ts` 的 Register 路由对象之后插入：

```ts
  {
    path: '/forgot-password',
    name: 'ForgotPassword',
    component: () => import('@/views/ForgotPasswordView.vue'),
    meta: { requiresAuth: false, title: 'nav.forgotPassword' }
  },
```

（注意：全局守卫只对 `Login`/`Register` 做「已登录跳走」，本路由**不**加入该名单——已登录用户也应能走找回流程。）

- [ ] **Step 5: 登录页加入口链接**

`user-portal/src/views/LoginView.vue`：

script 增加 computed（放在 `turnstileSiteKey` 附近）：

```ts
// 站点开启密码重置时才在登录页展示「忘记密码？」入口
const passwordResetEnabled = computed(() => !!settingsStore.settings?.password_reset_enabled)
```

template 中密码 label 那行（`<div class="mb-[9px] flex items-baseline justify-between">` 内、label 之后）加链接：

```vue
            <div class="mb-[9px] flex items-baseline justify-between">
              <label
                for="login-password"
                class="text-xs font-semibold tracking-wide text-text2"
              >{{ t('auth.passwordLabel') }}</label>
              <router-link
                v-if="passwordResetEnabled"
                to="/forgot-password"
                class="text-xs font-medium text-subtle underline-offset-2 transition hover:text-text hover:underline"
              >
                {{ t('auth.forgotEntry') }}
              </router-link>
            </div>
```

- [ ] **Step 6: 运行测试确认通过**

Run: `cd user-portal && pnpm exec vitest run src/views/__tests__/ForgotPasswordView.test.ts && pnpm exec vue-tsc -b`
Expected: 全部 PASS、0 类型错误。

- [ ] **Step 7: Commit**

```bash
git add user-portal/src/views/ForgotPasswordView.vue user-portal/src/router/index.ts user-portal/src/views/LoginView.vue user-portal/src/views/__tests__/ForgotPasswordView.test.ts
git commit -m "feat(user-portal): 新增忘记密码页与登录页入口

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: ResetPasswordView + 路由

**Files:**
- Create: `user-portal/src/views/ResetPasswordView.vue`
- Modify: `user-portal/src/router/index.ts`（ForgotPassword 路由后加一条）
- Test: `user-portal/src/views/__tests__/ResetPasswordView.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `ApiError.reason`、Task 2 的 `resetPassword`、Task 3 的 `auth.reset*` 等 key、Task 4 的 `AuthShell`、Task 6 的 `/forgot-password` 路由。

- [ ] **Step 1: 写失败测试**

新建 `user-portal/src/views/__tests__/ResetPasswordView.test.ts`：

```ts
import { vi } from 'vitest'

vi.mock('@/api/auth', () => ({
  resetPassword: vi.fn()
}))

import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import ResetPasswordView from '@/views/ResetPasswordView.vue'
import { resetPassword } from '@/api/auth'

const mockReset = vi.mocked(resetPassword)

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/reset-password', component: ResetPasswordView },
      { path: '/forgot-password', component: { template: '<div/>' } },
      { path: '/login', component: { template: '<div/>' } },
      { path: '/:pathMatch(.*)*', component: { template: '<div/>' } }
    ]
  })
}

async function mountView(url = '/reset-password?email=a%40b.com&token=tok-1') {
  const router = makeRouter()
  router.push(url)
  await router.isReady()
  const wrapper = mount(ResetPasswordView, { global: { plugins: [router, i18n] } })
  await flushPromises()
  return wrapper
}

async function fillAndSubmit(
  wrapper: Awaited<ReturnType<typeof mountView>>,
  password: string,
  confirm: string
) {
  await wrapper.find('#reset-password').setValue(password)
  await wrapper.find('#reset-confirm').setValue(confirm)
  await wrapper.find('form').trigger('submit.prevent')
  await flushPromises()
}

beforeEach(() => {
  setActivePinia(createPinia())
  mockReset.mockReset()
})

describe('ResetPasswordView', () => {
  it('链接缺 email/token：展示无效链接态，无表单', async () => {
    const wrapper = await mountView('/reset-password')
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).toContain('重置链接无效')
  })

  it('密码不足 6 位：不发请求', async () => {
    const wrapper = await mountView()
    await fillAndSubmit(wrapper, '123', '123')
    expect(mockReset).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('密码至少 6 位')
  })

  it('两次输入不一致：不发请求', async () => {
    const wrapper = await mountView()
    await fillAndSubmit(wrapper, '123456', '654321')
    expect(mockReset).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('两次输入的密码不一致')
  })

  it('提交成功：按 query 参数调接口并切到成功态', async () => {
    mockReset.mockResolvedValue(undefined)
    const wrapper = await mountView()
    await fillAndSubmit(wrapper, '123456', '123456')
    expect(mockReset).toHaveBeenCalledWith({
      email: 'a@b.com',
      token: 'tok-1',
      new_password: '123456'
    })
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).toContain('密码重置成功')
  })

  it('后端回 INVALID_RESET_TOKEN：展示专门文案', async () => {
    mockReset.mockRejectedValue({
      status: 400,
      code: 400,
      reason: 'INVALID_RESET_TOKEN',
      message: 'invalid or expired password reset token'
    })
    const wrapper = await mountView()
    await fillAndSubmit(wrapper, '123456', '123456')
    expect(wrapper.text()).toContain('重置链接已失效或过期，请重新申请')
  })

  it('其它失败：内联展示后端 message', async () => {
    mockReset.mockRejectedValue({ status: 500, code: 500, message: '服务暂不可用' })
    const wrapper = await mountView()
    await fillAndSubmit(wrapper, '123456', '123456')
    expect(wrapper.text()).toContain('服务暂不可用')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd user-portal && pnpm exec vitest run src/views/__tests__/ResetPasswordView.test.ts`
Expected: FAIL（`ResetPasswordView.vue` 不存在）。

- [ ] **Step 3: 新建 ResetPasswordView.vue**

完整内容：

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AuthShell from '@/components/auth/AuthShell.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import { resetPassword } from '@/api/auth'
import { errMessage } from '@/utils/error'
import type { ApiError } from '@/api/types'

const route = useRoute()
const { t } = useI18n()

// 重置链接参数（后端邮件里拼的 ?email=&token=）；进入页面即定，无需响应 query 变化
const email = String(route.query.email ?? '')
const token = String(route.query.token ?? '')
const isInvalidLink = !email || !token

const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const showConfirm = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)
const success = ref(false)

async function onSubmit() {
  if (password.value.length < 6) {
    error.value = t('auth.errPasswordTooShort')
    return
  }
  if (password.value !== confirmPassword.value) {
    error.value = t('auth.errPasswordMismatch')
    return
  }
  loading.value = true
  error.value = null
  try {
    await resetPassword({ email, token, new_password: password.value })
    success.value = true
  } catch (e) {
    // token 一次性且有 TTL：后端明确回 INVALID_RESET_TOKEN 时给专门文案引导重新申请
    error.value =
      (e as ApiError)?.reason === 'INVALID_RESET_TOKEN'
        ? t('auth.errTokenInvalid')
        : errMessage(e, t('auth.errResetFailed'))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell
    :kicker="t('auth.forgotKicker')"
    :headline-pre="t('auth.forgotHeadlinePre')"
    :headline-mark="t('auth.forgotHeadlineMark')"
    :headline-end="t('auth.forgotHeadlineEnd')"
    :desc="t('auth.forgotBrandDesc')"
  >
    <div class="mb-8">
      <h1 class="mb-2 font-serif text-4xl font-medium tracking-tight text-text">
        {{ t('auth.resetTitle') }}
      </h1>
      <p class="text-sm text-subtle">
        {{ t('auth.resetSubtitle') }}
      </p>
    </div>

    <!-- ===== 无效链接态：缺 email/token ===== -->
    <div v-if="isInvalidLink">
      <div class="rounded-xl3 border border-border bg-muted p-6 text-center">
        <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neg/10">
          <svg
            class="text-neg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          ><circle
            cx="12"
            cy="12"
            r="9"
          /><path d="M12 8v4M12 16h.01" /></svg>
        </div>
        <h2 class="text-base font-semibold text-text">
          {{ t('auth.invalidResetLink') }}
        </h2>
        <p class="mt-2 text-sm leading-relaxed text-text3">
          {{ t('auth.invalidResetLinkHint') }}
        </p>
      </div>
      <p class="mt-[26px] text-center text-sm text-subtle">
        <router-link
          to="/forgot-password"
          class="border-b-2 border-accent pb-px font-semibold text-text"
        >
          {{ t('auth.requestNewLink') }}
        </router-link>
      </p>
    </div>

    <!-- ===== 成功态 ===== -->
    <div v-else-if="success">
      <div class="rounded-xl3 border border-border bg-muted p-6 text-center">
        <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
          <svg
            class="text-pos"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          ><path d="M20 6L9 17l-5-5" /></svg>
        </div>
        <h2 class="text-base font-semibold text-text">
          {{ t('auth.resetSuccess') }}
        </h2>
        <p class="mt-2 text-sm leading-relaxed text-text3">
          {{ t('auth.resetSuccessHint') }}
        </p>
      </div>
      <router-link
        to="/login"
        class="mt-6 flex w-full items-center justify-center gap-2 rounded-xl2 bg-accent py-[15px] text-[15px] font-semibold text-white transition hover:opacity-90"
        style="box-shadow: 0 4px 14px rgba(20, 194, 138, 0.32)"
      >
        <span>{{ t('auth.goSignIn') }}</span>
        <span class="text-base">→</span>
      </router-link>
    </div>

    <!-- ===== 表单态 ===== -->
    <form
      v-else
      @submit.prevent="onSubmit"
    >
      <div class="mb-[18px]">
        <label
          for="reset-email"
          class="mb-[9px] block text-xs font-semibold tracking-wide text-text2"
        >{{ t('auth.emailLabel') }}</label>
        <input
          id="reset-email"
          :value="email"
          type="email"
          disabled
          class="fld pl-4! opacity-60"
        >
      </div>

      <div class="mb-[18px]">
        <label
          for="reset-password"
          class="mb-[9px] block text-xs font-semibold tracking-wide text-text2"
        >{{ t('auth.newPasswordLabel') }}</label>
        <div class="relative">
          <svg
            class="ico"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
          ><rect
            x="4"
            y="11"
            width="16"
            height="9"
            rx="2"
          /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
          <input
            id="reset-password"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="new-password"
            class="fld pr-12!"
            :placeholder="t('auth.passwordMinPlaceholder')"
          >
          <button
            type="button"
            class="absolute right-[15px] top-1/2 -translate-y-1/2 text-faint transition hover:text-text2"
            :aria-label="showPassword ? t('auth.hidePassword') : t('auth.showPassword')"
            @click="showPassword = !showPassword"
          >
            <svg
              v-if="showPassword"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
            ><path d="M3 3l18 18" /><path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a17.4 17.4 0 0 1-3.2 4.2M6.1 6.1A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.9-1.9" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
            <svg
              v-else
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
            ><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle
              cx="12"
              cy="12"
              r="3"
            /></svg>
          </button>
        </div>
      </div>

      <div class="mb-[26px]">
        <label
          for="reset-confirm"
          class="mb-[9px] block text-xs font-semibold tracking-wide text-text2"
        >{{ t('auth.confirmPasswordLabel') }}</label>
        <div class="relative">
          <svg
            class="ico"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
          ><rect
            x="4"
            y="11"
            width="16"
            height="9"
            rx="2"
          /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
          <input
            id="reset-confirm"
            v-model="confirmPassword"
            :type="showConfirm ? 'text' : 'password'"
            autocomplete="new-password"
            class="fld pr-12!"
            :placeholder="t('auth.confirmPasswordPlaceholder')"
          >
          <button
            type="button"
            class="absolute right-[15px] top-1/2 -translate-y-1/2 text-faint transition hover:text-text2"
            :aria-label="showConfirm ? t('auth.hidePassword') : t('auth.showPassword')"
            @click="showConfirm = !showConfirm"
          >
            <svg
              v-if="showConfirm"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
            ><path d="M3 3l18 18" /><path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a17.4 17.4 0 0 1-3.2 4.2M6.1 6.1A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.9-1.9" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
            <svg
              v-else
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
            ><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle
              cx="12"
              cy="12"
              r="3"
            /></svg>
          </button>
        </div>
      </div>

      <p
        v-if="error"
        class="mb-4 text-sm text-neg"
      >
        {{ error }}
      </p>

      <button
        type="submit"
        :disabled="loading"
        class="flex w-full items-center justify-center gap-2 rounded-xl2 bg-accent py-[15px] text-[15px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        style="box-shadow: 0 4px 14px rgba(20, 194, 138, 0.32)"
      >
        <LoadingSpinner
          v-if="loading"
          :size="16"
        />
        <span>{{ loading ? t('auth.resettingPassword') : t('auth.resetPasswordBtn') }}</span>
      </button>
    </form>
  </AuthShell>
</template>
```

- [ ] **Step 4: 注册路由**

`user-portal/src/router/index.ts` 的 ForgotPassword 路由之后插入：

```ts
  {
    // 邮件重置链接的落点：后端拼 <frontend_url>/reset-password?email=&token=，勿改路径
    path: '/reset-password',
    name: 'ResetPassword',
    component: () => import('@/views/ResetPasswordView.vue'),
    meta: { requiresAuth: false, title: 'nav.resetPassword' }
  },
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd user-portal && pnpm exec vitest run src/views/__tests__/ResetPasswordView.test.ts && pnpm exec vue-tsc -b`
Expected: 全部 PASS、0 类型错误。

- [ ] **Step 6: Commit**

```bash
git add user-portal/src/views/ResetPasswordView.vue user-portal/src/router/index.ts user-portal/src/views/__tests__/ResetPasswordView.test.ts
git commit -m "feat(user-portal): 新增重置密码页（邮件链接落点）

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: 全量质量门禁

**Files:** 无新改动（只跑门禁；lint --fix 若产生格式修正则一并提交）。

- [ ] **Step 1: lint**

Run: `mise run lint-user-portal`
Expected: 0 error。若报模板格式问题：`cd user-portal && pnpm exec eslint --fix src` 后重跑。

- [ ] **Step 2: 类型检查 + 全部测试**

Run: `mise run test-user-portal`
Expected: vue-tsc 0 错误、vitest 全部 PASS。

- [ ] **Step 3: 生产构建可编译**

Run: `mise run build-user-portal`
Expected: 构建成功、无错误输出。

- [ ] **Step 4: 手动端到端冒烟（推荐）**

Run: `mise run run-user-portal`，依次访问：
- `http://localhost:5174/login`——密码行右侧出现「忘记密码？」（需后端 `password_reset_enabled` 开启；本地未连后端时该链接可能不显示，属预期）。
- `http://localhost:5174/forgot-password`——表单态正常，空提交/坏邮箱内联报错。
- `http://localhost:5174/reset-password`——无 query 时展示无效链接态。
- `http://localhost:5174/reset-password?email=a%40b.com&token=x`——表单态，邮箱只读回显。
- `http://localhost:5174/register`——重构后视觉如常（左栏三步骤）。

- [ ] **Step 5: 若有 lint --fix 产生的改动，提交**

```bash
git add -A user-portal/src
git commit -m "style(user-portal): lint 自动格式修正

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

（无改动则跳过。）
