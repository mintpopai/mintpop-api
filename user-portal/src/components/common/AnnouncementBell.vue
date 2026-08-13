<script setup lang="ts">
/**
 * 顶栏公告铃铛：未读时带小圆点，点开列表弹窗，再点条目进详情弹窗（进详情即标已读）。
 * 数据全部来自 announcements store，本组件只管展示与交互。
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Modal from '@/components/ui/Modal.vue'
import { useAnnouncementStore } from '@/stores/announcements'
import { useToast } from '@/composables/useToast'
import { renderMarkdown } from '@/utils/markdown'
import { formatDateMinute } from '@/utils/format'
import type { UserAnnouncement } from '@/api/types'

const { t } = useI18n()
const toast = useToast()
const announcementStore = useAnnouncementStore()

const listOpen = ref(false)
const selected = ref<UserAnnouncement | null>(null)

const unreadCount = computed(() => announcementStore.unreadCount)
const detailHtml = computed(() => (selected.value ? renderMarkdown(selected.value.content) : ''))

// 未读时把数量并进无障碍名称，屏幕阅读器不依赖那个纯装饰的小圆点
const bellLabel = computed(() =>
  unreadCount.value > 0
    ? `${t('announcements.bellLabel')}（${t('announcements.unreadSummary', { count: unreadCount.value })}）`
    : t('announcements.bellLabel')
)

// 列表与详情不同时开：Modal 的 Tab 圈禁是「每个实例各自把焦点拽回自己面板」，
// 两层同时打开会互相抢焦点。故进详情先收起列表，退出详情再把列表放回来（保留下钻手感）。
function openDetail(item: UserAnnouncement) {
  listOpen.value = false
  selected.value = item
  if (!item.read_at) void announcementStore.markAsRead(item.id)
}

function closeDetail() {
  selected.value = null
  listOpen.value = true
}

async function markAllAsRead() {
  try {
    await announcementStore.markAllAsRead()
    toast.success(t('announcements.allMarkedAsRead'))
  } catch {
    toast.error(t('announcements.markAllReadFailed'))
  }
}
</script>

<template>
  <div>
    <!-- 铃铛按钮 -->
    <button
      type="button"
      class="relative flex h-9 w-9 items-center justify-center rounded-[10px] text-text2 transition-colors hover:bg-muted"
      :aria-label="bellLabel"
      @click="listOpen = true"
    >
      <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      <!-- 未读圆点：纯装饰，语义已并入 aria-label -->
      <span
        v-if="unreadCount > 0"
        class="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent ring-2 ring-bar"
        aria-hidden="true"
      />
    </button>

    <!-- 列表弹窗 -->
    <Modal
      :open="listOpen"
      :title="$t('announcements.title')"
      size="lg"
      @close="listOpen = false"
    >
      <p
        v-if="unreadCount > 0"
        class="-mt-3 mb-3 text-xs text-subtle"
      >
        {{ $t('announcements.unreadSummary', { count: unreadCount }) }}
      </p>

      <div class="max-h-[56vh] overflow-y-auto">
        <ul
          v-if="announcementStore.announcements.length > 0"
          class="flex flex-col gap-1.5"
        >
          <li
            v-for="item in announcementStore.announcements"
            :key="item.id"
          >
            <button
              type="button"
              class="flex w-full items-center gap-3 rounded-xl2 border border-transparent px-3.5 py-3 text-left transition-colors hover:bg-muted"
              :class="item.read_at ? '' : 'border-l-[3px] border-l-accent bg-muted/60'"
              @click="openDetail(item)"
            >
              <span class="min-w-0 flex-1">
                <span
                  class="block truncate text-sm text-text"
                  :class="item.read_at ? 'font-medium' : 'font-semibold'"
                >{{ item.title }}</span>
                <span class="mt-1 flex items-center gap-2 text-xs text-subtle">
                  <span>{{ formatDateMinute(item.created_at) }}</span>
                  <span
                    v-if="!item.read_at"
                    class="rounded-full bg-accent/12 px-1.5 py-0.5 font-medium text-accent"
                  >{{ $t('announcements.unread') }}</span>
                </span>
              </span>
              <span
                class="shrink-0 text-faint"
                aria-hidden="true"
              >→</span>
            </button>
          </li>
        </ul>

        <!-- 空态 -->
        <div
          v-else
          class="flex flex-col items-center gap-1.5 py-12"
        >
          <p class="text-sm font-medium text-text">
            {{ $t('announcements.empty') }}
          </p>
          <p class="text-xs text-subtle">
            {{ $t('announcements.emptyHint') }}
          </p>
        </div>
      </div>

      <template #footer>
        <button
          v-if="unreadCount > 0"
          class="rounded-full border border-border px-5 py-2 text-sm font-medium text-text2 transition-colors hover:border-border2 hover:text-text disabled:opacity-50"
          :disabled="announcementStore.loading"
          @click="markAllAsRead"
        >
          {{ $t('announcements.markAllRead') }}
        </button>
        <button
          class="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(20,194,138,.3)] transition-opacity hover:opacity-90"
          @click="listOpen = false"
        >
          {{ $t('common.close') }}
        </button>
      </template>
    </Modal>

    <!-- 详情弹窗 -->
    <Modal
      :open="!!selected"
      :title="selected?.title"
      size="lg"
      @close="closeDetail"
    >
      <div
        v-if="selected"
        class="flex flex-col gap-4"
      >
        <div class="-mt-3 text-xs text-subtle">
          {{ formatDateMinute(selected.created_at) }}
        </div>
        <!-- v-html 注入的是管理员撰写的公告 markdown 渲染结果（与文档中心同一信任级别），故禁用该规则 -->
        <!-- eslint-disable vue/no-v-html -->
        <div
          class="prose prose-neutral max-h-[52vh] max-w-none overflow-y-auto dark:prose-invert prose-a:text-accent prose-a:no-underline prose-a:hover:underline"
          v-html="detailHtml"
        />
        <!-- eslint-enable vue/no-v-html -->
      </div>

      <template #footer>
        <button
          class="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(20,194,138,.3)] transition-opacity hover:opacity-90"
          @click="closeDetail"
        >
          {{ $t('common.close') }}
        </button>
      </template>
    </Modal>
  </div>
</template>
