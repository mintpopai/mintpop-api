export default {
  // Page header
  pageTitle: 'My Orders',
  pageSubtitle: 'View all your recharge and subscription orders.',
  backToRecharge: 'Back to Recharge',

  // Status filter tabs
  tabs: {
    all: 'All',
    pending: 'Pending',
    completed: 'Completed',
    failed: 'Failed',
    refunded: 'Refunded'
  },

  // Stat cards
  stats: {
    total: 'Total Orders',
    totalHint: 'This page: {paid} paid · {pending} pending',
    totalRecharge: 'Total Recharge',
    totalRechargeHint: 'All-time recharge total for your account',
    latest: 'Latest Order'
  },

  // Search
  searchPlaceholder: 'Search order no.…',
  searchHint: 'Search filters the current page only',

  // List
  empty: 'No order records yet',

  // Cancel confirmation modal
  cancelTitle: 'Cancel Order',
  // {orderNo} 由模板以样式化插槽注入（<i18n-t>）
  cancelConfirm: 'Are you sure you want to cancel order {orderNo}? This action cannot be undone.',
  cancelReconsider: 'Never mind',
  cancelling: 'Cancelling…',
  confirmCancel: 'Confirm Cancel',
  cancelFailed: 'Failed to cancel order, please try again',

  // Detail modal
  detailTitle: 'Order Details',
  fields: {
    orderNo: 'Order No.',
    orderType: 'Order Type',
    amount: 'Recharge Amount',
    payAmount: 'Amount Paid',
    paymentMethod: 'Payment Method',
    status: 'Status',
    createdAt: 'Created at',
    expiresAt: 'Expires at',
    paidAt: 'Paid at',
    refundAmount: 'Refund Amount',
    refundReason: 'Refund Reason'
  },

  // Order types
  orderType: {
    balance: 'Account Recharge',
    subscription: 'Subscription'
  },

  // Order status badge labels (StatusBadge; keys are backend enum values in SCREAMING_SNAKE_CASE)
  status: {
    PENDING: 'Pending',
    PAID: 'Paid',
    RECHARGING: 'Recharging',
    COMPLETED: 'Completed',
    EXPIRED: 'Expired',
    CANCELLED: 'Cancelled',
    FAILED: 'Failed',
    REFUND_REQUESTED: 'Refund Requested',
    REFUNDING: 'Refunding',
    REFUND_PENDING: 'Refund Pending',
    PARTIALLY_REFUNDED: 'Partially Refunded',
    REFUNDED: 'Refunded',
    REFUND_FAILED: 'Refund Failed'
  },

  // Payment method display labels
  payment: {
    wechat: 'WeChat Pay',
    alipay: 'Alipay'
  },

  // Table headers
  table: {
    orderNo: 'Order No.',
    paid: 'Paid',
    paymentMethod: 'Payment Method',
    status: 'Status',
    createdAt: 'Created at',
    actions: 'Actions'
  },

  // Row actions
  actions: {
    view: 'View',
    reorder: 'Reorder'
  }
}
