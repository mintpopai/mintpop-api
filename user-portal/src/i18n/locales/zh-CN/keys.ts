export default {
  title: 'API 密钥',
  subtitle: '管理您的 API 密钥与访问令牌。',
  createKey: '创建密钥',
  guide: {
    // 固定链接 /keys?guide=create 进入时的引导气泡文案
    createHint: '点击这里即可创建您的 API 密钥'
  },
  creating: '创建中…',
  createFailed: '创建失败，请重试',
  searchPlaceholder: '搜索名称或 Key…',
  empty: '暂无密钥数据',
  status: {
    active: '活跃',
    inactive: '已禁用'
  },
  enable: '启用',
  disable: '禁用',
  stats: {
    totalLabel: '密钥总数',
    statusHint: '本页 {active} 个已启用 · {inactive} 个已禁用',
    cost30dLabel: '近 30 天消费',
    costHint: '本页密钥合计'
  },
  filter: {
    allGroups: '全部分组',
    allStatus: '全部状态'
  },
  form: {
    name: '名称',
    namePlaceholder: '例如：生产环境',
    editNamePlaceholder: '密钥名称',
    group: '分组',
    selectGroup: '请选择分组',
    expiryLabel: '有效期（天，留空表示永不过期）',
    expiryPlaceholder: '例如：30',
    quotaLabel: '配额（USD，留空表示不限）',
    quotaPlaceholder: '例如：10.00'
  },
  created: {
    title: '密钥已创建',
    keyLabel: '您的 API 密钥'
  },
  edit: {
    title: '编辑密钥',
    enableLabel: '启用密钥',
    saving: '保存中…'
  },
  delete: {
    confirmTitle: '确认删除',
    // {name} 由模板以样式化插槽注入（<i18n-t>）
    confirm: '确认删除密钥 {name}？此操作不可撤销。',
    confirmBtn: '确认删除',
    deleting: '删除中…'
  },
  table: {
    nameKey: '名称 · 密钥',
    name: '名称',
    key: '密钥',
    group: '分组',
    status: '状态',
    usage: '用量',
    rate: '速率',
    actions: '操作',
    today: '今日',
    last30d: '30天',
    ratePerDay: '{n}/天',
    use: '使用'
  },
  copyToClipboard: '复制到剪贴板',
  copied: '已复制！',
  useKeyModal: {
    title: '使用 API 密钥',
    clientTabsAria: '客户端选择',
    shellTabsAria: '系统 / Shell 选择',
    description: '将以下环境变量添加到您的终端配置文件或直接在终端中运行。',
    copy: '复制',
    copied: '已复制',
    note: '这些环境变量将在当前终端会话中生效。如需永久配置，请将其添加到 ~/.bashrc、~/.zshrc 或相应的配置文件中。',
    noGroupTitle: '请先分配分组',
    noGroupDescription: '此 API 密钥尚未分配分组，请先在密钥列表中编辑密钥进行分配，然后才能查看使用配置。',
    openai: {
      description: '将以下配置文件添加到 Codex CLI 配置目录中。',
      configTomlHint: '请确保以下内容位于 config.toml 文件的开头部分',
      note: '请确保配置目录存在。macOS/Linux 用户可运行 mkdir -p ~/.codex 创建目录。',
      noteWindows: '按 Win+R，输入 %userprofile%\\.codex 打开配置目录。如目录不存在，请先手动创建。'
    },
    cliTabs: {
      claudeCode: 'Claude Code',
      geminiCli: 'Gemini CLI',
      codexCli: 'Codex CLI',
      codexCliWs: 'Codex CLI (WebSocket)',
      opencode: 'OpenCode'
    },
    antigravity: {
      description: '为 Antigravity 分组配置 API 访问。请根据您使用的客户端选择对应的配置方式。',
      claudeCode: 'Claude Code',
      geminiCli: 'Gemini CLI',
      claudeNote: '这些环境变量将在当前终端会话中生效。如需永久配置，请将其添加到 ~/.bashrc、~/.zshrc 或相应的配置文件中。',
      geminiNote: '这些环境变量将在当前终端会话中生效。如需永久配置，请将其添加到 ~/.bashrc、~/.zshrc 或相应的配置文件中。'
    },
    gemini: {
      description: '将以下环境变量添加到您的终端配置文件或直接在终端中运行，以配置 Gemini CLI 访问。',
      modelComment: '如果你有 Gemini 3 权限可以填：gemini-3-pro-preview',
      note: '这些环境变量将在当前终端会话中生效。如需永久配置，请将其添加到 ~/.bashrc、~/.zshrc 或相应的配置文件中。'
    },
    opencode: {
      title: 'OpenCode 配置示例',
      subtitle: 'opencode.json',
      hint: '配置文件路径：~/.config/opencode/opencode.json（或 opencode.jsonc），不存在需手动创建。可使用默认 provider（openai/anthropic/google）或自定义 provider_id。API Key 支持直接配置或通过客户端 /connect 命令配置。示例仅供参考，模型与选项可按需调整。'
    }
  }
}
