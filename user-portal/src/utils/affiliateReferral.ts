/**
 * 邀请返利码的落地与回取（与主前端 utils/oauthAffiliate.ts 的 referral 部分同口径）：
 * 用户经 /register?aff=xxx 进站后，把邀请码带 30 天 TTL 存入 localStorage，
 * 之后即使不是本次会话完成注册，提交时仍能回取到邀请码；注册成功后清除。
 */

const AFFILIATE_REFERRAL_CODE_KEY = 'affiliate_referral_code'
const AFFILIATE_REFERRAL_TTL_MS = 30 * 24 * 60 * 60 * 1000

interface StoredAffiliateReferralCode {
  code: string
  expiresAt: number
}

/** 归一化 query 里的邀请码（vue-router query 值可能是数组） */
export function normalizeAffiliateCode(value?: unknown): string {
  const raw = Array.isArray(value) ? value[0] : value
  return typeof raw === 'string' ? raw.trim() : ''
}

/** 从多个候选（?aff= / ?aff_code=）里取第一个非空邀请码 */
export function pickAffiliateCode(...values: unknown[]): string {
  for (const value of values) {
    const code = normalizeAffiliateCode(value)
    if (code) return code
  }
  return ''
}

/** 把邀请码带 TTL 落地 localStorage（空值不落地） */
export function storeAffiliateReferralCode(value?: unknown, now = Date.now()): void {
  const code = normalizeAffiliateCode(value)
  if (!code) return
  try {
    const payload: StoredAffiliateReferralCode = {
      code,
      expiresAt: now + AFFILIATE_REFERRAL_TTL_MS
    }
    localStorage.setItem(AFFILIATE_REFERRAL_CODE_KEY, JSON.stringify(payload))
  } catch {
    // 忽略浏览器存储异常
  }
}

/** 回取未过期的邀请码；过期/损坏时顺手清除并返回空串 */
export function loadAffiliateReferralCode(now = Date.now()): string {
  try {
    const raw = localStorage.getItem(AFFILIATE_REFERRAL_CODE_KEY)
    if (!raw) return ''
    const parsed = JSON.parse(raw) as Partial<StoredAffiliateReferralCode>
    const code = normalizeAffiliateCode(parsed.code)
    const expiresAt = Number(parsed.expiresAt) || 0
    if (!code || expiresAt <= now) {
      clearAffiliateReferralCode()
      return ''
    }
    return code
  } catch {
    return ''
  }
}

/** 清除已落地的邀请码（注册成功后调用） */
export function clearAffiliateReferralCode(): void {
  try {
    localStorage.removeItem(AFFILIATE_REFERRAL_CODE_KEY)
  } catch {
    // 忽略浏览器存储异常
  }
}
