# 充值页：官方价值展示 + 账户显示用户名 + Stripe 子方式拍平 设计

日期：2026-07-05 ｜ 范围：仅 user-portal（后端零改动）

## 需求

1. **官方价值比对**：充值档位卡与订单明细展示「官方 API 价」对比。口径（用户拍板）：**官方价值 = 充值金额 × 5（即平台价为官方价 2 折），省 80%**。
2. **充值账户**：账户卡显示**用户名**（`user.username`），不再显示用户 ID。
3. **支付方式拍平**：当前门户只有一个「Stripe」入口，点进 Stripe 支付组件后才在其内部选微信/支付宝/银行卡。改为门户页直接平铺**微信支付 / 支付宝 / 银行卡**三个选项（卡片文案「银行卡 · Visa · 万事达」），选中后支付弹窗只显示所选方式。

## 约束与前提

- **后端零改动**（用户要求；后端为上游 fork，减小 diff）。
- **部署约定**：Stripe 实例的 `supported_types` 固定配置 card/alipay/wxpay 三个子方式（用户确认可假定恒成立），门户按此约定硬编码展开三个选项。

## 方案（纯前端）

原理：下单创建的 PaymentIntent 本身仍带三种 `payment_method_types`（后端不动）；**收窄只发生在展示层**——用 Stripe.js 的 deferred 模式 Elements（`stripe.elements({ mode: 'payment', amount, currency, paymentMethodTypes: [所选方式] })`）只渲染一种方式，确认时 `elements.submit()` 后把订单的 `client_secret` 显式传给 `stripe.confirmPayment({ elements, clientSecret })` 去确认同一个 PaymentIntent。金额/币种取下单返回的 `pay_amount` / `currency`（与 intent 完全一致）。

### 改动点（全部在 user-portal）

1. `config/payMethods.ts`：拍平选项构建器。`stripe` 方式存在 → 展开 `stripe:wxpay` / `stripe:alipay` / `stripe:card`（顺序即展示与默认选中优先级）；与直连 `wxpay`/`alipay` 同名去重（直连优先）。附 `STRIPE_PM_TYPE` 子方式 → Stripe `payment_method_types` 映射。
2. `composables/useRecharge.ts`：`payOptions` / `activePayOption`；下单 `payment_type` 统一取选项的 `paymentType`（Stripe 子方式选项即 `stripe`），不向后端发送子方式。
3. `views/RechargeView.vue`：把选中子方式作为 `stripe_sub_method` 附在传给支付弹窗的订单对象上；限额读 `methods[选项.limitsKey]`；账户卡显示 `username`。
4. `components/payment/PaymentResultModal.vue` 按子方式分流，省掉多余确认步骤：
   - **微信**：不挂表单——`confirmWechatPayPayment(clientSecret, {payment_method:{}}, {handleActions:false})` 直接取 `next_action.wechat_pay_display_qr_code`，弹窗打开即直出二维码（本地渲染 data URL，无外链可达性问题）+ 倒计时 + 轮询，零点击；
   - **支付宝**：`confirmAlipayPayment(clientSecret, {return_url})` 直接整页跳转 Stripe 托管支付页，弹窗仅短暂显示「正在跳转」；付完回跳由既有 `pay_return` 回流确认；
   - **银行卡**：deferred 模式 Elements（`paymentMethodTypes:['card']`）渲染卡表单（卡号必须收集，无后端改动时没有托管卡页可跳），确认前 `elements.submit()` 再传 `clientSecret` 给 `confirmPayment`；
   - 缺子方式/金额/币种（订单列表续付等）→ 回退 clientSecret 模式渲染 PaymentIntent 全部方式。
5. `utils/format.ts`：`toStripeMinorUnit`（主单位 → Stripe 最小货币单位，零小数币种名单对齐 Stripe 文档）。
6. `config/pricing.ts`：`OFFICIAL_VALUE_MULTIPLIER = 5` 单一来源；`AmountPicker` 档位卡「官方价值 ≈ $X」；`OrderSummary` 官方价对比块（划线价 + 你已省下 $Y · 省 80%）与「到账后余额」行，赠送行仅 >0 时显示。
7. i18n 中英词条同步（删除不再使用的 `instantUse`、`methodStripe*`）。

## 错误处理与测试

- deferred 路径缺金额/币种/子方式任一 → 自动回退 clientSecret 模式（功能不损，仅回到「弹窗内三选一」）。
- 单测：`payMethods`（展开/去重/不支持通道过滤）、`useRecharge`（默认选中、子方式映射）、`toStripeMinorUnit`（两位小数/零小数/回退币种）、`PayMethodPicker` 键盘交互。
