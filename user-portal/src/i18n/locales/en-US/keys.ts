export default {
  title: 'API Keys',
  subtitle: 'Manage your API keys and access tokens.',
  createKey: 'Create Key',
  guide: {
    // 固定链接 /keys?guide=create 进入时的引导气泡文案
    createHint: 'Click here to create your API key'
  },
  creating: 'Creating…',
  createFailed: 'Failed to create, please try again',
  searchPlaceholder: 'Search by name or key…',
  empty: 'No API keys yet',
  status: {
    active: 'Active',
    inactive: 'Disabled'
  },
  enable: 'Enable',
  disable: 'Disable',
  stats: {
    totalLabel: 'Total Keys',
    statusHint: 'This page: {active} active · {inactive} disabled',
    cost30dLabel: 'Spend (Last 30 Days)',
    costHint: 'Keys on this page combined'
  },
  filter: {
    allGroups: 'All Groups',
    allStatus: 'All Statuses'
  },
  form: {
    name: 'Name',
    namePlaceholder: 'e.g. Production',
    editNamePlaceholder: 'Key name',
    group: 'Group',
    selectGroup: 'Select a group',
    expiryLabel: 'Expiry (days, leave empty for never)',
    expiryPlaceholder: 'e.g. 30',
    quotaLabel: 'Quota (USD, leave empty for unlimited)',
    quotaPlaceholder: 'e.g. 10.00'
  },
  created: {
    title: 'Key Created',
    keyLabel: 'Your API Key'
  },
  edit: {
    title: 'Edit Key',
    enableLabel: 'Enable key',
    saving: 'Saving…'
  },
  delete: {
    confirmTitle: 'Confirm Deletion',
    // {name} 由模板以样式化插槽注入（<i18n-t>）
    confirm: 'Delete API key {name}? This action cannot be undone.',
    confirmBtn: 'Confirm Delete',
    deleting: 'Deleting…'
  },
  table: {
    nameKey: 'Name · Key',
    name: 'Name',
    key: 'Key',
    group: 'Group',
    status: 'Status',
    usage: 'Usage',
    rate: 'Rate',
    actions: 'Actions',
    today: 'Today',
    last30d: '30d',
    ratePerDay: '{n}/day',
    use: 'Use'
  },
  copyToClipboard: 'Copy to clipboard',
  copied: 'Copied!',
  useKeyModal: {
    title: 'Use API Key',
    clientTabsAria: 'Client',
    shellTabsAria: 'OS / Shell',
    description:
      'Add the following environment variables to your terminal profile or run directly in terminal to configure API access.',
    copy: 'Copy',
    copied: 'Copied',
    note: 'These environment variables will be active in the current terminal session. For permanent configuration, add them to ~/.bashrc, ~/.zshrc, or the appropriate configuration file.',
    noGroupTitle: 'Please assign a group first',
    noGroupDescription:
      'This API key has not been assigned to a group. Please edit the key in the list to assign one before viewing the configuration.',
    openai: {
      description: 'Add the following configuration files to your Codex CLI config directory.',
      configTomlHint: 'Make sure the following content is at the beginning of the config.toml file',
      note: 'Make sure the config directory exists. macOS/Linux users can run mkdir -p ~/.codex to create it.',
      noteWindows:
        'Press Win+R and enter %userprofile%\\.codex to open the config directory. Create it manually if it does not exist.'
    },
    cliTabs: {
      claudeCode: 'Claude Code',
      geminiCli: 'Gemini CLI',
      codexCli: 'Codex CLI',
      codexCliWs: 'Codex CLI (WebSocket)',
      opencode: 'OpenCode'
    },
    antigravity: {
      description: 'Configure API access for Antigravity group. Select the configuration method based on your client.',
      claudeCode: 'Claude Code',
      geminiCli: 'Gemini CLI',
      claudeNote:
        'These environment variables will be active in the current terminal session. For permanent configuration, add them to ~/.bashrc, ~/.zshrc, or the appropriate configuration file.',
      geminiNote:
        'These environment variables will be active in the current terminal session. For permanent configuration, add them to ~/.bashrc, ~/.zshrc, or the appropriate configuration file.'
    },
    gemini: {
      description:
        'Add the following environment variables to your terminal profile or run directly in terminal to configure Gemini CLI access.',
      modelComment: 'If you have Gemini 3 access, you can use: gemini-3-pro-preview',
      note: 'These environment variables will be active in the current terminal session. For permanent configuration, add them to ~/.bashrc, ~/.zshrc, or the appropriate configuration file.'
    },
    opencode: {
      title: 'OpenCode Example',
      subtitle: 'opencode.json',
      hint: 'Config path: ~/.config/opencode/opencode.json (or opencode.jsonc), create if not exists. Use default providers (openai/anthropic/google) or custom provider_id. API Key can be configured directly or via /connect command. This is an example, adjust models and options as needed.'
    }
  }
}
