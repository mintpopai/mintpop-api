<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import PageSkeleton from '@/components/common/PageSkeleton.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatCard from '@/components/ui/StatCard.vue'
import FilterBar from '@/components/ui/FilterBar.vue'
import Pagination from '@/components/ui/Pagination.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import Modal from '@/components/ui/Modal.vue'
import KeyTable from '@/components/keys/KeyTable.vue'
import CreateKeyModal from '@/components/keys/CreateKeyModal.vue'
import EditKeyModal from '@/components/keys/EditKeyModal.vue'
import UseKeyModal from '@/components/keys/UseKeyModal.vue'
import { useI18n } from 'vue-i18n'
import { useKeys } from '@/composables/useKeys'
import { useCreateKeyGuide } from '@/composables/useCreateKeyGuide'
import { useToast } from '@/composables/useToast'
import { useSettingsStore } from '@/stores/settings'
import { formatCost } from '@/utils/format'
import type { ApiKey, CreateApiKeyRequest, UpdateApiKeyRequest } from '@/api/types'
import { errMessage } from '@/utils/error'

const k = useKeys()
const toast = useToast()
const { t } = useI18n()
const settingsStore = useSettingsStore()
const showCreate = ref(false)
const editTarget = ref<ApiKey | null>(null)
const removeTarget = ref<ApiKey | null>(null)
const removing = ref(false)
const useTarget = ref<ApiKey | null>(null)

// 固定链接 /keys?guide=create 进入时的「创建密钥」引导（高亮 + 气泡提示）
const { active: guideActive, dismiss: dismissGuide } = useCreateKeyGuide()

function openCreate() {
  showCreate.value = true
  dismissGuide()
}

onMounted(() => {
  k.load()
  k.loadGroups()
  settingsStore.ensureLoaded()
})

// 网关 API 基础地址（来自公开设置），用于「使用密钥」配置示例
const apiBaseUrl = computed(() => settingsStore.settings?.api_base_url ?? '')

// 统计卡片：从当前页计算（精简版，不分页汇总）
const activeCount = computed(() => k.rows.value.filter((r) => r.status === 'active').length)
const inactiveCount = computed(() => k.rows.value.filter((r) => r.status !== 'active').length)

const totalCost = computed(() => {
  return Object.values(k.usage.value).reduce((sum, s) => sum + (s.total_actual_cost ?? 0), 0)
})

async function doCreate(payload: CreateApiKeyRequest, done: (nk: ApiKey | null) => void) {
  try {
    const nk = await k.create(payload)
    done(nk)
  } catch {
    // 创建失败时回调 null，由弹窗展示错误并保持表单
    done(null)
  }
}

async function doEdit(id: number, patch: UpdateApiKeyRequest, done: () => void) {
  try {
    await k.update(id, patch)
    editTarget.value = null
  } catch (e) {
    // 失败保持弹窗与表单、提示后可重试（与 doCreate 的失败语义一致）
    toast.error(errMessage(e, t('common.requestFailed')))
  } finally {
    done()
  }
}

async function confirmRemove() {
  if (!removeTarget.value || removing.value) return
  removing.value = true
  try {
    await k.remove(removeTarget.value.id)
    removeTarget.value = null
  } catch (e) {
    // 失败保持弹窗、提示后可重试（与 doEdit 的失败语义一致）
    toast.error(errMessage(e, t('common.requestFailed')))
  } finally {
    removing.value = false
  }
}

async function doToggle(key: ApiKey) {
  try {
    await k.toggle(key.id, key.status === 'active' ? 'inactive' : 'active')
  } catch (e) {
    // 模板直调异步会静默吞错：启停失败必须给出反馈
    toast.error(errMessage(e, t('common.requestFailed')))
  }
}
</script>

<template>
  <div>
    <!-- 页头 -->
    <PageHeader
      :title="$t('keys.title')"
      :subtitle="$t('keys.subtitle')"
    >
      <template #actions>
        <button
          class="rounded-full bg-card px-4 py-[11px] text-[13px] font-medium text-text2 shadow-pill transition-colors hover:text-text"
          :disabled="k.loading.value"
          @click="k.load()"
        >
          ↻ {{ $t('common.refresh') }}
        </button>
        <div class="relative">
          <button
            class="rounded-full bg-accent px-[22px] py-[11px] text-sm font-semibold text-white shadow-[0_4px_14px_rgba(20,194,138,.3)] transition-opacity hover:opacity-90"
            :class="{ 'guide-pulse': guideActive }"
            @click="openCreate"
          >
            + {{ $t('keys.createKey') }}
          </button>
          <!-- 引导气泡：点击气泡同样打开创建弹窗 -->
          <div
            v-if="guideActive"
            class="guide-bubble absolute right-0 top-full z-20 mt-3 w-max max-w-[260px] cursor-pointer rounded-xl bg-text px-4 py-3 text-[13px] font-medium leading-relaxed text-card shadow-lg"
            role="status"
            @click="openCreate"
          >
            <span class="absolute -top-1.5 right-8 h-3 w-3 rotate-45 bg-text" />
            {{ $t('keys.guide.createHint') }}
          </div>
        </div>
      </template>
    </PageHeader>

    <!-- 加载态 -->
    <PageSkeleton
      v-if="k.loading.value && !k.loaded.value"
      variant="table"
    />

    <!-- 错误态 -->
    <div
      v-else-if="k.error.value && !k.loaded.value"
      class="rounded-xl3 border border-dashed border-border2 bg-card px-7 py-16 text-center text-sm text-subtle"
    >
      {{ k.error.value }}
      <button
        class="ml-2 underline"
        @click="k.load()"
      >
        {{ $t('common.retry') }}
      </button>
    </div>

    <!-- 内容 -->
    <template v-else>
      <!-- 统计卡片 -->
      <div class="mb-[22px] grid grid-cols-2 gap-[18px]">
        <StatCard
          :label="$t('keys.stats.totalLabel')"
          :value="String(k.total.value)"
          :hint="$t('keys.stats.statusHint', { active: activeCount, inactive: inactiveCount })"
          accent
        />
        <StatCard
          :label="$t('keys.stats.cost30dLabel')"
          :value="`$${formatCost(totalCost)}`"
          :hint="$t('keys.stats.costHint')"
          accent
        />
      </div>

      <!-- 筛选栏 -->
      <FilterBar>
        <!-- 搜索 -->
        <SearchInput
          v-model="k.filters.search"
          class="max-w-[340px] flex-1"
          input-class="w-full rounded-[11px] border-[1.5px] border-border2 bg-card py-[11px] pl-10 pr-4 text-sm text-text outline-hidden focus:border-accent"
          :placeholder="$t('keys.searchPlaceholder')"
          @change="k.load()"
        />

        <!-- 分组筛选 -->
        <select
          v-model="k.filters.group_id"
          class="rounded-[11px] border-[1.5px] border-border2 bg-card px-4 py-[11px] text-[13px] font-medium text-text2 outline-hidden focus:border-accent"
          @change="k.load()"
        >
          <option value="">
            {{ $t('keys.filter.allGroups') }}
          </option>
          <option
            v-for="g in k.groups.value"
            :key="g.id"
            :value="String(g.id)"
          >
            {{ g.name }}
          </option>
        </select>

        <!-- 状态筛选 -->
        <select
          v-model="k.filters.status"
          class="rounded-[11px] border-[1.5px] border-border2 bg-card px-4 py-[11px] text-[13px] font-medium text-text2 outline-hidden focus:border-accent"
          @change="k.load()"
        >
          <option value="">
            {{ $t('keys.filter.allStatus') }}
          </option>
          <option value="active">
            {{ $t('keys.status.active') }}
          </option>
          <option value="inactive">
            {{ $t('keys.status.inactive') }}
          </option>
        </select>
      </FilterBar>

      <!-- 表格 -->
      <KeyTable
        :rows="k.rows.value"
        :usage="k.usage.value"
        :group-rates="k.groupRates.value"
        @edit="editTarget = $event"
        @toggle="doToggle($event)"
        @remove="removeTarget = $event"
        @use="useTarget = $event"
      />

      <!-- 分页 -->
      <Pagination
        :page="k.page.value"
        :page-size="k.pageSize.value"
        :total="k.total.value"
        @update:page="k.setPage($event)"
      />
    </template>

    <!-- 创建弹窗 -->
    <CreateKeyModal
      :open="showCreate"
      :groups="k.groups.value"
      :group-rates="k.groupRates.value"
      @close="showCreate = false"
      @submit="doCreate"
    />

    <!-- 编辑弹窗 -->
    <EditKeyModal
      :open="!!editTarget"
      :target="editTarget"
      :groups="k.groups.value"
      :group-rates="k.groupRates.value"
      @close="editTarget = null"
      @submit="doEdit"
    />

    <!-- 使用密钥弹窗 -->
    <UseKeyModal
      :open="!!useTarget"
      :api-key="useTarget?.key ?? ''"
      :base-url="apiBaseUrl"
      :platform="useTarget?.group?.platform ?? null"
      :allow-messages-dispatch="useTarget?.group?.allow_messages_dispatch ?? false"
      @close="useTarget = null"
    />

    <!-- 删除确认弹窗 -->
    <Modal
      :open="!!removeTarget"
      :title="$t('keys.delete.confirmTitle')"
      @close="removeTarget = null"
    >
      <!-- 具名插值 + 样式化插槽（vue-i18n <i18n-t>）：语序由词条承载，不再拆前后缀 -->
      <i18n-t
        keypath="keys.delete.confirm"
        tag="p"
        scope="global"
        class="text-sm text-text2"
      >
        <template #name>
          <b class="font-semibold text-text">{{ removeTarget?.name }}</b>
        </template>
      </i18n-t>
      <template #footer>
        <button
          class="rounded-full border border-border px-5 py-2 text-sm font-medium text-text2 transition-colors hover:border-border2 hover:text-text"
          @click="removeTarget = null"
        >
          {{ $t('common.cancel') }}
        </button>
        <button
          class="rounded-full bg-neg px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          :disabled="removing"
          @click="confirmRemove"
        >
          {{ removing ? $t('keys.delete.deleting') : $t('keys.delete.confirmBtn') }}
        </button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
/* 「创建密钥」引导：按钮脉冲光环（叠加原有投影，避免动画期间投影消失） */
.guide-pulse {
  animation: guide-pulse 1.6s ease-out infinite;
}

@keyframes guide-pulse {
  0% {
    box-shadow:
      0 4px 14px rgba(20, 194, 138, 0.3),
      0 0 0 0 rgba(20, 194, 138, 0.5);
  }
  70% {
    box-shadow:
      0 4px 14px rgba(20, 194, 138, 0.3),
      0 0 0 14px rgba(20, 194, 138, 0);
  }
  100% {
    box-shadow:
      0 4px 14px rgba(20, 194, 138, 0.3),
      0 0 0 0 rgba(20, 194, 138, 0);
  }
}

/* 引导气泡入场 */
.guide-bubble {
  animation: guide-bubble-in 0.35s ease;
}

@keyframes guide-bubble-in {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 用户偏好减少动效时：不做动画，改为静态高亮环 */
@media (prefers-reduced-motion: reduce) {
  .guide-pulse,
  .guide-bubble {
    animation: none;
  }

  .guide-pulse {
    box-shadow:
      0 4px 14px rgba(20, 194, 138, 0.3),
      0 0 0 4px rgba(20, 194, 138, 0.35);
  }
}
</style>
