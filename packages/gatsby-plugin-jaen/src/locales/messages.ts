import {getI18n} from './i18n'

export const messagesByLocale = {
  'en-US': getI18n('en-US').messages,
  'de-AT': getI18n('de-AT').messages
} as const

export type MessagesByLocale = typeof messagesByLocale