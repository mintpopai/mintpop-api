/** Payment result domain (PaymentResultModal) */
export default {
  scanToPay: 'Scan to pay',
  payTitle: 'Complete payment',
  expired: 'Expired',
  // Stripe card payment (Payment Element)
  stripeHint: 'Enter your card details to pay',
  stripePay: 'Pay now',
  processing: 'Confirming your payment, please wait…',
  stripeLoadFailed: 'Failed to load the payment form, please try again',
  stripeNotConfigured: 'Payment is not configured, please contact the administrator',
  // Order status labels
  statusPending: 'Awaiting payment',
  statusPaid: 'Payment successful',
  statusRecharging: 'Recharging',
  statusFailed: 'Payment failed',
  statusCancelled: 'Cancelled',
  statusRefunded: 'Refunded',
  errVerify: 'Query failed',
  // QR code area
  qrAlt: 'Payment QR code',
  scanHint: 'Scan with WeChat / Alipay to pay',
  qrValidity: 'QR code valid for {time}',
  redirecting: 'Redirecting to the payment page, please wait…',
  // Footer actions
  verifying: 'Checking…',
  paidRefresh: "I've paid / Refresh",
  // Redirect payment return page (PaymentReturnView)
  returnChecking: 'Confirming your payment, please wait…',
  returnSuccess: 'Your balance has been updated. See details on the orders page.',
  returnSubscribed: 'Your subscription is now active. See details on the orders page.',
  returnUnknown: "We couldn't confirm the payment yet. If you have paid, it may take a moment to settle — please check your orders shortly.",
  returnMissing: 'Missing order reference; unable to check the payment result. Please verify the status on the orders page.',
  goOrders: 'View orders',
  backRecharge: 'Back to recharge'
}
