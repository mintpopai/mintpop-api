/** Dashboard domain strings */
export default {
  title: 'Dashboard',
  welcome: "Welcome back, here's an overview of your account.",
  last7Days: 'Last 7 days',
  // Balance hero
  hero: {
    balanceAvailable: 'Balance · Available',
    todayCost: "Today's spend ${cost}",
    recharge: 'Recharge',
    // Referral badge on the balance card (rate is a 0-100 percentage)
    inviteBadge: 'Refer & earn {rate}%'
  },
  // KPI cards
  kpi: {
    apiKeys: 'API Keys',
    enabled: '{count} enabled',
    todayRequests: "Today's Requests",
    totalRequests: 'Total {value}',
    todayTokens: "Today's Tokens",
    inOut: 'In {input} · Out {output}',
    avgResponse: 'Avg Response'
  },
  // Model distribution
  model: {
    title: 'Model Distribution',
    subtitle: 'Top 5 · by requests',
    other: 'Other'
  },
  // Vendor distribution（APPLICATION 模式下标题改用 titleApp，各格名称改用 app.* 按平台 key 取）
  vendor: {
    title: 'Vendor Distribution',
    titleApp: 'Application Distribution',
    subtitle: 'Last 7 days · by requests',
    other: 'Other',
    requests: 'requests',
    // APPLICATION 模式下各格展示名（key 与平台一致）
    app: {
      anthropic: 'Text',
      openai: 'Vision',
      gemini: 'Voice'
    }
  },
  // Trend chart
  trend: {
    title: 'Token Usage Trend'
  },
  // Lifetime strip
  lifetime: {
    label: 'Lifetime',
    tokens: 'Total Tokens',
    requests: 'Total Requests',
    cost: 'Total Spend',
    viewAll: 'View all'
  },
  // Quick actions
  quickActions: {
    createKey: { title: 'Create API Key', desc: 'Generate a new key' },
    viewUsage: { title: 'View Usage', desc: 'Detailed usage logs' },
    redeem: { title: 'Redeem Code', desc: 'Use a redeem code' },
    // 外链：MintPop Shop 成品账号商店
    shop: { title: 'MintPop Shop', desc: 'Need a ready-made Claude / ChatGPT account?' }
  }
}
