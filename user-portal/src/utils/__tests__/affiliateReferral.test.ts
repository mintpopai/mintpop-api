import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearAffiliateReferralCode,
  loadAffiliateReferralCode,
  normalizeAffiliateCode,
  pickAffiliateCode,
  storeAffiliateReferralCode
} from '../affiliateReferral'

const KEY = 'affiliate_referral_code'
const TTL_MS = 30 * 24 * 60 * 60 * 1000

describe('affiliateReferral', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('normalizeAffiliateCode：字符串去空白，数组取首个，非字符串归空', () => {
    expect(normalizeAffiliateCode('  ABC ')).toBe('ABC')
    expect(normalizeAffiliateCode(['X', 'Y'])).toBe('X')
    expect(normalizeAffiliateCode(undefined)).toBe('')
    expect(normalizeAffiliateCode(123)).toBe('')
  })

  it('pickAffiliateCode：取第一个非空候选（?aff= 优先于 ?aff_code=）', () => {
    expect(pickAffiliateCode('', 'FALLBACK')).toBe('FALLBACK')
    expect(pickAffiliateCode('MAIN', 'FALLBACK')).toBe('MAIN')
    expect(pickAffiliateCode(undefined, undefined)).toBe('')
  })

  it('store + load：TTL 内可回取，空值不落地', () => {
    storeAffiliateReferralCode('CODE1', 1000)
    expect(loadAffiliateReferralCode(1000 + TTL_MS - 1)).toBe('CODE1')
    clearAffiliateReferralCode()
    storeAffiliateReferralCode('   ', 1000)
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('load：过期即清除并返回空串', () => {
    storeAffiliateReferralCode('CODE2', 1000)
    expect(loadAffiliateReferralCode(1000 + TTL_MS)).toBe('')
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('load：损坏的存储值返回空串且不抛错', () => {
    localStorage.setItem(KEY, '{not-json')
    expect(loadAffiliateReferralCode()).toBe('')
  })

  it('clear：清除后回取为空', () => {
    storeAffiliateReferralCode('CODE3')
    clearAffiliateReferralCode()
    expect(loadAffiliateReferralCode()).toBe('')
  })
})
