# User Portal (Mint) — 设计文档（里程碑 1：Dashboard）

> 日期：2026-06-23 · 分支：user-portal

## 目标

在仓库根新建 **独立前端工程 `user-portal/`**，用 Mint 设计稿重做面向普通用户（非管理员）的前端。**不改任何后端代码，只调用现有 `/api/v1` 接口**。本里程碑只交付 **Dashboard 页面**（含必要的登录与布局壳），其余用户页面（使用记录、API 密钥、订阅、兑换等）后续里程碑再做。

设计稿来源：`~/Desktop/user-portal/Mint Dashboard C.dc.html`（薄荷绿主调 / 标准强度 / 衬线数字 / 支持深浅色）。

## 范围（里程碑 1）

- ✅ 独立 Vite + Vue3 + TS 工程脚手架（mise 管工具链）
- ✅ Mint 设计系统（CSS 变量 token + Tailwind + 三套字体 + 深浅色）
- ✅ API 层复刻现有鉴权与通信契约
- ✅ 最小登录页（使 dashboard 端到端可达）
- ✅ 布局壳 `PortalLayout`（顶栏 + 用户菜单 + 深浅色切换）
- ✅ Dashboard 页面，严格照设计稿，全部接真实接口
- ⏸️ 使用记录 / API 密钥 tab：仅占位路由
- ⏸️ 生产部署 / 嵌入方式：本期不动，只保证 dev 端到端可跑

## 现有后端接口契约（新工程须复刻）

- baseURL：`/api/v1`（`VITE_API_BASE_URL` 可覆盖），`withCredentials: true`
- 鉴权：`localStorage.auth_token` → `Authorization: Bearer <token>`；`refresh_token` 走 `POST /auth/refresh` 自动续期；401 且非 auth 端点时尝试刷新
- 统一返回体：`{ code, message, data }`，`code === 0` 解包返回 `.data`，否则 reject `{status, code, message}`
- 每个 GET 自动注入 `timezone`（IANA）与 `Accept-Language`

Dashboard 所需端点（均已存在）：

| 用途 | 端点 |
|---|---|
| KPI / Token / RPM·TPM / avg / 厂商分布 `by_platform[]` | `GET /usage/dashboard/stats` |
| 趋势曲线 | `GET /usage/dashboard/trend?start_date&end_date&granularity` |
| 模型分布 | `GET /usage/dashboard/models?start_date&end_date` |
| 最近使用记录 | `GET /usage?start_date&end_date&...` |
| 用户名/邮箱/余额 balance | `GET /user/profile` |
| 平台配额 | `GET /user/platform-quotas` |
| 登录/当前用户/续期/登出 | `POST /auth/login`、`GET /auth/me`、`POST /auth/refresh`、`POST /auth/logout` |

## 工程结构

```
user-portal/
  mise.toml                 # [tools] node=20.18.1 pnpm=9.15.9 + [tasks] install/dev/build/lint/typecheck
  package.json
  vite.config.ts            # dev 端口 5174，/api/v1 proxy 到后端
  tailwind.config.js postcss.config.js tsconfig*.json index.html
  src/
    main.ts  App.vue
    styles/  theme.css       # CSS 变量：浅色 :root + 深色 .dark
    api/     client.ts usage.ts user.ts auth.ts
    stores/  auth.ts theme.ts
    router/  index.ts        # 守卫：无 token → /login
    composables/ useDashboard.ts
    layouts/ PortalLayout.vue
    components/dashboard/ HeroBalance KpiRow ModelDistribution VendorDistribution TrendChart LifetimeStrip QuickActions
    components/common/ AppDropdown LoadingSpinner ThemeToggle
    views/   LoginView.vue DashboardView.vue (UsageView/KeysView 占位)
```

## 设计系统

- **色彩**：token 化设计稿全部变量（`--bg/--card/--bar/--border/--text/--text2/--mtext/--muted/--track/--accent/--ink` 及厂商分布 4 宫格 `--p{0..3}*`）。固定默认观感：薄荷主调 + 标准强度 + 衬线数字，不暴露 popLevel/accentMix 旋钮。深色用 `.dark` 覆盖一组变量。
- **字体**：Fredoka（logo）/ Newsreader（标题与数字，serif，`--numFont`）/ Space Grotesk（正文）。Google Fonts CDN 引入。
- **Tailwind**：`theme.extend.colors` 接入语义 token，圆角/阴影对齐设计稿（卡片 16–22px 圆角、柔和阴影）。

## 鉴权（最小可用）

- 路由全局守卫：访问受保护路由且 `localStorage.auth_token` 不存在 → 重定向 `/login`。
- `LoginView`：调 `POST /auth/login`，把返回 token 写入 `localStorage`（`auth_token` / `refresh_token`），刷新 `auth` store 后跳 `/dashboard`。样式从简，后续里程碑再照设计稿美化。
- `auth` store：持有当前用户（含 balance），`fetchUser()` 调 `/user/profile`，`logout()` 调 `/auth/logout` 并清 token。

## 布局壳 `PortalLayout`

严格照设计稿顶栏（sticky，毛玻璃）：
- 左：logo `mint ● AI`（Fredoka + 薄荷绿圆点）
- 中：3 个 tab（仪表盘 / 使用记录 / API 密钥），当前态高亮；后两者本期为占位路由
- 右：用户胶囊按钮 → 下拉菜单：头像、用户名/邮箱、账户余额、充值→、我的订单、个人资料、深/浅色切换、退出登录
- 深浅色：`theme` store 持久化 `localStorage.theme`，切换 `<html>.dark`

## Dashboard 页面区块 → 数据映射

| 设计稿区块 | 组件 | 数据来源 | 备注 |
|---|---|---|---|
| 页头（标题 + 近7天/刷新） | DashboardView | — | 刷新触发全部重载 |
| Hero 余额 + 充值 | HeroBalance | `/user/profile`.balance | 充值跳占位/订单路由 |
| KPI 行 ×4 | KpiRow | `dashboard/stats` | API密钥数、今日请求、今日Token、平均响应 |
| 模型分布 Top5 | ModelDistribution | `dashboard/models` | 按请求数排序，进度条 + 占比 |
| 厂商分布 4 宫格 | VendorDistribution | `stats.by_platform` | Claude/GPT/Gemini/其他 bento，网点纹理 |
| Token 趋势 | TrendChart | `dashboard/trend` | chart.js 面积曲线渲染真实数据 |
| 累计指标条 | LifetimeStrip | `stats` 累计字段 | 累计 Token/请求/消费 |
| 快捷操作 ×3 | QuickActions | — | 创建密钥/查看记录/兑换充值，路由跳转 |

- 默认时间区间：近 7 天（`granularity=day`）。
- 加载态：整页 spinner；错误态：console + 友好占位。
- 格式化（金额 2 位、Token K/M、时长 ms/s）复用设计稿语义，封装到工具函数。

## 决策记录

1. 落地方式：**仓库根新建独立工程 `user-portal/`**（用户决定，覆盖 monorepo apps/ 约定）。
2. 导航 IA：**严格照设计稿**，本期只 3 tab + 用户菜单项。
3. 主题：**固定默认观感 + 深色**，不暴露多套旋钮。
4. 趋势图：**chart.js**（同生态依赖，能上真实数据）。
5. 字体：**Google Fonts CDN**（后续可改自托管）。
6. 登录页：本期做**最小可用**版，使 dashboard 可达。

## 验收标准

- `cd user-portal && mise run install && mise run dev` 可启动，proxy 到后端。
- 用真实账号登录后，`/dashboard` 各区块显示**真实数据**且观感对齐设计稿（浅色），深色切换正常。
- `mise run lint` 与 `mise run typecheck` 通过。
- 不触碰 `backend/` 与既有 `frontend/` 任何文件。
```
