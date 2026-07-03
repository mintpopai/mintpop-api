/** 个人资料域文案 */
export default {
  title: '个人资料',
  subtitle: '管理您的账户信息与登录方式。',
  // 角色标签
  role: {
    admin: '管理员',
    user: '用户'
  },
  // 账号状态
  status: {
    enabled: '已启用',
    disabled: '已禁用'
  },
  // 概览统计
  stats: {
    balance: '账户余额',
    concurrency: '并发限制',
    registeredAt: '注册时间'
  },
  // 资料与头像表单
  form: {
    title: '资料与头像',
    subtitle: '维护公开展示信息，保持头像与昵称风格一致。',
    avatarLabel: '资料头像',
    avatarHint: '上传图片自动压缩静态图至 20KB 内，GIF 需自行控制在 20KB 内。',
    uploadImage: '上传图片',
    uploadFailed: '上传失败',
    imageTooLarge: '图片过大，请换一张更小的图片',
    username: '用户名',
    usernamePlaceholder: '用户名（1–50 字符）',
    updateProfile: '更新资料'
  },
  // 操作结果提示
  toast: {
    updateSuccess: '资料已更新',
    updateFailed: '资料更新失败',
    avatarSuccess: '头像已更新',
    avatarRemoved: '头像已删除',
    avatarFailed: '头像更新失败',
    unbindSuccess: '已解绑',
    bindFailed: '发起绑定失败',
    unbindFailed: '解绑失败'
  },
  // 登录方式绑定
  binding: {
    title: '登录方式绑定',
    subtitle: '查看当前绑定状态，并将更多第三方登录方式关联到此账号。',
    bound: '已绑定',
    unbound: '未绑定',
    bind: '绑定',
    unbind: '解绑',
    // 各登录方式展示名（品牌英文名不翻译）
    providers: {
      email: '邮箱',
      wechat: '微信',
      dingtalk: '钉钉'
    },
    // 各登录方式说明
    desc: {
      email: '{email} · 主邮箱在资料表单中管理',
      linuxdo: '使用 LinuxDo 账号快速登录',
      wechat: '使用微信扫码快速登录',
      dingtalk: '关联企业钉钉以便团队管理',
      oidc: '通过标准 OIDC 单点登录接入'
    }
  }
}
