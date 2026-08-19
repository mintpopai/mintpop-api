<script setup lang="ts">
import { ref, useId, watch } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import type { ApiKey, Group, UpdateApiKeyRequest } from '@/api/types'

// label for/id 关联；useId() 保证弹窗多实例不撞 id
const nameFieldId = useId()
const groupFieldId = useId()

const props = defineProps<{
  open: boolean
  target: ApiKey | null
  groups: Group[]
  /** 用户专属分组倍率（group_id → 倍率），来自 /groups/rates */
  groupRates?: Record<number, number>
}>()

const emit = defineEmits<{
  close: []
  submit: [id: number, patch: UpdateApiKeyRequest, done: () => void]
}>()

const name = ref('')
const groupId = ref<number | null>(null)
const status = ref<'active' | 'inactive'>('active')
const submitting = ref(false)

watch(
  () => props.target,
  (t) => {
    if (t) {
      name.value = t.name
      groupId.value = t.group_id
      status.value = t.status === 'active' ? 'active' : 'inactive'
    }
  },
  { immediate: true }
)

watch(
  () => props.open,
  (v) => {
    if (!v) submitting.value = false
  }
)

// 选项文案带生效倍率（专属倍率 ?? 分组默认倍率），与密钥表徽标口径一致
function optionLabel(g: Group): string {
  const rate = props.groupRates?.[g.id] ?? g.rate_multiplier
  return typeof rate === 'number' ? `${g.name}（${rate}x）` : g.name
}

function submit() {
  // 与 frontend 语义对齐：分组必填；历史无分组密钥必须先选定分组才能保存
  const gid = groupId.value
  if (!props.target || !name.value.trim() || gid === null || submitting.value) return
  submitting.value = true
  emit(
    'submit',
    props.target.id,
    {
      name: name.value.trim(),
      status: status.value,
      group_id: gid
    },
    // 与 CreateKeyModal 同款 done 回调：父组件处理完调用，无论成败复位提交态
    // （此前只在弹窗关闭时复位，父组件失败不关弹窗会永久卡在「保存中」）
    () => {
      submitting.value = false
    }
  )
}
</script>

<template>
  <Modal
    :open="open"
    :title="$t('keys.edit.title')"
    @close="emit('close')"
  >
    <div class="flex flex-col gap-4">
      <!-- 名称 -->
      <div>
        <label
          :for="nameFieldId"
          class="mb-1.5 block text-xs font-medium text-text2"
        >{{ $t('keys.form.name') }} <span class="text-neg">*</span></label>
        <input
          :id="nameFieldId"
          v-model="name"
          type="text"
          :placeholder="$t('keys.form.editNamePlaceholder')"
          class="w-full input-base"
        >
      </div>

      <!-- 分组 -->
      <div>
        <label
          :for="groupFieldId"
          class="mb-1.5 block text-xs font-medium text-text2"
        >{{ $t('keys.form.group') }} <span class="text-neg">*</span></label>
        <select
          :id="groupFieldId"
          v-model="groupId"
          class="w-full input-base"
        >
          <!-- 占位项不可选：分组必填，disabled+hidden 仅为历史无分组密钥作占位显示 -->
          <option
            :value="null"
            disabled
            hidden
          >
            {{ $t('keys.form.selectGroup') }}
          </option>
          <option
            v-for="g in groups"
            :key="g.id"
            :value="g.id"
          >
            {{ optionLabel(g) }}
          </option>
        </select>
      </div>

      <!-- 启用开关 -->
      <div class="flex items-center justify-between rounded-xl2 border-[1.5px] border-border2 bg-card px-4 py-3">
        <span class="text-sm font-medium text-text2">{{ $t('keys.edit.enableLabel') }}</span>
        <button
          type="button"
          role="switch"
          :aria-checked="status === 'active'"
          :aria-label="$t('keys.edit.enableLabel')"
          class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors"
          :class="status === 'active' ? 'bg-accent' : 'bg-track'"
          @click="status = status === 'active' ? 'inactive' : 'active'"
        >
          <span
            class="inline-block h-4 w-4 translate-x-1 rounded-full bg-white shadow-sm transition-transform"
            :class="status === 'active' ? 'translate-x-6' : 'translate-x-1'"
          />
        </button>
      </div>
    </div>

    <template #footer>
      <button
        class="rounded-full border border-border px-5 py-2 text-sm font-medium text-text2 transition-colors hover:border-border2 hover:text-text"
        @click="emit('close')"
      >
        {{ $t('common.cancel') }}
      </button>
      <button
        class="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(20,194,138,.3)] transition-opacity hover:opacity-90 disabled:opacity-50"
        :disabled="!name.trim() || groupId === null || submitting"
        @click="submit"
      >
        {{ submitting ? $t('keys.edit.saving') : $t('common.save') }}
      </button>
    </template>
  </Modal>
</template>
