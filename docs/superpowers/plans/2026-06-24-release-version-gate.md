# 版本门禁 + 打 tag 发版流程 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 backend / user-portal 两个组件加「tag 版本号 == 仓库内版本文件」一致性门禁,并把发版收口成 mise 任务 + CI 自动创建 GitHub Release。

**Architecture:** 本地 `mise run <组件>-release <版本> [--notes]` 改版本→提交→打 tag→推送;tag 触发对应 `*-release.yml`,先过 `version-gate`(版本不符则 fail),再过质量门禁,构建推 GHCR 镜像,最后生成按提交类型过滤的 changelog + tag 注释创建 GitHub Release。

**Tech Stack:** mise(usage 字段传参)、GitHub Actions、`docker/metadata-action@v5`、`mikepenz/release-changelog-builder-action@v6`(COMMIT 模式)、`softprops/action-gh-release@v2`、`jq`、`pnpm version`。

**Spec:** `docs/superpowers/specs/2026-06-24-release-version-gate-design.md`

## Global Constraints

- 版本真值:backend = `backend/cmd/server/VERSION`(现 `0.1.138`);user-portal = `user-portal/package.json` 的 `version`(现 `0.1.0`)。
- tag 前缀:`backend-v` / `user-portal-v`;格式 `<前缀>v<SemVer>`。
- 提交信息、注释、文档用中文;代码/命令/标识符保持英文。
- mise 任务传参用 `usage` 字段(`{{arg()}}`/`{{option()}}` 模板已废弃),参数经 `$usage_version` / `$usage_notes` 注入。
- 不改 backend 代码、不改 Dockerfile。
- `version-gate` 必须**永远运行并成功**,非 tag(`workflow_dispatch`)时在 step 内 `if` 跳过校验,**禁止用 job 级 `if`**(否则 `needs` 它的 `build-push` 被连带 skip)。
- changelog 用 COMMIT 模式;`label_extractor` 正则只匹配类型前缀以兼容中文描述;categories 只列 `feat/fix/perf/refactor/revert`,**不设 `labels:[]` 兜底类**(噪声类型自然排除);monorepo 不做按路径过滤。
- workflow 权限提到 `contents: write`(建 Release),保留 `packages: write`。

---

### Task 1: mise 发版任务(backend-release + user-portal-release)

**Files:**
- Modify: `mise.toml`(在「镜像」段后追加「发版」段)

**Interfaces:**
- Produces: 两个 mise 任务 `backend-release` / `user-portal-release`,签名 `mise run <task> <version> [--notes <notes>]`。`<version>` 为不带 `v` 的 SemVer。

- [ ] **Step 1: 在 `mise.toml` 末尾追加发版任务段**

在文件末尾(`[tasks.user-portal-image]` 之后)追加:

```toml
# ---------- 发版（打 tag，收口改版本→提交→tag→推送） ----------
[tasks.backend-release]
description = "发布 backend：改版本号→提交→打 tag→推送（参数：<版本> [--notes 说明]）"
usage = '''
arg "<version>" help="语义化版本号，如 0.2.0（不带 v 前缀）"
flag "--notes <notes>" help="本次更新重点，写入 annotated tag 注释并作为 GitHub Release 正文置顶" default=""
'''
run = '''
set -euo pipefail
VERSION="${usage_version}"
NOTES="${usage_notes:-}"

if ! printf '%s' "${VERSION}" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$'; then
  echo "错误：版本号 '${VERSION}' 不是合法 SemVer（应形如 0.2.0 或 0.2.0-rc.1）" >&2
  exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
  echo "错误：工作区不干净，请先提交或清理后再发版" >&2
  exit 1
fi

TAG="backend-v${VERSION}"
printf '%s\n' "${VERSION}" > backend/cmd/server/VERSION
git add backend/cmd/server/VERSION
git commit -m "chore(release): 发布 backend v${VERSION}"
if [ -n "${NOTES}" ]; then
  git tag -a "${TAG}" -m "${NOTES}"
else
  git tag "${TAG}"
fi
git push origin HEAD
git push origin "${TAG}"
echo "已发布 ${TAG}：commit 与 tag 均已推送，CI 将自动构建并创建 GitHub Release"
'''

[tasks.user-portal-release]
description = "发布 user-portal：改版本号→提交→打 tag→推送（参数：<版本> [--notes 说明]）"
usage = '''
arg "<version>" help="语义化版本号，如 0.2.0（不带 v 前缀）"
flag "--notes <notes>" help="本次更新重点，写入 annotated tag 注释并作为 GitHub Release 正文置顶" default=""
'''
run = '''
set -euo pipefail
VERSION="${usage_version}"
NOTES="${usage_notes:-}"

if ! printf '%s' "${VERSION}" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$'; then
  echo "错误：版本号 '${VERSION}' 不是合法 SemVer（应形如 0.2.0 或 0.2.0-rc.1）" >&2
  exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
  echo "错误：工作区不干净，请先提交或清理后再发版" >&2
  exit 1
fi

TAG="user-portal-v${VERSION}"
(cd user-portal && pnpm version "${VERSION}" --no-git-tag-version --allow-same-version >/dev/null)
git add user-portal/package.json
git commit -m "chore(release): 发布 user-portal v${VERSION}"
if [ -n "${NOTES}" ]; then
  git tag -a "${TAG}" -m "${NOTES}"
else
  git tag "${TAG}"
fi
git push origin HEAD
git push origin "${TAG}"
echo "已发布 ${TAG}：commit 与 tag 均已推送，CI 将自动构建并创建 GitHub Release"
'''
```

- [ ] **Step 2: 校验 TOML 解析 + 任务注册成功**

Run: `mise tasks ls | grep -E 'backend-release|user-portal-release'`
Expected: 两行,分别显示两个任务及其 description。

- [ ] **Step 3: 校验缺参数报错(不产生副作用)**

Run: `mise run backend-release 2>&1 | tail -2`
Expected: 输出含 `Missing required arg: <version>`,且未产生任何 git 改动。

- [ ] **Step 4: 校验非法版本号被拦下(不产生副作用)**

Run: `git stash -u 2>/dev/null; mise run backend-release abc 2>&1 | tail -3; git status --porcelain`
Expected: 输出含 `不是合法 SemVer`;`git status --porcelain` 为空(无任何改动/无新 commit/无 tag)。
> 说明:SemVer 与工作区检查都在写文件、commit 之前,故失败时仓库零改动。

- [ ] **Step 5: 提交**

```bash
git add mise.toml
git commit -m "build: 新增 backend/user-portal 发版 mise 任务（改版本+打tag+推送）"
```

---

### Task 2: backend-release.yml 加门禁与 GitHub Release

**Files:**
- Modify: `.github/workflows/backend-release.yml`(整文件重写)

**Interfaces:**
- Consumes: 复用 workflow `./.github/workflows/backend-quality.yml`、`./.github/workflows/frontend-quality.yml`(已存在);`backend/cmd/server/VERSION`(Task 1 的发版产物来源)。
- Produces: tag `backend-v*` 触发的完整发版(门禁→质量→镜像→Release)。

- [ ] **Step 1: 用以下内容整体替换 `.github/workflows/backend-release.yml`**

```yaml
name: Backend Release

on:
  push:
    tags:
      - 'backend-v*'
  workflow_dispatch:

permissions:
  contents: write
  packages: write

concurrency:
  group: backend-release-${{ github.ref }}
  cancel-in-progress: false

env:
  IMAGE: ghcr.io/${{ github.repository_owner }}/sub2api

jobs:
  version-gate:
    name: Version Gate
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v6
      - name: Verify tag version matches VERSION file
        env:
          REF_TYPE: ${{ github.ref_type }}
          REF_NAME: ${{ github.ref_name }}
        run: |
          if [ "${REF_TYPE}" != "tag" ]; then
            echo "非 tag 触发（${REF_NAME}），跳过版本一致性校验"
            exit 0
          fi
          TAG_VERSION="${REF_NAME#backend-v}"
          FILE_VERSION="$(tr -d '\r\n' < backend/cmd/server/VERSION)"
          echo "tag 版本：${TAG_VERSION}"
          echo "文件版本：${FILE_VERSION}"
          if [ "${TAG_VERSION}" != "${FILE_VERSION}" ]; then
            echo "::error::tag 版本(${TAG_VERSION}) 与 backend/cmd/server/VERSION(${FILE_VERSION}) 不一致；请用 'mise run backend-release ${TAG_VERSION}' 改对版本号后重新发版"
            exit 1
          fi
          echo "版本一致，门禁通过"

  backend-quality:
    name: Backend Quality
    uses: ./.github/workflows/backend-quality.yml
  frontend-quality:
    name: Frontend Quality
    uses: ./.github/workflows/frontend-quality.yml

  build-push:
    name: Build and Push
    needs: [version-gate, backend-quality, frontend-quality]
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

  github-release:
    name: GitHub Release
    needs: [build-push]
    if: github.ref_type == 'tag'
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v6
        with:
          fetch-depth: 0
      - name: Build changelog
        id: changelog
        uses: mikepenz/release-changelog-builder-action@v6
        with:
          mode: COMMIT
          toTag: ${{ github.ref_name }}
          configurationJson: |
            {
              "template": "#{{CHANGELOG}}",
              "tag_resolver": {
                "method": "semver",
                "filter": { "pattern": "^backend-v" },
                "transformer": { "pattern": "^backend-v(.+)$", "target": "$1" }
              },
              "label_extractor": [
                {
                  "pattern": "^(feat|fix|perf|refactor|revert|build|chore|ci|docs|style|test)[(!:]",
                  "on_property": "title",
                  "target": "$1"
                }
              ],
              "categories": [
                { "title": "## 🚀 新功能", "labels": ["feat"] },
                { "title": "## 🐛 修复", "labels": ["fix"] },
                { "title": "## ⚡ 性能", "labels": ["perf"] },
                { "title": "## ♻️ 重构", "labels": ["refactor"] },
                { "title": "## ⏪ 回滚", "labels": ["revert"] }
              ]
            }
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - name: Assemble release notes
        env:
          TAG: ${{ github.ref_name }}
          CHANGELOG: ${{ steps.changelog.outputs.changelog }}
        run: |
          : > notes.md
          if [ "$(git cat-file -t "$TAG")" = "tag" ]; then
            git tag -l --format='%(contents)' "$TAG" >> notes.md
            printf '\n\n' >> notes.md
          fi
          printf '%s\n' "$CHANGELOG" >> notes.md
      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ github.ref_name }}
          body_path: notes.md
```

- [ ] **Step 2: 校验 YAML 语法**

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/backend-release.yml')); print('YAML OK')"`
Expected: `YAML OK`

- [ ] **Step 3: 校验 job 依赖与门禁结构正确**

Run: `python3 -c "import yaml; d=yaml.safe_load(open('.github/workflows/backend-release.yml')); j=d['jobs']; print('build-push.needs=',j['build-push']['needs']); print('github-release.if=',j['github-release']['if']); print('perm=',d['permissions'])"`
Expected:
```
build-push.needs= ['version-gate', 'backend-quality', 'frontend-quality']
github-release.if= github.ref_type == 'tag'
perm= {'contents': 'write', 'packages': 'write'}
```

- [ ] **Step 4: 提交**

```bash
git add .github/workflows/backend-release.yml
git commit -m "ci(backend-release): 新增版本一致性门禁与 GitHub Release 生成"
```

---

### Task 3: user-portal-release.yml 加门禁与 GitHub Release

**Files:**
- Modify: `.github/workflows/user-portal-release.yml`(整文件重写)

**Interfaces:**
- Consumes: 复用 workflow `./.github/workflows/user-portal-quality.yml`(已存在);`user-portal/package.json` 的 `version`(Task 1 的发版产物来源);runner 自带 `jq`。
- Produces: tag `user-portal-v*` 触发的完整发版(门禁→质量→镜像→Release)。

- [ ] **Step 1: 用以下内容整体替换 `.github/workflows/user-portal-release.yml`**

```yaml
name: User Portal Release

on:
  push:
    tags:
      - 'user-portal-v*'
  workflow_dispatch:

permissions:
  contents: write
  packages: write

concurrency:
  group: user-portal-release-${{ github.ref }}
  cancel-in-progress: false

env:
  IMAGE: ghcr.io/${{ github.repository_owner }}/sub2api-user-portal

jobs:
  version-gate:
    name: Version Gate
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v6
      - name: Verify tag version matches package.json
        env:
          REF_TYPE: ${{ github.ref_type }}
          REF_NAME: ${{ github.ref_name }}
        run: |
          if [ "${REF_TYPE}" != "tag" ]; then
            echo "非 tag 触发（${REF_NAME}），跳过版本一致性校验"
            exit 0
          fi
          TAG_VERSION="${REF_NAME#user-portal-v}"
          FILE_VERSION="$(jq -r .version user-portal/package.json)"
          echo "tag 版本：${TAG_VERSION}"
          echo "文件版本：${FILE_VERSION}"
          if [ "${TAG_VERSION}" != "${FILE_VERSION}" ]; then
            echo "::error::tag 版本(${TAG_VERSION}) 与 user-portal/package.json(${FILE_VERSION}) 不一致；请用 'mise run user-portal-release ${TAG_VERSION}' 改对版本号后重新发版"
            exit 1
          fi
          echo "版本一致，门禁通过"

  user-portal-quality:
    name: User Portal Quality
    uses: ./.github/workflows/user-portal-quality.yml

  build-push:
    name: Build and Push
    needs: [version-gate, user-portal-quality]
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

  github-release:
    name: GitHub Release
    needs: [build-push]
    if: github.ref_type == 'tag'
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v6
        with:
          fetch-depth: 0
      - name: Build changelog
        id: changelog
        uses: mikepenz/release-changelog-builder-action@v6
        with:
          mode: COMMIT
          toTag: ${{ github.ref_name }}
          configurationJson: |
            {
              "template": "#{{CHANGELOG}}",
              "tag_resolver": {
                "method": "semver",
                "filter": { "pattern": "^user-portal-v" },
                "transformer": { "pattern": "^user-portal-v(.+)$", "target": "$1" }
              },
              "label_extractor": [
                {
                  "pattern": "^(feat|fix|perf|refactor|revert|build|chore|ci|docs|style|test)[(!:]",
                  "on_property": "title",
                  "target": "$1"
                }
              ],
              "categories": [
                { "title": "## 🚀 新功能", "labels": ["feat"] },
                { "title": "## 🐛 修复", "labels": ["fix"] },
                { "title": "## ⚡ 性能", "labels": ["perf"] },
                { "title": "## ♻️ 重构", "labels": ["refactor"] },
                { "title": "## ⏪ 回滚", "labels": ["revert"] }
              ]
            }
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - name: Assemble release notes
        env:
          TAG: ${{ github.ref_name }}
          CHANGELOG: ${{ steps.changelog.outputs.changelog }}
        run: |
          : > notes.md
          if [ "$(git cat-file -t "$TAG")" = "tag" ]; then
            git tag -l --format='%(contents)' "$TAG" >> notes.md
            printf '\n\n' >> notes.md
          fi
          printf '%s\n' "$CHANGELOG" >> notes.md
      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ github.ref_name }}
          body_path: notes.md
```

- [ ] **Step 2: 校验 YAML 语法**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/user-portal-release.yml')); print('YAML OK')"`
Expected: `YAML OK`

- [ ] **Step 3: 校验 job 依赖与门禁结构正确**

Run: `python3 -c "import yaml; d=yaml.safe_load(open('.github/workflows/user-portal-release.yml')); j=d['jobs']; print('build-push.needs=',j['build-push']['needs']); print('github-release.if=',j['github-release']['if']); print('perm=',d['permissions'])"`
Expected:
```
build-push.needs= ['version-gate', 'user-portal-quality']
github-release.if= github.ref_type == 'tag'
perm= {'contents': 'write', 'packages': 'write'}
```

- [ ] **Step 4: 提交**

```bash
git add .github/workflows/user-portal-release.yml
git commit -m "ci(user-portal-release): 新增版本一致性门禁与 GitHub Release 生成"
```

---

## 自检对照(Self-Review)

- **门禁(spec §3.1)** → Task 2/3 的 `version-gate` job:tag 时校验、非 tag 时 step 内跳过、`build-push` needs 之、不符 fail。✓
- **mise 任务(spec §3.2)** → Task 1:usage 传参、SemVer+干净工作区校验、改版本(file/`pnpm version`)、中文 commit、annotated/轻量 tag、push commit+tag。✓
- **GitHub Release(spec §3.3)** → Task 2/3 的 `github-release` job:COMMIT 模式、同前缀 `tag_resolver` filter+transformer、兼容中文的 `label_extractor`、仅 5 类 categories 无兜底、tag 注释置顶拼 changelog、`action-gh-release` body_path、权限 `contents: write`。✓
- **边界(spec §5)**:`workflow_dispatch` 无 tag → gate 跳过 + release skip + 镜像走 `type=sha`;预发布 → `latest=auto` 不打 latest + SemVer 正则允许 `-` 后缀;轻量 tag → `git cat-file -t` 判得非 tag 跳过注释。✓
- **不在范围(spec §7)**:未触碰 `update_service.go`、未做路径过滤、未抽可复用 workflow。✓
- 占位符扫描:无 TBD/TODO,所有步骤含完整可执行内容。✓
- 类型/命名一致性:任务名、tag 前缀、job 名、`needs` 引用在三个 Task 间逐字一致。✓
