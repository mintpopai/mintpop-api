import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { TOKEN_KEY } from '@/api/client'
import { setDocumentTitle } from '@/utils/title'

export const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/dashboard' },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/LoginView.vue'),
    meta: { requiresAuth: false, title: 'nav.login' }
  },
  // 本地注册/找回/重置已收敛到统一认证中心（Logto）：portal 只允许统一登录，
  // 这些旧入口一律重定向到登录页（保留路径避免书签/深链 404）。
  { path: '/register', redirect: '/login' },
  { path: '/forgot-password', redirect: '/login' },
  { path: '/reset-password', redirect: '/login' },
  {
    path: '/legal',
    name: 'Legal',
    component: () => import('@/views/LegalView.vue'),
    meta: { requiresAuth: false, title: 'legal.title' }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { requiresAuth: true, title: 'nav.dashboard' }
  },
  {
    path: '/usage',
    name: 'Usage',
    component: () => import('@/views/UsageView.vue'),
    meta: { requiresAuth: true, title: 'nav.usage' }
  },
  {
    path: '/keys',
    name: 'Keys',
    component: () => import('@/views/KeysView.vue'),
    meta: { requiresAuth: true, title: 'nav.keys' }
  },
  {
    path: '/subscriptions',
    name: 'Subscriptions',
    component: () => import('@/views/SubscriptionsView.vue'),
    meta: { requiresAuth: true, title: 'nav.subscriptions' }
  },
  {
    path: '/pricing',
    name: 'Pricing',
    component: () => import('@/views/PricingView.vue'),
    meta: { requiresAuth: true, title: 'nav.pricing' }
  },
  {
    path: '/recharge',
    name: 'Recharge',
    component: () => import('@/views/RechargeView.vue'),
    meta: { requiresAuth: true, title: 'nav.recharge' }
  },
  {
    path: '/orders',
    name: 'Orders',
    component: () => import('@/views/OrdersView.vue'),
    meta: { requiresAuth: true, title: 'nav.orders' }
  },
  {
    // 跳转型支付的规范回流路径：后端 CanonicalizeReturnURL 只放行 /payment/result，勿改路径
    path: '/payment/result',
    name: 'PaymentReturn',
    component: () => import('@/views/PaymentReturnView.vue'),
    meta: { requiresAuth: true, title: 'nav.paymentResult' }
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('@/views/ProfileView.vue'),
    meta: { requiresAuth: true, title: 'nav.profile' }
  },
  {
    // 邀请返利（站点开启 affiliate_enabled 时经余额卡角标进入；关闭时视图内重定向回仪表盘）
    path: '/invite',
    name: 'Invite',
    component: () => import('@/views/InviteView.vue'),
    meta: { requiresAuth: true, title: 'nav.invite' }
  },
  {
    path: '/docs/:slug?',
    name: 'Docs',
    component: () => import('@/views/DocsView.vue'),
    meta: { requiresAuth: true, title: 'nav.docs' }
  },
  // 站内联系方式页已移除，联系入口改为外链官网联系页（见 PortalLayout / LoginView）；
  // 旧 /contact 深链由兜底路由送回仪表盘。
  {
    // 统一登录（OIDC）回调落点：后端处理完成后 302 到此（成功不带 token；失败 fragment 带 error/message）
    path: '/auth/oidc/callback',
    name: 'OidcCallback',
    component: () => import('@/views/OidcCallbackView.vue'),
    meta: { requiresAuth: false, title: 'nav.oidcCallback' }
  },
  {
    path: '/onboarding',
    name: 'Onboarding',
    component: () => import('@/views/OnboardingView.vue'),
    meta: { requiresAuth: false, title: 'nav.onboarding' }
  },
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  // 带 hash 时滚到对应锚点（留出顶栏高度偏移），否则回到顶部
  scrollBehavior: (to) => (to.hash ? { el: to.hash, top: 96 } : { top: 0 })
})

router.beforeEach((to) => {
  const authed = !!localStorage.getItem(TOKEN_KEY)
  if (to.meta.requiresAuth && !authed) {
    return { name: 'Login', query: { redirect: to.fullPath } }
  }
  if (to.name === 'Login' && authed) {
    return { name: 'Dashboard' }
  }
  return true
})

router.afterEach((to) => {
  // 全部路由都配了 meta.title；setDocumentTitle 的空 key 分支防新增路由漏配时渲染出「MintPop API · MintPop API」
  setDocumentTitle(to.meta.title)
})

export default router
