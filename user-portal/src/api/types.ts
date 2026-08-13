// 与后端契约对应的类型定义（仅 Dashboard 里程碑所需）

/** 统一返回体 */
export interface ApiResponse<T> {
  code: number
  message?: string
  /** 字符串错误码（后端 infraerrors 的 Reason，如 INVALID_RESET_TOKEN），供页面识别语义错误 */
  reason?: string
  data: T
}

/** 调用方收到的标准化错误 */
export interface ApiError {
  status?: number
  code?: number | string
  /** 字符串错误码（同 ApiResponse.reason），语义分支优先用它、不要解析 message 文本 */
  reason?: string
  message: string
}

// ==================== 用户 ====================

export interface User {
  id: number
  username: string
  email: string
  /** 账户余额（USD） */
  balance: number
  /**
   * 累计充值总额（USD）。来源：后端 GET /user/profile、/auth/me 返回，充值成功后端累加，
   * 是「累计充值」的权威口径（前端不应再用当前页订单 reduce 出近似值）。
   */
  total_recharged?: number
  /** 并发限制 */
  concurrency?: number
  avatar_url?: string | null
  role?: string
  status?: 'active' | 'disabled'
  created_at?: string
  /** 各登录方式绑定状态 */
  email_bound?: boolean
  linuxdo_bound?: boolean
  dingtalk_bound?: boolean
  oidc_bound?: boolean
  wechat_bound?: boolean
}

// ==================== 鉴权 ====================

export interface LoginRequest {
  email: string
  password: string
  /** Cloudflare Turnstile token（站点开启人机验证时后端强制校验，缺失即拒绝登录） */
  turnstile_token?: string
}

export interface LoginResponse {
  access_token?: string
  token?: string
  refresh_token?: string
  expires_in?: number
  user?: User
  /** 开启 TOTP 2FA 的用户：登录第一步不发 token，只回 temp_token，须再调 /auth/login/2fa */
  requires_2fa?: boolean
  temp_token?: string
  user_email_masked?: string
}

/** 注册请求（用户名仅前端用于注册后补充资料，后端由邮箱派生） */
export interface RegisterRequest {
  email: string
  password: string
  verify_code?: string
  invitation_code?: string
  /** 优惠码（选填），有效时注册后赠送对应余额 */
  promo_code?: string
  /** Cloudflare Turnstile token（站点开启人机验证时后端强制校验，缺失即拒绝注册） */
  turnstile_token?: string
  /** 邀请返利码（选填），来自邀请链接 ?aff=；后端关闭邀请返利时忽略 */
  aff_code?: string
}

/** 忘记密码：请求发送重置邮件 */
export interface ForgotPasswordRequest {
  email: string
  /** Cloudflare Turnstile token（站点开启人机验证时后端强制校验，缺失即拒绝） */
  turnstile_token?: string
}

/** 凭邮件里的一次性 token 重置密码 */
export interface ResetPasswordRequest {
  email: string
  token: string
  new_password: string
}

/** 优惠码校验结果（对齐后端 ValidatePromoCodeResponse） */
export interface ValidatePromoCodeResult {
  valid: boolean
  /** 有效时的赠送金额（USD） */
  bonus_amount?: number
  /** 无效原因错误码，如 PROMO_CODE_NOT_FOUND / PROMO_CODE_EXPIRED 等 */
  error_code?: string
  message?: string
}

/** 邀请码校验结果（对齐后端 ValidateInvitationCodeResponse；后端开启邀请码注册时该码必填） */
export interface ValidateInvitationCodeResult {
  valid: boolean
  /** 无效原因错误码，如 INVITATION_CODE_INVALID / INVITATION_CODE_USED 等 */
  error_code?: string
}

/** 公开站点设置（仅取本前端所需字段） */
export interface PublicSettings {
  registration_enabled: boolean
  email_verify_enabled: boolean
  invitation_code_enabled: boolean
  /** 是否开启优惠码功能（关闭时前端不展示优惠码输入框） */
  promo_code_enabled: boolean
  password_reset_enabled: boolean
  payment_enabled: boolean
  linuxdo_oauth_enabled: boolean
  dingtalk_oauth_enabled?: boolean
  oidc_oauth_enabled: boolean
  oidc_oauth_provider_name: string
  wechat_oauth_enabled: boolean
  site_name: string
  purchase_subscription_enabled?: boolean
  /** 网关 API 基础地址，用于「使用密钥」配置示例 */
  api_base_url?: string
  /** Cloudflare Turnstile 人机验证（开启时登录/注册/发码都必须携带 turnstile_token） */
  turnstile_enabled?: boolean
  turnstile_site_key?: string
  /** 是否开启邀请返利（开启时余额卡展示邀请入口、注册接受 aff_code） */
  affiliate_enabled?: boolean
}

// ==================== 邀请返利 ====================

/** 已邀请用户（对齐后端 GET /user/aff 的 invitees 元素） */
export interface AffiliateInvitee {
  user_id: number
  email: string
  username: string
  created_at?: string
  /** 该用户累计为我产生的返利（USD） */
  total_rebate: number
}

/** 邀请返利详情（对齐后端 GET /user/aff） */
export interface UserAffiliateDetail {
  user_id: number
  aff_code: string
  inviter_id?: number | null
  /** 已邀请人数 */
  aff_count: number
  /** 可转入余额的返利额度（USD） */
  aff_quota: number
  /** 冻结期内暂不可转的返利额度（USD） */
  aff_frozen_quota: number
  /** 历史累计返利额度（USD） */
  aff_history_quota: number
  /** 当前用户作为邀请人时实际生效的返利比例（专属覆盖全局）。0-100。 */
  effective_rebate_rate_percent: number
  invitees: AffiliateInvitee[]
}

/** 返利额度转余额结果（对齐后端 POST /user/aff/transfer） */
export interface AffiliateTransferResponse {
  transferred_quota: number
  balance: number
}

// ==================== API 密钥 ====================

export interface Group {
  id: number
  name: string
  description?: string
  platform?: string
  rate_multiplier?: number
  subscription_type?: string
  /** 是否允许 messages 透传（OpenAI 分组下决定是否展示 Claude Code 配置） */
  allow_messages_dispatch?: boolean
}

export interface ApiKey {
  id: number
  user_id: number
  key: string
  name: string
  group_id: number | null
  status: 'active' | 'inactive' | 'quota_exhausted' | 'expired'
  quota: number
  quota_used: number
  last_used_at: string | null
  expires_at: string | null
  created_at: string
  rate_limit_1d: number
  group?: Group
}

export interface CreateApiKeyRequest {
  name: string
  // 分组必填（与 frontend 语义一致）：无分组的 Key 网关无法确定平台，也生成不了使用配置
  group_id: number
  expires_in_days?: number
  quota?: number
}

export interface UpdateApiKeyRequest {
  name?: string
  status?: 'active' | 'inactive'
  // 分组只允许改绑、不允许清空（与 frontend 语义一致）
  group_id?: number
}

/** 单个密钥的批量用量统计 */
export interface ApiKeyUsageStat {
  api_key_id: number
  today_actual_cost: number
  total_actual_cost: number
}

// ==================== 支付 / 订单 ====================

// 取值与后端 payment.OrderStatus* 保持字面一致（SCREAMING_SNAKE_CASE），全集与 admin 前端 frontend/src/types/payment.ts 对齐
export type OrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'RECHARGING'
  | 'COMPLETED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'FAILED'
  | 'REFUND_REQUESTED'
  | 'REFUNDING'
  | 'REFUND_PENDING'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED'
  | 'REFUND_FAILED'

export interface PaymentOrder {
  id: number
  user_id: number
  amount: number
  pay_amount: number
  fee_rate: number
  currency?: string
  payment_type: string
  out_trade_no: string
  status: OrderStatus
  order_type: 'balance' | 'subscription'
  created_at: string
  expires_at: string
  paid_at?: string
  completed_at?: string
  refund_amount?: number
  refund_reason?: string
  plan_id?: number
  provider_instance_id?: string
}

/** 单个支付方式的限额（对齐后端 service.MethodLimits 的 JSON 序列化） */
export interface MethodLimit {
  payment_type: string
  currency: string
  fee_rate: number
  daily_limit: number
  /** 单笔最低金额（0 = 无下限） */
  single_min: number
  /** 单笔最高金额（0 = 无上限） */
  single_max: number
}

export interface SubscriptionPlan {
  id: number
  group_id: number
  group_platform?: string
  group_name?: string
  rate_multiplier?: number
  daily_limit_usd?: number
  weekly_limit_usd?: number
  monthly_limit_usd?: number
  name: string
  description?: string
  price: number
  original_price?: number
  validity_days: number
  validity_unit?: string
  features?: string[]
}

export interface CheckoutInfoResponse {
  methods: Record<string, MethodLimit>
  /** 全局最低/最高充值金额（管理端配置，下单校验以此为准；0 = 无上限） */
  min_amount: number
  max_amount: number
  /** 各支付方式 per-instance 限额的并集范围（0 = 无限制），仅作兜底 */
  global_min: number
  global_max: number
  plans: SubscriptionPlan[]
  balance_disabled: boolean
  balance_recharge_multiplier: number
  recharge_fee_rate: number
  stripe_publishable_key: string
  alipay_force_qrcode?: boolean
}

export interface CreateOrderRequest {
  amount: number
  payment_type: string
  order_type: 'balance' | 'subscription'
  plan_id?: number
  return_url?: string
  is_mobile?: boolean
}

/**
 * 下单返回。字段与后端 CreateOrderResponse 对齐。
 * 后端 DTO：backend/internal/service/payment_service.go → CreateOrderResponse
 */
export interface CreateOrderResult {
  /** 订单 ID */
  order_id: number
  amount: number
  pay_amount: number
  fee_rate: number
  /** 订单状态（初始为 pending） */
  status: string
  /** 结果类型：order_created / jsapi_ready / oauth_required 等 */
  result_type?: string
  payment_type: string
  out_trade_no: string
  /** 跳转支付 URL（stripe / alipay H5 等） */
  pay_url?: string
  /** 二维码内容（微信扫码 / 支付宝 PC） */
  qr_code?: string
  client_secret?: string
  intent_id?: string
  currency?: string
  country_code?: string
  payment_env?: string
  expires_at: string
  payment_mode?: string
  resume_token?: string
}

// ==================== OAuth 绑定 ====================

export interface BindStartRequest {
  provider: string
  redirect_to?: string
}

export interface BindStartResult {
  authorize_url: string
}

/** 统一登录（OIDC）pending 交换结果：有 access_token 即登录完成；requires_2fa 走两步验证；其余为待人工处理状态 */
export interface OidcPendingExchangeResult {
  access_token?: string
  refresh_token?: string
  redirect?: string
  error?: string
  requires_2fa?: boolean
  temp_token?: string
  user_email_masked?: string
  auth_result?: string
  registration_required?: boolean
  promo_code?: string
}

/** 统一登录（OIDC）无密码开户请求：全新用户凭真实邮箱+三码建号 */
export interface OnboardOidcRequest {
  invitation_code?: string
  promo_code?: string
  aff_code?: string
}

// ==================== 兑换码 ====================

export interface RedeemResult {
  message: string
  type: string
  value: number
  new_balance?: number
  new_concurrency?: number
}

// ==================== Dashboard 统计 ====================

export interface PlatformDashboardStats {
  platform: string
  total_requests: number
  total_tokens: number
  total_actual_cost: number
  today_requests: number
  today_tokens: number
  today_actual_cost: number
}

export interface UserDashboardStats {
  total_api_keys: number
  active_api_keys: number
  total_requests: number
  total_input_tokens: number
  total_output_tokens: number
  total_tokens: number
  total_cost: number
  total_actual_cost: number
  today_requests: number
  today_input_tokens: number
  today_output_tokens: number
  today_tokens: number
  today_cost: number
  today_actual_cost: number
  average_duration_ms: number
  rpm: number
  tpm: number
  by_platform?: PlatformDashboardStats[]
}

export interface TrendParams {
  start_date?: string
  end_date?: string
  granularity?: 'day' | 'hour'
}

export interface TrendDataPoint {
  date: string
  requests: number
  input_tokens: number
  output_tokens: number
  total_tokens: number
  cost: number
  actual_cost: number
}

export interface TrendResponse {
  trend: TrendDataPoint[]
  start_date: string
  end_date: string
  granularity: string
}

export interface ModelStat {
  model: string
  requests: number
  total_tokens: number
  cost: number
  actual_cost: number
}

export interface ModelStatsResponse {
  models: ModelStat[]
  start_date: string
  end_date: string
}

// ==================== 使用记录 ====================

export interface UsageLog {
  id: number
  api_key_id: number
  model: string
  platform?: string
  reasoning_effort?: string | null
  inbound_endpoint?: string | null
  input_tokens: number
  output_tokens: number
  cache_creation_tokens: number
  cache_read_tokens: number
  total_tokens: number
  actual_cost: number
  total_cost: number
  billing_type: number
  stream: boolean
  duration_ms: number | null
  first_token_ms: number | null
  user_agent: string | null
  created_at: string
  api_key?: { id: number; name: string; key: string }
}

// 对应后端 response.PaginatedData：数组键为 items（勿改为 data）
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages?: number
}

// ==================== 公告 ====================

/**
 * 提醒方式。取值与后端 domain.AnnouncementNotifyMode* 逐字一致（小写字面量，
 * 已是既有接口契约，勿改成 SCREAMING_SNAKE_CASE，否则与后端/admin 前端不通）：
 * - silent：静默，只进铃铛列表
 * - popup：登录后强制弹窗，需用户确认
 */
export type AnnouncementNotifyMode = 'silent' | 'popup'

/** 面向普通用户的公告（GET /announcements），read_at 为空即未读 */
export interface UserAnnouncement {
  id: number
  title: string
  content: string
  notify_mode: AnnouncementNotifyMode
  starts_at?: string
  ends_at?: string
  read_at?: string
  created_at: string
  updated_at: string
}

// ==================== 订阅 ====================

/** 订阅所属分组：额度上限来自分组配置（字段对齐后端 dto.Group 中订阅页用到的子集） */
export interface SubscriptionGroup {
  id: number
  name: string
  description?: string
  platform?: string
  rate_multiplier?: number
  daily_limit_usd?: number | null
  weekly_limit_usd?: number | null
  monthly_limit_usd?: number | null
}

/**
 * 订阅状态。取值沿用后端既有契约的小写形式（backend/internal/domain/constants.go），
 * 与「枚举取值 SCREAMING_SNAKE_CASE」的全局规范冲突，但该契约由 backend + frontend + DB 共用，
 * 改动超出本次范围，故前端按现状对齐。
 */
export type SubscriptionStatus = 'active' | 'expired' | 'suspended' | 'revoked'

/** 用户订阅。字段对齐后端 backend/internal/handler/dto/types.go 的 UserSubscription */
export interface UserSubscription {
  id: number
  user_id: number
  group_id: number
  starts_at: string
  expires_at: string
  status: SubscriptionStatus
  daily_window_start: string | null
  weekly_window_start: string | null
  monthly_window_start: string | null
  daily_usage_usd: number
  weekly_usage_usd: number
  monthly_usage_usd: number
  created_at: string
  updated_at: string
  revoked_at?: string | null
  group?: SubscriptionGroup
}
