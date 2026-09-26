# mintpop 统一认证中心（基于 Logto）设计

- 日期：2026-07-07
- 状态：设计已确认，待拆实施计划
- 范围：mintpop 组织级基础设施（新仓库 `mintpop-auth`）+ 本仓库（mintpop-api）的接入改造

## 1. 背景与目标

mintpop 组织下将有多个产品（本项目 mintpop-api、其它带后端的 Web 应用、纯前端/静态站、桌面端/CLI），希望共用一套授权体系：一个账号通行全组织产品。

**目标**：

1. 建立组织唯一的统一认证中心（OIDC Provider），承担注册、登录、密码找回等身份职责；
2. mintpop-api 以「尽可能不修改 backend 代码」的方式接入；
3. 全球用户（美加欧澳新中，含中国大陆）接入便捷，邮箱注册登录为保底且优先保障；
4. 登录页可自定义，与 mintpop 品牌产品设计风格一致。

**非目标**：

- 不把 mintpop-api 的用户业务数据（余额、配额、API Key、订阅）搬进认证中心——业务归属仍在各产品本地；
- 不自研 OIDC Provider（安全关键路径不自建）；
- 不在本期强求登录页像素级还原品牌（CSS 深度换肤到位即可，像素级路径见 §9 风险）。

## 2. 关键事实（探索与调研结论）

### 2.1 backend 现状（可行性立足点）

- backend 已内置**标准 OIDC 客户端**能力：`backend/internal/handler/auth_oidc_oauth.go` + 配置块 `OIDCConnectConfig`（`internal/config/config.go`），路由 `/api/v1/auth/oauth/oidc/start|callback` 及配套 `complete-registration / bind-login / create-account` 均已存在。**接入统一认证中心＝填配置，不改代码**。
- `auth_identity` 表（`ent/schema/auth_identity.go`）已把「登录身份」与「本地用户」解耦：`(provider_type, provider_key, provider_subject)` 唯一 → `user_id`。它就是认证中心 `sub` 与本地账号的现成映射机制。
- 现有会话机制（HS256 JWT + Redis refresh token + 每请求回查 DB 的中间件）**原样保留**：统一登录成功后 backend 依旧签发自己的 JWT/refresh，业务层无感知。
- 用户业务字段（balance/concurrency/配额/API Key 归属）挂在本地 `users` 表，12+ 张业务表外键指向它——这部分不抽、不动。
- 注册/忘记密码等行为由 DB 运行时开关驱动（SettingService：`IsRegistrationEnabled` 等），可在收敛阶段用开关关闭本地入口，仍不改代码。
- 存量现状：仅开放过邮箱注册，用户量不大 → 迁移负担轻。
- 管理员与普通用户同表同机制（`role` 字段区分），另有 Admin API Key 旁路。

### 2.2 选型调研（2026-07 联网核实）

对比 Logto / Casdoor / Zitadel / Keycloak，按「全球可达、邮箱优先、登录页可定制」三条要求：

- **Zitadel**：v3 起从 Apache-2.0 改为 AGPL-3.0，且无中国系登录连接器 → 排除；
- **Keycloak**：最重、UI 最旧、微信钉钉靠社区扩展，本场景用不到其企业强项（SAML/LDAP）→ 排除；
- **Casdoor**：Go 单二进制最轻、中国系登录最全，但登录页是 antd 底子、视觉定制上限低，历史 CVE 较多 → 备选；
- **Logto（选定）**：MPL-2.0 自托管无限用户；开箱登录 UI 现代，OSS 支持 logo/主色/暗色/**自定义 CSS**；邮箱密码 + 邮箱验证码登录内置，SMTP 连接器 OSS 可用；官方微信/钉钉/飞书连接器（未来社交登录）；设备码流程（CLI）v1.38+；Management API 支持携带 bcrypt 哈希导入用户。
- 注意边界：Logto「Bring your UI」（整体替换登录 UI）为 **Cloud 独占**，OSS 的完全自定义路径是 fork 其 experience 包——本期不需要。

## 3. 总体架构

```
                 ┌─────────────────────────────┐
                 │  mintpop-auth（新仓库）        │
                 │  Logto 自托管 + 专属 Postgres  │
                 │  auth.<主域>（Cloudflare）     │
                 └──────────────┬──────────────┘
                        标准 OIDC（授权码/PKCE/设备码）
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
  mintpop-api             纯前端/静态站             桌面端 / CLI
  （传统 Web client，      （SPA client，           （Native client，
   授权码流，secret 在后端）  授权码 + PKCE）          PKCE 回环 / 设备码）
```

- **mintpop-auth 仓库内容**：Logto 的 `docker-compose.yml` 编排（logto + postgres，按 docker-compose 规范：healthcheck、版本与端口参数化、无 build 段）、品牌定制资产（logo、自定义 CSS）、存量用户导入脚本、接入文档。不写新服务代码。
- **职责分工**：Logto 只管身份（邮箱、密码、验证码、未来的社交登录/MFA）；各产品本地用户表管业务归属（余额、配额、API Key、订阅）。两边靠 OIDC `sub` ↔ 本地映射表（mintpop-api 用现成的 `auth_identity`）。
- Logto 版本**钉住具体版本号**，升级前查 changelog（其大版本偶有数据库迁移步骤）。

## 4. mintpop-api 接入方案（零后端代码改动）

1. **配置接入**：在 Logto 建 `mintpop-api` 应用（Traditional Web），把 issuer/discovery URL、client id/secret 填进 backend 的 `OIDCConnectConfig`；现有 `/api/v1/auth/oauth/oidc/*` 路由直接生效。
2. **前端入口**（唯一需要动手的部分，且只动前端）：`frontend/` 与 `user-portal/` 登录页各加一个「使用 mintpop 账号登录」按钮，指向 OIDC start 端点。
3. **会话不变**：OIDC 回调完成后 backend 照旧签发本产品 JWT + refresh token；两个前端现有的 localStorage token 与 401 自动刷新逻辑不动。
4. **存量关联**：存量用户首次统一登录时按邮箱关联本地账号——backend 现有的 OIDC 绑定流程（同邮箱 bind-login / 自动关联）即为此设计，无需新码。
5. **入口收敛**（稳定后）：用 DB 运行时开关关闭本地注册（`IsRegistrationEnabled=false`）与本地忘记密码，注册收敛到认证中心。**本地邮箱密码登录保留**：作为认证中心故障时的逃生口 + 管理员兜底（admin 同表同机制，Admin API Key 旁路也不受影响）。

## 5. 存量用户迁移

- 一次性脚本走 Logto Management API：按本地 `users` 表导出 `email + password_hash(bcrypt)`，携带哈希建用户（Logto 支持指定密码算法为 bcrypt），用户密码无感迁移；
- 用户量不大，全量一批导入即可；导入后抽样验证「旧密码在认证中心可登录」；
- 邮箱冲突策略：认证中心以邮箱唯一；导入前先核对本地无重复（本地 email 本就唯一软删，注意排除已软删用户）。

## 6. 品牌与全球可达性

- **品牌**：Logto 控制台配置 logo、主色、暗色模式 + 自定义 CSS，对齐 user-portal 现有 AuthShell 认证页的设计语言；
- **可达性**（按全球可达性规范执行）：`auth.<主域>` 走 Cloudflare；核查登录页最终产物无被墙第三方引用（Google Fonts 等），有则以自托管方式消除；
- **邮件**：Logto 的 SMTP 连接器接现有 SMTP 服务商（Cloud 独占的只是其内置免费邮件服务，不影响 OSS 用 SMTP）；验证码/重置邮件送达率随 SMTP 服务商，与 IdP 无关。

## 7. 上线顺序（每步可独立回退）

1. 建 `mintpop-auth` 仓库：Logto compose 编排 + 品牌定制 + SMTP 连接器，建 mintpop-api 的 OIDC client；
2. 导入存量用户，抽样验证登录；
3. backend 填 OIDC 配置 + 两个前端加统一登录按钮，**与本地登录并存**上线；
4. 观察稳定后关本地注册/找回入口，统一登录成为主入口；
5. 后续新产品直接在 Logto 建 client 接入，mintpop-api 不再参与。

回退策略：任一阶段出问题，删按钮/改回开关即可回到纯本地登录；backend 配置项不删，只是不用。

## 8. 测试

- 本地用 docker compose 起 Logto，建 dev client，端到端验证：认证中心注册 → OIDC 登录 mintpop-api → 新用户建号 / 存量同邮箱关联 → backend 签发 JWT → 业务接口可用 → refresh 正常；
- 迁移脚本用测试实例演练：导入 → 旧密码登录成功；
- 前端登录按钮走现有组件测试惯例（user-portal / frontend 各自的测试栈）。

## 9. 风险与已知边界

| 风险 | 应对 |
|---|---|
| Logto 大版本升级偶有迁移步骤 | 钉版本；升级前读 changelog，先在本地演练 |
| CSS 换肤有上限，将来要求像素级品牌一致 | 届时 fork Logto experience 包（OSS 官方路径）；接口层是标准 OIDC，认证中心本身可替换 |
| 认证中心单点故障 | mintpop-api 保留本地邮箱登录逃生口；Logto 与其 Postgres 配 healthcheck + 自动重启 |
| 两套账号并存期的心智负担 | 并存期尽量短；登录页文案引导走统一登录 |
| 桌面/CLI 场景细节（回环端口、设备码 UX） | 到接入具体产品时按 Logto Native/设备码指南落地，本期不展开 |
