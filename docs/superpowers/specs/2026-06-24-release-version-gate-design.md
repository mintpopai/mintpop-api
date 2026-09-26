# 版本一致性门禁 + 打 tag 发版流程 设计文档

> 日期:2026-06-24　分支:user-portal　范围:仅「门禁 + 发版」,不含 Docker 下禁用 in-app 更新(另议)。

## 1. 背景与目标

当前两个发版 workflow(`backend-release.yml` / `user-portal-release.yml`)只构建并推 GHCR 镜像,**既不校验版本号、也不创建 GitHub Release**。本次要补齐两件事:

1. **版本一致性门禁**:发版(打 tag)时强制「tag 版本号 == 仓库内版本文件」,不一致直接 fail,挡在构建之前。目的是逼发版者自己先把版本号改对,改错/忘改就发不出去。
2. **打 tag 发版流程**:
   - 本地侧:收口成 mise `<组件>-release` 任务(版本号 + 可选说明 → 改版本 → 提交 → 打 tag → 推送);
   - CI 侧:推完镜像后创建 GitHub Release(annotated tag 注释置顶 + 按提交类型过滤的 changelog)。

遵循全局规则:`monorepo-cicd-naming.md`(tag/workflow/组件命名)、`docker-image-publish.md`(发布工作流)、`release-notes.md`(Release 正文)、`mise-toolchain.md`(命令收口 mise)。

## 2. 版本来源(门禁校验的真值)

| 组件 | 版本文件 | 现值 | tag 前缀 |
|---|---|---|---|
| backend | `backend/cmd/server/VERSION` | `0.1.138` | `backend-v` |
| user-portal | `user-portal/package.json` 的 `version` | `0.1.0` | `user-portal-v` |

- backend 版本经 `//go:embed VERSION`(可被 `-ldflags -X main.Version` 覆盖)进二进制;Docker 构建默认读该文件,故门禁保证文件==tag 即保证镜像版本正确,**无需改 Dockerfile**。
- user-portal 为 nginx 静态镜像,版本仅作发布标识,以 `package.json` 的 `version` 为准。

## 3. 总体方案

三块改动,落在 3 个文件:

1. `mise.toml`:新增 `backend-release`、`user-portal-release` 两个 task。
2. `.github/workflows/backend-release.yml`:新增 `version-gate`、`github-release` 两个 job;workflow 权限提到 `contents: write`。
3. `.github/workflows/user-portal-release.yml`:同上。

不动 backend 代码、不动 Dockerfile。

### 3.1 版本一致性门禁(CI 侧)

在两个 release workflow 各加 `version-gate` job,卡在 `build-push` 之前:

- checkout → 从 `github.ref_name` 剥前缀得 tag 版本号 → 读仓库内版本:
  - backend:`tr -d '\r\n' < backend/cmd/server/VERSION`;
  - user-portal:`jq -r .version user-portal/package.json`。
- 不一致 → `exit 1`(打印两侧值便于排错)。
- `build-push` 的 `needs` 增加 `version-gate`;门禁不过则不构建、不推镜像、也不发 Release。

**关键工程细节**:校验仅在 `github.ref_type == 'tag'` 时执行;`workflow_dispatch`(无 tag 的手动逃生口)时在 **step 内部 `if` 判断跳过**,而非用 **job 级 `if`**——否则 GitHub 会把 `needs: version-gate` 的 `build-push` 连带 skip。即 `version-gate` job 永远运行并成功,只是非 tag 时不做实际校验。

### 3.2 mise 发版任务(本地侧)

用 `usage` 字段接参数(`{{arg()}}`/`{{option()}}` 模板写法已在 mise 2027.5.0 废弃,故用 `usage`;已实测 `usage` 可用,参数经 `$usage_version` / `$usage_notes` 注入)。

调用形态:

```bash
mise run backend-release 0.2.0 --notes "本次重点说明"   # --notes 可省
mise run user-portal-release 0.2.0
```

任务逻辑(两个 task 结构一致,差异见下表):

1. 校验 `<version>` 为 SemVer(形如 `X.Y.Z`,允许预发布后缀 `-rc.1` 等);
2. 校验 `git status` 工作区干净(避免把无关改动混进发版 commit);
3. 写版本号:
   - backend:`printf '%s\n' "$VERSION" > backend/cmd/server/VERSION`;
   - user-portal:`pnpm version "$VERSION" --no-git-tag-version --allow-same-version`(在 `user-portal/` 目录,只改 `package.json` 不打 git tag);
4. `git add <版本文件>` + `git commit -m "chore(release): 发布 <组件> v<version>"`(提交信息中文,符合全局规则);
5. 打 tag:有 `--notes` → `git tag -a <前缀>v<version> -m "<notes>"`(注释作为 Release 正文置顶);无 → 轻量 `git tag <前缀>v<version>`;
6. 推送:`git push origin HEAD`(发版 commit)+ `git push origin <前缀>v<version>`(tag,触发对应 release workflow)。

| | backend-release | user-portal-release |
|---|---|---|
| 版本文件 | `backend/cmd/server/VERSION` | `user-portal/package.json` |
| 写法 | 覆盖写文件 | `pnpm version --no-git-tag-version` |
| tag 前缀 | `backend-v` | `user-portal-v` |

**shell 健壮性**(`set -euo pipefail` 下):变量后若紧跟全角标点用 `${VAR}` 界定;`$usage_notes` 可能为空,引号包裹避免 word splitting。

### 3.3 GitHub Release(CI 侧)

在两个 release workflow 各加 `github-release` job,`needs: [build-push]` 且 job 级 `if: github.ref_type == 'tag'`(leaf job,被 skip 无副作用):

1. checkout `fetch-depth: 0`(COMMIT 模式 changelog 需全量历史);
2. `mikepenz/release-changelog-builder-action` `mode: COMMIT` 生成按类型过滤的变更日志,`configurationJson` 要点:
   - `tag_resolver`:`filter.pattern` 设为同前缀(如 `backend-v.*`),只取「上个同前缀 tag → 本 tag」区间;
   - `label_extractor`:正则 `^(feat|fix|perf|refactor|revert|build|chore|ci|docs|style|test)[(!:]`,`target: "$1"`(只匹配类型前缀,兼容中文描述);
   - `categories`:只列 `feat / fix / perf / refactor / revert`;未收纳类型落 uncategorized;
   - `template`:`#{{CHANGELOG}}`(各 category 之和)→ 噪声类型(docs/chore/ci/build/style/test)被自然排除;
3. 读 annotated tag 注释拼到 changelog 上方,写入 `notes.md`:
   ```bash
   : > notes.md
   if [ "$(git cat-file -t "$TAG")" = "tag" ]; then
     git tag -l --format='%(contents)' "$TAG" >> notes.md; printf '\n\n' >> notes.md
   fi
   printf '%s\n' "$CHANGELOG" >> notes.md   # action 输出经 env 传入,不用 ${{ }} 直插脚本
   ```
4. `softprops/action-gh-release` 用 `body_path: notes.md`、`tag_name: ${{ github.ref_name }}` 创建 Release。
5. workflow 权限:从 `contents: read` 提到 `contents: write`(创建 Release 需要);`packages: write` 保留。

**monorepo 取舍**:COMMIT 模式按 commit 算区间,monorepo 里两个同前缀 tag 之间会夹杂另一组件的提交。本次按规则只做「类型过滤 + 同前缀 tag 区间」,**不做按路径过滤**(避免过度工程)。该限制已知并接受。

## 4. 数据流 / 时序

```
开发者：mise run backend-release 0.2.0 --notes "..."
  └─ 改 VERSION → commit → git tag -a backend-v0.2.0 -m "..." → push commit + tag
       │
       ▼ tag backend-v0.2.0 推到 origin
GitHub Actions: backend-release.yml 触发
  ├─ version-gate   ：校验 backend-v0.2.0 的 "0.2.0" == VERSION 文件 "0.2.0"，不符则 fail
  ├─ backend-quality / frontend-quality（复用 *-quality.yml，lint+test 门禁）
  ├─ build-push     ：needs 上述全过 → 构建并推 GHCR 镜像（metadata-action 打 0.2.0 + latest）
  └─ github-release ：needs build-push → 生成 changelog + tag 注释 → 创建 GitHub Release
```

## 5. 错误处理与边界

- **版本不一致**:`version-gate` job `exit 1`,后续全部不跑。
- **手动 `workflow_dispatch`**:无 tag,`version-gate` 跳过校验、`github-release` 被 skip,`build-push` 仍跑(metadata-action 用 `type=sha` 兜底标签)。
- **预发布版本**(如 `0.2.0-rc.1`):metadata-action `flavor: latest=auto` 自动不打 `latest`;mise 任务 SemVer 校验需允许 `-` 后缀。
- **轻量 tag(无 notes)**:`github-release` 的 `git cat-file -t` 判得非 `tag`,跳过注释、正文只剩 changelog。
- **mise 任务工作区不干净**:直接报错退出,不做任何改动。

## 6. 验证方式

- `mise run backend-release` / `user-portal-release` 不带参数:应报 `Missing required arg: <version>`。
- 传非法版本(如 `abc`):应被 SemVer 校验拦下。
- workflow YAML:用 `actionlint`(若可用)或人工核对 job 依赖、`if` 条件、权限。
- 端到端:在测试 tag 上验证门禁(故意让 VERSION 与 tag 不符,确认 fail)。

## 7. 不在本次范围

- Docker 下禁用/隐藏 in-app 手动更新功能(`update_service.go`):已知该功能仅适配二进制+systemd 部署,Docker 下失效,但本次不处理,另行讨论。
- 按组件路径过滤 changelog 提交。
- 抽取可复用的 release workflow(仅 2 组件,暂不抽象)。
