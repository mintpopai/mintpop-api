/** Invite & rebate page */
export default {
  pageTitle: 'Referral Rewards',
  pageSubtitle: 'Invite new users and transfer your rebate credits into your balance.',
  loadFailed: 'Failed to load referral data',
  // Stat cards
  stats: {
    rebateRate: 'My rebate rate',
    rebateRateHint: 'Your share of every top-up made by invited users',
    invitedUsers: 'Invited users',
    invitedUsersHint: 'Users who signed up with your code',
    availableQuota: 'Transferable rebate',
    availableQuotaHint: 'Can be transferred to balance anytime',
    totalQuota: 'Lifetime rebate',
    frozenQuota: 'Frozen {amount}'
  },
  // Invite code / link
  share: {
    title: 'Share your invite',
    yourCode: 'My invite code',
    inviteLink: 'Invite link',
    copy: 'Copy',
    copied: 'Copied'
  },
  // How it works
  tips: {
    title: 'How it works',
    line1: 'Share your invite code or link with new users.',
    line2: 'You earn {rate} in rebate credits whenever an invited user tops up.',
    line3: 'Rebate credits can be transferred to your balance anytime.',
    line4: 'Newly earned rebates go through a freeze period before transfer.'
  },
  // Transfer rebate to balance
  transfer: {
    title: 'Transfer rebate to balance',
    description: 'Move all available rebate credits into your account balance in one click',
    button: 'Transfer to balance',
    transferring: 'Transferring…',
    empty: 'No transferable credits right now',
    success: 'Transferred to balance: {amount}',
    failed: 'Failed to transfer to balance'
  },
  // Invited users table
  invitees: {
    title: 'Invited users',
    empty: 'No invites yet — share your link to start earning rebates',
    columns: {
      email: 'Email',
      username: 'Username',
      rebate: 'Total rebate',
      joinedAt: 'Joined at'
    }
  }
}
