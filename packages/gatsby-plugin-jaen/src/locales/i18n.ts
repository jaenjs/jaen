export type SupportedLocale = 'en-US' | 'de-AT'

type MessageDictionary = Record<string, string>

type I18nDescriptor = {
  messages: MessageDictionary
}

const i18nByLocale: Record<SupportedLocale, I18nDescriptor> = {
  'en-US': {
    messages: {
      language: 'English'
    }
  },
  'de-AT': {
    messages: {
      language: 'Deutsch (Österreich)'
    }
  }
}

export const getI18n = (locale: SupportedLocale): I18nDescriptor => {
  return i18nByLocale[locale]
}

export const supportedLocales = Object.keys(i18nByLocale) as SupportedLocale[]
