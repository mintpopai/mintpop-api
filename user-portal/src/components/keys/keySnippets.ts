/**
 * 「使用密钥」弹窗的配置片段生成（从 UseKeyModal.vue 拆出的纯逻辑层）：
 * - 各平台 × 客户端 × Shell 的配置文件内容生成函数
 * - opencode 的模型清单数据（上游模型更代频繁，改这里即可，不动弹窗组件）
 * 文案经 i18n.global 取值（与 utils/format.ts 同模式），本模块不依赖组件上下文。
 */
import i18n from '@/i18n'

const t = (key: string) => i18n.global.t(key)

export interface FileConfig {
  path: string
  content: string
  hint?: string
  highlighted?: string
}

// opencode.json 里单个 provider 条目的形状：options 必有，npm/name/models 按平台按需追加
interface OpenCodeProvider {
  options: { baseURL: string; apiKey: string }
  npm?: string
  name?: string
  models?: Record<string, unknown>
}

// ==================== opencode 模型清单（高频变更数据，集中维护） ====================

const OPENAI_MODELS = {
  'gpt-5.2': { name: 'GPT-5.2', limit: { context: 400000, output: 128000 }, options: { store: false }, variants: { low: {}, medium: {}, high: {}, xhigh: {} } },
  'gpt-5.5': { name: 'GPT-5.5', limit: { context: 1050000, output: 128000 }, options: { store: false }, variants: { low: {}, medium: {}, high: {}, xhigh: {} } },
  'gpt-5.4': { name: 'GPT-5.4', limit: { context: 1050000, output: 128000 }, options: { store: false }, variants: { low: {}, medium: {}, high: {}, xhigh: {} } },
  'gpt-5.4-mini': { name: 'GPT-5.4 Mini', limit: { context: 400000, output: 128000 }, options: { store: false }, variants: { low: {}, medium: {}, high: {}, xhigh: {} } },
  'gpt-5.3-codex-spark': { name: 'GPT-5.3 Codex Spark', limit: { context: 128000, output: 32000 }, options: { store: false }, variants: { low: {}, medium: {}, high: {}, xhigh: {} } },
  'gpt-5.3-codex': { name: 'GPT-5.3 Codex', limit: { context: 400000, output: 128000 }, options: { store: false }, variants: { low: {}, medium: {}, high: {}, xhigh: {} } },
  'codex-mini-latest': { name: 'Codex Mini', limit: { context: 200000, output: 100000 }, options: { store: false }, variants: { low: {}, medium: {}, high: {} } }
}

const GEMINI_MODELS = {
  'gemini-2.0-flash': { name: 'Gemini 2.0 Flash', limit: { context: 1048576, output: 65536 }, modalities: { input: ['text', 'image', 'pdf'], output: ['text'] } },
  'gemini-2.5-flash': { name: 'Gemini 2.5 Flash', limit: { context: 1048576, output: 65536 }, modalities: { input: ['text', 'image', 'pdf'], output: ['text'] } },
  'gemini-2.5-pro': { name: 'Gemini 2.5 Pro', limit: { context: 2097152, output: 65536 }, modalities: { input: ['text', 'image', 'pdf'], output: ['text'] }, options: { thinking: { budgetTokens: 24576, type: 'enabled' } } },
  'gemini-3.5-flash': { name: 'Gemini 3.5 Flash', limit: { context: 1048576, output: 65536 }, modalities: { input: ['text', 'image', 'pdf'], output: ['text'] } },
  'gemini-3-flash-preview': { name: 'Gemini 3 Flash Preview', limit: { context: 1048576, output: 65536 }, modalities: { input: ['text', 'image', 'pdf'], output: ['text'] } },
  'gemini-3-pro-preview': { name: 'Gemini 3 Pro Preview', limit: { context: 1048576, output: 65536 }, modalities: { input: ['text', 'image', 'pdf'], output: ['text'] }, options: { thinking: { budgetTokens: 24576, type: 'enabled' } } },
  'gemini-3.1-pro-preview': { name: 'Gemini 3.1 Pro Preview', limit: { context: 1048576, output: 65536 }, modalities: { input: ['text', 'image', 'pdf'], output: ['text'] }, options: { thinking: { budgetTokens: 24576, type: 'enabled' } } }
}

const ANTIGRAVITY_GEMINI_MODELS = {
  // 普通 flash 关闭 thinking（要 thinking 用下方 -thinking 变体），关闭时不带 budgetTokens
  'gemini-2.5-flash': { name: 'Gemini 2.5 Flash', limit: { context: 1048576, output: 65536 }, modalities: { input: ['text', 'image', 'pdf'], output: ['text'] }, options: { thinking: { type: 'disabled' } } },
  'gemini-2.5-flash-lite': { name: 'Gemini 2.5 Flash Lite', limit: { context: 1048576, output: 65536 }, modalities: { input: ['text', 'image', 'pdf'], output: ['text'] }, options: { thinking: { budgetTokens: 24576, type: 'enabled' } } },
  'gemini-2.5-flash-thinking': { name: 'Gemini 2.5 Flash (Thinking)', limit: { context: 1048576, output: 65536 }, modalities: { input: ['text', 'image', 'pdf'], output: ['text'] }, options: { thinking: { budgetTokens: 24576, type: 'enabled' } } },
  'gemini-3-flash': { name: 'Gemini 3 Flash', limit: { context: 1048576, output: 65536 }, modalities: { input: ['text', 'image', 'pdf'], output: ['text'] }, options: { thinking: { budgetTokens: 24576, type: 'enabled' } } },
  'gemini-3.1-pro-low': { name: 'Gemini 3.1 Pro Low', limit: { context: 1048576, output: 65536 }, modalities: { input: ['text', 'image', 'pdf'], output: ['text'] }, options: { thinking: { budgetTokens: 24576, type: 'enabled' } } },
  'gemini-3.1-pro-high': { name: 'Gemini 3.1 Pro High', limit: { context: 1048576, output: 65536 }, modalities: { input: ['text', 'image', 'pdf'], output: ['text'] }, options: { thinking: { budgetTokens: 24576, type: 'enabled' } } },
  'gemini-2.5-flash-image': { name: 'Gemini 2.5 Flash Image', limit: { context: 1048576, output: 65536 }, modalities: { input: ['text', 'image'], output: ['image'] }, options: { thinking: { budgetTokens: 24576, type: 'enabled' } } },
  'gemini-3.1-flash-image': { name: 'Gemini 3.1 Flash Image', limit: { context: 1048576, output: 65536 }, modalities: { input: ['text', 'image'], output: ['image'] }, options: { thinking: { budgetTokens: 24576, type: 'enabled' } } }
}

const CLAUDE_MODELS = {
  'claude-fable-5': { name: 'Claude Fable 5', limit: { context: 1048576, output: 128000 }, modalities: { input: ['text', 'image', 'pdf'], output: ['text'] }, options: { thinking: { type: 'adaptive' } } },
  'claude-opus-4-6-thinking': { name: 'Claude 4.6 Opus (Thinking)', limit: { context: 200000, output: 128000 }, modalities: { input: ['text', 'image', 'pdf'], output: ['text'] }, options: { thinking: { budgetTokens: 24576, type: 'enabled' } } },
  'claude-sonnet-4-6': { name: 'Claude 4.6 Sonnet', limit: { context: 200000, output: 64000 }, modalities: { input: ['text', 'image', 'pdf'], output: ['text'] }, options: { thinking: { budgetTokens: 24576, type: 'enabled' } } }
}

// ==================== 语法高亮小工具（仅 Gemini CLI 片段使用） ====================

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const wrapToken = (className: string, value: string) => `<span class="${className}">${escapeHtml(value)}</span>`

const keyword = (value: string) => wrapToken('text-emerald-300', value)
const variable = (value: string) => wrapToken('text-sky-200', value)
const operator = (value: string) => wrapToken('text-slate-400', value)
const string = (value: string) => wrapToken('text-amber-200', value)
const comment = (value: string) => wrapToken('text-slate-500', value)

// content（复制用纯文本）与 highlighted（展示用高亮 HTML）曾各自手写，改一漏一会漂移
// （例如曾出现 cmd 分支的注释行只加进了 highlighted、content 里漏掉）。现在 highlighted
// 是唯一手写源，content 一律由本函数「剥 span 标签 + 反转义 HTML 实体」派生，两者天然一致。
// 与 escapeHtml 的转义顺序（& < > " '）互为逆操作：必须最后才还原 &amp;，否则会把
// 原本合法的 "&amp;lt;" 误还原成 "<"（两次反转义）。
export function stripHighlightMarkup(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&amp;/g, '&')
}

// ==================== 各客户端配置生成 ====================

function generateAnthropicFiles(shell: string, baseUrl: string, apiKey: string): FileConfig[] {
  let path: string
  let content: string

  switch (shell) {
    case 'unix':
      path = 'Terminal'
      content = `export ANTHROPIC_BASE_URL="${baseUrl}"
export ANTHROPIC_AUTH_TOKEN="${apiKey}"
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
export CLAUDE_CODE_ATTRIBUTION_HEADER=0`
      break
    case 'cmd':
      path = 'Command Prompt'
      content = `set ANTHROPIC_BASE_URL=${baseUrl}
set ANTHROPIC_AUTH_TOKEN=${apiKey}
set CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
set CLAUDE_CODE_ATTRIBUTION_HEADER=0`
      break
    case 'powershell':
      path = 'PowerShell'
      content = `$env:ANTHROPIC_BASE_URL="${baseUrl}"
$env:ANTHROPIC_AUTH_TOKEN="${apiKey}"
$env:CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
$env:CLAUDE_CODE_ATTRIBUTION_HEADER=0`
      break
    default:
      path = 'Terminal'
      content = ''
  }

  const vscodeSettingsPath = shell === 'unix' ? '~/.claude/settings.json' : '%userprofile%\\.claude\\settings.json'

  const vscodeContent = `{
  "env": {
    "ANTHROPIC_BASE_URL": "${baseUrl}",
    "ANTHROPIC_AUTH_TOKEN": "${apiKey}",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
    "CLAUDE_CODE_ATTRIBUTION_HEADER": "0"
  }
}`

  return [
    { path, content },
    { path: vscodeSettingsPath, content: vscodeContent, hint: 'VSCode Claude Code' }
  ]
}

function generateGeminiCliContent(shell: string, baseUrl: string, apiKey: string): FileConfig {
  const model = 'gemini-2.0-flash'
  const modelComment = t('keys.useKeyModal.gemini.modelComment')
  let path: string
  let highlighted: string

  switch (shell) {
    case 'unix':
      path = 'Terminal'
      highlighted = `${keyword('export')} ${variable('GOOGLE_GEMINI_BASE_URL')}${operator('=')}${string(`"${baseUrl}"`)}
${keyword('export')} ${variable('GEMINI_API_KEY')}${operator('=')}${string(`"${apiKey}"`)}
${keyword('export')} ${variable('GEMINI_MODEL')}${operator('=')}${string(`"${model}"`)}  ${comment(`# ${modelComment}`)}`
      break
    case 'cmd':
      path = 'Command Prompt'
      highlighted = `${keyword('set')} ${variable('GOOGLE_GEMINI_BASE_URL')}${operator('=')}${string(baseUrl)}
${keyword('set')} ${variable('GEMINI_API_KEY')}${operator('=')}${string(apiKey)}
${keyword('set')} ${variable('GEMINI_MODEL')}${operator('=')}${string(model)}
${comment(`REM ${modelComment}`)}`
      break
    case 'powershell':
      path = 'PowerShell'
      highlighted = `${keyword('$env:')}${variable('GOOGLE_GEMINI_BASE_URL')}${operator('=')}${string(`"${baseUrl}"`)}
${keyword('$env:')}${variable('GEMINI_API_KEY')}${operator('=')}${string(`"${apiKey}"`)}
${keyword('$env:')}${variable('GEMINI_MODEL')}${operator('=')}${string(`"${model}"`)}  ${comment(`# ${modelComment}`)}`
      break
    default:
      path = 'Terminal'
      highlighted = ''
  }

  return { path, content: stripHighlightMarkup(highlighted), highlighted }
}

function generateCodexFiles(shell: string, baseUrl: string, apiKey: string, websocket: boolean): FileConfig[] {
  const isWindows = shell === 'windows'
  const configDir = isWindows ? '%userprofile%\\.codex' : '~/.codex'

  const providerExtras = websocket ? '\nsupports_websockets = true' : ''
  const featureExtras = websocket ? 'responses_websockets_v2 = true\n' : ''
  const configContent = `model_provider = "OpenAI"
model = "gpt-5.5"
review_model = "gpt-5.5"
model_reasoning_effort = "xhigh"
disable_response_storage = true
network_access = "enabled"
windows_wsl_setup_acknowledged = true

[model_providers.OpenAI]
name = "OpenAI"
base_url = "${baseUrl}"
wire_api = "responses"${providerExtras}
requires_openai_auth = true

[features]
${featureExtras}goals = true`

  const authContent = `{
  "OPENAI_API_KEY": "${apiKey}"
}`

  return [
    { path: `${configDir}/config.toml`, content: configContent, hint: t('keys.useKeyModal.openai.configTomlHint') },
    { path: `${configDir}/auth.json`, content: authContent }
  ]
}

function generateOpenCodeConfig(platform: string, baseUrl: string, apiKey: string, pathLabel?: string): FileConfig {
  const provider: Record<string, OpenCodeProvider> = {
    [platform]: {
      options: {
        baseURL: baseUrl,
        apiKey
      }
    }
  }

  if (platform === 'gemini') {
    provider[platform].npm = '@ai-sdk/google'
    provider[platform].models = GEMINI_MODELS
  } else if (platform === 'anthropic') {
    provider[platform].npm = '@ai-sdk/anthropic'
  } else if (platform === 'antigravity-claude') {
    provider[platform].npm = '@ai-sdk/anthropic'
    provider[platform].name = 'Antigravity (Claude)'
    provider[platform].models = CLAUDE_MODELS
  } else if (platform === 'antigravity-gemini') {
    provider[platform].npm = '@ai-sdk/google'
    provider[platform].name = 'Antigravity (Gemini)'
    provider[platform].models = ANTIGRAVITY_GEMINI_MODELS
  } else if (platform === 'openai') {
    provider[platform].models = OPENAI_MODELS
  }

  const agent =
    platform === 'openai'
      ? {
          build: { options: { store: false } },
          plan: { options: { store: false } }
        }
      : undefined

  const content = JSON.stringify(
    {
      provider,
      ...(agent ? { agent } : {}),
      $schema: 'https://opencode.ai/config.json'
    },
    null,
    2
  )

  return {
    path: pathLabel ?? 'opencode.json',
    content,
    hint: t('keys.useKeyModal.opencode.hint')
  }
}

// ==================== 总入口：平台 × 客户端 tab × Shell tab → 配置文件列表 ====================

export function buildKeyFiles(args: {
  platform: string | null
  clientTab: string
  shellTab: string
  baseUrl: string
  apiKey: string
}): FileConfig[] {
  const { platform, clientTab, shellTab, apiKey } = args
  const baseUrl = args.baseUrl || window.location.origin
  // URL 契约：管理员配置的 api_base_url 可能带也可能不带 /v1，所有片段一律先归一化到
  // baseRoot（不带 /v1 的根），再按各客户端的预期自行拼后缀，不依赖配置形态：
  // - Claude Code：ANTHROPIC_BASE_URL 给根（它自己拼 /v1/messages）
  // - Codex：base_url 按 OpenAI 惯例带 /v1（wire_api 再拼 /responses）
  // - Gemini CLI：GOOGLE_GEMINI_BASE_URL 给根（SDK 自己拼 /v1beta/...）
  // - opencode：@ai-sdk/* 的 baseURL 需要完整前缀（/v1 或 /v1beta）
  // 后端在根路径与 /v1 下都注册了兼容别名（backend/internal/server/routes/gateway.go），
  // 但生成片段不赌这个兜底，始终产出各客户端的标准形态。
  const baseRoot = baseUrl.replace(/\/v1\/?$/, '').replace(/\/+$/, '')
  const ensureV1 = (value: string) => {
    const trimmed = value.replace(/\/+$/, '')
    return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`
  }
  const ensureV1beta = (value: string) => {
    const trimmed = value.replace(/\/+$/, '')
    return trimmed.endsWith('/v1beta') ? trimmed : `${trimmed}/v1beta`
  }
  const apiBase = ensureV1(baseRoot)
  const antigravityBase = ensureV1(`${baseRoot}/antigravity`)
  const antigravityGeminiBase = ensureV1beta(`${baseRoot}/antigravity`)
  const geminiBase = ensureV1beta(baseRoot)

  if (clientTab === 'opencode') {
    switch (platform) {
      case 'anthropic':
        return [generateOpenCodeConfig('anthropic', apiBase, apiKey)]
      case 'openai':
        return [generateOpenCodeConfig('openai', apiBase, apiKey)]
      case 'gemini':
        return [generateOpenCodeConfig('gemini', geminiBase, apiKey)]
      case 'antigravity':
        return [
          generateOpenCodeConfig('antigravity-claude', antigravityBase, apiKey, 'opencode.json (Claude)'),
          generateOpenCodeConfig('antigravity-gemini', antigravityGeminiBase, apiKey, 'opencode.json (Gemini)')
        ]
      default:
        return [generateOpenCodeConfig('openai', apiBase, apiKey)]
    }
  }

  switch (platform) {
    case 'openai':
      if (clientTab === 'claude') {
        return generateAnthropicFiles(shellTab, baseRoot, apiKey)
      }
      return generateCodexFiles(shellTab, apiBase, apiKey, clientTab === 'codex-ws')
    case 'gemini':
      return [generateGeminiCliContent(shellTab, baseRoot, apiKey)]
    case 'antigravity':
      if (clientTab === 'gemini') {
        return [generateGeminiCliContent(shellTab, `${baseRoot}/antigravity`, apiKey)]
      }
      return generateAnthropicFiles(shellTab, `${baseRoot}/antigravity`, apiKey)
    default:
      return generateAnthropicFiles(shellTab, baseRoot, apiKey)
  }
}
