import path from 'path'

export interface JaenSourcePluginLocaleOption {
  readonly locale: string
  readonly prefix?: string | null
}

// Make it satisfy Gatsby's GatsbyNode<T extends Record<string, unknown>>
export interface JaenSourcePluginOptions extends Record<string, unknown> {
  readonly defaultLocale?: string | null
  readonly locales?: readonly JaenSourcePluginLocaleOption[] | null
  readonly siteUrl?: string | null
}

export interface ResolvedLocaleDefinition {
  readonly locale: string
  readonly prefix: string
}

export interface ResolvedJaenSourcePluginOptions {
  readonly defaultLocale: string | null
  readonly locales: readonly ResolvedLocaleDefinition[]
  readonly localeMap: ReadonlyMap<string, ResolvedLocaleDefinition>
  readonly siteUrl: string
  readonly publicDirectory: string
}

const derivePrefix = (locale: string): string => {
  const trimmed = locale.trim()

  if (!trimmed) {
    return ''
  }

  const [language] = trimmed.split('-')

  return language.toLowerCase()
}

const normalizePrefix = (prefix?: string | null): string => {
  if (prefix == null) {
    return ''
  }

  const trimmed = prefix.trim().replace(/^\/+|\/+$/g, '')

  return trimmed
}

const sanitizeLocale = (locale?: string | null): string | null => {
  if (locale == null) {
    return null
  }

  const trimmed = locale.trim()

  return trimmed ? trimmed : null
}

const ensureSiteUrl = (siteUrl?: string | null): string => {
  const candidate =
    siteUrl ?? process.env.GATSBY_SITE_URL ?? process.env.SITE_URL

  const fallback = 'https://page.jaen.io'

  if (!candidate) {
    return fallback
  }

  try {
    const normalized = candidate.trim()

    const withProtocol = normalized.includes('://')
      ? normalized
      : `https://${normalized}`

    const url = new URL(withProtocol)

    const pathname = url.pathname.replace(/\/+$/, '')

    return `${url.origin}${pathname}`
  } catch {
    return fallback
  }
}

const ensureLocales = (
  locales: readonly JaenSourcePluginLocaleOption[] | null | undefined
): ResolvedLocaleDefinition[] => {
  if (!locales || locales.length === 0) {
    return []
  }

  const resolved: ResolvedLocaleDefinition[] = []
  const seen = new Set<string>()

  for (const localeOption of locales) {
    const normalizedLocale = sanitizeLocale(localeOption?.locale)

    if (!normalizedLocale || seen.has(normalizedLocale)) {
      continue
    }

    const prefix =
      normalizePrefix(localeOption?.prefix) || derivePrefix(normalizedLocale)

    resolved.push({
      locale: normalizedLocale,
      prefix
    })

    seen.add(normalizedLocale)
  }

  return resolved
}

export const resolvePluginOptions = (
  options?: JaenSourcePluginOptions | null
): ResolvedJaenSourcePluginOptions => {
  const locales = ensureLocales(options?.locales ?? null)

  const providedDefault = sanitizeLocale(options?.defaultLocale)

  const defaultLocale =
    providedDefault ?? (locales.length > 0 ? locales[0]?.locale ?? null : null)

  if (defaultLocale && !locales.find(locale => locale.locale === defaultLocale)) {
    locales.unshift({
      locale: defaultLocale,
      prefix: derivePrefix(defaultLocale)
    })
  }

  const localeMap = new Map<string, ResolvedLocaleDefinition>()

  for (const locale of locales) {
    localeMap.set(locale.locale, locale)
  }

  return {
    defaultLocale,
    locales,
    localeMap,
    siteUrl: ensureSiteUrl(options?.siteUrl),
    publicDirectory: path.join(process.cwd(), 'public')
  }
}

/**
 * Accept whatever Gatsby passes (often typed as PluginOptions) and resolve.
 * This avoids generic type mismatches in Gatsby's API signatures.
 */
export const withResolvedOptions = (
  options: unknown
): ResolvedJaenSourcePluginOptions => {
  return resolvePluginOptions(options as JaenSourcePluginOptions)
}
