import i18n from '@/i18n'

/** 把图片文件压缩到 ≤maxBytes（缩放×质量双重降档），返回 WebP（不支持时 JPEG）data URL */
export async function compressToDataUrl(file: File, maxBytes = 20480): Promise<string> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result))
    r.onerror = rej
    r.readAsDataURL(file)
  })
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = rej
    i.src = dataUrl
  })
  const scales = [1, 0.92, 0.84, 0.72, 0.6, 0.5, 0.4]
  const qualities = [0.92, 0.84, 0.72, 0.6, 0.5, 0.4]
  // Safari 不支持导出 WebP（toDataURL 静默回退成无损 PNG，体积必超限、逐档全败），
  // 先探测一次，不支持就降级 JPEG（同为有损压缩、全浏览器可导出）
  const mime = document.createElement('canvas').toDataURL('image/webp').startsWith('data:image/webp')
    ? 'image/webp'
    : 'image/jpeg'
  for (const sc of scales) {
    const cv = document.createElement('canvas')
    cv.width = Math.max(1, Math.round(img.width * sc))
    cv.height = Math.max(1, Math.round(img.height * sc))
    cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height)
    for (const q of qualities) {
      const out = cv.toDataURL(mime, q)
      // base64 长度 ≈ 字节×4/3
      if (out.length * 0.75 <= maxBytes) return out
    }
  }
  throw new Error(i18n.global.t('profile.form.imageTooLarge'))
}
