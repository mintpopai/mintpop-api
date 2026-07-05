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
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/RegisterView.vue'),
    meta: { requiresAuth: false, title: 'nav.register' }
  },
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
    path: '/docs/:slug?',
    name: 'Docs',
    component: () => import('@/views/DocsView.vue'),
    meta: { requiresAuth: true, title: 'nav.docs' }
  },
  {
    path: '/contact',
    name: 'Contact',
    component: () => import('@/views/ContactView.vue'),
    meta: { requiresAuth: true, title: 'nav.contact' }
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
  if ((to.name === 'Login' || to.name === 'Register') && authed) {
    return { name: 'Dashboard' }
  }
  return true
})

router.afterEach((to) => {
  // 全部路由都配了 meta.title；setDocumentTitle 的空 key 分支防新增路由漏配时渲染出「MintPop API · MintPop API」
  setDocumentTitle(to.meta.title)
})

export default router
