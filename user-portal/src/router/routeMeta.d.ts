// vue-router 官方推荐的 meta 字段类型化方式（声明合并，见官方文档 “Typing the meta field”）：
// 全仓 to.meta.* 访问免手写 as 断言，新增路由漏配/拼错字段名时编译期即可发现。
export {}

declare module 'vue-router' {
  interface RouteMeta {
    /** 是否需要登录（路由守卫消费；公开页显式写 false，见 router/index.ts） */
    requiresAuth?: boolean
    /** 浏览器标签标题的 i18n key（setDocumentTitle 消费；空缺时只显示站点名） */
    title?: string
    /** 内容区占满全宽（PortalLayout 消费；供文档中心这类「侧栏贴左 + 正文自行限宽」的页面用） */
    fluid?: boolean
  }
}
