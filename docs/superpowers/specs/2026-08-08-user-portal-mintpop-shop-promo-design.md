# user-portal 新增 MintPop Shop 宣传入口

日期：2026-08-08
实现说明：本设计未产出实施计划，由会话直接按本文实现（提交 e27beed90；同日 7ce20a124、1dc9cd6a7 为后续调整——顶栏说明改自绘 tooltip、商店入口从底部 QuickActions 挪到仪表盘 Hero 角标，与本文第 4 节已不一致，以代码为准）。

## 背景与目标

MintPop Shop（`shop.mintpop.ai`）售卖成品 Claude / ChatGPT 账号，与 user-portal 售卖的 API 额度是互补品。
需要在用户门户里给它一个常驻宣传入口，把有「要现成账号」需求的用户导过去，同时不喧宾夺主、不打断门户主流程。

## 方案

两处入口，一轻一重：

- **顶栏外链**：全站常驻，只放品牌名，负责「随时可达」。
- **仪表盘 QuickActions 卡片**：位于仪表盘底部，承载完整宣传语，负责「说清楚卖什么」。

明确不做（YAGNI）：不加开关控制显隐、不做可关闭通栏横幅、链接不按语言分流、不与 `IS_APPLICATION_MODE` 联动。

## 改动清单

### 1. 外链常量收口 `src/config/portal.ts`

与既有 `CONTACT_PAGE_URLS` 并列新增常量，外链地址不散落进组件：

```ts
/** MintPop Shop（成品 Claude / ChatGPT 账号商店）：不分语言，店铺自行处理多语言 */
export const SHOP_PAGE_URL = 'https://shop.mintpop.ai'
```

链接**不分语言**——店铺站点自行处理语言，门户侧只给一个地址。

### 2. i18n 双语文案

zh-CN / en-US 四个文件同步新增，缺一侧会被现有守护测试 `src/i18n/__tests__/messages-align.test.ts` 拦下。

| key | zh-CN | en-US |
|---|---|---|
| `nav.shop` | `MintPop Shop` | `MintPop Shop` |
| `dashboard.quickActions.shop.title` | `MintPop Shop` | `MintPop Shop` |
| `dashboard.quickActions.shop.desc` | `需要成品的 Claude / ChatGPT 账号？点此购买` | `Need a ready-made Claude / ChatGPT account?` |

品牌名两侧均不翻译。顶栏横向空间有限，只放品牌名；完整宣传语落在仪表盘卡片的 `desc` 上。

### 3. 顶栏入口 `src/layouts/PortalLayout.vue`

- 桌面：右侧「联系方式」之后追加一个 `<a>`，复用既有 `.doc-link` 样式类，带 `↗` 角标表示外链，`target="_blank"` + `rel="noopener"`。
- 移动端：汉堡抽屉里同样补一条，写法与抽屉内「联系方式」一致，点击后 `closeNav()`。
- 不新增样式类。

### 4. 仪表盘卡片 `src/components/dashboard/QuickActions.vue`

当前三项全是站内路由（`router.push`）。加入外链项后需要区分两种跳转：

- action 项结构改为 `to`（站内）与 `href`（外链）二选一。
- 模板按类型分别渲染：站内仍是 `<button>`，外链渲染 `<a target="_blank" rel="noopener">`。
- 箭头区分方向：站内 `→`，外链 `↗`。
- 栅格由 `sm:grid-cols-3` 改为 `sm:grid-cols-2 lg:grid-cols-4`，避免四格在平板宽度被压扁。

### 5. 测试

新增 `src/components/dashboard/__tests__/QuickActions.test.ts`：

- shop 项渲染为 `a[href="https://shop.mintpop.ai"]`，且带 `target="_blank"`、`rel` 含 `noopener`。
- 其余三项仍渲染为 `button`，不产生 `href`。

i18n 两侧对齐由既有守护测试覆盖，不另写。

## 验收

- `mise run lint-user-portal` 通过。
- `mise run test-user-portal` 通过（含新增用例与 i18n 对齐守护）。
- 中英文切换下顶栏与仪表盘卡片文案均正确，链接新开页指向 `https://shop.mintpop.ai`。
