import {promises as fs} from 'fs'
import path from 'path'

import {BuildArgs} from 'gatsby'

import {osgFiles, PUBLIC_MEDIA_DIR} from '../utils/osg-media'

/**
 * Writes the media this build downloaded into the site's own output.
 *
 * `public/osg/<file_id>.<ext>`, the path the sourced data was already
 * rewritten to, plus `public/osg/index.json`, the map from gateway id to
 * path. The map is not read by the site; it is what a check reads, so a
 * verification can assert that every id the data names is on the origin
 * without parsing the HTML.
 *
 * Here and not at source time because `public` is emptied while the build is
 * still sourcing. onPostBuild is the first moment the directory is final.
 */
export const onPostBuild = async ({reporter}: BuildArgs): Promise<void> => {
  const files = osgFiles()

  if (files.length === 0) return

  const publicDir = path.join(process.cwd(), 'public', PUBLIC_MEDIA_DIR)

  await fs.mkdir(publicDir, {recursive: true})

  const index: Record<string, {path: string; mimeType: string; size: number}> =
    {}

  let bytes = 0

  for (const file of files) {
    const target = path.join(process.cwd(), 'public', file.publicPath)

    await fs.copyFile(file.cachePath, target)

    index[file.fileId] = {
      path: file.publicPath,
      mimeType: file.mimeType,
      size: file.size
    }

    bytes += file.size
  }

  await fs.writeFile(
    path.join(publicDir, 'index.json'),
    `${JSON.stringify(index, null, 2)}\n`
  )

  reporter.info(
    `jaen media: ${files.length} file(s), ${Math.round(
      bytes / 1024
    )} kB, served from /${PUBLIC_MEDIA_DIR}/`
  )
}
