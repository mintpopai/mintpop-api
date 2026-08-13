/**
 * 英文语言包。结构必须与 zh-CN 完全一致（用 MessageSchema 约束，缺键/多键会编译报错）。
 */
import type { MessageSchema } from '../zh-CN'
import common from './common'
import nav from './nav'
import auth from './auth'
import dashboard from './dashboard'
import keys from './keys'
import usage from './usage'
import recharge from './recharge'
import orders from './orders'
import profile from './profile'
import payment from './payment'
import pricing from './pricing'
import ui from './ui'
import legal from './legal'
import invite from './invite'
import docs from './docs'
import announcements from './announcements'
import subscriptions from './subscriptions'

const enUS: MessageSchema = {
  common,
  nav,
  auth,
  dashboard,
  keys,
  usage,
  recharge,
  subscriptions,
  orders,
  profile,
  payment,
  pricing,
  ui,
  legal,
  invite,
  docs,
  announcements
}

export default enUS
