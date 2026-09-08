/**
 * The storage gateway, for the one file a publish writes.
 *
 * `docs/architecture/private-storage.md`: every read and every write of
 * osg.netsnek.com carries a Zitadel token, an upload needs `jaen:admin`,
 * `storage:write` or `storage:admin`, and the file is stamped with the
 * organisation of the token that sent it. So a migration uploaded here is
 * owned by the site's organisation and readable by the site's build
 * credential and by nobody outside it.
 *
 * The body is the GraphQL multipart request spec, built by hand. There is
 * deliberately no REST upload on the gateway, and jaen builds the same body by
 * hand in `packages/jaen/src/clients/osg/index.ts` and the taxi Worker in
 * `pylon/src/documents/confirmation.ts`. A generated client is not carried
 * into this Worker for one mutation.
 */
import {env, USER_AGENT, type SiteEntry} from './env'

/** `https://osg.netsnek.com` unless the deployment says otherwise. */
export const storageOrigin = (): string =>
  (env().STORAGE_URL || 'https://osg.netsnek.com').replace(/\/+$/, '')

/**
 * The site's machine token, and never a caller's.
 *
 * draft-state.md: "uploads it to the storage gateway with the site's machine
 * token". It is the site's and not the publishing editor's for two reasons
 * that both matter after the fact: the file's ownership row must name the
 * site's organisation whoever pressed the button, and a publish that outlives
 * the editor's access token (a build dispatch, a retry) must not fail on a
 * credential that expired between the snapshot and the upload. Who published
 * is recorded where it belongs, in the commit's author line.
 *
 * It is the brand's storage machine user (`osg-krc`, `osg-limosen`), which
 * holds `storage:write`. It is **not** `osg-build-krc` or `osg-build-limosen`:
 * private-storage.md gave the site builds `storage:read` and nothing else on
 * purpose, so those two cannot upload and a deployment that carries one of
 * them here is refused by the gateway with `FORBIDDEN` rather than silently
 * publishing nothing.
 */
export const storageToken = (entry: SiteEntry): string => {
  const name = entry.osgTokenVar || 'OSG_TOKEN'
  const value = env()[name]

  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(
      `no storage credential for ${entry.repository}: the site entry names ` +
        `"${name}" and it is not set. It is the brand's storage machine user ` +
        `(storage:write), a Worker secret, never a build token and never a ` +
        `caller's.`
    )
  }

  return value
}

export interface UploadedMigration {
  fileId: string
  url: string
  bytes: number
  mimeType: string | null
}

const UPLOAD = `mutation JaenAgentUpload($file: File!) {
  upload(args: {file: $file}) {
    file_id
    file_name
    file_size
    mime_type
    url
  }
}`

/**
 * Uploads the migration and hands back the URL that becomes the line.
 *
 * One part, one file, and the operation carries `null` where the file goes,
 * which is what the multipart spec asks for.
 */
export const uploadMigration = async (
  entry: SiteEntry,
  payload: string,
  fileName: string
): Promise<UploadedMigration> => {
  const form = new FormData()

  form.append(
    'operations',
    JSON.stringify({query: UPLOAD, variables: {file: null}})
  )
  form.append('map', JSON.stringify({'0': ['variables.file']}))
  form.append(
    '0',
    new File([payload], fileName, {type: 'application/json'}),
    fileName
  )

  const res = await fetch(`${storageOrigin()}/graphql`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${storageToken(entry)}`,
      'User-Agent': USER_AGENT
    },
    body: form
  })

  const body = (await res.json().catch(() => ({}))) as {
    data?: {
      upload?: {
        file_id?: string
        url?: string
        file_size?: number
        mime_type?: string
      }
    }
    errors?: Array<{message?: string; extensions?: {code?: string}}>
  }

  if (!res.ok || body.errors?.length) {
    const first = body.errors?.[0]

    throw new Error(
      `the storage gateway refused the migration (HTTP ${res.status}` +
        `${first?.extensions?.code ? `, ${first.extensions.code}` : ''}): ` +
        `${first?.message ?? 'no message'}`
    )
  }

  const uploaded = body.data?.upload

  if (!uploaded?.file_id || !uploaded.url) {
    throw new Error(
      'the storage gateway answered no file_id or no url for the migration'
    )
  }

  return {
    fileId: uploaded.file_id,
    url: uploaded.url,
    bytes: uploaded.file_size ?? payload.length,
    mimeType: uploaded.mime_type ?? null
  }
}

/**
 * Reads the migration back off the gateway before its line is committed.
 *
 * One extra round trip per publish, which happens rarely, against the one
 * failure this path can produce that nobody would notice for weeks: a line in
 * `patches.txt` naming a file the build cannot fetch. Every build of the site
 * from here on replays that line, so it is worth proving that the bytes are
 * there and are the bytes that were sent before the line exists at all. If
 * this throws, nothing has been committed and the publish is simply not made.
 */
export const readBackMigration = async (
  entry: SiteEntry,
  fileId: string,
  expected: string
): Promise<void> => {
  const res = await fetch(
    `${storageOrigin()}/storage/${encodeURIComponent(fileId)}`,
    {
      headers: {
        Authorization: `Bearer ${storageToken(entry)}`,
        'User-Agent': USER_AGENT
      }
    }
  )

  if (!res.ok) {
    throw new Error(
      `the migration was uploaded but reads back ${res.status} from the ` +
        `storage gateway. Its line was not committed.`
    )
  }

  const text = await res.text()

  if (text !== expected) {
    throw new Error(
      `the migration reads back ${text.length} bytes where ${expected.length} ` +
        `were sent. Its line was not committed.`
    )
  }
}
