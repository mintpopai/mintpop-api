# 项目整理：去 GoReleaser、Docker-only 部署、CI 重建 设计文档

- 日期：2026-06-23
- 分支：user-portal
- 范围：构建/发布/部署/CI 的工程化整理，不改业务代码逻辑

## 1. 背景与目标

仓库是一个 fork 的 AI API 网关（Go 后端 + Vue 前端）。当前发布链路走 GoReleaser（多平台二进制 + GHCR/DockerHub 镜像 + Telegram 通知），并保留大量裸机/systemd 安装脚本。现新增了一个独立的 Mint 风格用户前端 `user-portal/`，与既有 `frontend/` 长期并存。

本次整理目标：

1. **去掉 GoReleaser**，项目只允许用 Docker 部署。
2. 重新设计「两个前端 + 一个后端」的部署拓扑。
3. 按个人全局工程规范（mise 单一来源、monorepo 三名锁定命名、Docker 构建/发布规范）**重建 GitHub CI**。
4. 清理 `deploy/` 目录，瘦身为精简 Docker 部署套件。

## 2. 已确认的关键决策

| 项 | 决策 |
|---|---|
| GoReleaser | 删除，改为 Docker-only |
| 部署拓扑 | **2 个镜像**：`backend`（内嵌 `frontend`）+ `user-portal`（独立 nginx 静态） |
| `frontend` 定位 | 随 `backend` 走，**不单独发布、不分配 tag 前缀** |
| 目录布局 | 根目录平铺不动；组件名 = `backend` / `user-portal`，套用 tag/workflow/组件名「三名锁定」 |
| 工具链/命令 | 新建根 `mise.toml` 作单一来源，CI 走 `mise run` |
| backend 镜像底座 | debian-slim + curl 装 mise + PGDG apt 装 `postgresql-client`（版本 build arg，默认 18） |
| 外部 DB | PostgreSQL 18（独立容器，非随本项目启动） |
| deploy/ | 瘦身为精简 Docker 部署套件（删裸机/残留，留并更新 Docker 必需品） |

### 2.1 为什么 frontend 不拆成独立静态镜像

现有 `frontend` 与后端是**运行时深度耦合**，不是简单静态托管（见 `backend/internal/web/embed_on.go`）：

- 每请求把后端公开设置注入 `index.html`（`window.__APP_CONFIG__`），设置变更后端会失效缓存；
- 每请求 CSP nonce 注入（`__CSP_NONCE_VALUE__`，由安全中间件生成）；
- 按站点名动态替换 `<title>`、`data/public` 本地覆盖目录。

拆成 nginx 静态镜像需在反代层重建这套机制，回归风险高、收益低。故 `frontend` 保持内嵌后端。`user-portal` 是干净 SPA，仅经 `/api` 通信，天生适合独立镜像。

### 2.2 关于 pg-client（备份功能的运行时依赖）

后端有数据库备份/恢复功能（`internal/service/backup_service.go` + `internal/repository/backup_pg_dumper.go`），运行时 `exec.Command("pg_dump"/"psql", ...)`，因此镜像内必须有这两个 CLI。Postgres 铁律：`pg_dump` 版本必须 ≥ 服务器版本。

原 Dockerfile 从 `postgres:18-alpine` 镜像抠二进制 + 手补 `.so`，理由是「与 compose 一起起的 DB 对齐」。但本部署 DB 是**外部独立运维**，该理由不成立，反而把外部 DB 版本隐式烤死进 app 镜像。

新方案：debian 底座下用 **PostgreSQL 官方 PGDG apt 源**一行装 `postgresql-client-${PG_CLIENT_VERSION}`（默认 18），版本显式参数化、由使用者对齐外部 DB。比抠二进制更干净，且换 debian 后此处反而简化。

## 3. 详细设计

### 3.1 删除清单（去 GoReleaser 与旧发布链路）

- `.goreleaser.yaml`
- `.goreleaser.simple.yaml`
- `Dockerfile.goreleaser`
- `.github/workflows/release.yml`（由新的 per-组件 release workflow 取代）
- `.dockerignore` 中 GoReleaser 相关条目（改为 per-Dockerfile 白名单，见 3.4）

`README.md` / `install.sh` 中指向 GoReleaser 二进制下载的文案改为「只支持 Docker」。**install.sh 体量大（38KB），动它前先单独列出待改位置确认。**

### 3.2 根 `mise.toml`（新增，单一来源）

```toml
[tools]
go   = "1.26.4"      # 与 backend/go.mod 对齐
node = "20.18.1"     # 固定具体版本（对齐 user-portal 现锁版）
pnpm = "9.15.9"

# 依赖安装：一条命令装 backend + frontend + user-portal
[tasks.install]

# 构建（多组件不塞进一个 run，按组件拆）
[tasks.build]                 # backend 单二进制（内嵌 frontend），= 前端 build + go build -tags embed
[tasks.backend-image]         # docker build -f backend/Dockerfile -t backend:local .
[tasks.user-portal-image]     # docker build -f user-portal/Dockerfile -t user-portal:local .

# 质量（按组件拆，便于 CI 各调各的）
[tasks.lint-backend]          # golangci-lint
[tasks.lint-frontend]         # frontend eslint
[tasks.lint-user-portal]      # user-portal eslint
[tasks.test-backend]          # go unit + integration
[tasks.test-frontend]         # frontend typecheck + 关键 vitest
[tasks.test-user-portal]      # user-portal typecheck + lint
```

要点：版本只在此处写一次；任务按组件拆分，避免 CI 跨端重复跑；现有 Makefile 保留为薄封装，逐步退场。镜像构建 task 不设 `dir`，默认在仓库根运行，`.` 即仓库根 context。

> 注意：`mise.toml` 现唯一存在于 `user-portal/mise.toml`。新建根 `mise.toml` 后，`user-portal/mise.toml` 的 `[tools]` 与根重复，应删除其 `[tools]`（版本统一由根提供），仅在确有需要时保留组件级 task；否则整体并入根。

### 3.3 两个 Dockerfile（context 一律取仓库根）

**`backend/Dockerfile`（重写为 debian-slim + mise）**

- build 阶段：`debian:13-slim` + curl 装 mise（`MISE_VERSION` 钉死，自举例外）→ `COPY mise.toml` → `mise install go node pnpm`（仅列所需）→ 先 build `frontend`（产物落 `backend/internal/web/dist`）→ `go build -tags embed`。
- runtime 阶段：`debian:13-slim`，PGDG apt 装 `postgresql-client-${PG_CLIENT_VERSION:-18}`；`gosu` 替 `su-exec`；healthcheck `wget`→`curl`；保留非 root 用户、`/app/data`、entrypoint。
- 版本来源：工具链版本只认根 `mise.toml`；Dockerfile 内唯一允许钉的是 `MISE_VERSION` 与 `PG_CLIENT_VERSION`（后者为部署参数，非工具链版本）。
- COPY 源相对仓库根书写（带 `backend/` / `frontend/` 前缀）；`docker-entrypoint.sh` 改由 `backend/` 提供（见 3.5）。

**`user-portal/Dockerfile`（新建）**

- build 阶段：`debian:13-slim` + mise（node/pnpm）→ `pnpm build` 出 `dist/`。
- runtime 阶段：`nginx:alpine`，托管 `dist/`，配 SPA history fallback（`try_files ... /index.html`）。`/api` 不在本镜像，由反代转后端。

### 3.4 per-Dockerfile `.dockerignore`（白名单）

各组件一份 `backend/Dockerfile.dockerignore` / `user-portal/Dockerfile.dockerignore`，pattern 相对仓库根书写，白名单式仅放行 `mise.toml` + 自身目录（排除 `node_modules`/`dist`/`.git`）。不再共用根 `.dockerignore` 给多镜像兜底。

### 3.5 `docker-entrypoint.sh` 迁移

从 `deploy/docker-entrypoint.sh` 搬到 `backend/docker-entrypoint.sh`（它本就是 backend 镜像专属）。内容随 debian 化把 `su-exec` 改为 `gosu`。根/backend Dockerfile 的 `COPY` 路径同步更新。

### 3.6 GitHub CI 重建（按规范）

抽公共质量门禁为可复用 workflow，**按组件拆分，避免跨端重复跑同一套检查**：

- `backend-quality.yml`（`workflow_call`）：`mise run lint-backend` + `mise run test-backend`
- `frontend-quality.yml`（`workflow_call`）：`mise run lint-frontend` + `mise run test-frontend`
- `user-portal-quality.yml`（`workflow_call`）：`mise run lint-user-portal` + `mise run test-user-portal`

组件 CI / release 只调用与自己相关的 quality：

- **`backend-ci.yml`**（push / pull_request）：`uses` backend-quality **+** frontend-quality（frontend 内嵌进 backend，发版前须保证它能 build）。
- **`user-portal-ci.yml`**（push / pull_request）：`uses` user-portal-quality。
- **`backend-release.yml`**（触发 `backend-v*`）：`needs` backend-quality + frontend-quality 通过 → buildx 构建并推 GHCR。
- **`user-portal-release.yml`**（触发 `user-portal-v*`）：`needs` user-portal-quality 通过 → buildx 构建并推 GHCR。

release workflow 规范：

- 质量门禁内置（`needs:` 依赖 quality job）——因当前直推 main、不走 PR 保护，门禁必须内置在发版链路。
- 打标用 `docker/metadata-action@v5`：monorepo 形式 `type=semver,pattern={{version}},value=${{ github.ref_name }},match=<组件>-v(.+)` + `type=sha,enable=${{ github.ref_type != 'tag' }}` + `flavor: latest=auto`。
- **私有部署型 → 不上 QEMU、不写 `platforms:`**，只出 amd64 单架构。
- buildx 保留（`type=gha` 缓存 + per-Dockerfile ignore 依赖 BuildKit）。
- GHCR 登录用 `secrets.GITHUB_TOKEN` + `permissions: packages: write`。
- 保留 `workflow_dispatch` 逃生口；`concurrency` 串行 `cancel-in-progress: false`；每个 step 带 `name:`。
- 镜像名：backend = `ghcr.io/<owner>/sub2api`；user-portal = `ghcr.io/<owner>/sub2api-user-portal`。

保留并 mise 化：`security-scan.yml`。原样保留：`cla.yml`。

> 可选优化：给两个 ci.yml 加 `paths:` 过滤，减少无关改动触发的构建（非必需，先不做）。

### 3.7 deploy/ 瘦身

**删除（裸机/systemd 安装、fork 残留、与 Docker-only/GHCR-only 冲突）：**

- `install.sh`、`install-datamanagementd.sh`
- `sub2api.service`、`sub2api-datamanagementd.service`、`DATAMANAGEMENTD_CN.md`
- `docker-deploy.sh`（从上游 Wei-Shaw 仓库下载文件，fork 后失真）
- `build_image.sh`（由 `mise run backend-image` 取代）
- `DOCKER.md`（DockerHub 描述，已只发 GHCR）
- `deploy/Dockerfile`（更旧的重复 Dockerfile，alpine:3.20/node:24）
- `codex-instructions.md.tmpl`、`deploy/Makefile`

**搬走：**

- `deploy/docker-entrypoint.sh` → `backend/`（见 3.5）

**保留并更新：**

- 4 个 `docker-compose*.yml` 合并为 **1 个**：`backend` + `user-portal` 两服务，指向**外部 DB/Redis**（不内置 postgres/redis 服务，符合外部独立运维）。
- `Caddyfile`：更新为双前端分流（按域名/路径把 user-portal 与 backend 分开反代，`/api`、`/v1` 等走 backend）。
- `config.example.yaml`：配置项参考手册，保留。
- `.env.example`：环境变量模板，保留（与新 compose 对齐）。

> deploy/ 与 README/install.sh 文案的具体删改清单，会在执行阶段对应步骤先列出再动，不一次性闷头大改。

## 4. 落地顺序（每步可独立验证）

1. 删 GoReleaser 三件套 + `release.yml`，清理 `.dockerignore` 相关条目。
2. 新建根 `mise.toml`，调整 `user-portal/mise.toml`；本地 `mise run install/build/lint-*/test-*` 跑通。
3. `docker-entrypoint.sh` 搬到 `backend/`（`su-exec`→`gosu`）。
4. 重写 `backend/Dockerfile`（debian + mise + PGDG）+ `backend/Dockerfile.dockerignore`；`mise run backend-image` 构建，冒烟 `pg_dump --version`、`/health`。
5. 新建 `user-portal/Dockerfile` + nginx 配 + `user-portal/Dockerfile.dockerignore`；`mise run user-portal-image` 构建冒烟。
6. 重建 CI：3 个 quality（workflow_call）+ backend-ci/user-portal-ci + backend-release/user-portal-release；mise 化 security-scan。
7. deploy/ 瘦身：删除清单执行、compose 合并、Caddyfile 双前端分流、保留 config/.env 示例。
8. 更新 README/install.sh 文案为 Docker-only（改前列清单确认）。

## 5. 非目标（YAGNI）

- 不改业务代码、不动 frontend 的运行时注入机制。
- 不上多架构镜像（私有部署、目标 amd64）。
- 不引入 DockerHub（只 GHCR）。
- 不保留任何裸机/systemd 安装路径。
- 不把 frontend 拆成独立镜像。
