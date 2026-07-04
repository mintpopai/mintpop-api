<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import UserAvatar from '@/components/common/UserAvatar.vue'
import type { User } from '@/api/types'
import { formatBalance, formatRegMonth } from '@/utils/format'

const props = defineProps<{ user: User }>()
const { t } = useI18n()

/** 角色标签 */
function roleLabel(role: string | undefined): string {
  if (role === 'admin') return t('profile.role.admin')
  return t('profile.role.user')
}

</script>

<template>
  <div
    class="relative mb-[22px] overflow-hidden rounded-xl4 bg-card px-[36px] py-[32px] shadow-card"
  >
    <!-- 右上角品牌装饰点阵渐变 -->
    <div
      class="pointer-events-none absolute right-[-40px] top-[-50px] h-[230px] w-[230px] opacity-50"
      style="
        background: linear-gradient(150deg, #0e9e72 0%, #14c28a 45%, rgba(20, 194, 138, 0) 92%);
        -webkit-mask-image: radial-gradient(#000 2px, transparent 2.2px);
        mask-image: radial-gradient(#000 2px, transparent 2.2px);
        -webkit-mask-size: 16px 16px;
        mask-size: 16px 16px;
      "
    />

    <!-- 用户基本信息行 -->
    <div class="relative mb-[26px] flex items-center gap-[22px]">
      <!-- 头像 -->
      <UserAvatar
        :user="props.user"
        box-class="h-[74px] w-[74px] rounded-[20px] text-[30px]"
      />

      <!-- 姓名 / 角色 / 邮箱 -->
      <div>
        <div class="mb-[6px] flex items-center gap-[10px]">
          <span class="text-[24px] font-semibold text-text">{{ props.user.username }}</span>
          <!-- 角色徽章 -->
          <span class="rounded-[6px] bg-track px-[9px] py-[3px] text-[11px] font-semibold text-text3">
            {{ roleLabel(props.user.role) }}
          </span>
          <!-- 状态徽章 -->
          <span
            :class="[
              'rounded-[6px] px-[9px] py-[3px] text-[11px] font-semibold',
              props.user.status === 'disabled'
                ? 'bg-[rgba(251,6,130,0.1)] text-neg'
                : 'bg-[rgba(20,194,138,0.12)] text-pos',
            ]"
          >
            ● {{ props.user.status === 'disabled' ? $t('profile.status.disabled') : $t('profile.status.enabled') }}
          </span>
        </div>
        <div class="text-[14px] text-subtle">
          {{ props.user.email }}
        </div>
      </div>
    </div>

    <!-- 三格统计 -->
    <div class="relative grid grid-cols-3 gap-[16px]">
      <!-- 账户余额 -->
      <div class="rounded-[14px] bg-bg px-[20px] py-[18px]">
        <div class="mb-[12px] text-[11px] font-medium uppercase tracking-widest text-faint">
          {{ $t('profile.stats.balance') }}
        </div>
        <div class="font-serif text-[28px] font-medium leading-none text-text">
          ${{ formatBalance(props.user.balance) }}
        </div>
      </div>

      <!-- 并发限制 -->
      <div class="rounded-[14px] bg-bg px-[20px] py-[18px]">
        <div class="mb-[12px] text-[11px] font-medium uppercase tracking-widest text-faint">
          {{ $t('profile.stats.concurrency') }}
        </div>
        <div class="font-serif text-[28px] font-medium leading-none text-text">
          {{ props.user.concurrency ?? '—' }}
        </div>
      </div>

      <!-- 注册时间 -->
      <div class="rounded-[14px] bg-bg px-[20px] py-[18px]">
        <div class="mb-[12px] text-[11px] font-medium uppercase tracking-widest text-faint">
          {{ $t('profile.stats.registeredAt') }}
        </div>
        <div class="font-serif text-[28px] font-medium leading-none text-text">
          {{ formatRegMonth(props.user.created_at) }}
        </div>
      </div>
    </div>
  </div>
</template>
