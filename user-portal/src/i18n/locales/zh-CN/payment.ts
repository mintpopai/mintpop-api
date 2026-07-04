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
  statusFailed: '支付失败',
  statusCancelled: '已取消',
  statusRefunded: '已退款',
  errVerify: '查询失败',
  // 二维码区
  qrAlt: '支付二维码',
  scanHint: '请使用微信 / 支付宝扫码支付',
  qrValidity: '二维码有效期：{time}',
  redirecting: '正在跳转至支付页面，请稍候…',
  // 底部操作
  verifying: '查询中…',
  paidRefresh: '我已支付 / 刷新'
}
