/** 组装 CSV 文本（转义 + 公式注入防护）。独立导出以便单测；下载走 downloadCsv */
export function toCsvContent(headers: string[], rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    let s = String(v ?? '')
    // 防 CSV 公式注入：字符串以 = + - @ 开头会被 Excel/WPS 当公式执行（如用户把 key 命名为
    // "=CMD(...)"），前置单引号使其成为纯文本；数字不处理，负数金额不受影响
    if (typeof v === 'string' && /^[=+\-@]/.test(s)) s = `'${s}`
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers, ...rows].map((r) => r.map(esc).join(',')).join('\n')
}

/** 生成带 UTF-8 BOM 的 CSV 并触发下载（中文不乱码） */
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  // BOM 用显式转义写法（字面 BOM 字符肉眼不可见，易被编辑器/格式化误删）
  const blob = new Blob(['\uFEFF' + toCsvContent(headers, rows)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
