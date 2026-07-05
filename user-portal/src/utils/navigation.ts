/**
 * 整页导航收口（浏览器跳转，非 SPA 路由）。
 * 独立成模块的原因：jsdom 的 window.location 不可重定义，直接在组件里写
 * `window.location.href = url` 会让「是否发生了跳转、跳去了哪」完全不可测；
 * 收口成函数后测试 mock 本模块即可断言导航行为。
 */
export function navigateTo(url: string): void {
  window.location.assign(url)
}
