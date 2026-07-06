<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import InviteShareBox from '@/components/invite/InviteShareBox.vue'
import { getAffiliateDetail } from '@/api/user'
import { errMessage } from '@/utils/error'

/**
 * 个人资料页的邀请返利卡：展示我的邀请码 + 邀请链接，右上角跳转邀请页。
 * User 对象不含 aff_code，故自行调 GET /user/aff 拉取；父级已按 affiliate_enabled 门控渲染。
 */
const { t } = useI18n()

const loading = ref(true)
const error = ref<string | null>(null)
const affCode = ref<string | null>(null)

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    affCode.value = (await getAffiliateDetail()).aff_code
  } catch (e) {
    error.value = errMessage(e, t('profile.invite.loadFailed'))
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="mb-[22px] rounded-xl3 bg-card px-[30px] py-[28px] shadow-soft">
    <div class="mb-[22px] flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 class="mb-[4px] font-serif text-[20px] font-medium text-text">
          {{ $t('profile.invite.title') }}
        </h3>
        <p class="text-[13px] text-subtle">
          {{ $t('profile.invite.subtitle') }}
        </p>
      </div>
      <RouterLink
        to="/invite"
        class="rounded-[9px] border-[1.5px] border-[rgba(20,194,138,0.35)] bg-[rgba(20,194,138,0.1)] px-[18px] py-[9px] text-[13px] font-semibold text-pos transition-colors hover:bg-[rgba(20,194,138,0.18)]"
      >
        {{ $t('profile.invite.goToInvite') }} →
      </RouterLink>
    </div>

    <div
      v-if="loading"
      class="flex items-center justify-center py-6"
    >
      <LoadingSpinner :size="24" />
    </div>

    <div
      v-else-if="error"
      class="text-[13px] text-subtle"
    >
      {{ error }}
      <button
        class="ml-2 underline"
        @click="load"
      >
        {{ $t('common.retry') }}
      </button>
    </div>

    <InviteShareBox
      v-else-if="affCode"
      :aff-code="affCode"
    />
  </div>
</template>
