// 与后端契约对应的类型定义（仅 Dashboard 里程碑所需）

/** 统一返回体 */
export interface ApiResponse<T> {
  code: number
  message?: string
  data: T
}

/** 调用方收到的标准化错误 */
export interface ApiError {
  status?: number
  code?: number | string
  message: string
}

// ==================== 用户 ====================

export interface User {
  id: number
  username: string
  email: string
  /** 账户余额（USD） */
  balance: number
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
}

export interface LoginResponse {
  access_token?: string
  token?: string
  refresh_token?: string
  expires_in?: number
  user?: User
}

/** 注册请求（用户名仅前端用于注册后补充资料，后端由邮箱派生） */
export interface RegisterRequest {
  email: string
  password: string
  verify_code?: string
  invitation_code?: string
  /** 优惠码（选填），有效时注册后赠送对应余额 */
  promo_code?: string
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

export type GroupRates = Record<string, number>

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
  group_id?: number
  expires_in_days?: number
  quota?: number
}

export interface UpdateApiKeyRequest {
  name?: string
  status?: 'active' | 'inactive'
  group_id?: number | null
}

/** 单个密钥的批量用量统计 */
export interface ApiKeyUsageStat {
  api_key_id: number
  today_actual_cost: number
  total_actual_cost: number
}

// ==================== 支付 / 订单 ====================

// 取值与后端 payment.OrderStatus* 保持字面一致（SCREAMING_SNAKE_CASE）
export type OrderStatus = 'PENDING' | 'PAID' | 'COMPLETED' | 'FAILED' | 'REFUNDED'

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
