<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import PortalLayout from '@/layouts/PortalLayout.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatCard from '@/components/ui/StatCard.vue'
import { getAffiliateDetail, transferAffiliateQuota } from '@/api/user'
import type { UserAffiliateDetail } from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { useToast } from '@/composables/useToast'
import { useCopy } from '@/composables/useCopy'
import { formatBalance, formatDateTime, formatNumber, formatRebateRate } from '@/utils/format'
import { errMessage } from '@/utils/error'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const toast = useToast()
// 复制 + 按钮「已复制」反馈（copiedKey 取 'code' | 'link'）
const { copiedKey, copy } = useCopy()

const loading = ref(true)
const error = ref<string | null>(null)
const transferring = ref(false)
const detail = ref<UserAffiliateDetail | null>(null)

const inviteLink = computed(() => {
  if (!detail.value) return ''
  return `${window.location.origin}/register?aff=${encodeURIComponent(detail.value.aff_code)}`
})

const rebateRateText = computed(
  () => `${formatRebateRate(detail.value?.effective_rebate_rate_percent)}%`
)

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    detail.value = await getAffiliateDetail()
  } catch (e) {
    error.value = errMessage(e, t('invite.loadFailed'))
  } finally {
    loading.value = false
  }
}

async function transfer(): Promise<void> {
  if (!detail.value || detail.value.aff_quota <= 0 || transferring.value) return
  transferring.value = true
  try {
    const resp = await transferAffiliateQuota()
    toast.success(t('invite.transfer.success', { amount: `$${formatBalance(resp.transferred_quota)}` }))
    // 转入后余额已变：刷新返利详情与用户余额（fetchUser 失败在 store 内吞掉）
    await Promise.all([load(), authStore.fetchUser()])
  } catch (e) {
    toast.error(errMessage(e, t('invite.transfer.failed')))
  } finally {
    transferring.value = false
  }
}

onMounted(async () => {
  // 站点关闭邀请返利时本页无意义，回仪表盘（与主前端隐藏入口同语义）
  await settingsStore.ensureLoaded()
  if (settingsStore.settings && !settingsStore.settings.affiliate_enabled) {
    router.replace('/dashboard')
    return
  }
  await load()
})
</script>

<template>
  <PortalLayout>
    <!-- 页头 -->
    <PageHeader
      :title="$t('invite.pageTitle')"
      :subtitle="$t('invite.pageSubtitle')"
    >
      <template #actions>
        <button
          class="rounded-full bg-card px-4 py-[11px] text-[13px] font-medium text-text2 shadow-pill transition-colors hover:text-text"
          :disabled="loading"
          @click="load"
        >
          ↻ {{ $t('common.refresh') }}
        </button>
      </template>
    </PageHeader>

    <!-- 加载态（首次） -->
    <div
      v-if="loading && !detail"
      class="flex items-center justify-center py-24"
    >
      <LoadingSpinner :size="32" />
    </div>

    <!-- 错误态（首次） -->
    <div
      v-else-if="error && !detail"
      class="rounded-xl3 border border-dashed border-border2 bg-card px-7 py-16 text-center"
    >
      <p class="text-sm text-subtle">
        {{ error }}
      </p>
      <button
        class="mt-4 rounded-full border border-border px-5 py-2 text-sm font-semibold text-text"
        @click="load"
      >
        {{ $t('common.retry') }}
      </button>
    </div>

    <template v-else-if="detail">
      <!-- 统计行 -->
      <div class="mb-[22px] grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          :label="$t('invite.stats.rebateRate')"
          :value="rebateRateText"
          :hint="$t('invite.stats.rebateRateHint')"
          accent
        />
        <StatCard
          :label="$t('invite.stats.invitedUsers')"
          :value="formatNumber(detail.aff_count)"
          :hint="$t('invite.stats.invitedUsersHint')"
        />
        <StatCard
          :label="$t('invite.stats.availableQuota')"
          :value="`$${formatBalance(detail.aff_quota)}`"
          :hint="$t('invite.stats.availableQuotaHint')"
          accent
        />
        <StatCard
          :label="$t('invite.stats.totalQuota')"
          :value="`$${formatBalance(detail.aff_history_quota)}`"
          :hint="detail.aff_frozen_quota > 0
            ? $t('invite.stats.frozenQuota', { amount: `$${formatBalance(detail.aff_frozen_quota)}` })
            : undefined"
        />
      </div>

      <!-- 分享邀请：邀请码 + 邀请链接 + 使用说明 -->
      <div class="mb-[22px] rounded-xl3 bg-card p-7 shadow-soft">
        <h2 class="text-base font-semibold text-text">
          {{ $t('invite.share.title') }}
        </h2>

        <div class="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <div class="mb-[9px] text-xs font-semibold tracking-wide text-text2">
              {{ $t('invite.share.yourCode') }}
            </div>
            <div class="flex items-center gap-2 rounded-xl2 border-[1.5px] border-border2 bg-muted py-2 pl-4 pr-2">
              <code class="num min-w-0 flex-1 truncate text-sm font-semibold text-text">{{ detail.aff_code }}</code>
              <button
                class="flex-none rounded-full bg-card px-4 py-[7px] text-[13px] font-medium text-text2 shadow-pill transition-colors hover:text-text"
                @click="copy(detail.aff_code, 'code')"
              >
                {{ copiedKey === 'code' ? $t('invite.share.copied') : $t('invite.share.copy') }}
              </button>
            </div>
          </div>

          <div>
            <div class="mb-[9px] text-xs font-semibold tracking-wide text-text2">
              {{ $t('invite.share.inviteLink') }}
            </div>
            <div class="flex items-center gap-2 rounded-xl2 border-[1.5px] border-border2 bg-muted py-2 pl-4 pr-2">
              <code class="num min-w-0 flex-1 truncate text-sm text-text2">{{ inviteLink }}</code>
              <button
                class="flex-none rounded-full bg-card px-4 py-[7px] text-[13px] font-medium text-text2 shadow-pill transition-colors hover:text-text"
                @click="copy(inviteLink, 'link')"
              >
                {{ copiedKey === 'link' ? $t('invite.share.copied') : $t('invite.share.copy') }}
              </button>
            </div>
          </div>
        </div>

        <!-- 使用说明 -->
        <div class="mt-5 rounded-xl2 bg-accent/8 p-5">
          <div class="text-sm font-semibold text-pos">
            {{ $t('invite.tips.title') }}
          </div>
          <ol class="mt-2 list-inside list-decimal space-y-1 text-[13px] leading-relaxed text-text2">
            <li>{{ $t('invite.tips.line1') }}</li>
            <li>{{ $t('invite.tips.line2', { rate: rebateRateText }) }}</li>
            <li>{{ $t('invite.tips.line3') }}</li>
            <li v-if="detail.aff_frozen_quota > 0">
              {{ $t('invite.tips.line4') }}
            </li>
          </ol>
        </div>
      </div>

      <!-- 返利额度转余额 -->
      <div class="mb-[22px] rounded-xl3 bg-card p-7 shadow-soft">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="text-base font-semibold text-text">
              {{ $t('invite.transfer.title') }}
            </h2>
            <p class="mt-1 text-sm text-subtle">
              {{ $t('invite.transfer.description') }}
            </p>
          </div>
          <button
            class="rounded-full bg-accent px-[22px] py-[11px] text-[14px] font-semibold text-white shadow-[0_4px_14px_rgba(20,194,138,.3)] transition-opacity hover:opacity-90 disabled:opacity-50"
            :disabled="transferring || detail.aff_quota <= 0"
            @click="transfer"
          >
            {{ transferring ? $t('invite.transfer.transferring') : $t('invite.transfer.button') }}
          </button>
        </div>
        <p
          v-if="detail.aff_quota <= 0"
          class="mt-3 text-[13px] text-subtle"
        >
          {{ $t('invite.transfer.empty') }}
        </p>
      </div>

      <!-- 已邀请用户 -->
      <div class="overflow-hidden rounded-xl3 bg-card shadow-[0_2px_12px_rgba(0,0,0,.04)]">
        <div class="px-[26px] pb-1 pt-6 text-base font-semibold text-text">
          {{ $t('invite.invitees.title') }}
        </div>

        <div
          v-if="detail.invitees.length === 0"
          class="px-[26px] py-16 text-center text-sm text-subtle"
        >
          {{ $t('invite.invitees.empty') }}
        </div>
        <div
          v-else
          role="table"
          class="overflow-x-auto"
        >
          <div class="min-w-[560px]">
            <div
              role="row"
              class="grid gap-4 border-b border-track px-[26px] py-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint"
              style="grid-template-columns: 1.6fr 1fr 1fr 1.2fr"
            >
              <div role="columnheader">
                {{ $t('invite.invitees.columns.email') }}
              </div>
              <div role="columnheader">
                {{ $t('invite.invitees.columns.username') }}
              </div>
              <div
                role="columnheader"
                class="text-right"
              >
                {{ $t('invite.invitees.columns.rebate') }}
              </div>
              <div role="columnheader">
                {{ $t('invite.invitees.columns.joinedAt') }}
              </div>
            </div>
            <div
              v-for="item in detail.invitees"
              :key="item.user_id"
              role="row"
              class="grid items-center gap-4 border-b border-track px-[26px] py-4 text-sm last:border-b-0"
              style="grid-template-columns: 1.6fr 1fr 1fr 1.2fr"
            >
              <div
                role="cell"
                class="truncate font-medium text-text"
              >
                {{ item.email || '—' }}
              </div>
              <div
                role="cell"
                class="truncate text-text2"
              >
                {{ item.username || '—' }}
              </div>
              <div
                role="cell"
                class="num text-right font-medium text-pos"
              >
                ${{ formatBalance(item.total_rebate) }}
              </div>
              <div
                role="cell"
                class="num text-text2"
              >
                {{ formatDateTime(item.created_at) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </PortalLayout>
</template>
