/** 邀请返利页文案 */
export default {
  pageTitle: '邀请返利',
  pageSubtitle: '邀请新用户注册，并将返利额度转入账户余额。',
  loadFailed: '加载邀请返利数据失败',
  // 统计卡
  stats: {
    rebateRate: '我的返利比例',
    rebateRateHint: '被邀请用户每次充值后你可获得的返利比例',
    invitedUsers: '邀请人数',
    invitedUsersHint: '通过你的邀请码注册的用户数',
    availableQuota: '可转返利额度',
    availableQuotaHint: '可随时转入账户余额',
    totalQuota: '历史返利额度',
    frozenQuota: '冻结中 {amount}'
  },
  // 邀请码 / 邀请链接
  share: {
    title: '分享邀请',
    yourCode: '我的邀请码',
    inviteLink: '邀请链接',
    copy: '复制',
    copied: '已复制'
  },
  // 使用说明
  tips: {
    title: '使用说明',
    line1: '将邀请码或邀请链接分享给新用户。',
    line2: '被邀请用户充值后，你可获得 {rate} 的返利额度。',
    line3: '返利额度可随时转入账户余额。',
    line4: '新产生的返利需要经过冻结期后才能转入。'
  },
  // 返利额度转余额
  transfer: {
    title: '返利额度转余额',
    description: '将当前可用返利额度一键转入账户余额',
    button: '转入余额',
    transferring: '转入中…',
    empty: '当前没有可转入额度',
    success: '已转入余额：{amount}',
    failed: '转入余额失败'
  },
  // 已邀请用户表
  invitees: {
    title: '已邀请用户',
    empty: '暂无邀请记录，分享你的邀请链接开始获得返利吧',
    columns: {
      email: '邮箱',
      username: '用户名',
      rebate: '累计返利',
      joinedAt: '注册时间'
    }
  }
}
