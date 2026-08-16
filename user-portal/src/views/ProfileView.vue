<script setup lang="ts">
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import PageSkeleton from '@/components/common/PageSkeleton.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import AccountHero from '@/components/profile/AccountHero.vue'
import ProfileForm from '@/components/profile/ProfileForm.vue'
import InviteCard from '@/components/profile/InviteCard.vue'
import BindingList from '@/components/profile/BindingList.vue'
import { useProfile } from '@/composables/useProfile'
import { useSettingsStore } from '@/stores/settings'

const p = useProfile()
const settingsStore = useSettingsStore()
const { settings } = storeToRefs(settingsStore)

onMounted(() => {
  p.load()
  settingsStore.ensureLoaded()
})
</script>

<template>
  <div>
    <PageHeader
      :title="$t('profile.title')"
      :subtitle="$t('profile.subtitle')"
    />

    <!-- 加载态 -->
    <PageSkeleton
      v-if="p.loading.value && !p.user.value"
      variant="form"
    />

    <!-- 错误态 -->
    <div
      v-else-if="p.error.value && !p.user.value"
      class="rounded-xl3 border border-dashed border-border2 bg-card px-7 py-16 text-center text-sm text-subtle"
    >
      {{ p.error.value }}
      <button
        class="ml-2 underline"
        @click="p.load()"
      >
        {{ $t('common.retry') }}
      </button>
    </div>

    <!-- 内容 -->
    <template v-else-if="p.user.value">
      <AccountHero :user="p.user.value" />

      <ProfileForm
        :user="p.user.value"
        @save-username="p.saveUsername"
        @upload="p.saveAvatar"
        @remove-avatar="p.removeAvatar"
      />

      <!-- 邀请返利卡：站点开启邀请返利时才展示（与 InviteView 的门控同语义） -->
      <InviteCard v-if="settings?.affiliate_enabled" />

      <BindingList
        :user="p.user.value"
        :settings="settings"
        @bind="p.bind"
        @unbind="p.unbind"
      />
    </template>
  </div>
</template>
