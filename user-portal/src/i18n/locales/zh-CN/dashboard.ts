/** 仪表盘域文案 */
export default {
  title: '仪表盘',
  welcome: '欢迎回来，这是您账户的概览。',
  last7Days: '近 7 天',
  // 余额英雄区
  hero: {
    balanceAvailable: '账户余额 · 可用',
    todayCost: '今日消费 ${cost}',
    recharge: '充值',
    // 邀请返利角标（点击进入邀请页；rate 为 0-100 的百分数）
    inviteBadge: '邀请返 {rate}%',
    // MintPop Shop 角标：促销位用疑问句抓注意力（顶栏那处是导航位，仍用名词 nav.shop）
    shopBadge: '需要成品账号？'
  },
  // 关键指标卡片
  kpi: {
    apiKeys: 'API 密钥',
    enabled: '{count} 个已启用',
    todayRequests: '今日请求',
    totalRequests: '累计 {value}',
    todayTokens: '今日 Token',
    inOut: '入 {input} · 出 {output}',
    avgResponse: '平均响应'
  },
  // 模型分布
  model: {
    title: '模型分布',
    subtitle: 'Top 5 · 按请求数',
    other: '其他'
  },
  // 模型厂商分布（APPLICATION 模式下标题改用 titleApp，各格名称改用 app.* 按平台 key 取）
  vendor: {
    title: '模型厂商分布',
    titleApp: '应用类型分布',
    subtitle: '近 7 天 · 按请求数',
    other: '其他',
    requests: '请求',
    // APPLICATION 模式下各格展示名（key 与平台一致）
    app: {
      anthropic: '文本',
      openai: '视觉',
      gemini: '语音'
    }
  },
  // 趋势图
  trend: {
    title: 'Token 使用趋势'
  },
  // 累计指标条
  lifetime: {
    label: '累计指标',
    tokens: '累计 Token',
    requests: '累计请求',
    cost: '累计消费',
    viewAll: '查看全部'
  },
  // 快捷操作
  quickActions: {
    createKey: { title: '创建 API 密钥', desc: '生成新的密钥' },
    viewUsage: { title: '查看使用记录', desc: '详细使用日志' },
    redeem: { title: '兑换码充值', desc: '使用兑换码' }
  }
}
