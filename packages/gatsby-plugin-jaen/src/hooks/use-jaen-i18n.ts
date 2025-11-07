import {useAuth} from 'jaen'
import {useEffect, useMemo, useState} from 'react'

import {getI18n} from '../locales'
import type {I18nCode, UnifiedI18n} from '../locales/i18n'

const FALLBACK_LOCALE: I18nCode = 'en-US'

const localePriority = ['preferredLanguage', 'locale', 'language'] as const

type WithLocale = Partial<Record<(typeof localePriority)[number], string>>

export const resolveI18nCode = (value?: string | null): I18nCode => {
  const normalized = (value || '').toLowerCase()

  if (normalized.startsWith('de')) return 'de-AT'
  if (normalized.startsWith('tr')) return 'tr-TR'
  if (normalized.startsWith('ar')) return 'ar-EG'
  return FALLBACK_LOCALE
}

const pickLocale = (source?: WithLocale | null): string | undefined => {
  if (!source) return undefined

  for (const key of localePriority) {
    const candidate = source[key]
    if (candidate) return candidate
  }

  return undefined
}

export const useJaenI18n = (): UnifiedI18n => {
  const auth = useAuth()
  const [browserLocale, setBrowserLocale] = useState<string | undefined>()

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      const languages = Array.isArray(navigator.languages)
        ? navigator.languages
        : [navigator.language]

      setBrowserLocale(languages.find(Boolean))
    }
  }, [])

  const code = useMemo<I18nCode>(() => {
    const authLocale = pickLocale(
      (auth.user?.profile as WithLocale | undefined) ?? undefined
    )

    return resolveI18nCode(authLocale ?? browserLocale)
  }, [auth.user?.profile, browserLocale])

  return useMemo(() => getI18n(code), [code])
}

export const formatI18nMessage = (
  template: string,
  values: Record<string, string | number>
) => {
  return Object.entries(values).reduce((acc, [key, value]) => {
    const pattern = new RegExp(`\\{${key}\\}`, 'g')
    return acc.replace(pattern, String(value))
  }, template)
}
