export default {
  // 页头
  pageTitle: '我的订单',
  pageSubtitle: '查看所有充值与订阅订单记录。',
  backToRecharge: '返回充值',

  // 状态筛选 tab
  tabs: {
    all: '全部',
    pending: '待支付',
    completed: '已完成',
    failed: '失败',
    refunded: '已退款'
  },

  // 统计卡片
  stats: {
    total: '订单总数',
    totalHint: '本页 {paid} 笔已支付 · {pending} 笔待支付',
    totalRecharge: '本页充值合计',
    totalRechargeHint: '本页已完成订单合计',
    latest: '最近订单'
  },

  // 搜索
  searchPlaceholder: '搜索订单编号…',
  searchHint: '搜索仅过滤当前页',

  // 列表
  empty: '暂无订单记录',
  paySuccess: '支付成功，余额已更新 ✓',

  // 取消确认弹窗
  cancelTitle: '取消订单',
  // {orderNo} 由模板以样式化插槽注入（<i18n-t>）
  cancelConfirm: '确定要取消订单 {orderNo} 吗？该操作无法撤销。',
  cancelReconsider: '再想想',
  cancelling: '取消中…',
  confirmCancel: '确认取消',
  cancelFailed: '取消订单失败，请重试',

  // 详情弹窗
  detailTitle: '订单详情',
  fields: {
    orderNo: '订单编号',
    orderType: '订单类型',
    amount: '充值金额',
    payAmount: '实付金额',
    paymentMethod: '支付方式',
    status: '订单状态',
    createdAt: '创建时间',
    expiresAt: '到期时间',
    paidAt: '支付时间',
    refundAmount: '退款金额',
    refundReason: '退款原因'
  },

  // 订单类型
  orderType: {
    balance: '账户充值',
    subscription: '订阅'
  },

  // 订单状态徽章文案（StatusBadge；key 为后端枚举取值 SCREAMING_SNAKE_CASE）
  status: {
    PENDING: '待支付',
    PAID: '已支付',
    RECHARGING: '充值中',
    COMPLETED: '已完成',
    EXPIRED: '已过期',
    CANCELLED: '已取消',
    FAILED: '失败',
    REFUND_REQUESTED: '退款申请中',
    REFUNDING: '退款中',
    REFUND_PENDING: '退款处理中',
    PARTIALLY_REFUNDED: '部分退款',
    REFUNDED: '已退款',
    REFUND_FAILED: '退款失败'
  },

  // 支付方式展示文案
  payment: {
    wechat: '微信支付',
    alipay: '支付宝'
  },

  // 表头
  table: {
    orderNo: '订单编号',
    paid: '实付',
    paymentMethod: '支付方式',
    status: '状态',
    createdAt: '创建时间',
    actions: '操作'
  },

  // 行内操作
  actions: {
    view: '查看',
    payNow: '立即支付',
    reorder: '重新下单'
  }
}
