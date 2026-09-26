# 注册页好友邀请码输入框实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** user-portal 注册页把邀请返利码（`aff_code`）从静默处理升级为可见、可编辑的「好友邀请码」输入框，访问 `?aff=` 邀请链接时自动回填。

**Architecture:** 全部改动在前端 `RegisterView.vue`（现有 `affCode` ref 改绑到表单输入框；挂载时回取 localStorage 补齐回填；提交以输入框内容为准）+ i18n 文案两份。后端零改动（注册接口已接受 `aff_code`，绑定失败 fail-open）。

**Tech Stack:** Vue3 + TypeScript + vue-i18n + vitest（@vue/test-utils，jsdom）。

**Spec:** `docs/superpowers/specs/2026-07-06-register-aff-code-field-design.md`

## Global Constraints

- 所有注释、文档、提交信息用简体中文。
- 输入框仅在 `settings.affiliate_enabled === true` 时渲染（与优惠码同模式）。
- 文案固定：zh label「好友邀请码」placeholder「填写好友分享的邀请码」；en label "Referral code" placeholder "Enter your friend's referral code"。
- 不做实时校验、不加回填提示（后端 fail-open）。
- 测试统一跑 `mise run test-user-portal`（= `pnpm exec vue-tsc -b && pnpm exec vitest run`，在 user-portal 目录）；单跑本测试文件用 `cd user-portal && pnpm exec vitest run src/views/__tests__/RegisterView-aff.test.ts`。
- 提交信息末尾带 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。

---

### Task 1: 「好友邀请码」输入框渲染与自动回填

**Files:**
- Modify: `user-portal/src/i18n/locales/zh-CN/auth.ts`（第 58 行 `invitationPlaceholder` 后插入）
- Modify: `user-portal/src/i18n/locales/en-US/auth.ts`（第 58 行 `invitationPlaceholder` 后插入）
- Modify: `user-portal/src/views/RegisterView.vue`（脚本 `onMounted` + 模板新增字段块）
- Test: `user-portal/src/views/__tests__/RegisterView-aff.test.ts`（新建）

**Interfaces:**
- Consumes: `@/utils/affiliateReferral` 现有导出（`loadAffiliateReferralCode(): string`、`storeAffiliateReferralCode(value?: unknown): void`）；`PublicSettings.affiliate_enabled?: boolean`。
- Produces: 输入框 `<input id="reg-aff" v-model="affCode">`；i18n 键 `auth.affLabel`、`auth.affPlaceholder`（Task 2 的测试沿用 `#reg-aff` 选择器与本任务的测试文件）。

- [ ] **Step 1: 新增 i18n 文案**

`user-portal/src/i18n/locales/zh-CN/auth.ts`，在 `invitationPlaceholder: '有邀请码可享额外额度',` 之后插入：

```ts
  affLabel: '好友邀请码',
  affPlaceholder: '填写好友分享的邀请码',
```

`user-portal/src/i18n/locales/en-US/auth.ts`，在 `invitationPlaceholder: 'Have a code? Get extra credit',` 之后插入：

```ts
  affLabel: 'Referral code',
  affPlaceholder: "Enter your friend's referral code",
```

- [ ] **Step 2: 写失败测试**

新建 `user-portal/src/views/__tests__/RegisterView-aff.test.ts`：

```ts
import { vi } from 'vitest'

// 只测视图编排：settings/注册/用户资料接口全部 mock 掉，避免 jsdom 真实 XHR
vi.mock('@/api/settings', () => ({
  getPublicSettings: vi.fn()
}))
vi.mock('@/api/auth', () => ({
  register: vi.fn().mockResolvedValue({}),
  sendVerifyCode: vi.fn(),
  validatePromoCode: vi.fn()
}))
vi.mock('@/api/user', () => ({
  getProfile: vi.fn().mockResolvedValue({ id: 1, username: 'u', email: 'u@x.com', balance: 0 }),
  updateProfile: vi.fn().mockResolvedValue({})
}))

import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import RegisterView from '@/views/RegisterView.vue'
import { getPublicSettings } from '@/api/settings'
import * as authApi from '@/api/auth'
import { storeAffiliateReferralCode } from '@/utils/affiliateReferral'
import type { PublicSettings } from '@/api/types'

const mockSettings = vi.mocked(getPublicSettings)
const mockRegister = vi.mocked(authApi.register)

function settingsWith(affiliateEnabled: boolean | undefined): PublicSettings {
  return {
    registration_enabled: true,
    email_verify_enabled: false,
    invitation_code_enabled: false,
    promo_code_enabled: false,
    password_reset_enabled: false,
    payment_enabled: false,
    linuxdo_oauth_enabled: false,
    oidc_oauth_enabled: false,
    oidc_oauth_provider_name: '',
    wechat_oauth_enabled: false,
    site_name: 'Test',
    affiliate_enabled: affiliateEnabled
  }
}

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/register', name: 'Register', component: RegisterView },
      { path: '/:pathMatch(.*)*', component: { template: '<div/>' } }
    ]
  })
}

async function mountView(query = '', affiliateEnabled: boolean | undefined = true) {
  mockSettings.mockResolvedValue(settingsWith(affiliateEnabled))
  const router = makeRouter()
  router.push(`/register${query}`)
  await router.isReady()
  const wrapper = mount(RegisterView, { global: { plugins: [router, i18n] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  mockRegister.mockClear()
  mockSettings.mockReset()
})

describe('RegisterView 好友邀请码', () => {
  it('访问 ?aff= 链接时输入框自动回填，且码已落地 localStorage', async () => {
    const wrapper = await mountView('?aff=V269J6HUH72F')
    const input = wrapper.find<HTMLInputElement>('#reg-aff')
    expect(input.exists()).toBe(true)
    expect(input.element.value).toBe('V269J6HUH72F')
    expect(localStorage.getItem('affiliate_referral_code')).toContain('V269J6HUH72F')
  })

  it('无 URL 参数但 localStorage 有未过期码时回填', async () => {
    storeAffiliateReferralCode('STOREDCODE1')
    const wrapper = await mountView()
    expect(wrapper.find<HTMLInputElement>('#reg-aff').element.value).toBe('STOREDCODE1')
  })

  it('affiliate_enabled 为 false 时不渲染输入框', async () => {
    const wrapper = await mountView('?aff=V269J6HUH72F', false)
    expect(wrapper.find('#reg-aff').exists()).toBe(false)
  })

  it('settings 拉取失败时不渲染输入框（静默逻辑保留）', async () => {
    mockSettings.mockRejectedValue(new Error('network'))
    const router = makeRouter()
    router.push('/register?aff=V269J6HUH72F')
    await router.isReady()
    const wrapper = mount(RegisterView, { global: { plugins: [router, i18n] } })
    await flushPromises()
    expect(wrapper.find('#reg-aff').exists()).toBe(false)
  })
})
```

（注意最后一个用例不走 `mountView`——它需要 `mockRejectedValue`。）

- [ ] **Step 3: 跑测试确认失败**

```bash
cd user-portal && pnpm exec vitest run src/views/__tests__/RegisterView-aff.test.ts
```

预期：前两个用例 FAIL（找不到 `#reg-aff`）；后两个此时天然通过（输入框还不存在），属正常。

- [ ] **Step 4: 实现 RegisterView 改动**

`user-portal/src/views/RegisterView.vue` 脚本区，把 `onMounted` 改为（现有 watch 保持不动）：

```ts
onMounted(async () => {
  // URL 没带码时，回取此前落地的邀请码（30 天内有效）回填到输入框
  if (!affCode.value) {
    affCode.value = loadAffiliateReferralCode()
  }
  try {
    settings.value = await getPublicSettings()
  } catch {
    // 拉取失败时按最常见配置（无邀请码 / 无邮箱验证 / 无优惠码）兜底
  }
})
```

同时更新 `affCode` 声明处的注释（原「不在表单展示”已不成立）：

```ts
// ===== 邀请返利码（来自邀请链接 ?aff= / ?aff_code=）=====
// 进站即落地 localStorage（30 天 TTL）；affiliate 开启时作为「好友邀请码」输入框展示，可改可清空
const affCode = ref('')
```

模板区，在准入邀请码块（`v-if="settings?.invitation_code_enabled === true"` 的 `<div>`）之后、优惠码块之前插入：

```html
          <!-- 好友邀请码（邀请返利，仅在站点开启返利时显示；?aff= 链接进站自动回填） -->
          <div
            v-if="settings?.affiliate_enabled"
            class="mb-[22px]"
          >
            <label
              for="reg-aff"
              class="mb-[9px] block text-xs font-semibold tracking-wide text-text2"
            >{{ t('auth.affLabel') }} <span class="font-normal text-faint">{{ t('auth.optionalSuffix') }}</span></label>
            <div class="relative">
              <svg
                class="ico"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
              ><circle
                cx="9"
                cy="8"
                r="4"
              /><path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6" /><path d="M19 8v6M16 11h6" /></svg>
              <input
                id="reg-aff"
                v-model="affCode"
                type="text"
                class="fld"
                :placeholder="t('auth.affPlaceholder')"
              >
            </div>
          </div>
```

- [ ] **Step 5: 跑测试确认通过**

```bash
cd user-portal && pnpm exec vitest run src/views/__tests__/RegisterView-aff.test.ts
```

预期：4 个用例全部 PASS。

- [ ] **Step 6: 提交**

```bash
git add user-portal/src/views/RegisterView.vue user-portal/src/i18n/locales/zh-CN/auth.ts user-portal/src/i18n/locales/en-US/auth.ts user-portal/src/views/__tests__/RegisterView-aff.test.ts
git commit -m "feat(user-portal): 注册页好友邀请码输入框，?aff= 链接自动回填

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: 提交以输入框内容为准（清空即不带码）

**Files:**
- Modify: `user-portal/src/views/RegisterView.vue`（`onSubmit` 里 `aff_code` 取值）
- Test: `user-portal/src/views/__tests__/RegisterView-aff.test.ts`（追加用例）

**Interfaces:**
- Consumes: Task 1 的 `#reg-aff` 输入框与测试文件基建（`mountView`、`mockRegister`）。
- Produces: 注册请求 `aff_code` 语义 = `affCode.value.trim() || undefined`（不再有提交时刻的 localStorage 兜底）。

- [ ] **Step 1: 追加失败测试**

在 `RegisterView-aff.test.ts` 的 `describe` 内追加（需要一个填表并提交的辅助函数，放在 `mountView` 之后）：

```ts
async function fillAndSubmit(wrapper: Awaited<ReturnType<typeof mountView>>) {
  await wrapper.find('#reg-email').setValue('a@b.com')
  await wrapper.find('#reg-password').setValue('123456')
  await wrapper.find('#reg-confirm-password').setValue('123456')
  await wrapper.find('input[type="checkbox"]').setValue(true)
  await wrapper.find('form').trigger('submit.prevent')
  await flushPromises()
}
```

用例：

```ts
  it('提交时携带输入框中的邀请码（手动修改以修改值为准）', async () => {
    const wrapper = await mountView('?aff=V269J6HUH72F')
    await wrapper.find('#reg-aff').setValue('MANUAL123')
    await fillAndSubmit(wrapper)
    expect(mockRegister).toHaveBeenCalledTimes(1)
    expect(mockRegister.mock.calls[0][0].aff_code).toBe('MANUAL123')
  })

  it('清空输入框后提交不携带邀请码（即使 localStorage 有落地码）', async () => {
    const wrapper = await mountView('?aff=V269J6HUH72F')
    await wrapper.find('#reg-aff').setValue('')
    await fillAndSubmit(wrapper)
    expect(mockRegister).toHaveBeenCalledTimes(1)
    expect(mockRegister.mock.calls[0][0].aff_code).toBeUndefined()
  })
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd user-portal && pnpm exec vitest run src/views/__tests__/RegisterView-aff.test.ts
```

预期：「清空输入框」用例 FAIL——现行代码 `affCode.value || loadAffiliateReferralCode()` 会从 localStorage 兜底取回 `V269J6HUH72F`，`aff_code` 不为 undefined。「手动修改」用例应 PASS。

- [ ] **Step 3: 实现提交取值改动**

`user-portal/src/views/RegisterView.vue` 的 `onSubmit` 里，把：

```ts
    // 本次进站没带邀请码时，回取此前落地的（30 天内有效）
    const aff = affCode.value || loadAffiliateReferralCode()
```

改为：

```ts
    // 回填已前移到进页时（watch + onMounted），此处以输入框内容为准：用户清空即视为不带邀请码
    const aff = affCode.value.trim()
```

顶部 import **保持不变**——`loadAffiliateReferralCode` 虽然从 `onSubmit` 移除，但 Task 1 的 `onMounted` 仍在用它：

```ts
import {
  clearAffiliateReferralCode,
  loadAffiliateReferralCode,
  pickAffiliateCode,
  storeAffiliateReferralCode
} from '@/utils/affiliateReferral'
```

- [ ] **Step 4: 跑测试确认通过**

```bash
cd user-portal && pnpm exec vitest run src/views/__tests__/RegisterView-aff.test.ts
```

预期：6 个用例全部 PASS。

- [ ] **Step 5: 跑完整质量门禁**

```bash
mise run test-user-portal
mise run lint-user-portal
```

预期：vue-tsc、vitest、eslint 全绿。

- [ ] **Step 6: 提交**

```bash
git add user-portal/src/views/RegisterView.vue user-portal/src/views/__tests__/RegisterView-aff.test.ts
git commit -m "feat(user-portal): 注册提交以好友邀请码输入框为准，清空即不带码

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
