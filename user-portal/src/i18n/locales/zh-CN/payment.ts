/** 支付结果域（PaymentResultModal） */
export default {
  scanToPay: '扫码支付',
  payTitle: '完成支付',
  expired: '已过期',
  // Stripe 卡支付（Payment Element）
  stripeHint: '请填写卡信息完成支付',
  stripePay: '立即支付',
  processing: '正在确认支付，请稍候…',
  stripeLoadFailed: '支付组件加载失败，请稍后重试',
  stripeNotConfigured: '支付尚未配置，请联系管理员',
  // 订单状态文案
  statusPending: '等待支付',
  statusPaid: '支付成功',
  statusRecharging: '充值中',
  statusFailed: '支付失败',
  statusCancelled: '已取消',
  statusRefunded: '已退款',
  errVerify: '查询失败',
  // 二维码区
  qrAlt: '支付二维码',
  scanHint: '请使用微信 / 支付宝扫码支付',
  scanWechatHint: '请使用微信扫码支付',
  scanAlipayHint: '请使用支付宝扫码支付',
  alipayFallback: '无法扫码？跳转支付宝支付页 →',
  loadingQr: '正在生成二维码…',
  qrValidity: '二维码有效期：{time}',
  redirecting: '正在跳转至支付页面，请稍候…',
  // 底部操作
  verifying: '查询中…',
  paidRefresh: '我已支付 / 刷新',
  // 跳转支付回流页（PaymentReturnView）
  returnChecking: '正在确认支付结果，请稍候…',
  returnSuccess: '余额已更新，可前往订单页查看明细',
  returnSubscribed: '订阅已生效，可前往订单页查看明细',
  returnUnknown: '暂未确认到支付结果。如已完成支付，到账可能有延迟，请稍后在订单页核实。',
  returnMissing: '缺少订单参数，无法查询支付结果。请从订单页核实支付状态。',
  goOrders: '查看订单',
  backRecharge: '返回充值'
}
