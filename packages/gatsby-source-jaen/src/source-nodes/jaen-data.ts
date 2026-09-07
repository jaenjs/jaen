import {JaenPage, JaenSite, Widget} from 'jaen'
import deepmerge from 'deepmerge'
import fs from 'fs/promises' // Import the fs module for asynchronous file operations
import path from 'path'
import {SourceNodesArgs} from 'gatsby'
import {deepmergeArrayIdMerge} from '../utils/deepmerge'

import {fetchWithCache} from '../utils/fetch-with-cache'
import {
  fetchGatewayFiles,
  gatewayFileId,
  osgAuthHeaders,
  rewriteGatewayUrls
} from '../utils/osg-media'
import {
  siteUrlFromPluginOptions,
  storageUrlFromPluginOptions
} from '../utils/plugin-options'

export type JaenData = {
  pages?: JaenPage[]
  site?: JaenSite
  widgets?: Widget[]
  patches?: any
}

/**
 * The publish flow has shipped patches where a Boolean flag arrives as the
 * raw checkbox value: `excludedFromIndex: "on"`. The GraphQL schema declares
 * the field Boolean, so a single such patch kills the whole build with
 * "Boolean cannot represent a non boolean value". Coerce the known checkbox
 * spellings on every page entry (and its nested childPages) before merging;
 * anything else passes through untouched so a genuinely wrong type still
 * surfaces.
 */
const coerceCheckboxBoolean = (value: unknown): unknown => {
  if (value === 'on' || value === 'true') return true
  if (value === 'off' || value === 'false' || value === '') return false
  return value
}

const normalizeCheckboxBooleans = (data: JaenData | undefined): void => {
  const walkPages = (pages: unknown): void => {
    if (!Array.isArray(pages)) return
    for (const page of pages) {
      if (typeof page !== 'object' || page === null) continue
      const p = page as Record<string, unknown>
      if ('excludedFromIndex' in p) {
        p['excludedFromIndex'] = coerceCheckboxBoolean(p['excludedFromIndex'])
      }
      walkPages(p['childPages'])
    }
  }
  walkPages(data?.pages)
}

export const sourceNodes = async (
  args: SourceNodesArgs,
  pluginOptions?: unknown
) => {
  const {actions, createNodeId, createContentDigest, reporter, cache} = args
  const {createNode} = actions

  const storageUrl = storageUrlFromPluginOptions(pluginOptions)
  const siteUrl = siteUrlFromPluginOptions(pluginOptions)

  // Log a message using the reporter
  reporter.info('Fetching and sourcing nodes...')

  try {
    // 1. Read data from ./jaen-data/patches.txt
    const buffer = await fs.readFile(`${process.cwd()}/jaen-data/patches.txt`)

    // 2. Parse data from ./jaen-data/patches.txt (1 link per line)
    const data = buffer.toString().split('\n')

    let jaenData = {
      patches: []
    } as JaenData

    const jaenDataDir = path.join(process.cwd(), 'jaen-data')

    for (const rawLine of data) {
      // Surrounding whitespace is not part of a path or a URL. A trailing
      // carriage return is the common case: the publish workflow appends to
      // this file from a runner, and a file that has ever been written on
      // Windows carries CRLF, which used to turn every line into a path that
      // does not exist.
      const link = rawLine.trim()

      // Skip empty lines and comments. The file is edited by hand as often as
      // it is appended to, and a patch list nobody may annotate is one whose
      // entries stop being explicable after the third one.
      if (link === '' || link.startsWith('#')) {
        continue
      }

      let response: {
        createdAt?: Date
        message?: string
        data: JaenData
      }

      if (link.startsWith('http://') || link.startsWith('https://')) {
        // A patch is a gateway file like any other and is owned by this
        // site's organisation, so the machine token goes on the request.
        response = await fetchWithCache<{
          createdAt: Date
          message: string
          data: JaenData
        }>(link, {
          cache,
          ...(gatewayFileId(link, storageUrl)
            ? {headers: osgAuthHeaders()}
            : {})
        })
      } else {
        // Local patch file: the line is a path relative to the jaen-data
        // directory. Reject anything resolving outside of it (path
        // traversal). path.resolve is lexical, so the containment check runs
        // on real paths below as well — a symlink inside jaen-data must not
        // point outside of it.
        const resolvedPath = path.resolve(jaenDataDir, link)

        if (!resolvedPath.startsWith(jaenDataDir + path.sep)) {
          reporter.panicOnBuild(
            `Invalid patch path "${link}": local patch files must resolve inside ${jaenDataDir}`
          )
          continue
        }

        let realPath: string
        try {
          realPath = await fs.realpath(resolvedPath)
        } catch {
          reporter.panicOnBuild(
            `Local patch file "${link}" not found (resolved to ${resolvedPath})`
          )
          continue
        }

        const realJaenDataDir = await fs.realpath(jaenDataDir)

        if (!realPath.startsWith(realJaenDataDir + path.sep)) {
          reporter.panicOnBuild(
            `Invalid patch path "${link}": local patch files must resolve inside ${jaenDataDir}`
          )
          continue
        }

        // The parsed file content is merged into jaenData below, so
        // createContentDigest(jaenData) invalidates the Gatsby cache
        // whenever the local patch file changes.
        const patchBuffer = await fs.readFile(realPath)

        let parsed: unknown
        try {
          parsed = JSON.parse(patchBuffer.toString())
        } catch (parseError) {
          reporter.panicOnBuild(
            `${link}: invalid JSON in local patch file: ${
              (parseError as Error).message
            }`
          )
          continue
        }

        // A patch without a proper data object would die deep inside
        // deepmerge with an unreadable error — fail with the expected shape
        // and the offending file instead.
        const shaped = parsed as {data?: unknown} | null
        if (
          shaped === null ||
          typeof shaped !== 'object' ||
          Array.isArray(shaped) ||
          typeof shaped.data !== 'object' ||
          shaped.data === null ||
          Array.isArray(shaped.data)
        ) {
          reporter.panicOnBuild(
            `${link}: patch must be {createdAt?, message?, data}`
          )
          continue
        }

        response = shaped as {
          createdAt?: Date
          message?: string
          data: JaenData
        }
      }

      jaenData.patches.push({
        createdAt: response.createdAt || new Date(2001, 20, 10),
        title: response.message,
        url: link
      })

      if (response) {
        normalizeCheckboxBooleans(response.data)
        jaenData = deepmerge(jaenData, response.data, {
          arrayMerge: deepmergeArrayIdMerge,
          customMerge: key => {
            if (key === 'IMA:MdxField') {
              return (target, source) => {
                return {...target, ...source}
              }
            }
          }
        })
      }
    }

    /**
     * Every gateway file this site names is downloaded here, with OSG_TOKEN,
     * and every gateway URL in the data is rewritten onto this site's own
     * origin. After this the built site has no runtime relationship with the
     * gateway at all: a visitor never asks it for anything and it never
     * serves a visitor. The bytes go to `public/osg/` in onPostBuild, which
     * is the first moment `public` is safe to write.
     */
    const mediaFiles = await fetchGatewayFiles({
      data: jaenData,
      cacheDir: path.join(process.cwd(), '.cache'),
      storageUrl,
      reporter
    })

    if (mediaFiles.length > 0) {
      const rewritten = rewriteGatewayUrls(jaenData, {storageUrl, siteUrl})

      reporter.info(
        `jaen media: ${rewritten} gateway URL(s) rewritten onto ${
          siteUrl || 'this site'
        }`
      )

      if (!siteUrl) {
        // Only jaenPageMetadata.image needs the absolute form, and only
        // crawlers read it, so this is a warning rather than a stop.
        reporter.warn(
          'jaen media: no siteUrl, so page metadata images stay relative and ' +
            'OpenGraph crawlers will not resolve them'
        )
      }
    }

    const contentDigest = createContentDigest(jaenData)

    // 3. Create JaenData node
    const jaenDataNode = {
      id: createNodeId('JaenData'),
      internal: {
        type: 'JaenData',
        contentDigest
      },
      ...jaenData
    }

    // 3. Deep remove all objects that contains the key 'deleted' with value true

    const deepRemoveDeleted = (obj: any) => {
      if (typeof obj === 'object' && obj !== null) {
        if (obj.deleted === true) {
          return undefined
        }

        for (const key in obj) {
          obj[key] = deepRemoveDeleted(obj[key])
          if (obj[key] === undefined) {
            // Remove the key if its value is undefined after recursion
            delete obj[key]
          }
        }
      }

      if (Array.isArray(obj)) {
        obj = obj.filter(item => item !== null)
      }

      return obj
    }

    deepRemoveDeleted(jaenDataNode)

    // 5. Create JaenData node using createNode action
    await createNode(jaenDataNode)

    // 6. Cache the contentDigest of the JaenData node
    await cache.set('JaenDataContentDigest', contentDigest)

    // Log a success message using the reporter
    reporter.info('Nodes sourced and created successfully!')
  } catch (error) {
    // Log an error message using the reporter
    reporter.panic('Error sourcing nodes:', error)
  }
}
