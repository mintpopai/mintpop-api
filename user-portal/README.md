# user-portal（Mint 用户前端）

面向普通用户（非管理员）的前端，采用 **Mint** 设计风格。**独立工程**，与仓库内 `frontend/` 互不依赖；**只调用现有后端 `/api/v1` 接口，不改任何后端代码**。

功能覆盖：仪表盘、API 密钥管理、使用记录（含 CSV 导出）、充值/订阅（微信 · 支付宝 · Stripe）、订单、个人资料与第三方绑定、接入文档、法务条款；界面支持中英双语（vue-i18n，可构建期锁定语言）。

## 技术栈

Vite 8 + Vue3(`<script setup>`) + TypeScript + Pinia 3 + Vue Router + vue-i18n + Tailwind 4（CSS-first 配置，见 `src/styles/theme.css`）+ Chart.js。工具链经 **mise** 锁定（node 24.18.0 / pnpm 9.15.9）。

## 本地开发

前提：后端已在 `http://localhost:6310` 运行（本地 `backend/config.yaml` 的 `server.port` 设为 6310，见 `config.example.yaml` 该项注释）。

工具链与命令统一收口到**仓库根** `mise.toml`（子目录不再有 `mise.toml`），以下命令均在**仓库根**执行：

```bash
mise run install-user-portal   # 安装依赖
mise run run-user-portal       # 启动 dev server（http://localhost:6312，/api 代理到 6310）
```

后端地址可用环境变量覆盖：`VITE_BACKEND_ORIGIN=http://其它地址 mise run run-user-portal`。

本仓库在本机占用专属端口段 `6310–6319`：

| 端口 | 用途 |
|---|---|
| 6310 | 后端（`mise run run-backend`，端口在本地 `backend/config.yaml`） |
| 6311 | frontend（admin 前端）dev（`mise run run-frontend`） |
| 6312 | user-portal dev（`mise run run-user-portal`） |
| 6313 | frontend 预览（`mise run preview-frontend`） |
| 6314 | user-portal 预览（`mise run preview-user-portal`） |
| 6315–6319 | 预留 |

端口被占用时报错退出，不允许自动换端口。容器内后端仍监听 8080，与本地端口无关。

## 常用命令（均在仓库根执行）

| 命令 | 说明 |
|---|---|
| `mise run install-user-portal` | 安装/更新依赖 |
| `mise run run-user-portal` | 开发服务器（端口 5174） |
| `mise run build-user-portal` | 类型检查 + 生产构建到 `dist/`（`--env prod` 读 `.env.prod`） |
| `mise run preview-user-portal` | 本地预览构建产物 |
| `mise run lint-user-portal` | ESLint 检查（`--max-warnings 0`） |
| `mise run test-user-portal` | vue-tsc 类型检查（`-b`，含测试文件）+ vitest 单元测试 |
| `mise run audit-user-portal` | 依赖漏洞审计（pnpm audit） |
| `mise run image-user-portal` | 构建 Docker 镜像（context 取仓库根） |
| `mise run release-user-portal` | 发版（改版本号→提交→打 tag→推送） |

## 设计说明

- 设计稿来源：`Mint Dashboard C`（薄荷主调 / 标准强度 / 衬线数字）。
- 字体经 `@fontsource` 自托管打进构建产物（Newsreader / Space Grotesk），不外链 Google Fonts（保证中国大陆可达）。
- 主题色值 token 化在 `src/styles/theme.css`，深浅色用 `<html>.dark` 切换并持久化到 `localStorage.theme`。
- 鉴权与统一返回体（`{code,data,message}`）契约复刻自 `frontend/`：token 存 `localStorage.auth_token`，401 自动用 `refresh_token` 续期（有单测守护，见 `src/api/__tests__/client.test.ts`）。
- 语言模式与仪表盘分布卡片文案由构建期变量控制（`VITE_PORTAL_LOCALE` / `VITE_PORTAL_DISTRIBUTION_MODE`，见 `.env.prod` 注释）。

## 目录

```
src/
  api/         client.ts(鉴权/拦截器) auth.ts user.ts keys.ts usage.ts payment.ts
               groups.ts binding.ts redeem.ts settings.ts types.ts
  stores/      auth.ts(含余额) theme.ts(深浅色) locale.ts(语言) settings.ts(公开设置)
  router/      index.ts(守卫：无 token 跳登录)
  composables/ useCopy useDashboard useKeys useOrders useProfile useRecharge useToast useUsage
  i18n/        index.ts + locales/{zh-CN,en-US}/ 按命名空间分文件（两侧 key 有对齐守护测试）
  layouts/     PortalLayout.vue(顶栏+用户菜单+语言/主题切换)
  components/  common/ dashboard/ keys/ orders/ payment/ profile/ recharge/ ui/ usage/
  views/       Dashboard Keys Usage Orders Recharge Profile Docs Legal Pricing Login Register
  docs/        接入文档 md（{{占位符}} 渲染时注入，见 placeholders.ts）+ _manifest.ts
  views/legal/ 法务条款 md（协议/隐私/退款/联系，en 为权威版本）
  utils/       format.ts csv.ts avatar.ts markdown.ts platform.ts error.ts
  config/      portal.ts(分发模式) pricing.ts(定价页数据，接入后端定价前的单一来源)
```
