import type { PublicSettings } from '@/api/types'

/**
 * 文档模板占位符：md 原文里用 {{名字}} 引用，DocsView 渲染前注入运行时值。
 * BASE_URL 因部署环境而异（由后端公开设置下发），无法在构建期写死，故走运行时替换；
 * 新增占位符时在 docPlaceholderValues 里补一项即可（守护测试会拦截文档里出现未知占位符）。
 */
export function docPlaceholderValues(settings: PublicSettings | null): Record<string, string> {
  // 与 UseKeyModal 的取值口径一致：设置缺 api_base_url 时回退当前站点 origin
  const baseUrl = settings?.api_base_url || window.location.origin
  return {
    // 注入发生在 markdown 渲染前，且 markdown-it 开着 html:true；api_base_url 是管理员在后台
    // 自由填写的字符串（非受控输入），直接拼进原文会被当 HTML 解析，故先 encodeURI 无害化。
    // encodeURI 只转义 <>"{}|\^` 与空白等危险字符，保留 : / ? # 等 URL 合法字符，不破坏正常地址。
    BASE_URL: encodeURI(baseUrl),
    // 注册页地址：中文文档用 {{注册链接}}，英文文档用 {{SIGNUP_URL}}，取值相同
    注册链接: `${window.location.origin}/register`,
    SIGNUP_URL: `${window.location.origin}/register`
  }
}

/** 替换 src 中的 {{占位符}}；未知占位符原样保留（正式文档不该有，由守护测试保证） */
export function resolveDocPlaceholders(src: string, values: Record<string, string>): string {
  return src.replace(/\{\{([^{}]+)\}\}/g, (match, name: string) => values[name.trim()] ?? match)
}
