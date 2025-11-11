import {createHash} from 'crypto'
import {promises as fs} from 'fs'
import path from 'path'

import type {Reporter} from 'gatsby'

import {
  normalizePath as normalizeRoutePath,
  shouldExcludeFromSitemap
} from './path-filters'

const LOCALE_SEGMENT_PATTERN = /^[a-z]{2}(?:-[a-z]{2})?$/i

export type ChangeFrequency =
  | 'always'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'never'

export interface TrackPageTranslation {
  readonly locale?: string | null
  readonly path: string
}

export interface TrackPageInput {
  readonly path: string
  readonly createdAt: Date
  readonly lastModified: Date
  readonly locale?: string | null
  readonly defaultLocale?: string | null
  readonly localePagesId?: string | null
  readonly translations?: ReadonlyArray<TrackPageTranslation>
}

export interface EnsureSitemapManagerOptions {
  readonly siteUrl: string
  readonly publicDirectory: string
  readonly reporter?: Reporter
}

interface AlternateLink {
  readonly hreflang: string
  readonly href: string
}

interface SitemapEntry {
  readonly path: string
  readonly createdAt: Date
  readonly lastModified: Date
  readonly locale: string | null
  readonly defaultLocale: string | null
  readonly localePagesId: string | null
  readonly translations: readonly {locale: string; path: string}[]
}

export class SitemapManager {
  private siteUrl: string
  private publicDirectory: string
  private readonly entries = new Map<string, SitemapEntry>()
  private lastSitemapDigest: string | null = null
  private lastRobotsDigest: string | null = null

  constructor(private options: EnsureSitemapManagerOptions) {
    this.siteUrl = this.normalizeSiteUrl(options.siteUrl)
    this.publicDirectory = options.publicDirectory
  }

  public updateEnvironment(options: EnsureSitemapManagerOptions): void {
    this.options = options
    this.siteUrl = this.normalizeSiteUrl(options.siteUrl)
    this.publicDirectory = options.publicDirectory
  }

  public async trackPage(input: TrackPageInput): Promise<void> {
    const normalizedPath = this.normalizePath(input.path)

    if (this.shouldExclude(normalizedPath)) {
      return
    }

    const existing = this.entries.get(normalizedPath)
    const locale =
      this.normalizeLocale(input.locale) ?? existing?.locale ?? null
    const defaultLocale =
      this.normalizeLocale(input.defaultLocale) ?? existing?.defaultLocale ?? null
    const localePagesId =
      input.localePagesId?.trim() ?? existing?.localePagesId ?? null
    const translations = this.mergeTranslations(
      existing?.translations ?? [],
      this.normalizeTranslations(input.translations)
    )

    const createdAt = existing
      ? new Date(
          Math.min(existing.createdAt.getTime(), input.createdAt.getTime())
        )
      : input.createdAt
    const lastModified = existing
      ? new Date(
          Math.max(existing.lastModified.getTime(), input.lastModified.getTime())
        )
      : input.lastModified

    this.entries.set(normalizedPath, {
      path: normalizedPath,
      createdAt,
      lastModified,
      locale,
      defaultLocale,
      localePagesId,
      translations
    })

    await this.persist()
  }

  private normalizeSiteUrl(siteUrl: string): string {
    const fallback = 'https://page.jaen.io'
    const trimmed = siteUrl?.trim()

    if (!trimmed) {
      return fallback
    }

    const sanitized = trimmed.replace(/\/+$/, '')
    const candidate = sanitized.includes('://') ? sanitized : `https://${sanitized}`

    try {
      const url = new URL(candidate)
      const pathname = url.pathname.replace(/\/+$/, '')

      return `${url.origin}${pathname}`
    } catch (error) {
      this.options.reporter?.warn(
        `[gatsby-source-jaen] Invalid siteUrl "${siteUrl}" provided. Falling back to ${fallback}.`
      )
      return fallback
    }
  }

  private normalizePath(rawPath: string): string {
    return normalizeRoutePath(rawPath)
  }

  private shouldExclude(pathname: string): boolean {
    return shouldExcludeFromSitemap(pathname)
  }

  private async persist(): Promise<void> {
    try {
      await fs.mkdir(this.publicDirectory, {recursive: true})
      await this.writeSitemap()
      await this.writeRobots()
    } catch (error) {
      this.options.reporter?.warn(
        `[gatsby-source-jaen] Failed to persist sitemap files: ${(error as Error).message}`
      )
    }
  }

  private async writeSitemap(): Promise<void> {
    if (this.entries.size === 0) {
      return
    }

    const xml = this.buildSitemapXml()
    const digest = this.createDigest(xml)

    if (digest === this.lastSitemapDigest) {
      return
    }

    const sitemapPath = path.join(this.publicDirectory, 'sitemap.xml')
    await fs.writeFile(sitemapPath, xml, 'utf8')
    this.lastSitemapDigest = digest
  }

  private buildSitemapXml(): string {
    const urls = Array.from(this.entries.values()).sort((a, b) => {
      const priorityDiff = this.computePriority(b.path) - this.computePriority(a.path)

      if (priorityDiff !== 0) {
        return priorityDiff
      }

      return a.path.localeCompare(b.path)
    })

    const urlEntries = urls.map(entry => this.renderUrlEntry(entry)).join('\n')

    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urlEntries}\n</urlset>\n`
  }

  private renderUrlEntry(entry: SitemapEntry): string {
    const location = this.buildLocation(entry.path)
    const lastModified = entry.lastModified.toISOString()
    const changeFrequency = this.computeChangeFrequency(entry)
    const priority = this.computePriority(entry.path).toFixed(2)
    const lines = [
      '  <url>',
      `    <loc>${this.escapeXml(location)}</loc>`,
      `    <lastmod>${lastModified}</lastmod>`,
      `    <changefreq>${changeFrequency}</changefreq>`,
      `    <priority>${priority}</priority>`
    ]

    for (const link of this.buildAlternateLinks(entry)) {
      lines.push(
        `    <xhtml:link rel="alternate" hreflang="${this.escapeXml(link.hreflang)}" href="${this.escapeXml(link.href)}" />`
      )
    }

    lines.push('  </url>')

    return lines.join('\n')
  }

  private buildLocation(pathname: string): string {
    const base = this.siteUrl.replace(/\/+$/, '')

    if (pathname === '/') {
      return `${base}/`
    }

    return `${base}${pathname}`
  }

  private computeChangeFrequency(entry: SitemapEntry): ChangeFrequency {
    if (entry.path === '/') {
      return 'daily'
    }

    const now = Date.now()
    const msInDay = 1000 * 60 * 60 * 24
    const daysSinceUpdate = Math.floor(
      (now - entry.lastModified.getTime()) / msInDay
    )

    if (daysSinceUpdate <= 1) {
      return 'daily'
    }

    if (daysSinceUpdate <= 7) {
      return 'weekly'
    }

    if (daysSinceUpdate <= 30) {
      return 'monthly'
    }

    return 'yearly'
  }

  private computePriority(pathname: string): number {
    if (pathname === '/') {
      return 1
    }

    const depth = pathname.split('/').filter(Boolean).length
    const priority = 1 - depth * 0.15

    return Math.max(0.2, Number(priority.toFixed(2)))
  }

  private buildAlternateLinks(entry: SitemapEntry): AlternateLink[] {
    const localeToPath = new Map<string, string>()
    const addLink = (locale: string | null | undefined, pathname: string) => {
      if (!locale) {
        return
      }

      if (this.shouldExclude(pathname)) {
        return
      }

      localeToPath.set(locale, pathname)
    }

    const primaryLocale =
      entry.locale ?? entry.defaultLocale ?? this.deriveLocaleFromPath(entry.path)

    addLink(primaryLocale, entry.path)

    for (const translation of entry.translations) {
      addLink(translation.locale, translation.path)
    }

    const links: AlternateLink[] = Array.from(localeToPath.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([locale, pathname]) => ({
        hreflang: locale,
        href: this.buildLocation(pathname)
      }))

    const defaultLocalePath = entry.defaultLocale
      ? localeToPath.get(entry.defaultLocale)
      : undefined

    if (entry.defaultLocale && defaultLocalePath) {
      links.push({
        hreflang: 'x-default',
        href: this.buildLocation(defaultLocalePath)
      })
    }

    return links
  }

  private escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }

  private async writeRobots(): Promise<void> {
    const robotsContent = this.buildRobotsContent()
    const digest = this.createDigest(robotsContent)

    if (digest === this.lastRobotsDigest) {
      return
    }

    const robotsPath = path.join(this.publicDirectory, 'robots.txt')
    await fs.writeFile(robotsPath, robotsContent, 'utf8')
    this.lastRobotsDigest = digest
  }

  private buildRobotsContent(): string {
    const agents = [
      '*',
      'Googlebot',
      'Google-Extended',
      'Bingbot',
      'DuckDuckBot',
      'GPTBot',
      'CCBot',
      'ChatGPT-User'
    ]

    const blocks = agents
      .map(agent => [`User-agent: ${agent}`, 'Allow: /', ''])
      .flat()

    const sitemapReference = `Sitemap: ${this.siteUrl.replace(/\/+$/, '')}/sitemap.xml`

    return [...blocks, sitemapReference, ''].join('\n')
  }

  private createDigest(content: string): string {
    return createHash('sha1').update(content).digest('hex')
  }

  private normalizeLocale(locale: string | null | undefined): string | null {
    if (!locale) {
      return null
    }

    const trimmed = locale.trim()

    if (trimmed.length === 0) {
      return null
    }

    const sanitized = trimmed.replace(/_/g, '-')
    const segments = sanitized.split('-')

    if (segments.length === 0) {
      return null
    }

    const [language, ...rest] = segments
    const lowerLanguage = language.toLowerCase()

    if (rest.length === 0) {
      return lowerLanguage
    }

    const region = rest.join('-')

    return `${lowerLanguage}-${region.toUpperCase()}`
  }

  private normalizeTranslations(
    translations: ReadonlyArray<TrackPageTranslation> | undefined
  ): Array<{locale: string; path: string}> {
    if (!translations || translations.length === 0) {
      return []
    }

    const normalized: Array<{locale: string; path: string}> = []

    for (const translation of translations) {
      const locale = this.normalizeLocale(translation.locale)
      const pathname = this.normalizePath(translation.path)

      if (!locale || this.shouldExclude(pathname)) {
        continue
      }

      normalized.push({
        locale,
        path: pathname
      })
    }

    return normalized
  }

  private mergeTranslations(
    existing: readonly {locale: string; path: string}[],
    next: readonly {locale: string; path: string}[]
  ): readonly {locale: string; path: string}[] {
    if (existing.length === 0) {
      return next
    }

    if (next.length === 0) {
      return existing
    }

    const merged = new Map<string, string>()

    for (const translation of existing) {
      merged.set(translation.locale, translation.path)
    }

    for (const translation of next) {
      merged.set(translation.locale, translation.path)
    }

    return Array.from(merged.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([locale, path]) => ({
        locale,
        path
      }))
  }

  private deriveLocaleFromPath(pathname: string): string | null {
    const segments = pathname.split('/').filter(Boolean)

    if (segments.length === 0) {
      return null
    }

    const candidate = segments[0]

    if (!LOCALE_SEGMENT_PATTERN.test(candidate)) {
      return null
    }

    return this.normalizeLocale(candidate)
  }
}

let singleton: SitemapManager | null = null

export const ensureSitemapManager = (
  options: EnsureSitemapManagerOptions
): SitemapManager => {
  if (singleton === null) {
    singleton = new SitemapManager(options)
  } else {
    singleton.updateEnvironment(options)
  }

  return singleton
}
