import {osg, storageOrigin} from '../clients/osg'

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

export {storageOrigin}
export {storageFileUrl} from '../clients/osg'
