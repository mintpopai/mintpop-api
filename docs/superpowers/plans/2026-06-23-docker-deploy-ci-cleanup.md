# 项目整理：去 GoReleaser / Docker-only / CI 重建 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 去掉 GoReleaser 改为纯 Docker 部署，把工具链/命令收口到根 mise.toml，按个人规范重建 GitHub CI，并把 backend/user-portal 拆成两个 GHCR 镜像。

**Architecture:** 2 个镜像——`backend`（debian-slim + mise 构建，内嵌 `frontend`，含 PGDG pg-client）与 `user-portal`（debian-slim + mise 构建，nginx 托管）。CI 按组件拆分可复用质量门禁，发版由 `backend-v*` / `user-portal-v*` tag 触发推 GHCR。

**Tech Stack:** Go 1.26.4 + Gin/Ent、Vue3 + Vite + pnpm、Docker（BuildKit）、mise、GitHub Actions、PostgreSQL（外部）。

**Spec:** `docs/superpowers/specs/2026-06-23-docker-deploy-ci-cleanup-design.md`

## Global Constraints

- 工具链版本只在根 `mise.toml [tools]` 写一次：`go = "1.26.4"`、`node = "20.18.1"`、`pnpm = "9.15.9"`、`golangci-lint = "2.9.0"`。Dockerfile 内唯一允许钉的版本是 `MISE_VERSION = 2026.6.0`（mise 自举例外）与部署参数 `PG_CLIENT_VERSION = 18`。
- 组件名锚定：`backend` / `user-portal`，tag 前缀 `backend-v*` / `user-portal-v*`，workflow 文件名与之逐字一致。`frontend` 随 backend 走，不单独发布、不分配 tag。
- 部署只用 Docker；DB 与 Redis 均为**外部独立容器**，compose 不内置 postgres/redis。
- 镜像私有部署型：**不上 QEMU、不写 `platforms:`**，只出 amd64；只发 GHCR（不发 DockerHub）。镜像名 `ghcr.io/<owner>/sub2api`、`ghcr.io/<owner>/sub2api-user-portal`。
- Docker 构建 context 一律仓库根；COPY 源相对仓库根书写；每镜像一份 `Dockerfile.dockerignore`（白名单）。
- 每个 CI step 带 `name:`；release 保留 `workflow_dispatch` 逃生口、`concurrency` 串行 `cancel-in-progress: false`、质量门禁内置（`needs:`）。
- 注释/文档/提交信息用中文；提交信息结尾加 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。
- 关键事实：`frontend` 与后端运行时深度耦合（设置注入/nonce），保持内嵌不拆。`frontend` build 时 `LegalDocumentView.vue` 会 import `docs/legal/*.md?raw`，故 backend 镜像构建上下文必须含 `docs/legal/`。frontend 的 vite `outDir` = `../backend/internal/web/dist`。

---

### Task 1: 删除 GoReleaser 与旧发布链路

**Files:**
- Delete: `.goreleaser.yaml`、`.goreleaser.simple.yaml`、`Dockerfile.goreleaser`
- Delete: `.github/workflows/release.yml`
- Modify: `.dockerignore`（删除 GoReleaser 段；这份将被 Task 4/5 的 per-Dockerfile 白名单取代，但本任务先去除残留引用）

**Interfaces:**
- Produces: 仓库中不再有任何 `goreleaser` 引用（除历史 git 记录外）。

- [ ] **Step 1: 删除 GoReleaser 与 release.yml 文件**

```bash
cd /Users/yuebai/workspace/sub2api
git rm .goreleaser.yaml .goreleaser.simple.yaml Dockerfile.goreleaser .github/workflows/release.yml
```

- [ ] **Step 2: 从 .dockerignore 删除 GoReleaser 段**

编辑 `.dockerignore`，删掉这两行：

```
# GoReleaser
.goreleaser.yaml
```

- [ ] **Step 3: 验证仓库无 goreleaser 引用残留**

Run: `grep -rIn "goreleaser\|GoReleaser" --exclude-dir=node_modules --exclude-dir=.git .`
Expected: 仅可能命中本计划/设计文档（docs/superpowers/*）；无源码/workflow/Dockerfile 命中。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: 移除 GoReleaser 与旧发布工作流，改为 Docker-only

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: 新建根 mise.toml，调整 user-portal/mise.toml

**Files:**
- Create: `mise.toml`（仓库根）
- Modify: `user-portal/mise.toml`（删除 `[tools]`，避免与根重复）

**Interfaces:**
- Produces: 任务名供 CI/Dockerfile 调用——`install`、`install-backend`、`install-frontend`、`install-user-portal`、`build`、`lint-backend`、`lint-frontend`、`lint-user-portal`、`test-backend`、`test-frontend`、`test-user-portal`、`backend-image`、`user-portal-image`。

- [ ] **Step 1: 创建根 mise.toml**

Create `mise.toml`:

```toml
# 工具链与命令单一来源（统一通过 mise 管理）
[tools]
go = "1.26.4"               # 与 backend/go.mod 对齐
node = "20.18.1"            # 固定具体版本
pnpm = "9.15.9"
golangci-lint = "2.9.0"

# ---------- 依赖安装 ----------
[tasks.install]
description = "安装全部组件依赖（backend + frontend + user-portal）"
depends = ["install-backend", "install-frontend", "install-user-portal"]

[tasks.install-backend]
description = "下载后端 Go 依赖"
dir = "backend"
run = "go mod download"

[tasks.install-frontend]
description = "安装 frontend 依赖"
dir = "frontend"
run = "pnpm install --frozen-lockfile"

[tasks.install-user-portal]
description = "安装 user-portal 依赖"
dir = "user-portal"
run = "pnpm install --frozen-lockfile"

# ---------- 构建 ----------
[tasks.build]
description = "编译后端单二进制（内嵌 frontend）"
depends = ["install-frontend"]
run = [
  "pnpm --dir frontend run build",
  "cd backend && CGO_ENABLED=0 go build -tags embed -trimpath -o bin/server ./cmd/server",
]

# ---------- 质量：lint ----------
[tasks.lint-backend]
description = "后端 golangci-lint"
dir = "backend"
run = "golangci-lint run ./..."

[tasks.lint-frontend]
description = "frontend ESLint 检查"
depends = ["install-frontend"]
dir = "frontend"
run = "pnpm run lint:check"

[tasks.lint-user-portal]
description = "user-portal ESLint 检查"
depends = ["install-user-portal"]
dir = "user-portal"
run = "pnpm run lint:check"

# ---------- 质量：test ----------
[tasks.test-backend]
description = "后端单测 + 集成测试"
dir = "backend"
run = [
  "go test -tags=unit ./...",
  "go test -tags=integration ./...",
]

[tasks.test-frontend]
description = "frontend 类型检查 + 关键路径 vitest"
depends = ["install-frontend"]
dir = "frontend"
run = [
  "pnpm run typecheck",
  "pnpm exec vitest run src/views/auth/__tests__/LinuxDoCallbackView.spec.ts src/views/auth/__tests__/WechatCallbackView.spec.ts src/views/user/__tests__/PaymentView.spec.ts src/views/user/__tests__/PaymentResultView.spec.ts src/components/user/profile/__tests__/ProfileInfoCard.spec.ts src/views/admin/__tests__/SettingsView.spec.ts",
]

[tasks.test-user-portal]
description = "user-portal 类型检查"
depends = ["install-user-portal"]
dir = "user-portal"
run = "pnpm run typecheck"

# ---------- 镜像 ----------
[tasks.backend-image]
description = "构建 backend 镜像（backend/Dockerfile，context 取仓库根）"
run = "docker build -f backend/Dockerfile -t sub2api-backend:local ."

[tasks.user-portal-image]
description = "构建 user-portal 镜像（user-portal/Dockerfile，context 取仓库根）"
run = "docker build -f user-portal/Dockerfile -t sub2api-user-portal:local ."
```

- [ ] **Step 2: 精简 user-portal/mise.toml**

把 `user-portal/mise.toml` 改为（删除 `[tools]`，版本统一由根提供；保留组件级便捷 task）：

```toml
# user-portal 组件级便捷 task；工具链版本统一由仓库根 mise.toml 提供
[tasks.dev]
description = "启动开发服务器（端口 5174，/api 代理到后端）"
run = "pnpm dev"

[tasks.build]
description = "类型检查 + 生产构建"
run = "pnpm build"
```

- [ ] **Step 3: 验证 mise 任务可解析与工具安装**

Run: `cd /Users/yuebai/workspace/sub2api && mise install && mise tasks ls`
Expected: 成功安装 go/node/pnpm/golangci-lint；任务列表含上面定义的全部 task，无解析错误。

- [ ] **Step 4: 验证构建与质量任务跑通**

Run: `mise run install && mise run build && mise run lint-frontend && mise run test-frontend`
Expected: 依赖安装成功、`backend/bin/server` 产出、frontend lint/typecheck/关键 vitest 通过。

- [ ] **Step 5: Commit**

```bash
git add mise.toml user-portal/mise.toml
git commit -m "build: 新增根 mise.toml 作工具链与命令单一来源

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: 迁移 docker-entrypoint.sh 到 backend/（su-exec → gosu）

**Files:**
- Create: `backend/docker-entrypoint.sh`
- Delete: `deploy/docker-entrypoint.sh`（在 Task 7 deploy 瘦身中随目录处理；本任务先建新文件）

**Interfaces:**
- Produces: `backend/docker-entrypoint.sh`，供 Task 4 的 `backend/Dockerfile` COPY。

- [ ] **Step 1: 创建 backend/docker-entrypoint.sh（gosu 版）**

Create `backend/docker-entrypoint.sh`:

```sh
#!/bin/sh
set -e

# 以 root 启动时修正数据目录权限。
# Docker 命名卷 / 宿主机挂载可能属 root，导致非 root 的 sub2api 用户无法写入。
if [ "$(id -u)" = "0" ]; then
    mkdir -p /app/data
    # 用 || true 避免只读挂载文件（如 config.yaml:ro）导致失败
    chown -R sub2api:sub2api /app/data 2>/dev/null || true
    # 以 sub2api 身份重新执行本脚本，使下面的 flag 检测也在正确用户下运行
    exec gosu sub2api "$0" "$@"
fi

# 兼容：若首个参数是 flag（如 --help），补上默认二进制，
# 行为与旧 ENTRYPOINT ["/app/sub2api"] 一致。
if [ "${1#-}" != "$1" ]; then
    set -- /app/sub2api "$@"
fi

exec "$@"
```

- [ ] **Step 2: 赋可执行位**

Run: `chmod +x backend/docker-entrypoint.sh && head -1 backend/docker-entrypoint.sh`
Expected: 输出 `#!/bin/sh`。

- [ ] **Step 3: Commit**

```bash
git add backend/docker-entrypoint.sh
git commit -m "build: entrypoint 迁移至 backend/ 并改用 gosu

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: 重写 backend/Dockerfile（debian-slim + mise + PGDG）

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/Dockerfile.dockerignore`
- Delete: `Dockerfile`（仓库根旧版，被本任务取代）

**Interfaces:**
- Consumes: 根 `mise.toml`（Task 2）、`backend/docker-entrypoint.sh`（Task 3）。
- Produces: 镜像 `sub2api-backend:local`，含 `/app/sub2api`、`pg_dump`/`psql`、非 root 运行、`/health` 健康检查。

- [ ] **Step 1: 创建 backend/Dockerfile**

Create `backend/Dockerfile`:

```dockerfile
# =============================================================================
# Sub2API Backend 镜像（debian-slim + mise 多阶段，内嵌 frontend）
# =============================================================================
ARG GOPROXY=https://goproxy.cn,direct
ARG GOSUMDB=sum.golang.google.cn
ARG PG_CLIENT_VERSION=18

# -----------------------------------------------------------------------------
# 构建阶段：debian-slim + curl 装 mise（官方写法）
# -----------------------------------------------------------------------------
FROM debian:13-slim AS build

ENV MISE_VERSION=2026.6.0
ENV MISE_DATA_DIR=/mise MISE_CONFIG_DIR=/mise MISE_CACHE_DIR=/mise/cache \
    MISE_INSTALL_PATH=/usr/local/bin/mise PATH=/mise/shims:$PATH
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl git ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && curl https://mise.run | sh

ARG GOPROXY
ARG GOSUMDB
ENV GOPROXY=${GOPROXY} GOSUMDB=${GOSUMDB}

WORKDIR /app
# 仅装本镜像所需工具（不 mise install 全装）
COPY mise.toml ./
RUN mise trust && mise install go node pnpm

# 依赖清单先 COPY（层缓存）
COPY backend/go.mod backend/go.sum ./backend/
RUN cd backend && go mod download
COPY frontend/package.json frontend/pnpm-lock.yaml ./frontend/
RUN cd frontend && pnpm install --frozen-lockfile

# 源码后 COPY。先放后端源码，再 build 前端（其 outDir 写入 backend/internal/web/dist，
# 避免被后端源码 COPY 覆盖）。LegalDocumentView.vue 需 docs/legal/*.md。
COPY backend/ ./backend/
COPY frontend/ ./frontend/
COPY docs/legal/ ./docs/legal/
RUN cd frontend && pnpm run build

# 编译后端（embed 内嵌前端）；VERSION 优先级：build arg > cmd/server/VERSION
ARG VERSION=
ARG COMMIT=docker
ARG DATE
RUN cd backend && \
    VERSION_VALUE="${VERSION}" && \
    if [ -z "${VERSION_VALUE}" ]; then VERSION_VALUE="$(tr -d '\r\n' < ./cmd/server/VERSION)"; fi && \
    DATE_VALUE="${DATE:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}" && \
    CGO_ENABLED=0 GOOS=linux go build \
      -tags embed \
      -ldflags="-s -w -X main.Version=${VERSION_VALUE} -X main.Commit=${COMMIT} -X main.Date=${DATE_VALUE} -X main.BuildType=release" \
      -trimpath \
      -o /app/sub2api \
      ./cmd/server

# -----------------------------------------------------------------------------
# 运行阶段：debian-slim + PGDG apt 装 pg-client
# -----------------------------------------------------------------------------
FROM debian:13-slim AS runtime
ARG PG_CLIENT_VERSION

LABEL description="Sub2API - AI API Gateway Platform (backend)"

# 运行时依赖：ca-certificates/tzdata/gosu/curl(healthcheck) + PGDG postgresql-client
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates tzdata gosu curl gnupg \
    && install -d /usr/share/postgresql-common/pgdg \
    && curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
         https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] http://apt.postgresql.org/pub/repos/apt $(. /etc/os-release && echo $VERSION_CODENAME)-pgdg main" \
         > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client-${PG_CLIENT_VERSION} \
    && apt-get purge -y gnupg \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

# 非 root 用户
RUN groupadd -g 1000 sub2api && useradd -u 1000 -g sub2api -s /bin/sh -m sub2api

WORKDIR /app
COPY --from=build --chown=sub2api:sub2api /app/sub2api /app/sub2api
COPY --from=build --chown=sub2api:sub2api /app/backend/resources /app/resources
RUN mkdir -p /app/data && chown sub2api:sub2api /app/data

COPY backend/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -fsS -m 5 "http://localhost:${SERVER_PORT:-8080}/health" || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["/app/sub2api"]
```

- [ ] **Step 2: 创建 backend/Dockerfile.dockerignore（白名单）**

Create `backend/Dockerfile.dockerignore`:

```
*
!mise.toml
!backend
!frontend
!docs
docs/*
!docs/legal
**/node_modules
**/dist
backend/bin
**/.git
```

- [ ] **Step 3: 删除仓库根旧 Dockerfile**

```bash
git rm Dockerfile
```

- [ ] **Step 4: 构建 backend 镜像**

Run: `cd /Users/yuebai/workspace/sub2api && mise run backend-image`
Expected: 构建成功，最终 `sub2api-backend:local` 生成，无报错。

- [ ] **Step 5: 冒烟验证 pg-client 与二进制**

Run: `docker run --rm --entrypoint sh sub2api-backend:local -c "pg_dump --version && psql --version && /app/sub2api --help 2>&1 | head -3"`
Expected: `pg_dump (PostgreSQL) 18.x`、`psql (PostgreSQL) 18.x`，二进制可执行输出帮助/版本信息。

- [ ] **Step 6: Commit**

```bash
git add backend/Dockerfile backend/Dockerfile.dockerignore
git commit -m "build: 重写 backend Dockerfile 为 debian-slim + mise + PGDG pg-client

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: 新建 user-portal/Dockerfile（debian-slim + mise → nginx）

**Files:**
- Create: `user-portal/Dockerfile`
- Create: `user-portal/nginx.conf`
- Create: `user-portal/Dockerfile.dockerignore`

**Interfaces:**
- Consumes: 根 `mise.toml`（Task 2）。
- Produces: 镜像 `sub2api-user-portal:local`，nginx 托管 SPA，含 history fallback。

- [ ] **Step 1: 创建 user-portal/nginx.conf**

Create `user-portal/nginx.conf`:

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # 静态资源带较长缓存
    location /assets/ {
        try_files $uri =404;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    # SPA history 路由回退
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

- [ ] **Step 2: 创建 user-portal/Dockerfile**

Create `user-portal/Dockerfile`:

```dockerfile
# =============================================================================
# Sub2API user-portal 镜像（debian-slim + mise 构建 → nginx 托管）
# =============================================================================
FROM debian:13-slim AS build

ENV MISE_VERSION=2026.6.0
ENV MISE_DATA_DIR=/mise MISE_CONFIG_DIR=/mise MISE_CACHE_DIR=/mise/cache \
    MISE_INSTALL_PATH=/usr/local/bin/mise PATH=/mise/shims:$PATH
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl git ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && curl https://mise.run | sh

WORKDIR /app
COPY mise.toml ./
RUN mise trust && mise install node pnpm

COPY user-portal/package.json user-portal/pnpm-lock.yaml ./user-portal/
RUN cd user-portal && pnpm install --frozen-lockfile
COPY user-portal/ ./user-portal/
RUN cd user-portal && pnpm run build

# -----------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime
COPY user-portal/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/user-portal/dist /usr/share/nginx/html
EXPOSE 80
```

- [ ] **Step 3: 创建 user-portal/Dockerfile.dockerignore（白名单）**

Create `user-portal/Dockerfile.dockerignore`:

```
*
!mise.toml
!user-portal
user-portal/node_modules
user-portal/dist
**/.git
```

- [ ] **Step 4: 构建 user-portal 镜像**

Run: `cd /Users/yuebai/workspace/sub2api && mise run user-portal-image`
Expected: 构建成功生成 `sub2api-user-portal:local`。

- [ ] **Step 5: 冒烟验证 nginx 托管**

Run:
```bash
docker run -d --rm -p 18080:80 --name up-smoke sub2api-user-portal:local
sleep 2
curl -fsS http://localhost:18080/ | grep -qi "<!doctype html\|<div id=\"app\"" && echo OK
curl -fsS http://localhost:18080/some/spa/route | grep -qi "<!doctype html" && echo FALLBACK_OK
docker stop up-smoke
```
Expected: 输出 `OK` 与 `FALLBACK_OK`（首页与任意路由都回 index.html）。

- [ ] **Step 6: Commit**

```bash
git add user-portal/Dockerfile user-portal/nginx.conf user-portal/Dockerfile.dockerignore
git commit -m "build: 新增 user-portal 独立 nginx 镜像

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: 重建 CI——可复用质量门禁 + 组件 CI

**Files:**
- Create: `.github/workflows/backend-quality.yml`
- Create: `.github/workflows/frontend-quality.yml`
- Create: `.github/workflows/user-portal-quality.yml`
- Create: `.github/workflows/backend-ci.yml`（覆盖旧同名文件）
- Create: `.github/workflows/user-portal-ci.yml`
- Delete: 旧 `.github/workflows/backend-ci.yml`（用新内容覆盖）

**Interfaces:**
- Consumes: 根 `mise.toml` task（Task 2）。
- Produces: 可复用 workflow `backend-quality.yml` / `frontend-quality.yml` / `user-portal-quality.yml`（均 `on: workflow_call`），供 Task 8 的 release 复用。

- [ ] **Step 1: 创建 backend-quality.yml**

Create `.github/workflows/backend-quality.yml`:

```yaml
name: Backend Quality

on:
  workflow_call:

permissions:
  contents: read

jobs:
  backend-quality:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v6
      - name: Set up mise
        uses: jdx/mise-action@v2
      - name: Lint backend
        run: mise run lint-backend
      - name: Test backend
        run: mise run test-backend
```

- [ ] **Step 2: 创建 frontend-quality.yml**

Create `.github/workflows/frontend-quality.yml`:

```yaml
name: Frontend Quality

on:
  workflow_call:

permissions:
  contents: read

jobs:
  frontend-quality:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v6
      - name: Set up mise
        uses: jdx/mise-action@v2
      - name: Lint frontend
        run: mise run lint-frontend
      - name: Test frontend
        run: mise run test-frontend
```

- [ ] **Step 3: 创建 user-portal-quality.yml**

Create `.github/workflows/user-portal-quality.yml`:

```yaml
name: User Portal Quality

on:
  workflow_call:

permissions:
  contents: read

jobs:
  user-portal-quality:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v6
      - name: Set up mise
        uses: jdx/mise-action@v2
      - name: Lint user-portal
        run: mise run lint-user-portal
      - name: Test user-portal
        run: mise run test-user-portal
```

- [ ] **Step 4: 覆盖 backend-ci.yml（backend 含内嵌 frontend，调用两份质量门禁）**

用以下内容覆盖 `.github/workflows/backend-ci.yml`：

```yaml
name: Backend CI

on:
  push:
  pull_request:

permissions:
  contents: read

jobs:
  backend-quality:
    name: Backend Quality
    uses: ./.github/workflows/backend-quality.yml
  frontend-quality:
    name: Frontend Quality
    uses: ./.github/workflows/frontend-quality.yml
```

- [ ] **Step 5: 创建 user-portal-ci.yml**

Create `.github/workflows/user-portal-ci.yml`:

```yaml
name: User Portal CI

on:
  push:
  pull_request:

permissions:
  contents: read

jobs:
  user-portal-quality:
    name: User Portal Quality
    uses: ./.github/workflows/user-portal-quality.yml
```

- [ ] **Step 6: 校验 workflow YAML 合法**

Run: `for f in .github/workflows/backend-quality.yml .github/workflows/frontend-quality.yml .github/workflows/user-portal-quality.yml .github/workflows/backend-ci.yml .github/workflows/user-portal-ci.yml; do python3 -c "import yaml,sys; yaml.safe_load(open('$f')); print('OK', '$f')"; done`
Expected: 5 行 `OK ...`，无异常。

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/backend-quality.yml .github/workflows/frontend-quality.yml .github/workflows/user-portal-quality.yml .github/workflows/backend-ci.yml .github/workflows/user-portal-ci.yml
git commit -m "ci: 重建为 mise 化、按组件拆分的质量门禁与组件 CI

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: 发版 workflow——backend-release / user-portal-release

**Files:**
- Create: `.github/workflows/backend-release.yml`
- Create: `.github/workflows/user-portal-release.yml`

**Interfaces:**
- Consumes: Task 6 的 quality workflow；Task 4/5 的 Dockerfile。
- Produces: tag `backend-v*` → 推 `ghcr.io/<owner>/sub2api`；tag `user-portal-v*` → 推 `ghcr.io/<owner>/sub2api-user-portal`。

- [ ] **Step 1: 创建 backend-release.yml**

Create `.github/workflows/backend-release.yml`:

```yaml
name: Backend Release

on:
  push:
    tags:
      - 'backend-v*'
  workflow_dispatch:

permissions:
  contents: read
  packages: write

concurrency:
  group: backend-release-${{ github.ref }}
  cancel-in-progress: false

env:
  IMAGE: ghcr.io/${{ github.repository_owner }}/sub2api

jobs:
  backend-quality:
    name: Backend Quality
    uses: ./.github/workflows/backend-quality.yml
  frontend-quality:
    name: Frontend Quality
    uses: ./.github/workflows/frontend-quality.yml

  build-push:
    name: Build and Push
    needs: [backend-quality, frontend-quality]
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v6
      - name: Set up Buildx
        uses: docker/setup-buildx-action@v3
      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.repository_owner }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - name: Docker metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.IMAGE }}
          tags: |
            type=semver,pattern={{version}},value=${{ github.ref_name }},match=backend-v(.+)
            type=sha,enable=${{ github.ref_type != 'tag' }}
          flavor: |
            latest=auto
      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          file: backend/Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

- [ ] **Step 2: 创建 user-portal-release.yml**

Create `.github/workflows/user-portal-release.yml`:

```yaml
name: User Portal Release

on:
  push:
    tags:
      - 'user-portal-v*'
  workflow_dispatch:

permissions:
  contents: read
  packages: write

concurrency:
  group: user-portal-release-${{ github.ref }}
  cancel-in-progress: false

env:
  IMAGE: ghcr.io/${{ github.repository_owner }}/sub2api-user-portal

jobs:
  user-portal-quality:
    name: User Portal Quality
    uses: ./.github/workflows/user-portal-quality.yml

  build-push:
    name: Build and Push
    needs: [user-portal-quality]
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v6
      - name: Set up Buildx
        uses: docker/setup-buildx-action@v3
      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.repository_owner }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - name: Docker metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.IMAGE }}
          tags: |
            type=semver,pattern={{version}},value=${{ github.ref_name }},match=user-portal-v(.+)
            type=sha,enable=${{ github.ref_type != 'tag' }}
          flavor: |
            latest=auto
      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          file: user-portal/Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

- [ ] **Step 3: 校验 release workflow YAML 合法**

Run: `for f in .github/workflows/backend-release.yml .github/workflows/user-portal-release.yml; do python3 -c "import yaml,sys; yaml.safe_load(open('$f')); print('OK', '$f')"; done`
Expected: 2 行 `OK ...`。

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/backend-release.yml .github/workflows/user-portal-release.yml
git commit -m "ci: 新增 backend/user-portal 发版工作流（tag 触发推 GHCR）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: mise 化 security-scan.yml

**Files:**
- Modify: `.github/workflows/security-scan.yml`

**Interfaces:**
- Consumes: 根 `mise.toml`（go 工具链、frontend 依赖任务）。

- [ ] **Step 1: 用 mise 重写 security-scan.yml**

用以下内容覆盖 `.github/workflows/security-scan.yml`：

```yaml
name: Security Scan

on:
  push:
  pull_request:
  schedule:
    - cron: '0 3 * * 1'

permissions:
  contents: read

jobs:
  backend-security:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - name: Checkout
        uses: actions/checkout@v6
      - name: Set up mise
        uses: jdx/mise-action@v2
      - name: Run govulncheck
        working-directory: backend
        run: |
          go install golang.org/x/vuln/cmd/govulncheck@latest
          govulncheck ./...

  frontend-security:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v6
      - name: Set up mise
        uses: jdx/mise-action@v2
      - name: Install frontend dependencies
        run: mise run install-frontend
      - name: Run pnpm audit
        working-directory: frontend
        run: pnpm audit --prod --audit-level=high --json > audit.json || true
      - name: Check audit exceptions
        run: |
          python tools/check_pnpm_audit_exceptions.py \
            --audit frontend/audit.json \
            --exceptions .github/audit-exceptions.yml
```

- [ ] **Step 2: 校验 YAML 合法**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/security-scan.yml')); print('OK')"`
Expected: `OK`。

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/security-scan.yml
git commit -m "ci: security-scan 改走 mise

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: deploy/ 瘦身——删除裸机/残留，搬走 entrypoint

**Files:**
- Delete: `deploy/install.sh`、`deploy/install-datamanagementd.sh`、`deploy/sub2api.service`、`deploy/sub2api-datamanagementd.service`、`deploy/DATAMANAGEMENTD_CN.md`、`deploy/docker-deploy.sh`、`deploy/build_image.sh`、`deploy/DOCKER.md`、`deploy/Dockerfile`、`deploy/codex-instructions.md.tmpl`、`deploy/Makefile`、`deploy/docker-entrypoint.sh`、`deploy/docker-compose.dev.yml`、`deploy/docker-compose.local.yml`、`deploy/docker-compose.standalone.yml`

**Interfaces:**
- Produces: `deploy/` 仅余将在 Task 10 更新的 `docker-compose.yml`、`Caddyfile`、`config.example.yaml`、`.env.example`、`.gitignore`。

- [ ] **Step 1: 删除裸机安装、fork 残留与重复文件**

```bash
cd /Users/yuebai/workspace/sub2api
git rm deploy/install.sh deploy/install-datamanagementd.sh \
       deploy/sub2api.service deploy/sub2api-datamanagementd.service \
       deploy/DATAMANAGEMENTD_CN.md deploy/docker-deploy.sh deploy/build_image.sh \
       deploy/DOCKER.md deploy/Dockerfile deploy/codex-instructions.md.tmpl \
       deploy/Makefile deploy/docker-entrypoint.sh \
       deploy/docker-compose.dev.yml deploy/docker-compose.local.yml deploy/docker-compose.standalone.yml
```

- [ ] **Step 2: 确认剩余文件**

Run: `ls deploy/`
Expected: 仅剩 `Caddyfile`、`config.example.yaml`、`.env.example`、`.gitignore`、`docker-compose.yml`（`.gitignore` 用 `ls -a` 可见）。

- [ ] **Step 3: 校验无引用已删文件**

Run: `grep -rIn "docker-entrypoint.sh\|deploy/install.sh\|deploy/Dockerfile\|build_image.sh\|docker-deploy.sh" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=docs .`
Expected: 无命中（Task 3/4 已把 entrypoint 改到 backend/）。如有命中需先修正再继续。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(deploy): 删除裸机安装脚本与 fork 残留，仅保留 Docker 必需品

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 10: deploy/ 重写——单一 compose（外部 DB/Redis）+ 双前端 Caddyfile

**Files:**
- Modify: `deploy/docker-compose.yml`（重写为 backend + user-portal 两服务，指向外部 DB/Redis）
- Modify: `deploy/Caddyfile`（双前端分流）
- Read: `deploy/.env.example`（核对变量名是否匹配 compose 引用）

**Interfaces:**
- Consumes: GHCR 镜像 `ghcr.io/<owner>/sub2api`、`ghcr.io/<owner>/sub2api-user-portal`。

- [ ] **Step 1: 核对环境变量名**

Run: `grep -nE "POSTGRES|REDIS|DATABASE|SERVER_PORT|JWT|TOTP" deploy/.env.example | head -40`
Expected: 记录后端连接外部 DB/Redis 所需的变量名（如 `DATABASE_*` / `REDIS_*` / `SERVER_PORT`），供下一步 compose 的 `environment`/`env_file` 引用。

- [ ] **Step 2: 重写 deploy/docker-compose.yml**

用以下内容覆盖 `deploy/docker-compose.yml`（`OWNER` 处替换为实际 GHCR owner；后端配置经 `.env` + 挂载 `config.yaml` 注入，DB/Redis 为外部）：

```yaml
# Sub2API Docker 部署：backend + user-portal 两镜像
# DB 与 Redis 为外部独立容器/服务，本文件不内置。
services:
  backend:
    image: ghcr.io/OWNER/sub2api:latest
    restart: unless-stopped
    env_file:
      - .env
    volumes:
      - ./config.yaml:/app/config.yaml:ro
      - backend_data:/app/data
    ports:
      - "8080:8080"
    healthcheck:
      test: ["CMD", "curl", "-fsS", "-m", "5", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

  user-portal:
    image: ghcr.io/OWNER/sub2api-user-portal:latest
    restart: unless-stopped
    ports:
      - "8081:80"

volumes:
  backend_data:
```

- [ ] **Step 3: 重写 deploy/Caddyfile（双前端分流）**

用以下内容覆盖 `deploy/Caddyfile`（按域名分流：用户门户独立域名，API 与既有 admin 前端走 backend）：

```caddyfile
# 用户门户（独立 SPA 镜像）
portal.example.com {
    reverse_proxy user-portal:80
}

# 平台主域：API + 内嵌 admin 前端均由 backend 提供
app.example.com {
    # 网关/接口路径直达后端
    @api path /api/* /v1/* /v1beta/* /backend-api/* /antigravity/* /setup/* /responses /responses/* /images/* /health
    reverse_proxy @api backend:8080

    # 其余（内嵌 frontend）也由 backend 提供
    reverse_proxy backend:8080
}
```

- [ ] **Step 4: 校验 compose 语法**

Run: `cd deploy && docker compose -f docker-compose.yml config -q && echo COMPOSE_OK`
Expected: 输出 `COMPOSE_OK`（语法合法；`OWNER`/域名为占位不影响 config 校验）。

- [ ] **Step 5: Commit**

```bash
cd /Users/yuebai/workspace/sub2api
git add deploy/docker-compose.yml deploy/Caddyfile
git commit -m "chore(deploy): 单一 compose 指向外部 DB/Redis，Caddyfile 双前端分流

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 11: README/install 文案改为 Docker-only

**Files:**
- Read: `README.md`、`README_JA.md`、`deploy/README.md`（已在 Task 9 删除？确认）
- Modify: `README.md`（及 `README_JA.md` 如含相同段落）——移除二进制下载/裸机安装/GoReleaser/DockerHub 引导，改为 GHCR + compose 部署

**Interfaces:**
- Produces: 文档与实际部署方式一致。

- [ ] **Step 1: 定位需修改的文案位置（先列清单，不直接大改）**

Run: `grep -rIn "goreleaser\|GoReleaser\|install.sh\|hub.docker\|dockerhub\|DockerHub\|releases/download\|裸机\|systemctl\|datamanagementd" README.md README_JA.md`
Expected: 输出全部命中行号清单。**逐条人工确认要改的段落**后再进行 Step 2（避免误删与部署无关内容）。

- [ ] **Step 2: 按清单替换为 Docker-only 引导**

将命中的「二进制下载 / install.sh / DockerHub / GoReleaser / 裸机 systemd」段落替换为 GHCR 拉取 + `deploy/docker-compose.yml` 部署说明。示例片段（插入到 README 部署章节）：

```markdown
## 部署（仅支持 Docker）

镜像发布在 GHCR：

- 后端（内嵌管理后台前端）：`ghcr.io/<owner>/sub2api`
- 用户门户：`ghcr.io/<owner>/sub2api-user-portal`

```bash
cd deploy
cp .env.example .env        # 按需修改：外部 DB/Redis 连接、密钥等
cp config.example.yaml config.yaml
docker compose up -d
```

数据库与 Redis 为外部独立服务，不随本项目启动。
```

- [ ] **Step 3: 验证无残留过时引导**

Run: `grep -rIn "goreleaser\|releases/download\|install.sh\|hub.docker" README.md README_JA.md`
Expected: 无命中（或仅剩有意保留的历史说明）。

- [ ] **Step 4: Commit**

```bash
git add README.md README_JA.md
git commit -m "docs: 部署说明改为 Docker-only（GHCR + compose）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## 自查结论

- **Spec 覆盖**：去 GoReleaser(Task1)、根 mise.toml(Task2)、entrypoint 迁移(Task3)、backend 镜像 debian+mise+PGDG(Task4)、user-portal 镜像(Task5)、按组件拆分 CI(Task6)、发版 workflow(Task7)、security-scan mise 化(Task8)、deploy 瘦身(Task9)+重写(Task10)、文档 Docker-only(Task11)。spec 各节均有对应任务。
- **占位符**：无 TBD/TODO；文档类任务（Task11）显式要求「先 grep 列清单再改」属流程控制，非占位。
- **类型/名称一致性**：mise task 名（`lint-backend`/`test-backend`/`lint-frontend`/`test-frontend`/`lint-user-portal`/`test-user-portal`/`install-frontend`/`backend-image`/`user-portal-image`）在 Task2 定义、Task4/5/6/8 一致引用；镜像名 `ghcr.io/<owner>/sub2api(-user-portal)` 在 Task7/10/11 一致；tag 前缀 `backend-v*`/`user-portal-v*` 在 Task7 与 metadata `match=` 一致。

## 待执行者注意的开放点

- `mise.toml` 中 `golangci-lint = "2.9.0"` 取自原 CI 的 `v2.9`；若 mise registry 无该精确补丁号，取最接近的 2.9.x。
- `MISE_VERSION=2026.6.0` 取自本机版本；如官方镜像构建期解析失败，改用当时最新稳定 `vYYYY.M.D`。
- Task10 的 `OWNER` 与 Caddyfile 域名为占位，部署时替换为真实值。
- Task4 集成测试若在 CI 无 DB 环境会失败，需确认 `go test -tags=integration` 是否依赖外部服务（沿用原 CI 行为，原 backend-ci 也跑 integration）。
