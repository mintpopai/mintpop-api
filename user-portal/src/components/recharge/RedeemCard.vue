<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { redeem } from '@/api/redeem'
import type { RedeemResult } from '@/api/types'
import { formatBalance } from '@/utils/format'
import { errMessage } from '@/utils/error'

const { t } = useI18n()

const emit = defineEmits<{
  /** 兑换成功后，通知父组件刷新余额 */
  redeemed: []
}>()

const code = ref('')
const submitting = ref(false)
const result = ref<RedeemResult | null>(null)
const errorMsg = ref('')

async function handleRedeem() {
  const trimmed = code.value.trim()
  if (!trimmed) return
  submitting.value = true
  result.value = null
  errorMsg.value = ''
  try {
    const res = await redeem(trimmed)
    result.value = res
    code.value = ''
    emit('redeemed')
  } catch (e) {
    errorMsg.value = errMessage(e, t('recharge.errRedeem'))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="rounded-[20px] bg-card p-[24px_26px] shadow-card">
    <!-- 标题 -->
    <div class="mb-[18px] text-[11px] font-medium uppercase tracking-[0.1em] text-faint">
      {{ $t('recharge.redeemCode') }}
    </div>

    <!-- 输入行 -->
    <div class="flex gap-2">
      <input
        v-model="code"
        class="min-w-0 flex-1 input-base"
        :placeholder="$t('recharge.redeemPlaceholder')"
        :disabled="submitting"
        @keydown.enter="handleRedeem"
      >
      <button
        class="flex-none rounded-xl2 bg-accent px-5 py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
        :disabled="submitting || !code.trim()"
        @click="handleRedeem"
      >
        {{ submitting ? $t('recharge.redeeming') : $t('recharge.redeem') }}
      </button>
    </div>

    <!-- 成功结果 -->
    <div
      v-if="result"
      class="mt-3 rounded-xl2 border border-pos/30 bg-pos/[0.06] px-4 py-3 text-sm"
    >
      <p class="font-semibold text-pos">
        {{ $t('recharge.redeemSuccess') }}
      </p>
      <p class="mt-1 text-text3">
        {{ result.message }}
      </p>
      <div
        v-if="result.new_balance !== undefined"
        class="mt-2 text-text3"
      >
        {{ $t('recharge.newBalance') }}<span class="font-semibold text-text">${{ formatBalance(result.new_balance) }}</span>
      </div>
      <div
        v-if="result.new_concurrency !== undefined"
        class="mt-1 text-text3"
      >
        {{ $t('recharge.newConcurrency') }}<span class="font-semibold text-text">{{ result.new_concurrency }}</span>
      </div>
    </div>

    <!-- 错误结果 -->
    <div
      v-if="errorMsg"
      class="mt-3 rounded-xl2 border border-neg/30 bg-neg/[0.06] px-4 py-3 text-sm text-neg"
    >
      {{ errorMsg }}
    </div>
  </div>
</template>
