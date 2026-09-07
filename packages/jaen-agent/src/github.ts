/**
 * GitHub, over the REST API. No git binary, no filesystem, no clone.
 *
 * The credential is the agent's own: a GitHub App installation token, minted
 * per request and cached in KV for its hour, or a fine grained personal token
 * as the interim before the App exists. The editor's identity never becomes a
 * credential; it goes into the commit's author line, which is what makes
 * `git log --format='%an <%ae>'` on the site repository the audit trail.
 */
import {cache, env, USER_AGENT, type SiteEntry} from './env'

const api = (): string =>
  (env().GITHUB_API_URL || 'https://api.github.com').replace(/\/+$/, '')

export interface CommitAuthor {
  name: string
  email: string
}

// --------------------------------------------------------------------------
// The credential
// --------------------------------------------------------------------------

const base64url = (bytes: Uint8Array): string => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const pemToPkcs8 = (pem: string): ArrayBuffer => {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '')

  if (/BEGIN RSA PRIVATE KEY/.test(pem)) {
    // WebCrypto imports PKCS#8 only, and GitHub hands out PKCS#1. Converting
    // it in the Worker would mean carrying an ASN.1 writer for one shape, so
    // the secret is stored converted instead:
    //   openssl pkcs8 -topk8 -nocrypt -in app.pem -out app.pkcs8.pem
    throw new Error(
      'GITHUB_APP_PRIVATE_KEY is a PKCS#1 key ("BEGIN RSA PRIVATE KEY"). ' +
        'WebCrypto reads PKCS#8 only. Convert it with ' +
        '`openssl pkcs8 -topk8 -nocrypt -in app.pem` and set that.'
    )
  }

  const raw = atob(body)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes.buffer
}

/** The App's own JWT, RS256, valid for nine minutes of GitHub's ten. */
const appJwt = async (): Promise<string> => {
  const {GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY} = env()

  if (!GITHUB_APP_ID || !GITHUB_APP_PRIVATE_KEY) {
    throw new Error('GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY are not both set')
  }

  const now = Math.floor(Date.now() / 1000)
  const header = {alg: 'RS256', typ: 'JWT'}
  const payload = {iat: now - 60, exp: now + 540, iss: GITHUB_APP_ID}

  const encoder = new TextEncoder()
  const signingInput =
    `${base64url(encoder.encode(JSON.stringify(header)))}.` +
    `${base64url(encoder.encode(JSON.stringify(payload)))}`

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(GITHUB_APP_PRIVATE_KEY),
    {name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256'},
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    encoder.encode(signingInput)
  )

  return `${signingInput}.${base64url(new Uint8Array(signature))}`
}

/**
 * The token requests are made with.
 *
 * `GITHUB_TOKEN` wins when it is set, because it is the interim credential
 * and a deployment that still carries it means to use it. Otherwise the App's
 * installation token, cached in KV under its installation for fifty minutes
 * of the hour GitHub gives it. A cold KV costs one extra round trip and never
 * a wrong answer.
 */
export const token = async (entry: SiteEntry): Promise<string> => {
  const direct = env().GITHUB_TOKEN

  if (direct) return direct

  const installationId = entry.installationId

  if (!installationId) {
    throw new Error(
      `no GitHub credential for ${entry.repository}: GITHUB_TOKEN is unset and ` +
        `the site entry names no installationId.`
    )
  }

  const kv = cache()
  const cacheKey = `ghtoken:${installationId}`

  if (kv) {
    const hit = await kv.get(cacheKey)
    if (hit) return hit
  }

  const res = await fetch(
    `${api()}/app/installations/${encodeURIComponent(installationId)}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await appJwt()}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': USER_AGENT
      }
    }
  )

  if (!res.ok) {
    throw new Error(
      `github: minting an installation token for ${installationId} failed with ${res.status}`
    )
  }

  const json = (await res.json()) as {token: string}

  if (kv) {
    await kv.put(cacheKey, json.token, {expirationTtl: 3000})
  }

  return json.token
}

const headers = async (entry: SiteEntry): Promise<Record<string, string>> => ({
  Authorization: `Bearer ${await token(entry)}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  // The API rejects a request without one, and so does the Cloudflare in
  // front of the identity server, with `error code: 1010` in plain text.
  'User-Agent': USER_AGENT
})

// --------------------------------------------------------------------------
// base64 that survives non-ASCII, which atob/btoa alone do not
// --------------------------------------------------------------------------

const decodeBase64 = (b64: string): string =>
  new TextDecoder().decode(
    Uint8Array.from(atob(b64.replace(/\s/g, '')), c => c.charCodeAt(0))
  )

const encodeBase64 = (text: string): string => {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

// --------------------------------------------------------------------------
// Reads and writes
// --------------------------------------------------------------------------

/** The branch's HEAD commit sha. */
export const headSha = async (
  entry: SiteEntry,
  branch: string
): Promise<string> => {
  const res = await fetch(
    `${api()}/repos/${entry.repository}/commits/${encodeURIComponent(branch)}`,
    {headers: {...(await headers(entry)), Accept: 'application/vnd.github.sha'}}
  )

  if (!res.ok) {
    throw new Error(
      `github: reading the head of ${entry.repository}@${branch} failed with ${res.status}`
    )
  }

  return (await res.text()).trim()
}

export interface FileContent {
  text: string
  /** The blob sha, which is what a concurrent write is detected with. */
  sha: string
}

/** Null when the file does not exist, which is how a first save knows. */
export const readFile = async (
  entry: SiteEntry,
  path: string,
  ref: string
): Promise<FileContent | null> => {
  const res = await fetch(
    `${api()}/repos/${entry.repository}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`,
    {headers: await headers(entry)}
  )

  if (res.status === 404) return null

  if (!res.ok) {
    throw new Error(
      `github: reading ${entry.repository}/${path} failed with ${res.status}`
    )
  }

  const json = (await res.json()) as {content?: string; sha: string}

  return {text: json.content ? decodeBase64(json.content) : '', sha: json.sha}
}

export interface WriteResult {
  commitSha: string
  commitUrl: string
  blobSha: string
}

/** 409 and 422 both mean the file moved under us, which the caller retries. */
export class ConflictError extends Error {
  constructor(path: string) {
    super(`github: ${path} changed between the read and the write`)
    this.name = 'ConflictError'
  }
}

export const writeFile = async (
  entry: SiteEntry,
  input: {
    path: string
    branch: string
    text: string
    /** Omitted when the file is new. */
    sha: string | null
    message: string
    author: CommitAuthor
    committer: CommitAuthor
  }
): Promise<WriteResult> => {
  const res = await fetch(
    `${api()}/repos/${entry.repository}/contents/${encodePath(input.path)}`,
    {
      method: 'PUT',
      headers: {...(await headers(entry)), 'Content-Type': 'application/json'},
      body: JSON.stringify({
        message: input.message,
        content: encodeBase64(input.text),
        branch: input.branch,
        author: input.author,
        committer: input.committer,
        ...(input.sha ? {sha: input.sha} : {})
      })
    }
  )

  if (res.status === 409 || res.status === 422) {
    throw new ConflictError(input.path)
  }

  if (!res.ok) {
    const body = await res.text()
    throw new Error(
      `github: writing ${entry.repository}/${input.path} failed with ${res.status}: ${body.slice(0, 200)}`
    )
  }

  const json = (await res.json()) as {
    content?: {sha?: string}
    commit?: {sha?: string; html_url?: string}
  }

  return {
    commitSha: json.commit?.sha ?? '',
    commitUrl: json.commit?.html_url ?? '',
    blobSha: json.content?.sha ?? ''
  }
}

/**
 * The publish: `workflow_dispatch` on the workflow the site entry names.
 *
 * GitHub answers 204 and nothing else, so the run url is looked up once
 * afterwards rather than invented. A site without a working Actions build
 * gets an honest `queued: false` from the caller instead.
 */
export const dispatchWorkflow = async (
  entry: SiteEntry,
  workflow: string,
  ref: string
): Promise<{ok: boolean; status: number; reason?: string}> => {
  const res = await fetch(
    `${api()}/repos/${entry.repository}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`,
    {
      method: 'POST',
      headers: {...(await headers(entry)), 'Content-Type': 'application/json'},
      body: JSON.stringify({ref})
    }
  )

  if (res.status === 204) return {ok: true, status: 204}

  const body = await res.text()

  return {ok: false, status: res.status, reason: body.slice(0, 300)}
}

/** The newest run of that workflow, for the url the answer carries. */
export const latestRunUrl = async (
  entry: SiteEntry,
  workflow: string
): Promise<string | undefined> => {
  try {
    const res = await fetch(
      `${api()}/repos/${entry.repository}/actions/workflows/${encodeURIComponent(workflow)}/runs?per_page=1`,
      {headers: await headers(entry)}
    )

    if (!res.ok) return undefined

    const json = (await res.json()) as {
      workflow_runs?: Array<{html_url?: string}>
    }

    return json.workflow_runs?.[0]?.html_url
  } catch {
    return undefined
  }
}

/** A path is a sequence of segments; the slashes stay slashes. */
const encodePath = (path: string): string =>
  path.split('/').map(encodeURIComponent).join('/')
