// src/utils/path-filters.ts

/**
 * Local helpers to normalize paths and decide whether to exclude them from the sitemap.
 * This file intentionally does not import anything from `gatsby-plugin-sitemap`.
 */

const stripTrailingSlash = (p: string) =>
  p !== '/' ? p.replace(/\/+$/, '') : '/'

/** Normalize a route/path to leading slash, no duplicate slashes, and no trailing slash (except for root). */
export const normalizePath = (raw: string): string => {
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`
  const collapsed = withSlash.replace(/\/{2,}/g, '/')
  return stripTrailingSlash(collapsed)
}

/** Simple predicate for URLs that should never land in the sitemap. Extend as you like. */
export const shouldExcludeFromSitemap = (pathname: string): boolean => {
  const p = normalizePath(pathname)

  // Gatsby dev/system pages
  if (
    p === '/dev-404-page' ||
    p === '/404' ||
    p === '/404.html' ||
    p === '/offline-plugin-app-shell-fallback' ||
    p.startsWith('/__') ||
    p.startsWith('/plugins') ||
    p.startsWith('/page-data') ||
    p.startsWith('/static') ||
    p.startsWith('/graphql')
  ) {
    return true
  }

  // Add any of your own rules here (examples):
  // if (p.startsWith('/draft')) return true
  // if (p.includes('?')) return true

  return false
}
