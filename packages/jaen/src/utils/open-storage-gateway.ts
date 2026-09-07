import {useEffect, useState} from 'react'

import {
  osg,
  storageBearer,
  storageFileId,
  storageFileUrl,
  storageOrigin
} from '../clients/osg'

/**
 * Uploads to the storage gateway, through the client Pylon generates for it.
 *
 * This used to be a hand-rolled fetch to a `const STORAGE_URL` pointing at
 * osg.snek.at: REST where the rest of jaen uses generated clients, and not
 * configurable at all, so every jaen site sent its media to one third-party
 * host with no way to opt out.
 */

/** What callers get back. Unchanged, so no call site has to move. */
interface UploadedFileData {
  data: {
    file_id: string
    file_name: string
    file_size: number
    file_unique_id: string
    mime_type: string
    thumb?: {
      file_id: string
      file_size: number
      file_unique_id: string
      height: number
      width: number
    }
  }
  fileUrl: string
  fileThumbUrl?: string
}

/**
 * Stores a file, or an object wrapped as JSON.
 *
 * @param fileData - a Blob/File, or any object to be stored as JSON.
 * @param filename - name for the JSON case. Ignored for a Blob/File.
 * @param options.driver - which backend to write to. Omitted, the gateway
 *   picks its own default.
 */
/**
 * One upload at a time. See the comment inside uploadFile for why; the queue
 * is a promise chain that never rejects so one failed upload cannot wedge the
 * ones behind it.
 */
let uploadChain: Promise<unknown> = Promise.resolve()

const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
  const run = uploadChain.then(task, task)
  uploadChain = run.catch(() => undefined)
  return run
}

export const uploadFile = async (
  fileData: object | Blob | File,
  filename: string = 'jaen-index.json',
  options?: {driver?: string}
): Promise<UploadedFileData> => {
  const file =
    fileData instanceof File
      ? fileData
      : fileData instanceof Blob
        ? new File([fileData], filename, {type: fileData.type})
        : new File([JSON.stringify(fileData)], filename, {
            type: 'application/json'
          })

  // gqty batches concurrent mutate() calls into one request and keys their
  // selections by a hash of the arguments, in which a File serialises to {}.
  // Two uploads in flight at once therefore collapsed onto a single alias and
  // only the last file was sent, while every caller received that one result:
  // a multi-file drop in the media library stored one file N times. Uploads
  // are queued so that one request carries one file.
  const uploaded = await enqueue(() =>
    osg.mutate(mutation => {
      const result = mutation.upload({
        args: {file, driver: options?.driver ?? null}
      })

      // gqty resolves exactly the fields that are read here, so this selection
      // is the query.
      return {
        file_id: result.file_id,
        file_unique_id: result.file_unique_id,
        file_name: result.file_name,
        mime_type: result.mime_type,
        file_size: result.file_size,
        url: result.url,
        thumbUrl: result.thumbUrl,
        thumb: result.thumb
          ? {
              file_id: result.thumb.file_id,
              file_unique_id: result.thumb.file_unique_id,
              file_size: result.thumb.file_size,
              width: result.thumb.width,
              height: result.thumb.height
            }
          : null
      }
    })
  )

  return {
    data: {
      file_id: uploaded.file_id,
      file_unique_id: uploaded.file_unique_id,
      file_name: uploaded.file_name ?? file.name,
      file_size: uploaded.file_size ?? file.size,
      mime_type: uploaded.mime_type ?? file.type,
      ...(uploaded.thumb
        ? {
            thumb: {
              file_id: uploaded.thumb.file_id,
              file_unique_id: uploaded.thumb.file_unique_id,
              file_size: uploaded.thumb.file_size ?? 0,
              width: uploaded.thumb.width ?? 0,
              height: uploaded.thumb.height ?? 0
            }
          }
        : {})
    },
    fileUrl: uploaded.url,
    fileThumbUrl: uploaded.thumbUrl ?? undefined
  }
}

/**
 * The same upload from a Node process.
 *
 * It used to need `form-data` and a callback-style submit. Node has had
 * FormData, File and fetch as globals since 18, so it is the browser path
 * with the payload wrapped, and the dependency is gone.
 */
export const uploadFileFromNode = async (options: {
  payload: string
  fileName?: string
  driver?: string
}): Promise<UploadedFileData> =>
  await uploadFile(
    new File([options.payload], options.fileName || 'jaen-index.json', {
      type: 'application/json'
    }),
    options.fileName,
    {driver: options.driver}
  )

/**
 * Reads a stored file back, with the signed-in person's token.
 *
 * The gateway is private: `GET /storage/<id>` answers 401 without a bearer
 * and 403 with a token of another organisation, so a picture can no longer be
 * a bare `<img src="https://osg...">`. Callers take the bytes and draw them
 * through an object URL instead (`useFileObjectUrl` below).
 *
 * Accepts an id or any spelling of its URL, including the historical
 * osg.snek.at one that published patches carry. A value that is not a gateway
 * file (a site-relative `/osg/<id>.<ext>` the build wrote, or a foreign
 * origin) is fetched as it stands, without a credential, because sending this
 * person's token to somebody else's host would be the worse bug.
 */
export const fetchFile = async (idOrUrl: string): Promise<Blob> => {
  const fileId = storageFileId(idOrUrl)
  const url = fileId ? storageFileUrl(fileId) : idOrUrl
  const token = fileId ? storageBearer() : undefined

  const response = await fetch(url, {
    ...(token ? {headers: {Authorization: `Bearer ${token}`}} : {}),
    mode: 'cors'
  })

  if (!response.ok) {
    throw new Error(
      `storage gateway answered ${response.status} for ${fileId ?? url}`
    )
  }

  return await response.blob()
}

/**
 * The same file as an object URL, revoked when the component goes away.
 *
 * Undefined while it is loading and after a failure, so a caller can draw a
 * skeleton and then a placeholder rather than a broken image.
 *
 * Two values pass straight through instead of being fetched: a source that is
 * not a gateway file at all (the build rewrites every media URL onto the
 * site's own origin, and those are plain paths a visitor loads without a
 * token) and a gateway file while nobody is signed in, which is still the
 * right request for a file the gateway has not claimed yet and becomes a
 * broken image once it has. Passing them through keeps a public page working
 * with no session and no round trip through this hook.
 */
export const useFileObjectUrl = (
  idOrUrl?: string | null
): string | undefined => {
  const source = idOrUrl ?? undefined
  const fileId = source ? storageFileId(source) : null

  // Only a gateway file with a session is fetched, and only in a browser:
  // during the HTML build there is a machine token in the environment but no
  // object URL to make, and the built markup has to be the anonymous one.
  // Everything else is drawn from its own address, so the hook is inert on a
  // public page.
  const shouldFetch =
    typeof window !== 'undefined' && Boolean(fileId) && Boolean(storageBearer())

  const [objectUrl, setObjectUrl] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (!shouldFetch || !fileId) {
      setObjectUrl(undefined)
      return
    }

    let cancelled = false
    let created: string | undefined

    void fetchFile(fileId)
      .then(blob => {
        if (cancelled) return

        created = URL.createObjectURL(blob)
        setObjectUrl(created)
      })
      .catch(error => {
        // A refused or missing file is a placeholder, not a crash. The
        // console line is the only way to tell 401 from 404 from a tile that
        // simply has no picture.
        console.error('jaen: storage gateway read failed', error)

        if (!cancelled) setObjectUrl(undefined)
      })

    return () => {
      cancelled = true

      if (created) URL.revokeObjectURL(created)
    }
  }, [fileId, shouldFetch])

  if (!shouldFetch) return source

  return objectUrl
}

export {storageOrigin, storageBearer, storageFileId}
export {storageFileUrl} from '../clients/osg'
