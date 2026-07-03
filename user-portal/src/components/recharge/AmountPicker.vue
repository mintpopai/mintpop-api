<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  /** 预设金额列表 */
  presets: number[]
  /** 标记为「热门」的档位（该卡展示热门徽标） */
  popular?: number
  /** 充值倍率（1 = 无赠送；1.1 = 赠 10%） */
  multiplier: number
  /** 最低充值额 */
  min: number
  /** 最高充值额 */
  max?: number
  /** 当前选中金额（v-model） */
  modelValue: number | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number | null]
}>()

// 自定义输入框的文本值
const customInput = ref('')

// 当前选中的预设（用于高亮）
const selectedPreset = ref<number | null>(props.modelValue ?? 100)

// 自定义输入是否有效数值
const customNum = computed(() => {
  const n = parseFloat(customInput.value)
  return customInput.value !== '' && !isNaN(n) && n > 0 ? n : null
})

// 是否处于自定义模式（输入框有合法数字时）
const isCustom = computed(() => customNum.value !== null)

// 计算单个预设的赠送金额
function bonusFor(v: number): number {
  if (props.multiplier <= 1) return 0
  return Math.round(v * (props.multiplier - 1) * 100) / 100
}

// 选中预设
function pickPreset(v: number) {
  selectedPreset.value = v
  customInput.value = ''
  emit('update:modelValue', v)
}

// 自定义输入变化时
function onCustomInput(e: Event) {
  const val = (e.target as HTMLInputElement).value
  customInput.value = val
  const n = parseFloat(val)
  if (!isNaN(n) && n > 0) {
    selectedPreset.value = null
    emit('update:modelValue', n)
  } else if (val === '') {
    // 清空自定义时，回到上次选中的预设
    if (selectedPreset.value !== null) {
      emit('update:modelValue', selectedPreset.value)
    } else {
      emit('update:modelValue', null)
    }
  } else {
    emit('update:modelValue', null)
  }
}

// 外部 v-model 变化时同步（如初始化）
watch(
  () => props.modelValue,
  (v) => {
    if (v !== null && v !== undefined && customNum.value === null) {
      if (!props.presets.includes(v)) {
        // 外部传入的不是预设值，视为自定义
        customInput.value = String(v)
      } else {
        selectedPreset.value = v
      }
    }
  },
  { immediate: false }
)

// 校验提示
const validationMsg = computed(() => {
  const n = customNum.value
  if (n === null && customInput.value !== '') return t('recharge.errInvalidAmount')
  if (n !== null && n < props.min) return t('recharge.minAmount', { min: props.min })
  if (n !== null && props.max && n > props.max) return t('recharge.maxAmount', { max: props.max })
  return ''
})
</script>

<template>
  <div class="rounded-[20px] bg-card p-[28px_30px] shadow-card">
    <!-- 标题 -->
    <div class="mb-[18px] flex items-baseline justify-between">
      <h3 class="font-serif text-xl font-medium text-text">
        {{ $t('recharge.selectRechargeAmount') }}
      </h3>
      <span class="text-[13px] text-subtle">{{ $t('recharge.unitNote') }}</span>
    </div>

    <!-- 预设金额（手机 2 列 / 桌面 4 列）；radio 语义 + Enter/Space 可选，键盘可达 -->
    <div
      role="radiogroup"
      :aria-label="$t('recharge.selectRechargeAmount')"
      class="grid grid-cols-2 gap-3 sm:grid-cols-4"
    >
      <div
        v-for="v in presets"
        :key="v"
        role="radio"
        :aria-checked="!isCustom && selectedPreset === v"
        tabindex="0"
        class="relative cursor-pointer rounded-xl2 border-[1.5px] p-[18px_16px_16px] transition-[border-color,background,box-shadow] duration-[140ms] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        :class="
          !isCustom && selectedPreset === v
            ? 'border-accent bg-accent/[0.07] shadow-[0_2px_10px_rgba(20,194,138,0.14)]'
            : 'border-border2 bg-card hover:border-[#9FE6CD] hover:bg-hover'
        "
        @click="pickPreset(v)"
        @keydown.enter.prevent="pickPreset(v)"
        @keydown.space.prevent="pickPreset(v)"
      >
        <!-- 热门徽标 -->
        <span
          v-if="popular === v"
          class="absolute -top-2 right-3 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold leading-none text-white shadow-[0_2px_6px_rgba(20,194,138,0.35)]"
        >
          {{ $t('recharge.popular') }}
        </span>
        <div class="font-serif text-[26px] font-medium leading-none text-text">
          ${{ v }}
        </div>
        <div
          class="mt-[7px] text-[11px]"
          :class="bonusFor(v) > 0 ? 'text-pos' : 'text-subtle'"
        >
          {{ bonusFor(v) > 0 ? $t('recharge.bonus', { amount: bonusFor(v).toFixed(2) }) : $t('recharge.instantUse') }}
        </div>
      </div>
    </div>

    <!-- 自定义金额 -->
    <div class="mb-[10px] mt-6 text-[11px] font-medium uppercase tracking-[0.1em] text-faint">
      {{ $t('recharge.customAmount') }}
    </div>
    <div class="relative">
      <span
        class="absolute left-4 top-1/2 -translate-y-1/2 text-base font-medium text-subtle"
      >$</span>
      <input
        class="w-full rounded-xl2 border-[1.5px] border-border2 bg-card py-[15px] pl-[38px] pr-4 text-base font-medium text-text outline-none transition-[border-color] duration-[140ms] placeholder:font-normal placeholder:text-faint focus:border-accent focus:shadow-[0_0_0_3px_rgba(20,194,138,0.13)]"
        :placeholder="min > 0 ? $t('recharge.amountPlaceholder', { min }) : $t('recharge.amountPlaceholderNoMin')"
        :value="customInput"
        inputmode="decimal"
        @input="onCustomInput"
      >
    </div>
    <p
      v-if="validationMsg"
      class="mt-1.5 text-xs text-neg"
    >
      {{ validationMsg }}
    </p>
  </div>
</template>
