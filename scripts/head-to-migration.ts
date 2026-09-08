/**
 * The agent's head patches become one migration file on the storage gateway.
 *
 * The first build of the shared draft kept a site's unpublished head as two
 * files in the repository, `jaen-data/live.json` and `jaen-data/live-media.json`,
 * and named them as the last two lines of `jaen-data/patches.txt`. That made
 * every unfinished edit part of the published site, which is the thing
 * `okf/decisions/hard-rules.md` forbids ("The CMS's draft is not the site's
 * content"). `docs/architecture/draft-state.md` undoes it, and its transition
 * starts here: the head is real content and has to survive, so it becomes one
 * ordinary migration before the two files go away.
 *
 * What this does, and nothing else:
 *
 *   1. reads the two head files of a site,
 *   2. merges their `data` with the very same deepmerge the build uses
 *      (`gatsby-source-jaen`'s `deepmergeArrayIdMerge` and its `IMA:MdxField`
 *      customMerge), so the merged file replays to what the two replayed to,
 *   3. writes one `{message, createdAt, data}` in jaen's own patch shape, and
 *      the two files' `authors` maps beside it as a local sidecar that is
 *      never uploaded and never committed,
 *   4. uploads it through jaen's own gateway client, the same
 *      `uploadFileFromNode` every publish uses, with `OSG_TOKEN` from the
 *      environment.
 *
 * It does not touch `patches.txt` and it deletes nothing. Appending the line
 * and removing the two files is a git change and is made by hand, in one
 * commit, after this has printed the URL.
 *
 *   OSG_TOKEN=... node migration.cjs <site dir> [--out file] [--dry-run]
 *
 * Bundle it first, because it imports jaen's TypeScript source rather than a
 * built package:
 *
 *   node_modules/.bin/esbuild scripts/head-to-migration.ts --bundle \
 *     --platform=node --format=cjs --target=node20 --outfile=/tmp/migration.cjs
 */
import fs from 'fs'
import path from 'path'

import deepmerge from 'deepmerge'

import {deepmergeArrayIdMerge} from '../packages/gatsby-source-jaen/src/utils/deepmerge'
import {uploadFileFromNode} from '../packages/jaen/src/utils/open-storage-gateway'

type Patch = {
  message?: string
  createdAt?: string
  data: Record<string, unknown>
  authors?: Record<string, unknown>
}

const read = (file: string): Patch => {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    typeof parsed.data !== 'object'
  ) {
    throw new Error(`${file}: expected {message, createdAt, data}`)
  }

  return parsed as Patch
}

/**
 * The build merges the chain one patch at a time, so two head files are two
 * merges. One file has to be one merge of the same two payloads under the same
 * options, or the migration is not what the head was. Whether that holds is not
 * argued here: the transition's gate is a byte comparison of what a build
 * sources before and after.
 */
const mergeData = (
  a: Record<string, unknown>,
  b: Record<string, unknown>
): Record<string, unknown> =>
  deepmerge(a, b, {
    arrayMerge: deepmergeArrayIdMerge,
    customMerge: (key: string) => {
      if (key === 'IMA:MdxField') {
        return (target: any, source: any) => ({...target, ...source})
      }

      return undefined
    }
  }) as Record<string, unknown>

const main = async () => {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const outIndex = args.indexOf('--out')
  const outFile = outIndex >= 0 ? args[outIndex + 1] : undefined
  const siteDir = args.find(a => !a.startsWith('--') && a !== outFile)

  if (!siteDir) throw new Error('usage: <site dir> [--out file] [--dry-run]')

  const dir = path.join(siteDir, 'jaen-data')
  const live = read(path.join(dir, 'live.json'))
  const media = read(path.join(dir, 'live-media.json'))

  const createdAt = new Date().toISOString()
  const date = createdAt.slice(0, 10)

  const migration = {
    message:
      `draft: the agent's head of ${date}, live.json and live-media.json, ` +
      'as one migration',
    createdAt,
    _note:
      'Written by scripts/head-to-migration.ts. The two head files it was ' +
      'made from were removed from jaen-data and from patches.txt in the ' +
      'same commit that appended this file. See ' +
      'docs/architecture/draft-state.md, "The transition".',
    data: mergeData(live.data, media.data)
  }

  // Pretty printed like every other patch in these repositories, so a diff of
  // a downloaded migration is readable.
  const payload = JSON.stringify(migration, null, 2)

  /**
   * The two files' `authors` maps stay out of the payload, and this is a
   * safety rule and not a tidiness one.
   *
   * A patch is a gateway file, the gateway is private, and that would be the
   * end of it were the build not a reader: `gatsby-source-jaen` downloads
   * every gateway file the data names, the patch payloads included, and
   * writes them into `public/osg/<id>.<ext>`, so a published site serves its
   * own patch payloads to anybody. booklimo.at serves fourteen of them today.
   * `authors` names a person and their identity-server id per field, so a
   * migration carrying it publishes both. The head's authorship is real and
   * is not thrown away: it is written beside the payload, out of every
   * repository, and the shared draft holds it per field in its own store
   * from here on (`draft-state.md`, the `author:<fieldPath>` keys).
   */
  const authors = {...(live.authors ?? {}), ...(media.authors ?? {})}

  if (outFile) {
    fs.writeFileSync(outFile, payload)
    fs.writeFileSync(
      outFile.replace(/(\.json)?$/, '.authors.json'),
      JSON.stringify(authors, null, 2)
    )
  }

  console.log(
    JSON.stringify({
      bytes: payload.length,
      message: migration.message,
      createdAt: migration.createdAt,
      authors: Object.keys(authors).length,
      pages: (migration.data as {pages?: unknown[]}).pages?.length ?? 0
    })
  )

  if (dryRun) return

  if (!process.env['OSG_TOKEN']) {
    throw new Error('OSG_TOKEN is required to upload to the storage gateway')
  }

  const uploaded = await uploadFileFromNode({
    payload,
    fileName: `jaen-migration-${date}.json`
  })

  console.log(
    JSON.stringify({
      file_id: uploaded.data.file_id,
      file_size: uploaded.data.file_size,
      mime_type: uploaded.data.mime_type,
      url: uploaded.fileUrl
    })
  )
}

main().catch(error => {
  console.error(String(error?.stack || error))
  process.exit(1)
})
