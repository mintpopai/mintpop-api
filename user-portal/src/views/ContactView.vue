<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import PortalLayout from '@/layouts/PortalLayout.vue'
import { CONTACT_EMAIL, TELEGRAM_GROUP_URL } from '@/config/portal'

const { t } = useI18n()
</script>

<template>
  <PortalLayout>
    <h1 class="font-serif text-[42px] font-medium leading-tight tracking-tight text-text sm:text-[52px]">
      {{ t('contact.title') }}
    </h1>
    <p class="mt-6 max-w-[620px] text-[15px] leading-relaxed text-text2 sm:text-base">
      {{ t('contact.intro') }}
    </p>

    <div class="mt-10 grid gap-6 md:grid-cols-2">
      <!-- 邮件支持（薄荷绿卡） -->
      <section class="rounded-xl4 border border-accent/25 bg-accent/10 p-7 sm:p-9">
        <span class="flex h-12 w-12 items-center justify-center rounded-xl2 bg-accent/15 text-pos">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect
              x="3"
              y="5"
              width="18"
              height="14"
              rx="2"
            />
            <path d="M3 7l9 6 9-6" />
          </svg>
        </span>
        <div class="mt-8 text-xs font-semibold uppercase tracking-[0.14em] text-pos">
          {{ t('contact.emailLabel') }}
        </div>
        <a
          :href="`mailto:${CONTACT_EMAIL}`"
          class="mt-2 block w-fit font-serif text-[26px] font-medium tracking-tight text-text hover:underline sm:text-[30px]"
        >
          {{ CONTACT_EMAIL }}
        </a>
        <p class="mt-3 text-sm leading-relaxed text-text2">
          {{ t('contact.emailDesc') }}
        </p>
      </section>

      <!-- Telegram（白卡） -->
      <section class="rounded-xl4 border border-border bg-card p-7 shadow-card sm:p-9">
        <span class="flex h-12 w-12 items-center justify-center text-tg">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M22 2L11 13" />
            <path d="M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
        </span>
        <div class="mt-8 text-xs font-semibold uppercase tracking-[0.14em] text-subtle">
          {{ t('contact.telegramLabel') }}
        </div>
        <a
          :href="TELEGRAM_GROUP_URL"
          target="_blank"
          rel="noopener noreferrer"
          class="mt-2 inline-flex w-fit items-center gap-2 text-[17px] font-semibold text-tg hover:underline"
        >
          {{ t('contact.telegramCta') }}
          <span aria-hidden="true">→</span>
        </a>
      </section>
    </div>
  </PortalLayout>
</template>

<style scoped>
/* Telegram 品牌蓝（非主题色，仅本页使用） */
.text-tg {
  color: #1e9de8;
}
</style>
