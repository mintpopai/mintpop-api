<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLocaleStore } from '@/stores/locale'
import { LOCALE_LABELS, type AppLocale } from '@/i18n'
import { IS_APPLICATION_MODE } from '@/config/portal'

// 四个认证页（登录/注册/忘记密码/重置密码）共用的双栏骨架：
// 左侧品牌区（点阵晕染 + 字标 + 编辑式文案 + 底部插槽），右侧表单插槽（含移动端字标）。
defineProps<{
  /** 左栏 kicker 小标（已翻译） */
  kicker: string
  /** 左栏衬线大标题三段：前缀 + 高亮词（薄荷绿下划线标记）+ 后缀 */
  headlinePre: string
  headlineMark: string
  headlineEnd: string
  /** 左栏描述（已翻译） */
  desc: string
}>()

const { t } = useI18n()

// brand-footer 插槽缺省内容：模型/能力标签行，随分发模式切换（注册页用「三步骤」覆盖）
const brandTags = IS_APPLICATION_MODE ? ['Text', 'Vision', 'Voice'] : ['Claude', 'GPT', 'Gemini']

// 登录前的语言切换入口（登录后的入口在 PortalLayout 用户菜单里）：
// 按钮文案直接用对方语言的原生名（LOCALE_LABELS），两种语言下都无需翻译
const localeStore = useLocaleStore()
const otherLocaleLabel = computed(
  () => LOCALE_LABELS[(localeStore.current === 'zh-CN' ? 'en-US' : 'zh-CN') as AppLocale]
)
</script>

<template>
  <div class="flex min-h-screen font-sans">
    <!-- ============ 左侧品牌区 ============ -->
    <div
      class="relative hidden w-[46%] flex-none flex-col justify-between overflow-hidden border-r border-border bg-muted px-14 py-[54px] lg:flex"
    >
      <!-- warhol 点阵晕染 -->
      <div
        class="pointer-events-none absolute right-[-90px] top-[-70px] h-[340px] w-[340px] opacity-50"
        style="background: linear-gradient(150deg, #0e9e72 0%, #14c28a 45%, rgba(20, 194, 138, 0) 92%); -webkit-mask-image: radial-gradient(#000 2px, transparent 2.2px); mask-image: radial-gradient(#000 2px, transparent 2.2px); -webkit-mask-size: 18px 18px; mask-size: 18px 18px;"
      />
      <div
        class="pointer-events-none absolute -bottom-20 left-[-70px] h-[260px] w-[260px] opacity-[0.06]"
        style="background: radial-gradient(#1a1a1a 1.7px, transparent 1.9px); background-size: 15px 15px;"
      />

      <!-- 字标 -->
      <div class="relative flex items-center">
        <img
          src="/wordmark-dark.png"
          alt="MintPop API"
          class="block h-8 w-auto dark:hidden"
        >
        <img
          src="/wordmark-light.png"
          alt="MintPop API"
          class="hidden h-8 w-auto dark:block"
        >
      </div>

      <!-- 编辑式标语 -->
      <div class="relative max-w-[420px]">
        <div class="mb-5 text-xs font-semibold uppercase tracking-[0.14em] text-pos">
          {{ kicker }}
        </div>
        <h2 class="font-serif text-[42px] font-medium leading-[1.12] tracking-tight text-text">
          {{ headlinePre }}<span class="relative whitespace-nowrap">{{ headlineMark }}<span
            class="absolute inset-x-0 bottom-0.5 -z-10 h-[9px] rounded-xs bg-accent opacity-[0.28]"
          /></span>{{ headlineEnd }}
        </h2>
        <p class="mt-5 text-[15px] leading-relaxed text-text3">
          {{ desc }}
        </p>
      </div>

      <!-- 左栏底部：缺省渲染模型/能力标签，页面可用 #brand-footer 覆盖。
           包裹层自带 relative（把插槽内容整体抬到点阵装饰层之上），插槽内容不必再带 -->
      <div class="relative">
        <slot name="brand-footer">
          <div class="flex flex-wrap gap-2.5">
            <span
              v-for="tag in brandTags"
              :key="tag"
              class="rounded-full border border-border bg-card px-3.5 py-[7px] text-xs font-medium text-text2"
            >● {{ tag }}</span>
            <span class="rounded-full border border-dashed border-border2 px-3.5 py-[7px] text-xs font-medium text-faint">{{ t('auth.moreComing') }}</span>
          </div>
        </slot>
      </div>
    </div>

    <!-- ============ 右侧表单 ============ -->
    <div class="relative flex min-w-0 flex-1 items-center justify-center bg-bg px-10 py-12">
      <!-- 语言切换（构建时锁定单语言则不渲染，与 PortalLayout 一致） -->
      <button
        v-if="!localeStore.locked"
        type="button"
        class="absolute right-6 top-6 rounded-full border border-border bg-card px-3.5 py-[7px] text-xs font-medium text-text2 transition hover:bg-hover lg:right-10"
        @click="localeStore.toggle()"
      >
        {{ otherLocaleLabel }} ⇄
      </button>
      <div class="w-full max-w-[392px]">
        <!-- 移动端字标 -->
        <div class="mb-8 flex items-center lg:hidden">
          <img
            src="/wordmark-dark.png"
            alt="MintPop API"
            class="block h-7 w-auto dark:hidden"
          >
          <img
            src="/wordmark-light.png"
            alt="MintPop API"
            class="hidden h-7 w-auto dark:block"
          >
        </div>
        <slot />
      </div>
    </div>
  </div>
</template>

<style>
/* 认证页共享的输入框样式（供各页插槽内容使用，须全局生效，故不加 scoped） */
.fld {
  width: 100%;
  font: 400 15px 'Space Grotesk', sans-serif;
  color: var(--text);
  background: var(--card);
  border: 1.5px solid var(--border2);
  border-radius: 12px;
  padding: 14px 16px 14px 44px;
  outline: none;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}
.fld::placeholder {
  color: var(--faint);
}
.fld:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(20, 194, 138, 0.13);
}
.ico {
  position: absolute;
  left: 15px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--faint);
  pointer-events: none;
}
</style>
