import {getI18n, SupportedLocale} from './i18n'

type MessagesDescriptor = {
  prefix: string
  messages: ReturnType<typeof getI18n>['messages']
}

export const messagesByLocale: Record<SupportedLocale, MessagesDescriptor> = {
  'en-US': {
    prefix: 'en',
    messages: getI18n('en-US').messages
  },
  'de-AT': {
    prefix: 'de',
    messages: getI18n('de-AT').messages
  }
}

export type MessagesByLocale = typeof messagesByLocale
