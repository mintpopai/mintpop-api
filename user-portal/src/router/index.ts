import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { TOKEN_KEY } from '@/api/client'
import { setDocumentTitle } from '@/utils/title'
import PortalLayout from '@/layouts/PortalLayout.vue'

// 门户内页统一挂在 PortalLayout 这层父路由下（嵌套路由 + 持久布局）：
// 顶栏/用户菜单/公告铃铛只挂载一次，切 tab 只换 <router-view> 里的内容区，
// 不再整壳重建（避免顶栏闪烁与每次切换重复拉 user/announcements）。
// 布局本身故意「不」懒加载：它是登录后第一屏必现的外壳，随主 chunk 一起到位，
// 点 tab 时只需下载目标视图那一个 chunk。
const portalChildren: RouteRecordRaw[] = [
  {
    path: 'dashboard',
    name: 'Dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { requiresAuth: true, title: 'nav.dashboard' }
  },
  {
    path: 'usage',
    name: 'Usage',
    component: () => import('@/views/UsageView.vue'),
    meta: { requiresAuth: true, title: 'nav.usage' }
  },
  {
    path: 'keys',
    name: 'Keys',
    component: () => import('@/views/KeysView.vue'),
    meta: { requiresAuth: true, title: 'nav.keys' }
  },
  {
    path: 'subscriptions',
    name: 'Subscriptions',
    component: () => import('@/views/SubscriptionsView.vue'),
    meta: { requiresAuth: true, title: 'nav.subscriptions' }
  },
  {
    path: 'pricing',
    name: 'Pricing',
    component: () => import('@/views/PricingView.vue'),
    meta: { requiresAuth: true, title: 'nav.pricing' }
  },
  {
    path: 'recharge',
    name: 'Recharge',
    component: () => import('@/views/RechargeView.vue'),
    meta: { requiresAuth: true, title: 'nav.recharge' }
  },
  {
    path: 'orders',
    name: 'Orders',
    component: () => import('@/views/OrdersView.vue'),
    meta: { requiresAuth: true, title: 'nav.orders' }
  },
  {
    // 跳转型支付的规范回流路径：后端 CanonicalizeReturnURL 只放行 /payment/result，勿改路径
    path: 'payment/result',
    name: 'PaymentReturn',
    component: () => import('@/views/PaymentReturnView.vue'),
    meta: { requiresAuth: true, title: 'nav.paymentResult' }
  },
  {
    path: 'profile',
    name: 'Profile',
    component: () => import('@/views/ProfileView.vue'),
    meta: { requiresAuth: true, title: 'nav.profile' }
  },
  {
    // 邀请返利（站点开启 affiliate_enabled 时经余额卡角标进入；关闭时视图内重定向回仪表盘）
    path: 'invite',
    name: 'Invite',
    component: () => import('@/views/InviteView.vue'),
    meta: { requiresAuth: true, title: 'nav.invite' }
  },
  {
    // fluid：文档中心自行处理限宽（侧栏贴左），布局层不再套 max-width 容器
    path: 'docs/:slug?',
    name: 'Docs',
    component: () => import('@/views/DocsView.vue'),
    meta: { requiresAuth: true, title: 'nav.docs', fluid: true }
  }
]

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: PortalLayout,
    children: [{ path: '', redirect: '/dashboard' }, ...portalChildren]
  },
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
  // 门户内页的滚动容器是 PortalLayout 的 <main>（不是 window），故内页滚动重置由布局自己做
  // （见 PortalLayout 的 resetScroll）；这里只管非门户页（登录/条款等 window 滚动的整页）。
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
