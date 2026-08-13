/**
 * 简体中文语言包（作为结构基准 / fallback）。
 * 按功能域拆分到各命名空间模块，便于维护与并行编辑。
 */
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

const zhCN = {
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

export default zhCN
/** 语言包结构类型：en-US 据此保证键齐全、结构一致 */
export type MessageSchema = typeof zhCN
