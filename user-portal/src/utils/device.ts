/**
 * 是否移动端设备。用于支付方式分流：手机上直接整页跳转支付（同一设备完成支付并回跳），
 * 桌面上出二维码让手机扫（桌面没有支付宝/微信 App 可跳）。
 * 优先 UA Client Hints（Chromium），回退 UA 正则；iPadOS 桌面型 UA 归为桌面（扫码可用）。
 */
export function isMobileDevice(): boolean {
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData
  if (typeof uaData?.mobile === 'boolean') return uaData.mobile
  return /Android|iPhone|iPod|Mobile/i.test(navigator.userAgent)
}
