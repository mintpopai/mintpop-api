<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Modal from '@/components/ui/Modal.vue'
import type { Group, CreateApiKeyRequest, ApiKey } from '@/api/types'
import { useCopy } from '@/composables/useCopy'

const { t } = useI18n()

const props = defineProps<{ open: boolean; groups: Group[] }>()
const emit = defineEmits<{
  close: []
  submit: [payload: CreateApiKeyRequest, done: (nk: ApiKey | null) => void]
}>()

const name = ref('')
const groupId = ref<number | null>(null)
const expiresInDays = ref<number | null>(null)
const quota = ref<number | null>(null)
const submitting = ref(false)
const createdKey = ref<ApiKey | null>(null)
const { copiedKey, copy: copyText, reset: resetCopied } = useCopy()
const copied = computed(() => copiedKey.value !== null)
const errorMsg = ref('')

watch(
  () => props.open,
  (v) => {
    if (v) {
      name.value = ''
      groupId.value = null
      expiresInDays.value = null
      quota.value = null
      createdKey.value = null
      resetCopied()
      submitting.value = false
      errorMsg.value = ''
    }
  }
)

function submit() {
  if (!name.value.trim() || submitting.value) return
  submitting.value = true
  errorMsg.value = ''
  emit(
    'submit',
    {
      name: name.value.trim(),
      group_id: groupId.value ?? undefined,
      expires_in_days: expiresInDays.value ?? undefined,
      quota: quota.value ?? undefined
    },
    (nk) => {
      submitting.value = false
      if (nk) {
        createdKey.value = nk
      } else {
        // 创建失败：保持表单，提示错误
        errorMsg.value = t('keys.createFailed')
      }
    }
  )
}

function copyKey() {
  if (!createdKey.value) return
  copyText(createdKey.value.key)
}
</script>

<template>
  <Modal
    :open="open"
    :title="createdKey ? $t('keys.created.title') : $t('keys.createKey')"
    @close="emit('close')"
  >
    <!-- 步骤一：表单 -->
    <template v-if="!createdKey">
      <div class="flex flex-col gap-4">
        <!-- 名称 -->
        <div>
          <label class="mb-1.5 block text-xs font-medium text-text2">{{ $t('keys.form.name') }} <span class="text-neg">*</span></label>
          <input
            v-model="name"
            type="text"
            :placeholder="$t('keys.form.namePlaceholder')"
            class="w-full rounded-xl2 border-[1.5px] border-border2 bg-card px-4 py-3 text-sm text-text outline-none transition-colors focus:border-accent focus:shadow-[0_0_0_3px_rgba(20,194,138,0.13)]"
            @keydown.enter="submit"
          >
        </div>

        <!-- 分组 -->
        <div>
          <label class="mb-1.5 block text-xs font-medium text-text2">{{ $t('keys.form.group') }}</label>
          <select
            v-model="groupId"
            class="w-full rounded-xl2 border-[1.5px] border-border2 bg-card px-4 py-3 text-sm text-text outline-none transition-colors focus:border-accent focus:shadow-[0_0_0_3px_rgba(20,194,138,0.13)]"
          >
            <option :value="null">
              {{ $t('keys.form.noGroup') }}
            </option>
            <option
              v-for="g in groups"
              :key="g.id"
              :value="g.id"
            >
              {{ g.name }}
            </option>
          </select>
        </div>

        <!-- 有效期 -->
        <div>
          <label class="mb-1.5 block text-xs font-medium text-text2">{{ $t('keys.form.expiryLabel') }}</label>
          <input
            v-model.number="expiresInDays"
            type="number"
            min="1"
            :placeholder="$t('keys.form.expiryPlaceholder')"
            class="w-full rounded-xl2 border-[1.5px] border-border2 bg-card px-4 py-3 text-sm text-text outline-none transition-colors focus:border-accent focus:shadow-[0_0_0_3px_rgba(20,194,138,0.13)]"
          >
        </div>

        <!-- 配额 -->
        <div>
          <label class="mb-1.5 block text-xs font-medium text-text2">{{ $t('keys.form.quotaLabel') }}</label>
          <input
            v-model.number="quota"
            type="number"
            min="0"
            step="0.01"
            :placeholder="$t('keys.form.quotaPlaceholder')"
            class="w-full rounded-xl2 border-[1.5px] border-border2 bg-card px-4 py-3 text-sm text-text outline-none transition-colors focus:border-accent focus:shadow-[0_0_0_3px_rgba(20,194,138,0.13)]"
          >
        </div>

        <!-- 错误提示 -->
        <p
          v-if="errorMsg"
          class="text-xs text-neg"
        >
          {{ errorMsg }}
        </p>
      </div>
    </template>

    <!-- 步骤二：展示明文密钥 -->
    <template v-else>
      <div class="flex flex-col gap-4">
        <div class="rounded-xl2 border border-[#F59E0B]/40 bg-[#F59E0B]/[0.07] px-4 py-3 text-sm text-[#C77800]">
          {{ $t('keys.created.warning') }}
        </div>
        <div>
          <label class="mb-1.5 block text-xs font-medium text-text2">{{ $t('keys.created.keyLabel') }}</label>
          <div class="flex items-center gap-2">
            <code
              class="flex-1 select-all overflow-x-auto whitespace-nowrap rounded-xl2 border-[1.5px] border-border2 bg-muted px-4 py-3 text-xs font-medium text-text"
            >{{ createdKey.key }}</code>
            <button
              class="shrink-0 rounded-xl2 border-[1.5px] border-border2 bg-card px-4 py-3 text-xs font-medium text-text2 transition-colors hover:border-accent hover:text-accent"
              @click="copyKey"
            >
              {{ copied ? $t('common.copied') : $t('common.copy') }}
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- Footer -->
    <template #footer>
      <template v-if="!createdKey">
        <button
          class="rounded-full border border-border px-5 py-2 text-sm font-medium text-text2 transition-colors hover:border-border2 hover:text-text"
          @click="emit('close')"
        >
          {{ $t('common.cancel') }}
        </button>
        <button
          class="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(20,194,138,.3)] transition-opacity hover:opacity-90 disabled:opacity-50"
          :disabled="!name.trim() || submitting"
          @click="submit"
        >
          {{ submitting ? $t('keys.creating') : $t('keys.createKey') }}
        </button>
      </template>
      <template v-else>
        <button
          class="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(20,194,138,.3)] transition-opacity hover:opacity-90"
          @click="emit('close')"
        >
          {{ $t('common.done') }}
        </button>
      </template>
    </template>
  </Modal>
</template>
