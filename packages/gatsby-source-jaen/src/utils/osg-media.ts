import crypto from 'crypto'
import {promises as fs} from 'fs'
import path from 'path'

import {Reporter} from 'gatsby'

/**
 * The build stops being a visitor of the storage gateway.
 *
 * Until the gateway went private, a built site pointed its images straight at
 * `https://osg.<host>/storage/<id>` and every visitor fetched them from there:
 * an unauthenticated third host on the critical path of every page, and, once
 * the gateway refuses anonymous reads, a blank image on every page. So the
 * build downloads every file the site's jaen data names, with a machine token,
 * writes it into the site's own static output, and rewrites the data so the
 * published site never mentions the gateway again.
 *
 * See jaen's docs/architecture/private-storage.md, "The build".
 */

/**
 * Hosts that have ever served this estate's media.
 *
 * `osg.snek.at` is the Go service the current gateway replaced. It still
 * answers every historical id and every published patch of every jaen site
 * names it, so a URL written years ago arrives spelled that way and has to be
 * recognised as ours.
 */
export const KNOWN_STORAGE_HOSTS = [
  'osg.snek.at',
  'osg.netsnek.com',
  'osg.jaen.io'
]

/** Where the files live in the built site. One gateway id, one path. */
export const PUBLIC_MEDIA_DIR = 'osg'

/** What the build knows about one downloaded file. */
export interface OsgFile {
  fileId: string
  /** The address the data carried, kept so a second spelling maps to one row. */
  sourceUrl: string
  mimeType: string
  ext: string
  /** Absolute path of the downloaded bytes under the Gatsby cache. */
  cachePath: string
  /** Site-relative path the data is rewritten to, `/osg/<id>.<ext>`. */
  publicPath: string
  size: number
}

/**
 * Every file this build downloaded, by id and by both of its addresses.
 *
 * Module scope, because jaen-data sources the files and jaen-pages and
 * onPostBuild need them afterwards, inside the same Gatsby process. It is
 * cleared at the start of each source run so a `gatsby develop` that re-sources
 * does not accumulate.
 */
const files = new Map<string, OsgFile>()

export const osgFiles = (): OsgFile[] => {
  // By file id, not by object identity: the same file met under two spellings
  // is remembered twice, and copying it twice into the output would be two
  // writes of one path.
  const byId = new Map<string, OsgFile>()

  files.forEach(file => byId.set(file.fileId, file))

  return Array.from(byId.values()).sort((a, b) =>
    a.fileId.localeCompare(b.fileId)
  )
}

export const osgFileFor = (idOrUrl: string): OsgFile | undefined =>
  files.get(idOrUrl)

const remember = (file: OsgFile): void => {
  files.set(file.fileId, file)
  files.set(file.sourceUrl, file)
  files.set(file.publicPath, file)
}

/** The gateway origin this build mints and fetches against. */
export const gatewayOrigin = (storageUrl?: string): string =>
  (storageUrl || 'https://osg.netsnek.com').replace(/\/+$/, '')

/** The file id inside a gateway URL, or null when it is not one of ours. */
export const gatewayFileId = (
  value: string,
  storageUrl?: string
): string | null => {
  if (!/^https?:\/\/[^/]+\/storage\//i.test(value)) return null

  let url: URL

  try {
    url = new URL(value)
  } catch {
    return null
  }

  const origin = gatewayOrigin(storageUrl)
  const isOurs =
    KNOWN_STORAGE_HOSTS.includes(url.hostname) || value.startsWith(`${origin}/`)

  if (!isOurs) return null

  const match = /^\/storage\/(.+)$/.exec(url.pathname)

  return match ? decodeURIComponent(match[1]!) : null
}

/**
 * Every gateway URL anywhere in the data, in the order they were met.
 *
 * The scan is over the raw strings and not over the media nodes, because a
 * media node is not the only carrier: an image field that has only a
 * `defaultValue` and a page's `jaenPageMetadata.image` hold bare gateway URLs
 * too, and those are exactly the ones a visitor's browser would fetch.
 */
const URL_PATTERN = /https?:\/\/[^\s"'<>()]*\/storage\/[^\s"'<>()\\]+/gi

/**
 * The rewrite's own output, read back as the file it names.
 *
 * A published patch is written from the CMS's state, and the CMS's state is
 * the data this build already rewrote, so a site that publishes after a build
 * ships patches whose media are `/osg/<id>.<ext>` and not gateway URLs. If
 * that path were only a path, the file id would be gone from the data
 * forever and the next build could not fetch it. It is not only a path: the
 * name in it is the id, so the mapping is reversible and this whole rewrite
 * is idempotent.
 *
 * The one id shape this cannot read back is one that had to be digested to
 * become a file name (see `safeName`), which is a `git_`/`s3_` id. Nothing in
 * the estate has one: every id ever issued here is a Telegram id, which is
 * base64url and is its own file name.
 */
const LOCAL_PATTERN = new RegExp(
  `(?:https?://[^\\s"'<>()]+)?/${PUBLIC_MEDIA_DIR}/([A-Za-z0-9._-]+?)\\.[A-Za-z0-9]{1,8}\\b`,
  'g'
)

/** File ids named by a path this build's own rewrite wrote earlier. */
export const collectLocalMediaIds = (data: unknown): string[] => {
  const found = new Set<string>()

  const walk = (value: unknown): void => {
    if (typeof value === 'string') {
      // Array.from, not the iterator: this package is compiled to ES5
      // without downlevelIteration, and a `for...of` over an iterator becomes
      // an indexed loop over something that has no length, so the body never
      // runs and the whole scan silently finds nothing.
      for (const match of Array.from(value.matchAll(LOCAL_PATTERN))) {
        const id = match[1]

        if (id && id !== 'index') found.add(id)
      }

      return
    }

    if (Array.isArray(value)) {
      value.forEach(walk)
      return
    }

    if (value && typeof value === 'object') {
      Object.values(value as Record<string, unknown>).forEach(walk)
    }
  }

  walk(data)

  return Array.from(found)
}

export const collectGatewayUrls = (
  data: unknown,
  storageUrl?: string
): string[] => {
  const found = new Set<string>()

  const walk = (value: unknown): void => {
    if (typeof value === 'string') {
      for (const match of value.match(URL_PATTERN) ?? []) {
        // A trailing separator is punctuation of the surrounding text, not
        // part of the id, and an id that really ends in one would have been
        // percent-encoded.
        const url = match.replace(/[.,;:)\]}]+$/, '')

        if (gatewayFileId(url, storageUrl)) found.add(url)
      }

      return
    }

    if (Array.isArray(value)) {
      value.forEach(walk)
      return
    }

    if (value && typeof value === 'object') {
      Object.values(value as Record<string, unknown>).forEach(walk)
    }
  }

  walk(data)

  return Array.from(found)
}

/**
 * Extension for a stored file.
 *
 * Cloudflare Pages picks a response's content type by extension, so a file
 * written without one is served as `application/octet-stream` and an image
 * tag pointing at it renders nothing. The gateway's own content type decides,
 * because a Telegram id carries no file name.
 */
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/svg+xml': '.svg',
  'image/bmp': '.bmp',
  'image/tiff': '.tiff',
  'image/x-icon': '.ico',
  'application/pdf': '.pdf',
  'application/json': '.json',
  'text/plain': '.txt',
  'video/mp4': '.mp4',
  'video/webm': '.webm'
}

const extensionFor = (mimeType: string): string =>
  EXTENSIONS[mimeType.toLowerCase().split(';')[0]!.trim()] ?? '.bin'

/**
 * A file name that survives a file system and a URL path.
 *
 * A Telegram id is base64url and safe as it stands, but a `git_` id is a hash
 * with a path in it and an s3 key may be anything at all, so anything outside
 * the safe set becomes its own digest. Deterministic either way: one gateway
 * id maps to exactly one site path, on this build and on the next one.
 */
const safeName = (fileId: string): string =>
  /^[A-Za-z0-9._-]{1,120}$/.test(fileId)
    ? fileId
    : crypto.createHash('sha256').update(fileId).digest('hex').slice(0, 40)

/** The Authorization header for the gateway, or nothing when there is no token. */
export const osgAuthHeaders = (): Record<string, string> => {
  const token = process.env['OSG_TOKEN']

  return token
    ? {
        Authorization: `Bearer ${token}`,
        // The Worker sits behind Cloudflare and answers a default agent with
        // 403 (memory note osg-storage-gateway), so the build names itself.
        'User-Agent': 'gatsby-source-jaen'
      }
    : {}
}

/**
 * The one message a build without the credential ends on.
 *
 * Not a warning and not a blank image: a site that silently ships without its
 * pictures looks like a content problem and is a missing secret. The build
 * stops on the first file it cannot ask for.
 */
export const MISSING_TOKEN_MESSAGE =
  'OSG_TOKEN is required to fetch media from the storage gateway.\n' +
  '\n' +
  "This site's jaen data names files on the storage gateway, and the gateway\n" +
  'is private: every read carries a Zitadel token. Set OSG_TOKEN to the\n' +
  "personal access token of this organisation's storage machine user.\n" +
  '\n' +
  '  GitHub Actions: the repository secret OSG_TOKEN, passed into the build.\n' +
  '  Locally:        ~/.config/jaen/osg.env, which scripts/deploy.sh sources.\n' +
  '\n' +
  'See jaen docs/architecture/private-storage.md, "The build".'

/**
 * Downloads every gateway file the data names into the Gatsby cache.
 *
 * The bytes stay in the cache rather than going straight into `public`,
 * because `public` is emptied while the build is still sourcing; onPostBuild
 * copies them out at the end.
 */
export const fetchGatewayFiles = async (options: {
  data: unknown
  cacheDir: string
  storageUrl?: string
  reporter: Reporter
}): Promise<OsgFile[]> => {
  const {data, cacheDir, storageUrl, reporter} = options

  files.clear()

  const urls = collectGatewayUrls(data, storageUrl)
  const localIds = collectLocalMediaIds(data)

  if (urls.length === 0 && localIds.length === 0) return []

  if (!process.env['OSG_TOKEN']) {
    reporter.panic(MISSING_TOKEN_MESSAGE)

    // panic ends the process, and the throw is the belt to that brace: this
    // must never fall through to a build that ships with blank images.
    throw new Error(MISSING_TOKEN_MESSAGE)
  }

  const mediaDir = path.join(cacheDir, 'jaen-osg')

  await fs.mkdir(mediaDir, {recursive: true})

  const origin = gatewayOrigin(storageUrl)
  const headers = osgAuthHeaders()

  let downloaded = 0
  let reused = 0

  // The gateway URLs first, then the ids a previous build's rewrite left
  // behind: a file named both ways is downloaded once and both spellings map
  // onto the one path.
  const wanted: Array<{sourceUrl: string; fileId: string}> = [
    ...urls.flatMap(sourceUrl => {
      const fileId = gatewayFileId(sourceUrl, storageUrl)

      return fileId ? [{sourceUrl, fileId}] : []
    }),
    ...localIds.map(fileId => ({
      sourceUrl: `${origin}/storage/${fileId}`,
      fileId
    }))
  ]

  for (const {sourceUrl, fileId} of wanted) {
    const known = files.get(fileId)

    if (known) {
      // The same file under its second spelling: one download, two addresses
      // that rewrite onto one path.
      remember({...known, sourceUrl})
      reused++
      continue
    }

    // Always through this build's own gateway origin, never through the host
    // the data happens to name: osg.snek.at is the open door this whole design
    // is closing, and a build must not be the thing that keeps using it.
    const requestUrl = `${origin}/storage/${encodeURIComponent(fileId)}`

    let response: Response

    try {
      response = await fetch(requestUrl, {headers})
    } catch (error) {
      reporter.panic(
        `storage gateway unreachable for ${fileId}: ${String(error)}`
      )

      return osgFiles()
    }

    if (response.status === 401 || response.status === 403) {
      reporter.panic(
        `storage gateway answered ${response.status} for ${fileId}.\n` +
          'OSG_TOKEN is set but is not a token of the organisation that owns ' +
          'this file, or it does not hold storage:read.'
      )

      return osgFiles()
    }

    if (!response.ok) {
      reporter.panic(
        `storage gateway answered ${response.status} for ${fileId} (${sourceUrl})`
      )

      return osgFiles()
    }

    const mimeType = (
      response.headers.get('content-type') || 'application/octet-stream'
    )
      .split(';')[0]!
      .trim()
    const ext = extensionFor(mimeType)
    const name = `${safeName(fileId)}${ext}`
    const cachePath = path.join(mediaDir, name)
    const bytes = Buffer.from(await response.arrayBuffer())

    await fs.writeFile(cachePath, bytes)

    downloaded++

    remember({
      fileId,
      sourceUrl,
      mimeType,
      ext,
      cachePath,
      publicPath: `/${PUBLIC_MEDIA_DIR}/${name}`,
      size: bytes.byteLength
    })
  }

  reporter.info(
    `jaen media: ${downloaded} file(s) fetched from ${origin}` +
      (reused ? `, ${reused} reused` : '')
  )

  return osgFiles()
}

/**
 * Rewrites every gateway URL in the data onto this site's own origin.
 *
 * A rewrite over the data rather than a change in one component, because the
 * URLs sit inside published patch payloads that are immutable history:
 * `MediaNode.url`, an image field carrying only a `defaultValue`, and
 * `jaenPageMetadata.image`.
 *
 * `jaenPageMetadata.image` becomes absolute. It is what OpenGraph serves to
 * crawlers, and a crawler resolves a relative path against nothing.
 */
export const rewriteGatewayUrls = (
  data: unknown,
  options: {storageUrl?: string; siteUrl?: string}
): number => {
  const {storageUrl, siteUrl} = options

  let rewritten = 0

  const replaceIn = (value: string, absolute: boolean): string => {
    const target = (file: OsgFile): string =>
      absolute && siteUrl ? `${siteUrl}${file.publicPath}` : file.publicPath

    const withGatewayUrls = value.replace(URL_PATTERN, match => {
      const trailing = /[.,;:)\]}]+$/.exec(match)?.[0] ?? ''
      const url = trailing ? match.slice(0, -trailing.length) : match
      const file = files.get(url)

      if (!file) return match

      rewritten++

      return `${target(file)}${trailing}`
    })

    // A path a previous build's rewrite wrote is left as it is, except for
    // the one place that has to be absolute: `jaenPageMetadata.image` is what
    // OpenGraph hands a crawler, and a crawler resolves a relative path
    // against nothing.
    if (!absolute || !siteUrl) return withGatewayUrls

    return withGatewayUrls.replace(LOCAL_PATTERN, (match, id: string) => {
      if (match.startsWith('http')) return match

      const file = files.get(id)

      if (!file) return match

      rewritten++

      return `${siteUrl}${file.publicPath}`
    })
  }

  const walk = (value: unknown, parentKey?: string, key?: string): unknown => {
    if (typeof value === 'string') {
      return replaceIn(
        value,
        parentKey === 'jaenPageMetadata' && key === 'image'
      )
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        value[index] = walk(item, parentKey, key)
      })

      return value
    }

    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>

      for (const childKey of Object.keys(record)) {
        record[childKey] = walk(record[childKey], key, childKey)
      }

      return record
    }

    return value
  }

  walk(data)

  return rewritten
}
