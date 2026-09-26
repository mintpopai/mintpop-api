# mintpop 统一认证中心实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 部署 Logto 自托管作为 mintpop 组织统一 OIDC Provider（新仓库 mintpop-auth），mintpop-api 以配置方式接入，user-portal 补齐统一登录入口与回调页。

**Architecture:** 认证中心只管身份（邮箱/密码/验证码），各产品本地保留业务用户表；backend 已有 OIDC 客户端能力（`/api/v1/auth/oauth/oidc/*`），接入=运行时配置；唯一代码改动在 user-portal（登录按钮 + `/auth/oidc/callback` 回调页）。设计依据：`docs/superpowers/specs/2026-07-07-unified-auth-center-design.md`。

**Tech Stack:** Logto（Docker 自托管）+ PostgreSQL；导入脚本 Go；user-portal Vue3 + TS + Pinia + vitest。

**Spec:** `docs/superpowers/specs/2026-07-07-unified-auth-center-design.md`

## Global Constraints

- 所有文档/注释/commit 信息用中文；commit 末尾加 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。
- mintpop-auth 新仓库位置：`/Users/yuebai/workspace/mintpop-auth`；遵循全局规范：`docker-compose.yml` 固定文件名、无 `build:` 段、无 `version:` 键、每服务必带 healthcheck、镜像 tag 与宿主端口参数化、`restart: unless-stopped`、端口仅绑 `127.0.0.1`；命令收口 mise（`mise.toml` 只在根、`[tools]` 钉具体版本）；`.gitignore` 排除 `.idea/`、`.claude/`。
- mintpop-api 仓库改动仅限 `user-portal/`（backend 零改动）；提交前过 `mise run lint-user-portal` 与 `mise run test-user-portal`；当前分支 `mintpop`。
- 代码内状态常量用 SCREAMING_SNAKE_CASE（如 `'PROCESSING'`）。
- 已核实的后端契约（不要凭想象改）：
  - 发起：`GET /api/v1/auth/oauth/oidc/start?redirect=<站内路径>`（浏览器整页跳转）。
  - 回调后端处理完把浏览器 302 到 `frontend_redirect_url`（同源相对路径 `/auth/oidc/callback`），**成功不带 token**；失败在 URL fragment 带 `error`/`message`/`description`。
  - 前端落地后 `POST /api/v1/auth/oauth/pending/exchange`（空 body，凭 cookie）换结果，响应字段（`frontend/src/api/auth.ts:189-208` 同款契约）：`access_token?/refresh_token?/redirect?/error?/requires_2fa?/temp_token?/user_email_masked?/auth_result?`。
  - 已验证邮箱 + 本地无同邮箱账号 → 后端快捷路径自动注册并直接给 token；同邮箱已有本地账号 → 进入 pending（v1 引导走邮箱登录+个人资料绑定，绑定能力 user-portal 已有）。
  - 部署路由：同域下 `/api` 等前缀 → backend，其余（含 `/auth/oidc/callback`）→ user-portal。

---

## Phase A：mintpop-auth 新仓库

### Task 1: 仓库骨架

**Files:**
- Create: `/Users/yuebai/workspace/mintpop-auth/.gitignore`
- Create: `/Users/yuebai/workspace/mintpop-auth/mise.toml`
- Create: `/Users/yuebai/workspace/mintpop-auth/.env.example`
- Create: `/Users/yuebai/workspace/mintpop-auth/README.md`

**Interfaces:**
- Produces: mise task 名 `up`/`down`/`logs`/`test-import`/`import-users`（后续任务与文档引用这些名字）；`.env` 变量名 `LOGTO_TAG`/`LOGTO_PORT`/`LOGTO_ADMIN_PORT`/`POSTGRES_TAG`/`POSTGRES_PASSWORD`/`LOGTO_ENDPOINT`/`LOGTO_ADMIN_ENDPOINT`。

- [ ] **Step 1: git init 与 .gitignore**

```bash
mkdir -p /Users/yuebai/workspace/mintpop-auth && cd /Users/yuebai/workspace/mintpop-auth && git init -b mintpop
```

`.gitignore`：

```gitignore
.idea/
.claude/
.env
data/
```

- [ ] **Step 2: 写 mise.toml**

先查 mise 里 go 的既有版本约定（与 mintpop-api 根 `mise.toml` 的 `go = "1.26.4"` 保持一致）：

```toml
[tools]
go = "1.26.4"

# —— 运行 ——
[tasks.up]
description = "启动认证中心（logto + postgres）"
run = "docker compose up -d"

[tasks.down]
description = "停止认证中心"
run = "docker compose down"

[tasks.logs]
description = "跟踪 logto 日志"
run = "docker compose logs -f logto"

# —— 质量 ——
[tasks.test-import]
description = "导入脚本单测"
dir = "import"
run = "go test ./..."

# —— 数据 ——
[tasks.import-users]
description = "把存量用户（email+bcrypt CSV）导入 Logto，用法: mise run import-users -- --csv users.csv"
dir = "import"
run = "go run . "
```

- [ ] **Step 3: 写 .env.example**

先取 Logto 最新稳定版本号填进去（钉版本）：

```bash
curl -s https://api.github.com/repos/logto-io/logto/releases/latest | grep -o '"tag_name": *"[^"]*"'
```

```dotenv
# Logto 镜像 tag（钉具体版本，去掉 v 前缀，如 1.31.0；升级前先读 changelog）
LOGTO_TAG=<上一步查到的版本号，去掉 v 前缀>
POSTGRES_TAG=17-alpine
POSTGRES_PASSWORD=<生成一个强密码>

# 宿主端口（仅绑 127.0.0.1，反代对外暴露）
LOGTO_PORT=3001
LOGTO_ADMIN_PORT=3002

# 对外访问地址（反代后的域名）
LOGTO_ENDPOINT=https://auth.example.com
LOGTO_ADMIN_ENDPOINT=https://auth-admin.example.com
```

（`.env.example` 里 `<...>` 是给部署者的填写指引，属于文档性质，允许保留。）

- [ ] **Step 4: 写 README.md**

内容：一句话定位（mintpop 组织统一认证中心，Logto 自托管编排）、快速开始（`cp .env.example .env` → 填值 → `mise run up`）、目录说明（`docker-compose.yml`/`branding/`/`import/`/`docs/`）、指向 `docs/setup.md` 与 `docs/rollout.md`。全中文。

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: 仓库骨架（mise 任务、env 模板、说明）

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: docker-compose 编排

**Files:**
- Create: `/Users/yuebai/workspace/mintpop-auth/docker-compose.yml`

**Interfaces:**
- Consumes: Task 1 的 `.env` 变量名。
- Produces: 服务名 `logto`（127.0.0.1:${LOGTO_PORT} → 3001 核心、${LOGTO_ADMIN_PORT} → 3002 控制台）、`postgres`；数据落 `./data/postgres`。

- [ ] **Step 1: 写 docker-compose.yml**

```yaml
# mintpop 统一认证中心：Logto 自托管 + 专属 Postgres
# 端口仅绑 127.0.0.1，需自备反向代理对外暴露：
#   ${LOGTO_ENDPOINT}       → 127.0.0.1:${LOGTO_PORT}   （用户登录/OIDC 端点）
#   ${LOGTO_ADMIN_ENDPOINT} → 127.0.0.1:${LOGTO_ADMIN_PORT}（管理控制台，建议再加访问限制）
services:
  logto:
    image: svhd/logto:${LOGTO_TAG:?请在 .env 钉住 Logto 版本}
    container_name: mintpop-auth-logto
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    # 首次启动初始化/升级数据库结构（官方推荐 entrypoint），随后启动服务
    entrypoint: ["sh", "-c", "npm run cli db seed -- --swe && npm start"]
    environment:
      - TRUST_PROXY_HEADER=1
      - DB_URL=postgres://logto:${POSTGRES_PASSWORD}@postgres:5432/logto
      - ENDPOINT=${LOGTO_ENDPOINT}
      - ADMIN_ENDPOINT=${LOGTO_ADMIN_ENDPOINT}
    ports:
      - "127.0.0.1:${LOGTO_PORT:-3001}:3001"
      - "127.0.0.1:${LOGTO_ADMIN_PORT:-3002}:3002"
    healthcheck:
      # 镜像内无 curl/wget，用 node fetch 探活（/api/status 返回 204）
      test: ["CMD", "node", "-e", "fetch('http://localhost:3001/api/status').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s

  postgres:
    image: postgres:${POSTGRES_TAG:-17-alpine}
    container_name: mintpop-auth-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_USER=logto
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=logto
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U logto -d logto"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
```

- [ ] **Step 2: 本地验证配置与启动**

```bash
cd /Users/yuebai/workspace/mintpop-auth
cp .env.example .env   # 本地验证：LOGTO_ENDPOINT/ADMIN_ENDPOINT 填 http://localhost:3001 / http://localhost:3002
docker compose config >/dev/null && echo OK
mise run up
# 等 30-60 秒首次 seed
docker compose ps    # 预期两个服务 healthy
curl -s http://localhost:3001/oidc/.well-known/openid-configuration | head -c 200
```

预期：`docker compose ps` 两服务 `healthy`；discovery 端点返回 JSON（含 `"issuer":"http://localhost:3001/oidc"`）。

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml && git commit -m "feat: Logto + Postgres compose 编排（healthcheck、版本与端口参数化）

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: 控制台初始化手册 docs/setup.md

**Files:**
- Create: `/Users/yuebai/workspace/mintpop-auth/docs/setup.md`

**Interfaces:**
- Produces: Logto 应用命名约定 `mintpop-api`（Traditional Web）、`mintpop-auth-import`（M2M）；后续任务与 rollout 文档引用。

- [ ] **Step 1: 写手册**

控制台操作无法代码化，落成可勾选清单（全中文），内容必须包含：

1. 首次访问 `${LOGTO_ADMIN_ENDPOINT}` 创建管理员账号（此账号只管 Logto，与业务无关；启用其 MFA）。
2. 登录体验：Sign-in experience → 启用「邮箱 + 密码」注册与登录，附加启用「邮箱验证码」登录；关闭暂不需要的社交登录。
3. SMTP：Connectors → Email connector → SMTP，填现有邮件服务商参数；用「发送测试邮件」验证。
4. 建应用 `mintpop-api`：类型 Traditional Web；Redirect URI 填 `https://<主域>/api/v1/auth/oauth/oidc/callback`（本地联调另加 `http://localhost:5174/api/v1/auth/oauth/oidc/callback`）；记录 App ID / App Secret。
5. 建 M2M 应用 `mintpop-auth-import`（导入脚本用）：在 Logto 控制台给它授予 Management API 权限（role 含 `all` 权限）；记录凭据。
6. 验证：`curl -s ${LOGTO_ENDPOINT}/oidc/.well-known/openid-configuration | python3 -m json.tool | head -30`，确认 `issuer`、`authorization_endpoint`、`device_authorization_endpoint` 存在。
7. 记下 issuer 值（`${LOGTO_ENDPOINT}/oidc`），rollout 时填给 mintpop-api。

- [ ] **Step 2: Commit**

```bash
git add docs/setup.md && git commit -m "docs: Logto 控制台初始化手册

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: 品牌资产 branding/

**Files:**
- Create: `/Users/yuebai/workspace/mintpop-auth/branding/custom.css`
- Create: `/Users/yuebai/workspace/mintpop-auth/branding/README.md`

- [ ] **Step 1: 从 user-portal 提取品牌 token**

```bash
grep -rn "accent\|--color\|#14c28a\|fontFamily" /Users/yuebai/workspace/mintpop-api/user-portal/src/styles/ /Users/yuebai/workspace/mintpop-api/user-portal/tailwind.config* 2>/dev/null | head -30
```

把主色（accent）、圆角、字体族的具体值记录到 `branding/README.md`。

- [ ] **Step 2: 写 custom.css 起步版**

只做第一层：主色、按钮圆角、页面底色对齐（值用上一步提取的实际 token，Logto 的自定义 CSS 在控制台 Sign-in experience → Custom CSS 粘贴生效）。示例骨架（用真实色值替换）：

```css
/* mintpop 品牌换肤第一层：主色/圆角/底色。深层选择器在 Logto 控制台预览里迭代 */
:root {
  --color-brand-default: <accent 主色>;
  --color-brand-hover: <accent hover 色>;
}
body {
  font-family: <user-portal 正文字体栈>;
}
```

`branding/README.md` 写清：粘贴位置、logo/favicon 上传位置（Sign-in experience → Branding）、迭代方式（控制台实时预览）、以及「深度换肤靠在预览里检查元素补选择器，不要臆写 Logto 内部类名」。

- [ ] **Step 3: 控制台落地并核查可达性**

logo 上传 + 主色配置 + custom.css 粘贴后，打开登录页，浏览器开发者工具 Network 面板核查：**无任何指向 fonts.googleapis.com / cdn.jsdelivr.net 等第三方域名的请求**（全球可达性规范）。有则在 css 里移除对应引用或改自托管。

- [ ] **Step 4: Commit**

```bash
git add branding/ && git commit -m "feat: 登录页品牌资产（主色/字体对齐 user-portal）

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: 存量用户导入脚本（TDD）

**Files:**
- Create: `/Users/yuebai/workspace/mintpop-auth/import/go.mod`
- Create: `/Users/yuebai/workspace/mintpop-auth/import/main.go`
- Test: `/Users/yuebai/workspace/mintpop-auth/import/main_test.go`

**Interfaces:**
- Consumes: Task 3 的 M2M 应用凭据（env `LOGTO_ENDPOINT`/`LOGTO_M2M_CLIENT_ID`/`LOGTO_M2M_CLIENT_SECRET`）。
- Produces: `mise run import-users -- --csv <file>`；CSV 两列 `email,password_hash`。核心函数 `importAll(baseURL, clientID, clientSecret string, rows []userRow) (summary, error)`。

- [ ] **Step 1: 初始化 module 并写失败测试**

```bash
cd /Users/yuebai/workspace/mintpop-auth/import && go mod init github.com/yuebai-blast/mintpop-auth/import
```

`main_test.go`：

```go
package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// 假 Logto：/oidc/token 发 M2M token；/api/users 第一个成功、第二个 422（已存在）
func TestImportAll(t *testing.T) {
	var gotUsers []map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/oidc/token":
			_ = json.NewEncoder(w).Encode(map[string]any{"access_token": "test-token"})
		case "/api/users":
			if r.Header.Get("Authorization") != "Bearer test-token" {
				t.Errorf("缺少 M2M token，got %q", r.Header.Get("Authorization"))
			}
			var body map[string]any
			_ = json.NewDecoder(r.Body).Decode(&body)
			gotUsers = append(gotUsers, body)
			if body["primaryEmail"] == "b@example.com" {
				w.WriteHeader(http.StatusUnprocessableEntity)
				return
			}
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"id":"u1"}`))
		default:
			t.Errorf("意外请求 %s", r.URL.Path)
		}
	}))
	defer srv.Close()

	rows := []userRow{
		{Email: "a@example.com", PasswordHash: "$2a$10$abc"},
		{Email: "b@example.com", PasswordHash: "$2a$10$def"},
	}
	sum, err := importAll(srv.URL, "cid", "csecret", rows)
	if err != nil {
		t.Fatalf("importAll: %v", err)
	}
	if sum.Created != 1 || sum.Skipped != 1 || sum.Failed != 0 {
		t.Fatalf("统计不符: %+v", sum)
	}
	if gotUsers[0]["passwordAlgorithm"] != "Bcrypt" {
		t.Fatalf("密码算法应为 Bcrypt: %+v", gotUsers[0])
	}
}
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd /Users/yuebai/workspace/mintpop-auth && mise run test-import
```

预期：FAIL（`userRow`/`importAll` 未定义）。

- [ ] **Step 3: 实现 main.go**

```go
// 存量用户导入：读 CSV(email,password_hash) → Logto Management API 建用户（携带 bcrypt 哈希，密码无感迁移）
// 用法：LOGTO_ENDPOINT/LOGTO_M2M_CLIENT_ID/LOGTO_M2M_CLIENT_SECRET 环境变量 + --csv 文件
package main

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
)

type userRow struct {
	Email        string
	PasswordHash string
}

type summary struct {
	Created int
	Skipped int
	Failed  int
}

// fetchM2MToken 用 client_credentials 换 Management API 访问令牌
func fetchM2MToken(baseURL, clientID, clientSecret string) (string, error) {
	form := url.Values{
		"grant_type": {"client_credentials"},
		"resource":   {"https://default.logto.app/api"},
		"scope":      {"all"},
	}
	req, err := http.NewRequest(http.MethodPost, baseURL+"/oidc/token", strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.SetBasicAuth(clientID, clientSecret)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("token 请求失败 %d: %s", resp.StatusCode, body)
	}
	var out struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", err
	}
	return out.AccessToken, nil
}

func importAll(baseURL, clientID, clientSecret string, rows []userRow) (summary, error) {
	var sum summary
	token, err := fetchM2MToken(baseURL, clientID, clientSecret)
	if err != nil {
		return sum, err
	}
	for _, row := range rows {
		payload, _ := json.Marshal(map[string]string{
			"primaryEmail":      row.Email,
			"passwordDigest":    row.PasswordHash,
			"passwordAlgorithm": "Bcrypt",
		})
		req, err := http.NewRequest(http.MethodPost, baseURL+"/api/users", bytes.NewReader(payload))
		if err != nil {
			return sum, err
		}
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json")
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			sum.Failed++
			fmt.Printf("失败 %s: %v\n", row.Email, err)
			continue
		}
		switch {
		case resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusCreated:
			sum.Created++
		case resp.StatusCode == http.StatusUnprocessableEntity:
			sum.Skipped++ // 已存在（重复导入安全）
			fmt.Printf("跳过（已存在）%s\n", row.Email)
		default:
			sum.Failed++
			body, _ := io.ReadAll(resp.Body)
			fmt.Printf("失败 %s: %d %s\n", row.Email, resp.StatusCode, body)
		}
		_ = resp.Body.Close()
	}
	return sum, nil
}

func readCSV(path string) ([]userRow, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer func() { _ = f.Close() }()
	records, err := csv.NewReader(f).ReadAll()
	if err != nil {
		return nil, err
	}
	var rows []userRow
	for i, rec := range records {
		if i == 0 && strings.EqualFold(rec[0], "email") {
			continue // 表头
		}
		if len(rec) < 2 || strings.TrimSpace(rec[0]) == "" {
			continue
		}
		rows = append(rows, userRow{Email: strings.TrimSpace(rec[0]), PasswordHash: strings.TrimSpace(rec[1])})
	}
	return rows, nil
}

func main() {
	csvPath := flag.String("csv", "", "CSV 文件（两列: email,password_hash）")
	flag.Parse()
	baseURL := strings.TrimRight(os.Getenv("LOGTO_ENDPOINT"), "/")
	clientID := os.Getenv("LOGTO_M2M_CLIENT_ID")
	clientSecret := os.Getenv("LOGTO_M2M_CLIENT_SECRET")
	if *csvPath == "" || baseURL == "" || clientID == "" || clientSecret == "" {
		fmt.Println("需要 --csv 与 LOGTO_ENDPOINT/LOGTO_M2M_CLIENT_ID/LOGTO_M2M_CLIENT_SECRET")
		os.Exit(1)
	}
	rows, err := readCSV(*csvPath)
	if err != nil {
		fmt.Println("读 CSV 失败:", err)
		os.Exit(1)
	}
	sum, err := importAll(baseURL, clientID, clientSecret, rows)
	if err != nil {
		fmt.Println("导入失败:", err)
		os.Exit(1)
	}
	fmt.Printf("完成：新建 %d，已存在跳过 %d，失败 %d\n", sum.Created, sum.Skipped, sum.Failed)
	if sum.Failed > 0 {
		os.Exit(1)
	}
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
mise run test-import
```

预期：PASS。

- [ ] **Step 5: 在 docs/setup.md 追加导出/导入操作段**

导出 CSV（在 mintpop-api 的数据库上执行；排除软删与无密码用户）：

```bash
psql "$DATABASE_URL" -c "\copy (SELECT email, password_hash FROM users WHERE deleted_at IS NULL AND password_hash IS NOT NULL AND password_hash <> '') TO 'users.csv' WITH CSV HEADER"
```

导入并抽样验证（用某存量账号旧密码在 Logto 登录页登录成功）：

```bash
export LOGTO_ENDPOINT=... LOGTO_M2M_CLIENT_ID=... LOGTO_M2M_CLIENT_SECRET=...
mise run import-users -- --csv users.csv
```

- [ ] **Step 6: Commit**

```bash
git add import/ docs/setup.md && git commit -m "feat: 存量用户导入脚本（bcrypt 哈希经 Management API 无感迁移）

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Phase B：mintpop-api 仓库（仅 user-portal）

### Task 6: 登录页统一登录按钮

**Files:**
- Create: `user-portal/src/components/auth/OidcLoginButton.vue`
- Modify: `user-portal/src/views/LoginView.vue`（第一步表单上方插入）
- Modify: `user-portal/src/i18n/locales/zh-CN/auth.ts`、`user-portal/src/i18n/locales/en-US/auth.ts`
- Test: `user-portal/src/views/__tests__/LoginView-oidc.test.ts`

**Interfaces:**
- Consumes: `useSettingsStore().settings` 的 `oidc_oauth_enabled`/`oidc_oauth_provider_name`（`api/types.ts:125-126` 已有）。
- Produces: 组件 `OidcLoginButton`（无 props，自读 settings store；未启用时渲染空）。

- [ ] **Step 1: 写失败测试**

参照 `__tests__/ForgotPasswordView.test.ts` 的挂载方式（pinia + i18n 初始化以现有 test-setup 为准）：

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import OidcLoginButton from '@/components/auth/OidcLoginButton.vue'
import { useSettingsStore } from '@/stores/settings'

function mountWithSettings(enabled: boolean) {
  const wrapper = mount(OidcLoginButton, {
    global: { plugins: [createTestingPinia({ createSpy: vi.fn, stubActions: true })] }
  })
  const settings = useSettingsStore()
  // @ts-expect-error 测试直接注入公开设置
  settings.settings = { oidc_oauth_enabled: enabled, oidc_oauth_provider_name: 'mintpop' }
  return wrapper
}

describe('OidcLoginButton', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('开关关闭时不渲染', async () => {
    const wrapper = mountWithSettings(false)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('开关开启时渲染并跳转 start 端点', async () => {
    const wrapper = mountWithSettings(true)
    await wrapper.vm.$nextTick()
    const assignSpy = vi.spyOn(window.location, 'assign' as never).mockImplementation(() => {})
    await wrapper.find('button').trigger('click')
    expect(assignSpy).toHaveBeenCalledWith(
      expect.stringContaining('/auth/oauth/oidc/start?redirect=')
    )
  })
})
```

（若现有测试对 `window.location` 有既定 mock 惯例，跟随之；组件内用 `window.location.assign(url)` 而非赋值 `href`，便于 spy。）

- [ ] **Step 2: 跑测试确认失败**

```bash
mise run test-user-portal
```

预期：FAIL（组件不存在）。

- [ ] **Step 3: 实现组件**

`user-portal/src/components/auth/OidcLoginButton.vue`：

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settings'

const route = useRoute()
const { t } = useI18n()
const settingsStore = useSettingsStore()

const enabled = computed(() => !!settingsStore.settings?.oidc_oauth_enabled)
const providerName = computed(
  () => settingsStore.settings?.oidc_oauth_provider_name?.trim() || 'mintpop'
)

// 统一登录是浏览器整页跳转（非 XHR）：后端 start 端点会 302 到认证中心
function startLogin(): void {
  const redirectTo = (route.query.redirect as string) || '/dashboard'
  const apiBase = ((import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api/v1').replace(/\/$/, '')
  window.location.assign(`${apiBase}/auth/oauth/oidc/start?redirect=${encodeURIComponent(redirectTo)}`)
}
</script>

<template>
  <div
    v-if="enabled"
    class="mb-6"
  >
    <button
      type="button"
      class="w-full rounded-xl2 border border-black/10 py-[13px] text-[15px] font-semibold text-text transition hover:bg-black/5"
      @click="startLogin"
    >
      {{ t('auth.oidcSignIn', { provider: providerName }) }}
    </button>
    <div class="mt-6 flex items-center gap-3">
      <div class="h-px flex-1 bg-black/10" />
      <span class="text-xs text-subtle">{{ t('auth.oidcOr') }}</span>
      <div class="h-px flex-1 bg-black/10" />
    </div>
  </div>
</template>
```

（按钮/分隔线的具体视觉 token 以 LoginView 现有样式为准微调，保持同一设计语言；深浅色适配跟随现有类。）

i18n 追加：

```ts
// zh-CN/auth.ts
oidcSignIn: '使用 {provider} 账号登录',
oidcOr: '或使用邮箱登录',
// en-US/auth.ts
oidcSignIn: 'Sign in with {provider}',
oidcOr: 'or continue with email',
```

`LoginView.vue`：import 组件，在「第一步：邮箱 + 密码」`<form v-else>` 内部顶端（邮箱输入框上方）插入 `<OidcLoginButton />`（TOTP 第二步不显示）。

- [ ] **Step 4: 跑测试与门禁**

```bash
mise run test-user-portal && mise run lint-user-portal
```

预期：全部 PASS。

- [ ] **Step 5: Commit**

```bash
git add user-portal && git commit -m "feat(user-portal): 登录页新增统一账号（OIDC）登录入口

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: OIDC 回调路由与视图

**Files:**
- Modify: `user-portal/src/api/types.ts`（追加交换响应类型）
- Modify: `user-portal/src/api/auth.ts`（追加 `exchangePendingOAuth`）
- Modify: `user-portal/src/router/index.ts`（追加 `/auth/oidc/callback`，参照 `/login` 的公开路由写法，置于 catchall 之前）
- Create: `user-portal/src/views/OidcCallbackView.vue`
- Modify: `user-portal/src/i18n/locales/zh-CN/auth.ts`、`en-US/auth.ts`
- Test: `user-portal/src/views/__tests__/OidcCallbackView.test.ts`

**Interfaces:**
- Consumes: 后端 `POST /auth/oauth/pending/exchange`（契约见 Global Constraints）；`authStore.fetchUser()`、`authStore.loginWith2FA(tempToken, code)`（`stores/auth.ts` 已有）。
- Produces: 路由 `/auth/oidc/callback`；类型 `OidcPendingExchangeResult`。

- [ ] **Step 1: 追加类型与 API**

`types.ts`：

```ts
/** 统一登录（OIDC）pending 交换结果：有 access_token 即登录完成；requires_2fa 走两步验证；其余为待人工处理状态 */
export interface OidcPendingExchangeResult {
  access_token?: string
  refresh_token?: string
  redirect?: string
  error?: string
  requires_2fa?: boolean
  temp_token?: string
  user_email_masked?: string
  auth_result?: string
}
```

`auth.ts`（与 `login()` 一致的 token 落地方式）：

```ts
/** 统一登录回调后凭 cookie 交换结果（POST /auth/oauth/pending/exchange）；拿到 token 即落地 */
export async function exchangePendingOAuth(): Promise<OidcPendingExchangeResult> {
  const { data } = await apiClient.post<OidcPendingExchangeResult>('/auth/oauth/pending/exchange', {})
  if (data.access_token) localStorage.setItem(TOKEN_KEY, data.access_token)
  if (data.refresh_token) localStorage.setItem(REFRESH_KEY, data.refresh_token)
  return data
}
```

- [ ] **Step 2: 写失败测试**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import OidcCallbackView from '@/views/OidcCallbackView.vue'
import * as authApi from '@/api/auth'

const replaceMock = vi.fn()
vi.mock('vue-router', async (orig) => ({
  ...(await orig()),
  useRouter: () => ({ replace: replaceMock }),
  useRoute: () => ({ query: {} })
}))

function mountView() {
  return mount(OidcCallbackView, {
    global: { plugins: [createTestingPinia({ createSpy: vi.fn, stubActions: true })] }
  })
}

describe('OidcCallbackView', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    replaceMock.mockReset()
    window.location.hash = ''
  })

  it('交换成功：拉取用户并跳转 redirect', async () => {
    vi.spyOn(authApi, 'exchangePendingOAuth').mockResolvedValue({
      access_token: 'tok', redirect: '/keys'
    })
    mountView()
    await flushPromises()
    expect(replaceMock).toHaveBeenCalledWith('/keys')
  })

  it('requires_2fa：展示验证码步骤，不跳转', async () => {
    vi.spyOn(authApi, 'exchangePendingOAuth').mockResolvedValue({
      requires_2fa: true, temp_token: 'tmp', user_email_masked: 'a***@x.com'
    })
    const wrapper = mountView()
    await flushPromises()
    expect(replaceMock).not.toHaveBeenCalled()
    expect(wrapper.find('input[inputmode="numeric"]').exists()).toBe(true)
  })

  it('同邮箱待绑定等 pending：展示引导文案与返回登录', async () => {
    vi.spyOn(authApi, 'exchangePendingOAuth').mockResolvedValue({
      error: 'bind_login_required'
    })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain('邮箱密码登录')
  })

  it('fragment 带 error：直接展示错误', async () => {
    window.location.hash = '#error=provider_error&message=upstream'
    const exchange = vi.spyOn(authApi, 'exchangePendingOAuth')
    const wrapper = mountView()
    await flushPromises()
    expect(exchange).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('登录未完成')
  })
})
```

- [ ] **Step 3: 跑测试确认失败**

```bash
mise run test-user-portal
```

预期：FAIL（视图不存在）。

- [ ] **Step 4: 实现视图与路由**

`OidcCallbackView.vue`：

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { exchangePendingOAuth } from '@/api/auth'
import AuthShell from '@/components/auth/AuthShell.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import { errMessage } from '@/utils/error'

const router = useRouter()
const { t } = useI18n()
const authStore = useAuthStore()

// 状态机：处理中 / 需要 TOTP / 引导走邮箱登录（同邮箱待绑定等 pending）/ 出错
const state = ref<'PROCESSING' | 'TOTP' | 'GUIDE' | 'ERROR'>('PROCESSING')
const errorDetail = ref('')
const tempToken = ref('')
const emailMasked = ref('')
const totpCode = ref('')
const loading = ref(false)

onMounted(async () => {
  // 后端失败时把 error 放在 URL fragment（成功不带任何 token 参数）
  const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const fragError = fragment.get('error')
  if (fragError) {
    errorDetail.value = fragment.get('message') || fragError
    state.value = 'ERROR'
    return
  }
  try {
    const resp = await exchangePendingOAuth()
    if (resp.requires_2fa && resp.temp_token) {
      tempToken.value = resp.temp_token
      emailMasked.value = resp.user_email_masked || ''
      state.value = 'TOTP'
      return
    }
    if (resp.access_token) {
      await authStore.fetchUser()
      router.replace(resp.redirect || '/dashboard')
      return
    }
    // 其余 pending（同邮箱待绑定/需补充信息等）v1 统一引导：先邮箱登录，再到个人资料绑定
    state.value = 'GUIDE'
  } catch (e) {
    errorDetail.value = errMessage(e, t('auth.oidcErrExchange'))
    state.value = 'ERROR'
  }
})

async function onSubmitTotp() {
  const code = totpCode.value.trim()
  if (!/^\d{6}$/.test(code)) return
  loading.value = true
  try {
    await authStore.loginWith2FA(tempToken.value, code)
    router.replace('/dashboard')
  } catch (e) {
    errorDetail.value = errMessage(e, t('auth.errLoginFailed'))
    state.value = 'ERROR'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell
    :kicker="t('auth.oidcCallbackKicker')"
    :headline-pre="t('auth.oidcCallbackHeadlinePre')"
    :headline-mark="t('auth.oidcCallbackHeadlineMark')"
    :headline-end="''"
    :desc="t('auth.loginBrandDesc')"
  >
    <div class="mb-8">
      <h1 class="mb-2 font-serif text-4xl font-medium tracking-tight text-text">
        {{ t('auth.oidcCallbackTitle') }}
      </h1>
    </div>

    <!-- 处理中 -->
    <div
      v-if="state === 'PROCESSING'"
      class="flex items-center gap-3 text-sm text-subtle"
    >
      <LoadingSpinner :size="18" />
      <span>{{ t('auth.oidcProcessing') }}</span>
    </div>

    <!-- 存量 2FA 用户：TOTP 验证码 -->
    <form
      v-else-if="state === 'TOTP'"
      @submit.prevent="onSubmitTotp"
    >
      <p
        v-if="emailMasked"
        class="mb-4 text-sm text-text3"
      >
        {{ emailMasked }}
      </p>
      <div class="mb-[26px]">
        <input
          v-model="totpCode"
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="6"
          class="fld pl-4!"
          :placeholder="t('auth.totpPlaceholder')"
        >
      </div>
      <button
        type="submit"
        :disabled="loading"
        class="flex w-full items-center justify-center gap-2 rounded-xl2 bg-accent py-[15px] text-[15px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
      >
        <LoadingSpinner
          v-if="loading"
          :size="16"
        />
        <span>{{ t('auth.totpVerify') }}</span>
      </button>
    </form>

    <!-- 同邮箱待绑定等：引导先邮箱登录再绑定 -->
    <div v-else-if="state === 'GUIDE'">
      <p class="mb-6 text-sm leading-relaxed text-text2">
        {{ t('auth.oidcBindGuide') }}
      </p>
      <router-link
        to="/login"
        class="block w-full rounded-xl2 bg-accent py-[15px] text-center text-[15px] font-semibold text-white transition hover:opacity-90"
      >
        {{ t('auth.oidcBackToLogin') }}
      </router-link>
    </div>

    <!-- 出错 -->
    <div v-else>
      <p class="mb-2 text-sm font-semibold text-neg">
        {{ t('auth.oidcErrorTitle') }}
      </p>
      <p class="mb-6 text-sm text-text3">
        {{ errorDetail }}
      </p>
      <router-link
        to="/login"
        class="block w-full rounded-xl2 bg-accent py-[15px] text-center text-[15px] font-semibold text-white transition hover:opacity-90"
      >
        {{ t('auth.oidcBackToLogin') }}
      </router-link>
    </div>
  </AuthShell>
</template>
```

路由（`router/index.ts`，catchall 之前，公开路由写法与 `/login` 一致）：

```ts
{
  path: '/auth/oidc/callback',
  component: () => import('@/views/OidcCallbackView.vue')
},
```

i18n 追加（zh-CN；en-US 对应英文）：

```ts
oidcCallbackKicker: '统一登录',
oidcCallbackHeadlinePre: '正在接入',
oidcCallbackHeadlineMark: 'mintpop 账号',
oidcCallbackTitle: '统一登录',
oidcProcessing: '正在完成登录…',
oidcErrExchange: '登录会话已失效，请重新发起登录',
oidcErrorTitle: '登录未完成',
oidcBackToLogin: '返回邮箱密码登录',
oidcBindGuide: '该邮箱已注册过本站账号。请先使用邮箱密码登录，然后在「个人资料 → 登录方式绑定」中绑定统一账号，之后即可一键统一登录。',
```

（AuthShell props 以其实际定义为准；若无 `headline-end` 空串用法，按现有页面惯例微调。）

- [ ] **Step 5: 跑测试与门禁**

```bash
mise run test-user-portal && mise run lint-user-portal
```

预期：全部 PASS。

- [ ] **Step 6: Commit**

```bash
git add user-portal && git commit -m "feat(user-portal): 新增统一登录（OIDC）回调页与 pending 交换流程

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Phase C：接线与上线

### Task 8: 上线手册 docs/rollout.md（mintpop-auth 仓库）

**Files:**
- Create: `/Users/yuebai/workspace/mintpop-auth/docs/rollout.md`

- [ ] **Step 1: 写手册**

必须包含三部分（全中文）：

**① mintpop-api 管理后台 OIDC 设置值**（backend 支持运行时 DB 设置，管理后台 设置 → OIDC 登录 填写，无需改 config.yaml、无需重启）：

| 设置项 | 值 |
|---|---|
| 启用 OIDC 登录 | 开 |
| Provider 名称 | `mintpop` |
| Client ID / Secret | Logto `mintpop-api` 应用的凭据 |
| Issuer URL | `https://auth.<主域>/oidc` |
| Discovery URL | `https://auth.<主域>/oidc/.well-known/openid-configuration` |
| Scopes | `openid email profile` |
| Redirect URL | `https://<主域>/api/v1/auth/oauth/oidc/callback` |
| Frontend Redirect URL | `/auth/oidc/callback` |
| Token 认证方式 | `client_secret_post`，PKCE 开 |
| 校验 ID Token | 开；允许算法**必须包含 Logto 实际签名算法**（Logto 默认签名密钥是 EC，id_token 常见为 `ES384`——在 Logto 控制台「签名密钥」处确认后，把该算法加进 `allowed_signing_algs`，如 `RS256,ES256,ES384,PS256`；配错这里是最常见的「回调必失败」原因） |
| 要求邮箱已验证 | 开 |

**② 灰度步骤**：1) Logto 上线+导入存量 → 2) 管理后台开 OIDC（登录页出现统一登录按钮，与邮箱登录并存）→ 3) 观察 1-2 周（关注 pending 引导路径的用户反馈）→ 4) 管理后台关闭「开放注册」，注册收敛到认证中心；本地邮箱登录长期保留（认证中心故障逃生口 + 管理员兜底）。

**③ 回退**：任一阶段管理后台关掉 OIDC 开关即可回到纯本地登录，无需发版。

- [ ] **Step 2: Commit**

```bash
git add docs/rollout.md && git commit -m "docs: 接入配置与灰度上线手册

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: 本地端到端验证

**Files:** 无新文件（验证任务；发现问题回对应 Task 修）。

- [ ] **Step 1: 起全套本地环境**

```bash
# 认证中心（.env 用 localhost 值）
cd /Users/yuebai/workspace/mintpop-auth && mise run up
# 按 docs/setup.md 完成控制台初始化，Redirect URI 配 http://localhost:5174/api/v1/auth/oauth/oidc/callback
# backend（本地不带 embed）
cd /Users/yuebai/workspace/mintpop-api/backend && go run ./cmd/server/
# user-portal 开发服务器（端口 5174，/api 代理到 backend）
cd /Users/yuebai/workspace/mintpop-api && mise run run-user-portal
```

- [ ] **Step 2: 管理后台按 rollout.md 填 OIDC 配置**（issuer 用 `http://localhost:3001/oidc`）。

- [ ] **Step 3: 走查四条路径并记录结果**

1. **新用户**：在 Logto 注册新邮箱 → 从 user-portal 点统一登录 → 应自动建号并直达 dashboard；
2. **存量同邮箱**：本地已有账号的邮箱走统一登录 → 应看到绑定引导页 → 按引导邮箱登录 → 个人资料绑定 → 再次统一登录直达；
3. **2FA 存量用户**（本地开过 TOTP 的账号绑定后）：统一登录 → 回调页出现验证码步骤 → 通过后进入 dashboard；
4. **失败路径**：Logto 停掉（`docker compose stop logto`）后点统一登录 → 错误可见、可返回邮箱登录，邮箱登录不受影响。

- [ ] **Step 4: 全量门禁**

```bash
cd /Users/yuebai/workspace/mintpop-api && mise run lint-user-portal && mise run test-user-portal
```

预期：全部 PASS。四条路径全通即计划完成。

---

## 自审记录

- Spec 覆盖：架构（Task 2）、零代码接入（Task 8 配置值 + Task 6/7 前端入口）、存量迁移（Task 5）、品牌与可达性（Task 4）、上线顺序与回退（Task 8/9）、测试（各 Task TDD + Task 9 E2E）——齐。
- 明确不做（YAGNI，spec 非目标之内）：统一登录路径的邀请码/推广码/aff 透传（快捷路径自动建号不带 aff；本地注册期间 aff 功能不受影响）、回调页完整 pending 交互（chooser/补邮箱/头像采纳——由绑定引导替代，主前端已有完整实现可后补）、CLI/桌面端与其它产品接入（各产品接入时另立计划）。
- 类型一致性：`OidcPendingExchangeResult` 字段与后端 `ExchangePendingOAuthCompletion` 响应、主前端 `PendingOAuthBindLoginResponse` 契约逐字对齐；mise task 名与文档引用一致。
