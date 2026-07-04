<script setup lang="ts">
import { ref, computed, h, watch, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import Modal from '@/components/ui/Modal.vue'
import { useCopy } from '@/composables/useCopy'
import { buildKeyFiles } from './keySnippets'

interface Props {
  open: boolean
  apiKey: string
  baseUrl: string
  platform: string | null
  allowMessagesDispatch?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()

const { copiedKey: copiedIndex, copy } = useCopy(2000)
const activeTab = ref<string>('unix')
const activeClientTab = ref<string>('claude')

// 切换平台时重置 tab
const defaultClientTab = computed(() => {
  switch (props.platform) {
    case 'openai':
      return 'codex'
    case 'gemini':
      return 'gemini'
    case 'antigravity':
      return 'claude'
    default:
      return 'claude'
  }
})

watch(
  () => props.platform,
  () => {
    activeTab.value = 'unix'
    activeClientTab.value = defaultClientTab.value
  },
  { immediate: true }
)

watch(activeClientTab, () => {
  activeTab.value = 'unix'
})

// —— 图标组件 ——
const AppleIcon = {
  render() {
    return h('svg', { fill: 'currentColor', viewBox: '0 0 24 24', class: 'w-4 h-4' }, [
      h('path', {
        d: 'M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z'
      })
    ])
  }
}

const WindowsIcon = {
  render() {
    return h('svg', { fill: 'currentColor', viewBox: '0 0 24 24', class: 'w-4 h-4' }, [
      h('path', {
        d: 'M3 12V6.75l6-1.32v6.48L3 12zm17-9v8.75l-10 .15V5.21L20 3zM3 13l6 .09v6.81l-6-1.15V13zm7 .25l10 .15V21l-10-1.91v-5.84z'
      })
    ])
  }
}

const TerminalIcon = {
  render() {
    return h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', 'stroke-width': '1.5', class: 'w-4 h-4' }, [
      h('path', {
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        d: 'm6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 17.25V6.75A2.25 2.25 0 0 0 18.75 4.5H5.25A2.25 2.25 0 0 0 3 6.75v10.5A2.25 2.25 0 0 0 5.25 20.25Z'
      })
    ])
  }
}

const SparkleIcon = {
  render() {
    return h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', 'stroke-width': '1.5', class: 'w-4 h-4' }, [
      h('path', {
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        d: 'M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z'
      })
    ])
  }
}

interface TabConfig {
  id: string
  label: string
  icon: Component
}

const clientTabs = computed((): TabConfig[] => {
  if (!props.platform) return []
  switch (props.platform) {
    case 'openai': {
      const tabs: TabConfig[] = [
        { id: 'codex', label: t('keys.useKeyModal.cliTabs.codexCli'), icon: TerminalIcon },
        { id: 'codex-ws', label: t('keys.useKeyModal.cliTabs.codexCliWs'), icon: TerminalIcon }
      ]
      if (props.allowMessagesDispatch) {
        tabs.push({ id: 'claude', label: t('keys.useKeyModal.cliTabs.claudeCode'), icon: TerminalIcon })
      }
      tabs.push({ id: 'opencode', label: t('keys.useKeyModal.cliTabs.opencode'), icon: TerminalIcon })
      return tabs
    }
    case 'gemini':
      return [
        { id: 'gemini', label: t('keys.useKeyModal.cliTabs.geminiCli'), icon: SparkleIcon },
        { id: 'opencode', label: t('keys.useKeyModal.cliTabs.opencode'), icon: TerminalIcon }
      ]
    case 'antigravity':
      return [
        { id: 'claude', label: t('keys.useKeyModal.cliTabs.claudeCode'), icon: TerminalIcon },
        { id: 'gemini', label: t('keys.useKeyModal.cliTabs.geminiCli'), icon: SparkleIcon },
        { id: 'opencode', label: t('keys.useKeyModal.cliTabs.opencode'), icon: TerminalIcon }
      ]
    default:
      return [
        { id: 'claude', label: t('keys.useKeyModal.cliTabs.claudeCode'), icon: TerminalIcon },
        { id: 'opencode', label: t('keys.useKeyModal.cliTabs.opencode'), icon: TerminalIcon }
      ]
  }
})

const shellTabs: TabConfig[] = [
  { id: 'unix', label: 'macOS / Linux', icon: AppleIcon },
  { id: 'cmd', label: 'Windows CMD', icon: WindowsIcon },
  { id: 'powershell', label: 'PowerShell', icon: WindowsIcon }
]

const openaiTabs: TabConfig[] = [
  { id: 'unix', label: 'macOS / Linux', icon: AppleIcon },
  { id: 'windows', label: 'Windows', icon: WindowsIcon }
]

const showShellTabs = computed(() => activeClientTab.value !== 'opencode')

const currentTabs = computed(() => {
  if (!showShellTabs.value) return []
  if (activeClientTab.value === 'codex' || activeClientTab.value === 'codex-ws') {
    return openaiTabs
  }
  return shellTabs
})

const platformDescription = computed(() => {
  switch (props.platform) {
    case 'openai':
      if (activeClientTab.value === 'claude') {
        return t('keys.useKeyModal.description')
      }
      return t('keys.useKeyModal.openai.description')
    case 'gemini':
      return t('keys.useKeyModal.gemini.description')
    case 'antigravity':
      return t('keys.useKeyModal.antigravity.description')
    default:
      return t('keys.useKeyModal.description')
  }
})

const platformNote = computed(() => {
  switch (props.platform) {
    case 'openai':
      if (activeClientTab.value === 'claude') {
        return t('keys.useKeyModal.note')
      }
      return activeTab.value === 'windows'
        ? t('keys.useKeyModal.openai.noteWindows')
        : t('keys.useKeyModal.openai.note')
    case 'gemini':
      return t('keys.useKeyModal.gemini.note')
    case 'antigravity':
      return activeClientTab.value === 'claude'
        ? t('keys.useKeyModal.antigravity.claudeNote')
        : t('keys.useKeyModal.antigravity.geminiNote')
    default:
      return t('keys.useKeyModal.note')
  }
})

const showPlatformNote = computed(() => activeClientTab.value !== 'opencode')

// 配置文件内容生成全部收口在 keySnippets.ts（含 opencode 模型清单等高频变更数据）
const currentFiles = computed(() =>
  buildKeyFiles({
    platform: props.platform,
    clientTab: activeClientTab.value,
    shellTab: activeTab.value,
    baseUrl: props.baseUrl,
    apiKey: props.apiKey
  })
)

function copyContent(content: string, index: number) {
  copy(content, index)
}
</script>

<template>
  <Modal
    :open="open"
    :title="$t('keys.useKeyModal.title')"
    size="xl"
    @close="emit('close')"
  >
    <!-- 正文（可滚动；负边距让上下分隔线贯穿面板全宽） -->
    <div class="-mx-7 max-h-[62vh] space-y-4 overflow-y-auto border-y border-track px-7 py-5">
      <!-- 未分配分组提示 -->
      <div
        v-if="!platform"
        class="flex items-start gap-3 rounded-xl2 border border-[#F59E0B]/40 bg-[#F59E0B]/[0.07] p-4"
      >
        <svg
          class="mt-0.5 h-5 w-5 flex-shrink-0 text-[#F59E0B]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          stroke-width="1.5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
        <div>
          <p class="text-sm font-medium text-[#C77800]">
            {{ $t('keys.useKeyModal.noGroupTitle') }}
          </p>
          <p class="mt-1 text-sm text-[#C77800]/85">
            {{ $t('keys.useKeyModal.noGroupDescription') }}
          </p>
        </div>
      </div>

      <!-- 平台相关内容 -->
      <template v-else>
        <!-- 描述 -->
        <p class="text-sm text-text2">
          {{ platformDescription }}
        </p>

        <!-- 客户端 Tab -->
        <div
          v-if="clientTabs.length"
          class="border-b border-track"
        >
          <nav
            class="-mb-px flex space-x-6"
            :aria-label="t('keys.useKeyModal.clientTabsAria')"
          >
            <button
              v-for="tab in clientTabs"
              :key="tab.id"
              :class="[
                'whitespace-nowrap border-b-2 px-1 py-2.5 text-sm font-medium transition-colors',
                activeClientTab === tab.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text3 hover:border-border2 hover:text-text'
              ]"
              @click="activeClientTab = tab.id"
            >
              <span class="flex items-center gap-2">
                <component :is="tab.icon" />
                {{ tab.label }}
              </span>
            </button>
          </nav>
        </div>

        <!-- 系统 / Shell Tab -->
        <div
          v-if="showShellTabs"
          class="border-b border-track"
        >
          <nav
            class="-mb-px flex space-x-4"
            :aria-label="t('keys.useKeyModal.shellTabsAria')"
          >
            <button
              v-for="tab in currentTabs"
              :key="tab.id"
              :class="[
                'whitespace-nowrap border-b-2 px-1 py-2.5 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text3 hover:border-border2 hover:text-text'
              ]"
              @click="activeTab = tab.id"
            >
              <span class="flex items-center gap-2">
                <component :is="tab.icon" />
                {{ tab.label }}
              </span>
            </button>
          </nav>
        </div>

        <!-- 代码块（多文件堆叠） -->
        <div class="space-y-4">
          <div
            v-for="(file, index) in currentFiles"
            :key="index"
            class="relative"
          >
            <p
              v-if="file.hint"
              class="mb-1.5 flex items-center gap-1 text-xs text-[#C77800]"
            >
              <svg
                class="h-3.5 w-3.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                stroke-width="1.8"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
              {{ file.hint }}
            </p>
            <div class="overflow-hidden rounded-xl2 bg-gray-900">
              <!-- 代码头部 -->
              <div class="flex items-center justify-between border-b border-gray-700 bg-gray-800 px-4 py-2">
                <span class="font-mono text-xs text-gray-400">{{ file.path }}</span>
                <button
                  class="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors"
                  :class="
                    copiedIndex === index
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                  "
                  @click="copyContent(file.content, index)"
                >
                  <svg
                    v-if="copiedIndex === index"
                    class="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    stroke-width="2"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <svg
                    v-else
                    class="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
                    />
                  </svg>
                  {{ copiedIndex === index ? $t('keys.useKeyModal.copied') : $t('keys.useKeyModal.copy') }}
                </button>
              </div>
              <!-- 代码内容 -->
              <!-- eslint-disable vue/no-v-html -- highlighted 由 keySnippets.ts 拼装，动态值均经 escapeHtml 转义，无注入面 -->
              <pre class="overflow-x-auto p-4 font-mono text-sm text-gray-100"><code
                v-if="file.highlighted"
                v-html="file.highlighted"
              /><code
                v-else
                v-text="file.content"
              /></pre>
              <!-- eslint-enable vue/no-v-html -->
            </div>
          </div>
        </div>

        <!-- 使用提示 -->
        <div
          v-if="showPlatformNote"
          class="flex items-start gap-3 rounded-xl2 border border-accent/30 bg-accent/[0.08] p-3"
        >
          <svg
            class="mt-0.5 h-5 w-5 flex-shrink-0 text-accent"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            stroke-width="1.5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
            />
          </svg>
          <p class="text-sm text-text2">
            {{ platformNote }}
          </p>
        </div>
      </template>
    </div>

    <template #footer>
      <button
        class="rounded-full border border-border px-5 py-2 text-sm font-medium text-text2 transition-colors hover:border-border2 hover:text-text"
        @click="emit('close')"
      >
        {{ $t('common.close') }}
      </button>
    </template>
  </Modal>
</template>
