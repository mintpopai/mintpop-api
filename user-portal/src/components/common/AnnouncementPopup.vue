<script setup lang="ts">
/**
 * 强提醒公告弹窗（notify_mode='popup'）：登录后自动弹出，必须点「我知道了」才关闭并标已读。
 * 故用 Modal 的 persistent —— Esc 与点遮罩都不生效，避免重要通知被随手点掉。
 */
import { computed } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import { useAnnouncementStore } from '@/stores/announcements'
import { renderMarkdown } from '@/utils/markdown'
import { formatDateMinute } from '@/utils/format'

const announcementStore = useAnnouncementStore()

const current = computed(() => announcementStore.currentPopup)
const html = computed(() => (current.value ? renderMarkdown(current.value.content) : ''))
</script>

<template>
  <Modal
    :open="!!current"
    :title="current?.title"
    size="lg"
    persistent
  >
    <div
      v-if="current"
      class="flex flex-col gap-4"
    >
      <div class="text-xs text-subtle">
        {{ formatDateMinute(current.created_at) }}
      </div>
      <!-- v-html 注入的是管理员撰写的公告 markdown 渲染结果（与文档中心同一信任级别），故禁用该规则 -->
      <!-- eslint-disable vue/no-v-html -->
      <div
        class="prose prose-neutral max-h-[50vh] max-w-none overflow-y-auto dark:prose-invert prose-a:text-accent prose-a:no-underline prose-a:hover:underline"
        v-html="html"
      />
      <!-- eslint-enable vue/no-v-html -->
    </div>

    <template #footer>
      <button
        data-testid="announcement-popup-dismiss"
        class="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(20,194,138,.3)] transition-opacity hover:opacity-90"
        @click="announcementStore.dismissPopup()"
      >
        {{ $t('announcements.gotIt') }}
      </button>
    </template>
  </Modal>
</template>
