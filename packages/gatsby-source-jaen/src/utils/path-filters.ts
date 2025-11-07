// src/utils/path-filters.ts

const EXCLUDED_PATH_PREFIXES: readonly string[] = [
  '/dev-404-page',
  '/404',
  '/404.html',
  '/500',
  '/offline-plugin-app-shell-fallback',
  '/__'
]

type SystemSegment =
  | '404'
  | '404.html'
  | '500'
  | 'cms'
  | 'login'
  | 'logout'
  | 'mailpress'
  | 'password_reset'
  | 'settings'
  | 'signup'

const SYSTEM_SEGMENTS = new Set<SystemSegment>([
  '404',
  '404.html',
  '500',
  'cms',
  'login',
  'logout',
  'mailpress',
  'password_reset',
  'settings',
  'signup'
])

const LOCALE_SEGMENT_PATTERN = /^[a-z]{2}(?:-[a-z]{2})?$/i

const splitSegments = (pathname: string): string[] =>
  pathname
    .split('/')
    .map(segment => segment.trim())
    .filter(Boolean)

const hasDynamicMarker = (segment: string): boolean =>
  segment.includes('[') || segment.includes(']')

export const normalizePath = (rawPath: string): string => {
  const trimmed = rawPath.trim()
  if (trimmed.length === 0 || trimmed === '/') return '/'

  const withoutTrailing = trimmed.replace(/\/+$/, '')
  return withoutTrailing.startsWith('/') ? withoutTrailing : `/${withoutTrailing}`
}

export const shouldExcludeFromSitemap = (pathname: string): boolean => {
  if (
    EXCLUDED_PATH_PREFIXES.some(prefix => {
      return pathname === prefix || pathname.startsWith(`${prefix}/`)
    })
  ) {
    return true
  }

  const segments = splitSegments(pathname)
  if (segments.length === 0) return false

  return segments.some(segment => {
    const normalized = segment.toLowerCase()
    if (SYSTEM_SEGMENTS.has(normalized as SystemSegment)) return true
    if (normalized.startsWith('__')) return true
    if (hasDynamicMarker(normalized)) return true
    return false
  })
}

export const shouldSkipPageCreation = (pathname: string): boolean => {
  const segments = splitSegments(pathname)

  // e.g. "/", "/about" → not localized → don't skip
  if (segments.length <= 1) return false

  const [maybeLocale, ...rest] = segments

  // ✅ Guard against undefined to satisfy TS and runtime
  if (!maybeLocale || !LOCALE_SEGMENT_PATTERN.test(maybeLocale)) {
    return false
  }

  // We are inside a locale-prefixed path → check remaining segments for system/dynamic markers
  return rest.some(segment => {
    const normalized = segment.toLowerCase()
    if (SYSTEM_SEGMENTS.has(normalized as SystemSegment)) return true
    if (hasDynamicMarker(normalized)) return true
    return false
  })
}
