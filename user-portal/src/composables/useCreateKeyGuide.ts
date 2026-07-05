import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/** 引导 query 参数名与取值：固定链接为 /keys?guide=create */
export const CREATE_KEY_GUIDE_QUERY = 'guide'
export const CREATE_KEY_GUIDE_VALUE = 'create'

/**
 * 「创建密钥」引导：经固定链接 /keys?guide=create 进入密钥页时，
 * 高亮「创建密钥」按钮并展示气泡提示，引导用户点击创建。
 *
 * 进入即消费掉 guide 参数（router.replace，其余 query 保留），
 * 刷新或前进后退不会重复触发引导；未登录时登录守卫以 redirect
 * 携带完整 fullPath，登录后仍能回到带 guide 的链接完成引导。
 */
export function useCreateKeyGuide() {
  const route = useRoute()
  const router = useRouter()
  const active = ref(route.query[CREATE_KEY_GUIDE_QUERY] === CREATE_KEY_GUIDE_VALUE)

  if (active.value) {
    const query = { ...route.query }
    delete query[CREATE_KEY_GUIDE_QUERY]
    void router.replace({ query })
  }

  function dismiss() {
    active.value = false
  }

  return { active, dismiss }
}
