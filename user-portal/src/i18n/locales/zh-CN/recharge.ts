/** 充值 / 订阅域（RechargeView 及 recharge/* 组件） */
export default {
  // —— 页头 ——
  pageTitle: '充值 / 订阅',
  pageSubtitle: '为账户余额充值，按量计费即充即用。',
  myOrders: '我的订单',
  // —— 顶部分段 / 结果提示 ——
  tabRecharge: '充值',
  tabSubscription: '订阅',
  paySuccessTitle: '支付成功',
  rechargeSuccess: '充值成功！余额已更新。',
  subscribeSuccess: '订阅成功！套餐已生效。',
  resumeUnknown: '未能确认到账，请稍后在「订单」页查看订单状态。',
  // —— 账户卡 ——
  rechargeAccount: '充值账户',
  currentBalance: '当前余额',
  // —— 提交按钮 / 下单 ——
  confirmPay: '确认支付',
  selectAmount: '请选择金额',
  submitting: '下单中…',
  errCreateOrder: '下单失败，请稍后重试',
  errAmountMissing: '充值金额未设置，无法提交',
  // —— 订阅确认弹窗 ——
  confirmSubscribe: '确认订阅',
  planFallback: '套餐',
  validityLine: '有效期：{days}{unit}',
  dayUnit: '天',
  // —— AmountPicker ——
  selectRechargeAmount: '选择充值金额',
  unitNote: '单位 USD · 实时汇率结算',
  credited: '到账 ${amount}',
  popular: '热门',
  customAmount: '自定义金额',
  amountPlaceholder: '输入金额（最低 ${min}）',
  amountPlaceholderNoMin: '输入自定义金额',
  errInvalidAmount: '请输入有效金额',
  minAmount: '最低 ${min}',
  maxAmount: '最高 ${max}',
  // —— OrderSummary ——
  orderDetails: '订单明细',
  rechargeAmount: '充值金额',
  creditedAmount: '到账额度',
  balanceAfter: '到账后余额',
  amountDue: '应付金额',
  amountDueNote: '实际应付以下单结果为准',
  stripeSecured: '支付由 Stripe 加密保障',
  // —— PayMethodPicker ——
  paymentMethod: '支付方式',
  // {provider} 由模板以样式化插槽注入（<i18n-t>），语序由词条自身承载
  poweredBy: '由 {provider} 安全处理',
  securityNote: '微信支付与支付宝均通过 {provider} 安全处理，到账与额度一致。',
  methodWxpay: '微信支付',
  methodAlipay: '支付宝',
  methodCard: '银行卡',
  methodCardDesc: 'Visa · 万事达',
  methodScanDesc: '扫码即时到账',
  // —— RedeemCard ——
  redeemCode: '兑换码',
  redeemPlaceholder: '输入兑换码',
  redeem: '兑换',
  redeeming: '兑换中…',
  errRedeem: '兑换失败，请检查兑换码是否正确',
  redeemSuccess: '兑换成功！',
  newBalance: '新余额：',
  newConcurrency: '并发数：',
  // —— SubscriptionPlans ——
  dailyLimit: '日额度',
  weeklyLimit: '周额度',
  monthlyLimit: '月额度',
  noPlans: '暂无可用订阅套餐',
  validity: '有效期',
  rateMultiplier: '倍率',
  selectPlan: '选择此套餐'
}
