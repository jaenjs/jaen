import {messagesByLocale} from './messages'

export type I18nCode = 'en-US' | 'de-AT' | 'tr-TR' | 'ar-EG'

export interface UnifiedI18n {
  code: I18nCode
  // Flat messages consumed by <IntlProvider messages={...}>
  // Includes merged string keys + every other top-level field from homepage/contact/booking.
  messages: Record<string, any>
}

const strip = <T extends Record<string, any>>(obj: T, keys: string[]) => {
  const out: Record<string, any> = {}
  for (const k in obj) if (!keys.includes(k)) out[k] = obj[k]
  return out
}

/**
 * Collect everything from homepage.*, contact.*, booking.* into one flat `messages` object.
 * - Merges all `*.strings` into top-level id:value pairs
 * - Adds all other top-level fields generically (no hardcoded sub-keys)
 */
export function getI18n(code: I18nCode): UnifiedI18n {
  const jaen = messagesByLocale("de-AT")

  const messages: Record<string, any> = {
    // flat string IDs first
    ...(jaen?.strings ?? {}),

    // then all other top-level fields (no hardcoding), excluding `code` and `strings`
    ...strip(jaen || {}, ['code', 'strings']),
  }

  return {
    code,
    messages
  }
}