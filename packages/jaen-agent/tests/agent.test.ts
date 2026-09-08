/**
 * The agent against a local `wrangler dev`, the site's own Durable Object and
 * a throwaway branch of netsnek/booklimo.at.
 *
 * Run it with the package's own runner, `npm test`, which is node's: these
 * are not notebooks on purpose, because they drive a Worker, an object and a
 * repository rather than an API a person reads along with.
 *
 * What it proves, which is the design's acceptance list:
 *   1. a save reaches the site's Durable Object, bumps its revision and
 *      writes no commit at all, which is the whole of the 2026-09-08 redesign;
 *   2. a poll whose sinceRevision is the revision answers with no delta, and a
 *      delta carries what changed above a revision and nothing else;
 *   3. a save whose base is stale is rebased onto the current draft and never
 *      rejected;
 *   4. concurrent writers are serialised inside the object, one revision each
 *      and none of them lost;
 *   5. a picture writes one key per node and never the pages, and a removed
 *      picture is named in a delta and gone from a full read;
 *   6. the draft survives the object being restarted between two saves;
 *   7. the alarm snapshots the draft on its own;
 *   8. the object's socket is pushed a revision, and refuses a connection
 *      without a ticket;
 *   9. the agent refuses another site's admin, a caller without the role, and
 *      an anonymous call, on the draft as on everything else;
 *  10. a publish writes exactly one gateway file, one line and one commit;
 *  11. a discard restores the state the last publish wrote, tells every
 *      reader which revision invalidated them, keeps the draft it replaced in
 *      the backstop, and refuses the save of a browser still holding the
 *      draft it threw away.
 *
 * The branch is created before and deleted after, so nothing of this reaches
 * booklimo.at's main. Nothing runs against limosen.at at all. Only the publish
 * half touches the repository now: the draft half moves no branch, which one
 * of its own assertions is about.
 *
 * Credentials come from the machine's own files and are never printed:
 *   ~/.config/taxi-app/tokens.env         the caller tokens and osg-krc
 *   ~/git/taxi-app/pylon/.dev.vars        AUTH_ISSUER and AUTH_KEY
 *   `gh auth token`                       the repository credential
 *
 * The callers are the taxi machine accounts rather than the human logins of
 * humans.env, because accounts.netsnek.com does not offer the password grant
 * (`unsupported_grant_type: password not supported`, measured 2026-09-07), so
 * a human token needs a browser. The three machine accounts are real accounts
 * in the two organisations and carry exactly the three identities the
 * refusals are about: booklimo's jaen:admin, booklimo's krc:customer, and
 * limosen's jaen:admin.
 */
import assert from 'node:assert/strict'
import {spawn, type ChildProcess} from 'node:child_process'
import {execFileSync} from 'node:child_process'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import http from 'node:http'
import {homedir, tmpdir} from 'node:os'
import path from 'node:path'
import test, {after, before} from 'node:test'
import {fileURLToPath} from 'node:url'

import deepmerge from 'deepmerge'

import {deepmergeArrayIdMerge} from '../src/deepmerge.ts'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PACKAGE = path.resolve(HERE, '..')

const REPOSITORY = 'netsnek/booklimo.at'
const SITE = 'booklimo.at'
const ORG_BOOKLIMO = '356348844407002709'
const PORT = Number(process.env.JAEN_AGENT_TEST_PORT || 8977)
const ORIGIN = `http://127.0.0.1:${PORT}`
const UA = 'jaen-agent-tests'

const BRANCH = `jaen-agent-test-${Date.now()}`

// --------------------------------------------------------------------------
// The machine's own credential files
// --------------------------------------------------------------------------

const readEnvFile = (file: string): Record<string, string> => {
  const out: Record<string, string> = {}

  if (!existsSync(file)) return out

  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(
      line
    )

    if (!match) continue

    let value = match[2]!.trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    out[match[1]!] = value
  }

  return out
}

const tokens = readEnvFile(path.join(homedir(), '.config/taxi-app/tokens.env'))
const taxiVars = readEnvFile(
  path.join(homedir(), 'git/taxi-app/pylon/.dev.vars')
)

const ADMIN = tokens.TAXI_TOKEN_ADMIN_BOOKLIMO ?? ''
const CUSTOMER = tokens.TAXI_TOKEN_CUSTOMER_BOOKLIMO ?? ''
const FOREIGN = tokens.TAXI_TOKEN_ADMIN ?? ''
/** osg-krc, the KRC organisation's storage machine user. See the before hook. */
const OSG_TOKEN = tokens.OSG_TOKEN_BOOKLIMO ?? ''

const githubToken = (): string =>
  execFileSync('gh', ['auth', 'token'], {encoding: 'utf8'}).trim()

const GITHUB_TOKEN = githubToken()

for (const [name, value] of Object.entries({
  TAXI_TOKEN_ADMIN_BOOKLIMO: ADMIN,
  TAXI_TOKEN_CUSTOMER_BOOKLIMO: CUSTOMER,
  TAXI_TOKEN_ADMIN: FOREIGN,
  OSG_TOKEN_BOOKLIMO: OSG_TOKEN,
  AUTH_ISSUER: taxiVars.AUTH_ISSUER,
  AUTH_KEY: taxiVars.AUTH_KEY,
  'gh auth token': GITHUB_TOKEN
})) {
  if (!value) throw new Error(`the tests need ${name} and it is not set`)
}

// --------------------------------------------------------------------------
// GitHub, directly, for the branch and for reading the commits back
// --------------------------------------------------------------------------

const gh = async (route: string, init?: RequestInit): Promise<any> => {
  const res = await fetch(`https://api.github.com${route}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': UA,
      ...(init?.body ? {'Content-Type': 'application/json'} : {})
    }
  })

  if (res.status === 204) return null

  const json = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(
      `github ${route} answered ${res.status}: ${JSON.stringify(json).slice(
        0,
        300
      )}`
    )
  }

  return json
}

// --------------------------------------------------------------------------
// The agent
// --------------------------------------------------------------------------

const call = async (
  query: string,
  variables: Record<string, unknown>,
  token?: string
): Promise<{data?: any; errors?: any[]}> => {
  const res = await fetch(`${ORIGIN}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': UA,
      ...(token ? {Authorization: `Bearer ${token}`} : {})
    },
    body: JSON.stringify({query, variables})
  })

  return (await res.json()) as any
}

const DRAFT = `query D($site: String!, $sinceRevision: Number) {
  draft(site: $site, sinceRevision: $sinceRevision) {
    site revision publishedRevision changed full
    updatedAt updatedBy snapshotRevision snapshotAt snapshotBytes readAt
    discardedRevision discardedAt discardedBy discardedByName
    delta {
      pages media removedMedia site widgets authors
      mediaField { pageId fieldType fieldName }
    }
  }
}`

const SAVE = `mutation S($site: String!, $changes: [SaveChangesInput!]!, $baseRevision: Number) {
  save(site: $site, changes: $changes, baseRevision: $baseRevision) {
    revision rebased savedAt touched keys
    overwrote { field previousAuthor previousAt }
  }
}`

const SUBSCRIBE = `mutation Sub($site: String!) {
  subscribe(site: $site) { site ticket url expiresAt revision }
}`

const VIEWER = `query V($site: String!) {
  viewer(site: $site) { site sub name at }
}`

const PUBLISH = `mutation P($site: String!, $message: String) {
  publish(site: $site, message: $message) {
    published revision publishedRevision migrationUrl migrationBytes
    commitSha commitUrl publishedAt queued workflow runUrl reason
  }
}`

/**
 * An upgrade request made by hand, because `fetch` refuses to send one.
 *
 * undici answers `invalid upgrade header` rather than sending it, so the
 * ticketless upgrade is spoken over node's own http client. It answers what
 * the server said, whether that is a 101 or a refusal.
 */
const rawUpgrade = (target: string): Promise<{status: number; body: string}> =>
  new Promise((resolve, reject) => {
    const url = new URL(target.replace(/^ws/, 'http'))

    const request = http.request({
      host: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: {
        Upgrade: 'websocket',
        Connection: 'Upgrade',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
        'User-Agent': UA
      }
    })

    request.on('response', response => {
      let body = ''

      response.on('data', chunk => {
        body += String(chunk)
      })
      response.on('end', () =>
        resolve({status: response.statusCode ?? 0, body})
      )
    })

    request.on('upgrade', response =>
      resolve({status: response.statusCode ?? 0, body: ''})
    )
    request.on('error', reject)
    request.end()
  })

/** Waits for a condition the runtime reaches on its own, or says what did not. */
const waitFor = async (
  ready: () => boolean,
  message: string,
  timeoutMs = 15_000
): Promise<void> => {
  const until = Date.now() + timeoutMs

  for (;;) {
    if (ready()) return

    if (Date.now() > until) throw new Error(message)

    await new Promise(resolve => setTimeout(resolve, 100))
  }
}

const errorCode = (answer: {errors?: any[]}): string | undefined =>
  answer.errors?.[0]?.extensions?.code

let worker: ChildProcess | null = null
const devVars = path.join(PACKAGE, '.dev.vars')

/**
 * A KV of this run's own. `wrangler dev` keeps its simulated KV in
 * .wrangler/state between runs, so without this the cached head of the
 * previous run's branch is served to the first draft of this one, and the
 * first save then looks stale.
 */
const persistTo = mkdtempSync(path.join(tmpdir(), 'jaen-agent-kv-'))

const waitForAgent = async (): Promise<void> => {
  const until = Date.now() + 90_000

  for (;;) {
    try {
      const answer = await call('{ version { agent } }', {})

      if (answer.data?.version?.agent) return
    } catch {
      // not listening yet
    }

    if (Date.now() > until) throw new Error('wrangler dev did not come up')

    await new Promise(resolve => setTimeout(resolve, 1000))
  }
}

/**
 * The Worker, started and stopped by name, because one test restarts it.
 *
 * `--persist-to` keeps the Durable Object's storage in a directory of this
 * run's own, so a restart loses the runtime and the object and keeps the
 * draft, which is exactly the loss scenario `10-draft-persistence.ipynb`
 * names as "the object restarted between two saves".
 */
const startWorker = async (): Promise<void> => {
  worker = spawn(
    'npx',
    [
      'wrangler',
      'dev',
      '--port',
      String(PORT),
      '--ip',
      '127.0.0.1',
      '--var',
      `SITES:${sitesVar}`,
      '--var',
      `AUTH_CACHE_TTL_MS:${authCacheTtlMs}`,
      // Two seconds rather than the deployed five minutes, so the alarm can
      // be watched inside a test run. Nothing else about it differs.
      '--var',
      'DRAFT_SNAPSHOT_INTERVAL_MS:2000',
      '--persist-to',
      persistTo
    ],
    {
      cwd: PACKAGE,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // Node's fetch dies on this machine's unreachable AAAA records.
        NODE_OPTIONS: '--no-network-family-autoselection',
        PYLON_DISABLE_TELEMETRY: 'true',
        WRANGLER_SEND_METRICS: 'false',
        CLOUDFLARE_API_TOKEN: ''
      }
    }
  )

  worker.stdout?.on('data', chunk => {
    if (process.env.JAEN_AGENT_TEST_VERBOSE) process.stdout.write(String(chunk))
  })
  worker.stderr?.on('data', chunk => {
    if (process.env.JAEN_AGENT_TEST_VERBOSE) process.stderr.write(String(chunk))
  })

  await waitForAgent()
}

const stopWorker = async (): Promise<void> => {
  const running = worker

  worker = null

  if (!running) return

  const ended = new Promise<void>(resolve =>
    running.once('exit', () => resolve())
  )

  running.kill('SIGTERM')

  await Promise.race([
    ended,
    new Promise<void>(resolve => setTimeout(resolve, 10_000))
  ])

  // The port has to be free before the next `wrangler dev` binds it.
  await new Promise(resolve => setTimeout(resolve, 1000))
}

const OTHER_SITE = 'cache-scope.invalid'

/**
 * The whole suite runs with the identity cache off, so that a role granted or
 * revoked between two tests is seen at once. That also means every test above
 * resolves a caller from scratch, and the one bug this cache ever had cannot
 * be seen with it off. The last test turns it on.
 */
let authCacheTtlMs = 0

let sitesVar = ''
let devVarsContent = ''

before(async () => {
  const main = await gh(`/repos/${REPOSITORY}/git/ref/heads/main`)

  await gh(`/repos/${REPOSITORY}/git/refs`, {
    method: 'POST',
    body: JSON.stringify({ref: `refs/heads/${BRANCH}`, sha: main.object.sha})
  })

  // wrangler dev reads its secrets from .dev.vars and from nowhere else. The
  // file is gitignored and is removed again in the teardown below.
  devVarsContent = [
    `AUTH_ISSUER=${taxiVars.AUTH_ISSUER}`,
    `AUTH_KEY=${taxiVars.AUTH_KEY}`,
    `GITHUB_TOKEN=${GITHUB_TOKEN}`,
    // In production this is the Worker's own organisation manager token.
    // Locally the booklimo admin's token is a valid bearer for the facade,
    // and the lookup is only reached when the caller's token asserts no
    // roles at all.
    `ORG_USER_MANAGER_TOKEN=${ADMIN}`,
    // The brand's storage machine user, osg-krc, which holds storage:write.
    // Introspected at accounts.netsnek.com before this suite was written
    // rather than tried: active, organisation 356348844407002709,
    // storage:read, storage:write, storage:sign. Never the build user
    // osg-build-krc, which holds storage:read alone and cannot upload.
    `OSG_TOKEN_BOOKLIMO=${OSG_TOKEN}`,
    ''
  ].join('\n')

  writeFileSync(devVars, devVarsContent, {mode: 0o600})

  sitesVar = JSON.stringify({
    // A second site of the other organisation, with no identity facade at
    // all, so a caller of booklimo is a stranger on it and is refused without
    // any lookup. It exists for the cache scoping test at the bottom of this
    // file and nothing is ever written into it.
    [OTHER_SITE]: {
      repository: REPOSITORY,
      branch: BRANCH,
      issuer: taxiVars.AUTH_ISSUER,
      organizationId: '339284789469124181',
      projectIds: ['268283277977065078'],
      adminRole: 'jaen:admin'
    },
    [SITE]: {
      repository: REPOSITORY,
      branch: BRANCH,
      issuer: taxiVars.AUTH_ISSUER,
      organizationId: ORG_BOOKLIMO,
      projectIds: ['268283277977065078'],
      adminRole: 'jaen:admin',
      iamApiUrl: 'https://idm.booklimo.at/graphql',
      osgTokenVar: 'OSG_TOKEN_BOOKLIMO'
    }
  })

  await startWorker()
})

after(async () => {
  await stopWorker()

  if (existsSync(devVars)) rmSync(devVars)

  rmSync(persistTo, {recursive: true, force: true})

  if (process.env.JAEN_AGENT_TEST_KEEP_BRANCH) {
    console.log(`kept ${BRANCH}`)
    return
  }

  try {
    await gh(`/repos/${REPOSITORY}/git/refs/heads/${BRANCH}`, {
      method: 'DELETE'
    })
  } catch (error) {
    console.error(`could not delete ${BRANCH}:`, (error as Error).message)
  }
})

// --------------------------------------------------------------------------
// The identity
// --------------------------------------------------------------------------

test('an anonymous call is refused with AUTH_REQUIRED', async () => {
  const answer = await call(DRAFT, {site: SITE})

  assert.equal(answer.data?.draft, undefined)
  assert.equal(errorCode(answer), 'AUTH_REQUIRED')
})

test("another site's admin is refused with FORBIDDEN", async () => {
  const answer = await call(DRAFT, {site: SITE}, FOREIGN)

  assert.equal(answer.data?.draft, undefined)
  assert.equal(errorCode(answer), 'FORBIDDEN')
})

test('a caller of this site without the role is refused with FORBIDDEN', async () => {
  const answer = await call(DRAFT, {site: SITE}, CUSTOMER)

  assert.equal(answer.data?.draft, undefined)
  assert.equal(errorCode(answer), 'FORBIDDEN')
})

test('an unknown site is not answered at all', async () => {
  const answer = await call(DRAFT, {site: 'not-a-site.example'}, ADMIN)

  assert.equal(answer.data?.draft, undefined)
  assert.equal(errorCode(answer), 'UNKNOWN_SITE')
})

// --------------------------------------------------------------------------
// The draft: one Durable Object per site
// --------------------------------------------------------------------------
//
// What this section proves, which is the acceptance list of
// docs/architecture/draft-state.md: a save reaches the object and no
// repository, a stale save is rebased rather than rejected, two writers
// serialise, the draft survives the object being restarted, the alarm takes
// its snapshot, and none of it is answered to somebody who is not the site's
// admin.
//
// The object starts empty on a site nobody has edited, and that is right: it
// holds the **unpublished** draft and the published content comes from the
// build. So these tests read back what they wrote and never assume the site's
// own content is in there.

const PAGE = 'JaenPage /'
const FIELD_TYPE = 'IMA:TextField'
const MEDIA_PAGE = 'JaenPage /cms/media/'
const MEDIA_TYPE = 'IMA:MEDIA_NODES'

/** The run's own prefix, so a re-run never reads the previous run's fields. */
const RUN = `t${Date.now().toString(36)}`

const fieldValue = (delta: any, fieldName: string): unknown =>
  delta?.pages?.[PAGE]?.jaenFields?.[FIELD_TYPE]?.[fieldName]?.value

const write = async (
  fieldName: string,
  value: unknown,
  baseRevision: number | null = null,
  token = ADMIN
) =>
  call(
    SAVE,
    {
      site: SITE,
      baseRevision,
      changes: [
        {
          kind: 'fieldWrite',
          pageId: PAGE,
          fieldType: FIELD_TYPE,
          fieldName,
          value,
          props: {},
          at: new Date().toISOString()
        }
      ]
    },
    token
  )

const readDraft = async (sinceRevision: number | null = null) =>
  call(DRAFT, {site: SITE, sinceRevision}, ADMIN)

let revision = 0

test('the draft answers a revision, and the object starts empty', async () => {
  const answer = await readDraft()

  assert.equal(answer.errors, undefined)
  assert.equal(answer.data.draft.site, SITE)
  assert.equal(answer.data.draft.changed, true)
  // No revision of the caller's is no revision the object can send a delta
  // against, so the answer replaces rather than merges.
  assert.equal(answer.data.draft.full, true)
  assert.equal(typeof answer.data.draft.revision, 'number')

  revision = answer.data.draft.revision
})

test('a save bumps the revision, reads back, and writes no commit', async () => {
  const head = await branchHead()
  const value = `agent draft ${new Date().toISOString()}`

  const answer = await write(`${RUN}One`, value, revision)

  assert.equal(answer.errors, undefined)
  assert.equal(answer.data.save.rebased, false)
  assert.equal(answer.data.save.revision, revision + 1)
  // The field key, the page key and the meta key. A save writes what it
  // touched and nothing else, which is the whole reason for the key layout.
  assert.ok(answer.data.save.keys <= 4, `wrote ${answer.data.save.keys} keys`)
  assert.deepEqual(answer.data.save.touched, [
    `${PAGE}/${FIELD_TYPE}/${RUN}One`
  ])

  revision = answer.data.save.revision

  const read = await readDraft()

  assert.equal(fieldValue(read.data.draft.delta, `${RUN}One`), value)
  assert.ok(
    read.data.draft.delta.authors[`${PAGE}/${FIELD_TYPE}/${RUN}One`],
    'the field carries who wrote it'
  )
  assert.equal(read.data.draft.updatedBy?.length > 0, true)

  // The claim the whole redesign is about: the branch did not move. Before
  // 2026-09-08 this save was a commit.
  assert.equal(await branchHead(), head)
})

test('a poll whose sinceRevision is the revision answers with no delta', async () => {
  const answer = await readDraft(revision)

  assert.equal(answer.errors, undefined)
  assert.equal(answer.data.draft.changed, false)
  assert.equal(answer.data.draft.delta, null)
  assert.equal(answer.data.draft.revision, revision)
})

test('a delta carries what changed above the revision and nothing else', async () => {
  const before = revision
  const value = `agent delta ${Date.now()}`

  const answer = await write(`${RUN}Two`, value, revision)
  revision = answer.data.save.revision

  const read = await readDraft(before)

  assert.equal(read.data.draft.changed, true)
  assert.equal(read.data.draft.full, false)
  assert.equal(fieldValue(read.data.draft.delta, `${RUN}Two`), value)
  // One page changed, so one page is carried, and the authors map carries the
  // one field this delta stamped rather than every field ever written.
  assert.deepEqual(Object.keys(read.data.draft.delta.pages), [PAGE])
  assert.deepEqual(Object.keys(read.data.draft.delta.authors), [
    `${PAGE}/${FIELD_TYPE}/${RUN}Two`
  ])
  assert.deepEqual(read.data.draft.delta.removedMedia, [])
})

test('a stale save is rebased onto the current draft, not rejected', async () => {
  const stale = revision - 1
  const value = `agent stale ${Date.now()}`

  const answer = await write(`${RUN}Three`, value, stale)

  assert.equal(answer.errors, undefined)
  assert.equal(answer.data.save.rebased, true)
  assert.equal(answer.data.save.revision, revision + 1)

  revision = answer.data.save.revision

  const read = await readDraft()

  // The rebase kept what was already there. That is what "rebased and never
  // rejected" has to mean: the stale save adds its change onto the draft as
  // it is now instead of writing an older draft back over it.
  assert.equal(fieldValue(read.data.draft.delta, `${RUN}Three`), value)
  assert.ok(fieldValue(read.data.draft.delta, `${RUN}One`))
  assert.ok(fieldValue(read.data.draft.delta, `${RUN}Two`))
})

test('two writers at once are serialised and neither loses the other', async () => {
  const before = revision
  const writers = 6

  // All six in flight together. The object is single threaded, so they queue
  // inside it rather than racing a read-modify-write, which is the guarantee
  // the KV lock of the first build could not give.
  const answers = await Promise.all(
    Array.from({length: writers}, (_, i) =>
      write(`${RUN}Race${i}`, `race ${i}`, before)
    )
  )

  for (const answer of answers) assert.equal(answer.errors, undefined)

  const revisions = answers
    .map(a => a.data.save.revision as number)
    .sort((a, b) => a - b)

  // One revision each, consecutive, no two the same.
  assert.deepEqual(
    revisions,
    Array.from({length: writers}, (_, i) => before + 1 + i)
  )

  revision = revisions[revisions.length - 1]!

  const read = await readDraft()

  for (let i = 0; i < writers; i++) {
    assert.equal(
      fieldValue(read.data.draft.delta, `${RUN}Race${i}`),
      `race ${i}`,
      `writer ${i} was lost`
    )
  }

  // Only the first of the six had the current revision as its base, so the
  // other five were folded onto a draft that had moved. None of them was
  // refused, which is the point.
  assert.equal(answers.filter(a => a.data.save.rebased).length, writers - 1)
})

// The identity of both writers above is the same account, and that is a gap
// worth naming rather than hiding: accounts.netsnek.com offers no password
// grant, and booklimo has exactly one machine account holding `jaen:admin`, so
// a second identity would have to be granted the role by the test itself and a
// run that died would leave that grant behind on a real identity server. What
// is proven here is what the object guarantees, that concurrent writes each
// get a revision and none is lost. The other half, that `overwrote` names the
// other editor, needs two people and belongs to the live CMS run where the
// grant is made and revoked under a human's eye.

test('a picture writes one key per node and never the pages', async () => {
  const id = `${RUN}-picture-a`

  const answer = await call(
    SAVE,
    {
      site: SITE,
      baseRevision: revision,
      changes: [
        {
          kind: 'fieldMerge',
          pageId: MEDIA_PAGE,
          fieldType: MEDIA_TYPE,
          fieldName: 'media_nodes',
          value: {
            [id]: {
              id,
              createdAt: new Date().toISOString(),
              description: id,
              fileType: 'image/png',
              url: `https://osg.netsnek.com/storage/${id}`,
              width: 4,
              height: 4,
              revisions: []
            }
          },
          props: {removed: []},
          at: new Date().toISOString()
        }
      ]
    },
    ADMIN
  )

  assert.equal(answer.errors, undefined)
  revision = answer.data.save.revision

  // The node, its author and the meta key. The catalogue is 140 nodes on
  // booklimo and a picture used to rewrite all of them.
  assert.equal(answer.data.save.keys, 3)

  const read = await readDraft()

  assert.ok(read.data.draft.delta.media[id], 'the node is in the catalogue')
  assert.deepEqual(read.data.draft.delta.mediaField, {
    pageId: MEDIA_PAGE,
    fieldType: MEDIA_TYPE,
    fieldName: 'media_nodes'
  })
  // The pages the delta carries do not carry the catalogue at all.
  assert.equal(read.data.draft.delta.pages[MEDIA_PAGE], undefined)
  assert.ok(fieldValue(read.data.draft.delta, `${RUN}One`))
})

test('a removed picture is named in a delta and gone from a full read', async () => {
  const id = `${RUN}-picture-a`
  const before = revision

  const answer = await call(
    SAVE,
    {
      site: SITE,
      baseRevision: revision,
      changes: [
        {
          kind: 'fieldMerge',
          pageId: MEDIA_PAGE,
          fieldType: MEDIA_TYPE,
          fieldName: 'media_nodes',
          value: {},
          props: {removed: [id]},
          at: new Date().toISOString()
        }
      ]
    },
    ADMIN
  )

  assert.equal(answer.errors, undefined)
  revision = answer.data.save.revision

  const delta = await readDraft(before)

  assert.deepEqual(
    delta.data.draft.delta.removedMedia,
    [id],
    `read since ${before}: full ${delta.data.draft.full}, revision ${
      delta.data.draft.revision
    }, media ${JSON.stringify(Object.keys(delta.data.draft.delta.media))}`
  )

  const full = await readDraft()

  assert.equal(full.data.draft.full, true)
  assert.equal(full.data.draft.delta.media[id], undefined)
  assert.deepEqual(full.data.draft.delta.removedMedia, [])
})

test('the object keeps its draft when it is restarted between two saves', async () => {
  const before = revision
  const value = `agent restart ${Date.now()}`

  await write(`${RUN}Before`, value, revision)

  // The whole runtime goes, the object with it, and comes back on the same
  // persisted storage. There is no in-memory copy of a draft to lose, which
  // is what this is here to prove rather than to assume.
  await stopWorker()
  await startWorker()

  const answer = await write(`${RUN}After`, 'after the restart', null)

  assert.equal(answer.errors, undefined)
  // The counter continued rather than starting again, so nothing that was
  // written before the restart can be overwritten by a revision reused after
  // it.
  assert.equal(answer.data.save.revision, before + 2)

  revision = answer.data.save.revision

  const read = await readDraft()

  assert.equal(fieldValue(read.data.draft.delta, `${RUN}Before`), value)
  assert.equal(
    fieldValue(read.data.draft.delta, `${RUN}After`),
    'after the restart'
  )
})

test('the alarm snapshots the draft, on its own', async () => {
  // The suite runs the object with DRAFT_SNAPSHOT_INTERVAL_MS at two seconds
  // rather than the deployed five minutes. Nothing else about the alarm is
  // different, and it is armed by a save and by nothing this test does.
  await write(`${RUN}Snapshot`, `snapshot ${Date.now()}`, revision)

  const until = Date.now() + 60_000
  let answer: any

  for (;;) {
    answer = await readDraft()

    if (answer.data.draft.snapshotRevision === answer.data.draft.revision) break

    if (Date.now() > until) {
      throw new Error(
        `the alarm did not snapshot: revision ${answer.data.draft.revision}, ` +
          `snapshot ${answer.data.draft.snapshotRevision}`
      )
    }

    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  revision = answer.data.draft.revision

  assert.ok(answer.data.draft.snapshotAt, 'the snapshot is stamped')
  // It is the whole draft and not a delta, so it is bigger than the field
  // that triggered it and small enough to be one value.
  assert.ok(
    answer.data.draft.snapshotBytes > 200,
    `the snapshot is ${answer.data.draft.snapshotBytes} bytes`
  )
})

test('the socket is pushed a revision, and is refused without a ticket', async () => {
  const minted = await call(SUBSCRIBE, {site: SITE}, ADMIN)

  assert.equal(minted.errors, undefined)
  assert.match(
    minted.data.subscribe.url,
    new RegExp(`^wss?://[^/]+/draft/${SITE.replace('.', '\\.')}$`),
    `subscribe answered the url ${minted.data.subscribe.url}`
  )
  assert.ok(minted.data.subscribe.ticket)

  // The agent builds the socket URL from the host the call arrived on, and
  // `wrangler dev` reports the host of the configured route rather than the
  // local one: inside the dev server `getContext().req.url` is
  // `https://jaen-agent.booklimo.at/graphql`, so the answer names the live
  // host. That is right in production and wrong for this run, which would
  // otherwise open a socket against the deployed agent. So the path is the
  // agent's and the origin is the local one.
  const url = `${ORIGIN.replace(/^http/, 'ws')}${
    new URL(minted.data.subscribe.url).pathname
  }`

  // A socket without a ticket is not a socket. The upgrade is refused inside
  // the object, which is the only place that knows what it minted. Done
  // before the good one, so a run that cannot open a socket at all still says
  // whether the route is there.
  // The route exists and says what it is for, which separates "no route" from
  // "the upgrade was refused" in a run that fails.
  const plain = await fetch(url.replace(/^ws/, 'http'), {
    headers: {'User-Agent': UA}
  })

  assert.equal(
    plain.status,
    426,
    `GET on the socket route answered ${plain.status}: ${(await plain.text()).slice(0, 120)}`
  )

  const refused = await rawUpgrade(url)

  assert.equal(
    refused.status,
    401,
    `the ticketless upgrade answered ${refused.status}: ${refused.body.slice(
      0,
      200
    )}`
  )

  const socket = new WebSocket(url, [
    'jaen-draft.v1',
    `ticket.${minted.data.subscribe.ticket}`
  ])

  const frames: any[] = []

  socket.addEventListener('message', event => {
    try {
      frames.push(JSON.parse(String((event as MessageEvent).data)))
    } catch {
      // A frame that is not JSON is not one this client acts on.
    }
  })

  await new Promise<void>((resolve, reject) => {
    socket.addEventListener('open', () => resolve())
    socket.addEventListener('error', () =>
      reject(new Error('the socket did not open'))
    )
    setTimeout(
      () => reject(new Error('the socket did not open in ten seconds')),
      10_000
    )
  })

  // The hello carries where the object is, so a client that has just
  // connected knows whether it is behind before it reads anything.
  await waitFor(() => frames.some(f => f.type === 'hello'), 'no hello frame')

  const answer = await write(`${RUN}Push`, `pushed ${Date.now()}`, revision)
  revision = answer.data.save.revision

  await waitFor(
    () => frames.some(f => f.revision === revision && f.type === 'revision'),
    `no push for revision ${revision}`
  )

  const pushed = frames.find(f => f.type === 'revision')

  // The socket carries revisions and never content: one read path and one
  // authorisation path for the data.
  assert.equal(pushed.site, SITE)
  assert.equal(typeof pushed.revision, 'number')
  assert.equal(pushed.pages, undefined)

  socket.close()
})

test('a save is refused anonymously and to a caller without the role', async () => {
  // An empty string and not `undefined`: a default parameter would put the
  // admin's token back and the call would be made as the admin.
  const anonymous = await write(`${RUN}Anonymous`, 'nobody', null, '')

  assert.equal(anonymous.data?.save, undefined)
  assert.equal(errorCode(anonymous), 'AUTH_REQUIRED')

  const customer = await write(
    `${RUN}Customer`,
    'not an editor',
    null,
    CUSTOMER
  )

  assert.equal(customer.data?.save, undefined)
  assert.equal(errorCode(customer), 'FORBIDDEN')

  const foreign = await write(
    `${RUN}Foreign`,
    "another site's admin",
    null,
    FOREIGN
  )

  assert.equal(foreign.data?.save, undefined)
  assert.equal(errorCode(foreign), 'FORBIDDEN')

  // And nothing of the three reached the draft.
  const read = await readDraft()

  assert.equal(fieldValue(read.data.draft.delta, `${RUN}Anonymous`), undefined)
  assert.equal(fieldValue(read.data.draft.delta, `${RUN}Customer`), undefined)
  assert.equal(fieldValue(read.data.draft.delta, `${RUN}Foreign`), undefined)
})

test('subscribe is refused to a caller without the role', async () => {
  const answer = await call(SUBSCRIBE, {site: SITE}, CUSTOMER)

  assert.equal(answer.data?.subscribe, undefined)
  assert.equal(errorCode(answer), 'FORBIDDEN')
})

// --------------------------------------------------------------------------
// The warm up call
// --------------------------------------------------------------------------

test('viewer answers who is calling and touches no repository', async () => {
  const answer = await call(VIEWER, {site: SITE}, ADMIN)

  assert.equal(answer.errors, undefined)
  assert.equal(answer.data.viewer.site, SITE)
  assert.match(answer.data.viewer.sub, /^\d+$/)
  assert.ok(answer.data.viewer.name)

  // It is the same guard as everything else: nobody gets it anonymously.
  const anonymous = await call(VIEWER, {site: SITE})

  assert.equal(errorCode(anonymous), 'AUTH_REQUIRED')
})

// --------------------------------------------------------------------------
// Publish: the only writer of history
// --------------------------------------------------------------------------
//
// What these prove, which is the acceptance list of
// docs/architecture/draft-state.md: a publish produces exactly one gateway
// file and one commit, the line it appends is the only change to
// patches.txt, the chain still replays afterwards, and a second publish
// appends rather than replacing.
//
// The draft is seeded through the agent's own `save`, which writes the site's
// Durable Object and no repository at all. That is the point of the whole
// design and it is worth asserting on its own: the seeding below moves the
// branch head by nothing, and every commit these tests see was made by a
// publish.
//
// **Two files reach the live storage gateway per run and stay there.** The
// gateway has no delete, so this suite uploads the smallest thing that proves
// the path: a migration carrying the marker field below and whatever the
// site's draft object holds, which on a fresh object is only what these tests
// saved into it. They are owned by the KRC organisation, stamped from the
// token that sent them, and readable by nobody outside it.

const PUBLISH_FIELD = 'agentPublishMarker'

/**
 * The save document this section drives, declared here rather than reused
 * from the top of the file.
 *
 * These tests are about publish and must not fail because the draft half's
 * own document moved: a save answers the object's revision now and no commit
 * sha, and the selection below is the whole of what seeding needs.
 */
const SAVE_INTO_DRAFT = `mutation SD($site: String!, $changes: [SaveChangesInput!]!, $baseRevision: Number) {
  save(site: $site, changes: $changes, baseRevision: $baseRevision) {
    revision savedAt rebased
  }
}`

/** One field write into the site's draft object. No repository is touched. */
const seedDraft = async (marker: string): Promise<number> => {
  const answer = await call(
    SAVE_INTO_DRAFT,
    {
      site: SITE,
      changes: [
        {
          kind: 'fieldWrite',
          pageId: PAGE,
          fieldType: FIELD_TYPE,
          fieldName: PUBLISH_FIELD,
          value: marker,
          at: new Date().toISOString()
        }
      ],
      baseRevision: null
    },
    ADMIN
  )

  assert.equal(answer.errors, undefined)

  return answer.data.save.revision
}

const patchLines = async (): Promise<string[]> => {
  const file = await gh(
    `/repos/${REPOSITORY}/contents/jaen-data%2Fpatches.txt?ref=${BRANCH}`
  )

  return Buffer.from(file.content, 'base64')
    .toString('utf8')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
}

const branchHead = async (): Promise<string> =>
  (await gh(`/repos/${REPOSITORY}/git/ref/heads/${BRANCH}`)).object.sha

const commitsBetween = async (from: string, to: string): Promise<any[]> =>
  (await gh(`/repos/${REPOSITORY}/compare/${from}...${to}`)).commits ?? []

/** A gateway file, read with the site's own storage credential. */
const readGatewayJson = async (url: string): Promise<any> => {
  const res = await fetch(url, {
    headers: {Authorization: `Bearer ${OSG_TOKEN}`, 'User-Agent': UA}
  })

  assert.equal(res.status, 200, `${url} reads back ${res.status}`)

  return JSON.parse(await res.text())
}

/**
 * The chain, replayed the way `gatsby-source-jaen` replays it.
 *
 * A remote line is fetched off the gateway with the site's own credential, a
 * local line is read out of `jaen-data/` on the branch, and each payload's
 * `data` is deepmerged onto the accumulated one under the two options the
 * build uses: `deepmergeArrayIdMerge` and the `IMA:MdxField` customMerge. It
 * is a copy of that loop and not an import of it, because the build's own
 * module reaches for gatsby's reporter and its cache.
 */
const replayChain = async (lines: string[]): Promise<any> => {
  let merged: any = {pages: [], site: {}, widgets: []}

  for (const line of lines) {
    if (line.startsWith('#')) continue

    let payload: any

    if (/^https?:\/\//.test(line)) {
      payload = await readGatewayJson(line)
    } else {
      const file = await gh(
        `/repos/${REPOSITORY}/contents/${encodeURIComponent(
          `jaen-data/${line}`
        )}?ref=${BRANCH}`
      )

      payload = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'))
    }

    merged = deepmerge(merged, payload.data, {
      arrayMerge: deepmergeArrayIdMerge,
      customMerge: (key: string) =>
        key === 'IMA:MdxField'
          ? (target: any, source: any) => ({...target, ...source})
          : undefined
    })
  }

  return merged
}

const publishedField = (data: any): unknown =>
  data?.pages?.find((page: any) => page.id === PAGE)?.jaenFields?.[
    FIELD_TYPE
  ]?.[PUBLISH_FIELD]?.value

let firstMigrationUrl = ''

test('a save into the draft moves no branch and writes no commit', async () => {
  const headBefore = await branchHead()

  await seedDraft('published one')

  assert.equal(await branchHead(), headBefore)
})

test('a publish writes one gateway file, one line and one commit', async () => {
  const linesBefore = await patchLines()
  const headBefore = await branchHead()

  const answer = await call(
    PUBLISH,
    {site: SITE, message: 'the first publish of the test branch'},
    ADMIN
  )

  assert.equal(answer.errors, undefined)

  const result = answer.data.publish

  // The reason travels into the failure message. A publish that answers
  // `published: false` always says why, and a test that hid it cost a run.
  assert.equal(result.published, true, `not published: ${result.reason}`)
  assert.ok(typeof result.revision === 'number' && result.revision > 0)
  assert.equal(result.publishedRevision, result.revision)
  assert.match(result.migrationUrl, /^https:\/\/osg\.[^/]+\/storage\/.+/)
  assert.match(result.commitSha, /^[0-9a-f]{40}$/)
  assert.ok(result.migrationBytes > 0)

  firstMigrationUrl = result.migrationUrl

  // One file on the gateway, in jaen's own patch shape.
  const migration = await readGatewayJson(result.migrationUrl)

  assert.equal(migration.message, 'the first publish of the test branch')
  assert.ok(migration.createdAt)
  assert.deepEqual(Object.keys(migration).sort(), [
    'createdAt',
    'data',
    'message'
  ])
  // The build downloads every gateway file the data names into public/osg/,
  // so a patch payload is served to anybody. A migration therefore carries no
  // authors even though the draft it was taken from holds them per field.
  assert.equal('authors' in migration, false)
  assert.equal(publishedField(migration.data), 'published one')

  // One line, appended, and nothing else about the file touched.
  assert.deepEqual(await patchLines(), [...linesBefore, result.migrationUrl])

  // One commit, in the publishing editor's name.
  const commits = await commitsBetween(headBefore, await branchHead())

  assert.equal(commits.length, 1)
  assert.equal(commits[0].sha, result.commitSha)
  assert.match(commits[0].commit.message, /^jaen: publish /)
  assert.ok(commits[0].commit.message.includes(result.migrationUrl))
  assert.equal(
    commits[0].files === undefined || commits[0].files.length <= 1,
    true
  )

  const viewer = await call(VIEWER, {site: SITE}, ADMIN)

  assert.equal(commits[0].commit.author.name, viewer.data.viewer.name)
  assert.equal(commits[0].commit.committer.name, 'jaen-agent')
})

test('a publish with nothing new writes no file, no line and no commit', async () => {
  const linesBefore = await patchLines()
  const headBefore = await branchHead()

  const answer = await call(PUBLISH, {site: SITE}, ADMIN)

  assert.equal(answer.errors, undefined)
  assert.equal(answer.data.publish.published, false)
  assert.equal(answer.data.publish.migrationUrl, null)
  assert.match(answer.data.publish.reason, /already published/i)

  assert.deepEqual(await patchLines(), linesBefore)
  assert.equal(await branchHead(), headBefore)
})

test('a second publish appends rather than replacing', async () => {
  await seedDraft('published two')

  const linesBefore = await patchLines()
  const headBefore = await branchHead()

  const answer = await call(
    PUBLISH,
    {site: SITE, message: 'the second publish of the test branch'},
    ADMIN
  )

  assert.equal(answer.errors, undefined)

  const result = answer.data.publish

  assert.equal(result.published, true)
  assert.notEqual(result.migrationUrl, firstMigrationUrl)

  const linesAfter = await patchLines()

  // The first migration is still there, where it was, and the second is after
  // it. Appending and never rewriting is the whole rule of this file: every
  // earlier line is somebody's published content.
  assert.deepEqual(linesAfter, [...linesBefore, result.migrationUrl])
  assert.equal(linesAfter.indexOf(firstMigrationUrl), linesBefore.length - 1)
  assert.equal(linesAfter.filter(l => l === firstMigrationUrl).length, 1)
  assert.equal((await commitsBetween(headBefore, await branchHead())).length, 1)

  const migration = await readGatewayJson(result.migrationUrl)

  assert.equal(publishedField(migration.data), 'published two')
})

test('the chain still replays, and its last word is the second publish', async () => {
  const lines = await patchLines()

  assert.ok(lines.length >= 2)

  // Every line resolves and the whole file merges, which is what a build
  // does. The two migrations this run appended are the tail of it.
  const merged = await replayChain(lines)

  assert.equal(publishedField(merged), 'published two')
  assert.ok(merged.pages.length > 0)
})

test('a publish is refused anonymously and to a caller without the role', async () => {
  const anonymous = await call(PUBLISH, {site: SITE})

  assert.equal(anonymous.data?.publish, undefined)
  assert.equal(errorCode(anonymous), 'AUTH_REQUIRED')

  const customer = await call(PUBLISH, {site: SITE}, CUSTOMER)

  assert.equal(customer.data?.publish, undefined)
  assert.equal(errorCode(customer), 'FORBIDDEN')
})

// --------------------------------------------------------------------------
// Discard: the draft put back to what the last publish wrote
// --------------------------------------------------------------------------
//
// It runs after the publish section on purpose. A discard restores the state
// the last publish kept, and an object that has never published has nothing to
// restore to and says so, which is the first thing asserted below.
//
// What this proves, which is the design's own list
// (docs/architecture/draft-state.md, "Three operations that rewrite the shared
// draft"): the confirmation names what will go before anything goes; a discard
// restores exactly what the last migration produced and writes no commit; the
// draft as it stood is in the backstop and can be read back, so the act is
// undoable; a save made against a revision below the discard is refused rather
// than folded back on top, which is the other editors' outbox being dropped;
// and none of it is answered to somebody who is not the site's admin.

const DISCARD_PREVIEW = `query DP($site: String!) {
  discardPreview(site: $site) {
    site revision publishedRevision canDiscard reason
    pages fields pagesAdded pagesRemoved
    mediaAdded mediaRemoved siteChanged widgetsChanged
    editors { sub name at }
    since publishedAt takenAt
  }
}`

const DISCARD = `mutation DC($site: String!, $atRevision: Number) {
  discard(site: $site, atRevision: $atRevision) {
    site discarded revision previousRevision publishedRevision
    pages fields
    editors { sub name at }
    snapshotRevision snapshotAt snapshotBytes
    by { sub name at }
    at reason
  }
}`

const DISCARDED = `query DD($site: String!) {
  discardedDraft(site: $site) {
    site found revision takenAt bytes pages data authors
  }
}`

/** The field this section writes into the draft and expects to lose. */
const DISCARD_FIELD = `${RUN}Discarded`

const draftField = async (fieldName: string): Promise<unknown> => {
  const answer = await readDraft()

  assert.equal(answer.errors, undefined)

  return fieldValue(answer.data.draft.delta, fieldName)
}

test('the confirmation names what will go, before anything goes', async () => {
  // The state of the object here is the second publish, and the draft is
  // exactly it: the test above asserted that a publish with nothing new
  // publishes nothing.
  const quiet = await call(DISCARD_PREVIEW, {site: SITE}, ADMIN)

  assert.equal(quiet.errors, undefined)
  assert.equal(quiet.data.discardPreview.canDiscard, false)
  assert.match(quiet.data.discardPreview.reason, /nothing/i)

  const saved = await write(DISCARD_FIELD, 'this one goes')

  assert.equal(saved.errors, undefined)

  const preview = await call(DISCARD_PREVIEW, {site: SITE}, ADMIN)

  assert.equal(preview.errors, undefined)

  const it = preview.data.discardPreview

  assert.equal(it.canDiscard, true, `cannot discard: ${it.reason}`)
  assert.equal(it.reason, null)
  assert.equal(it.revision, saved.data.save.revision)
  assert.ok(it.pages >= 1, `${it.pages} pages`)
  assert.ok(it.fields >= 1, `${it.fields} fields`)
  // Whose edits, and since when. The editors come from the object's own
  // per-field authorship and not from a guess about who is asking.
  assert.ok(it.editors.length >= 1)
  assert.ok(it.editors.some((e: any) => e.sub && e.name))
  assert.ok(it.since, 'the confirmation says since when')
  assert.equal(it.publishedRevision < it.revision, true)
  // A preview writes nothing.
  assert.equal(
    (await call(DISCARD_PREVIEW, {site: SITE}, ADMIN)).data.discardPreview
      .revision,
    it.revision
  )
})

test('a confirmation about a draft that has moved is refused', async () => {
  const before = (await readDraft()).data.draft.revision

  const answer = await call(
    DISCARD,
    {site: SITE, atRevision: before - 1},
    ADMIN
  )

  assert.equal(answer.errors, undefined)
  assert.equal(answer.data.discard.discarded, false)
  assert.match(answer.data.discard.reason, /moved from revision/i)
  // Nothing moved, and the field that was going to go is still there.
  assert.equal((await readDraft()).data.draft.revision, before)
  assert.equal(await draftField(DISCARD_FIELD), 'this one goes')
})

let discardedAtRevision = 0

test('a discard restores the published state, and writes no commit', async () => {
  const headBefore = await branchHead()
  const linesBefore = await patchLines()
  const before = (await readDraft()).data.draft.revision

  const answer = await call(DISCARD, {site: SITE, atRevision: before}, ADMIN)

  assert.equal(answer.errors, undefined)

  const result = answer.data.discard

  assert.equal(result.discarded, true, `not discarded: ${result.reason}`)
  assert.equal(result.previousRevision, before)
  assert.equal(result.revision, before + 1)
  // What the object holds afterwards is exactly what the last migration
  // produced, so there is nothing unpublished in it and the CMS must not say
  // there is.
  assert.equal(result.publishedRevision, result.revision)
  assert.ok(result.pages >= 1)
  assert.ok(result.fields >= 1)
  assert.ok(result.by.name, 'the discard says who made it')
  assert.ok(result.at, 'and when')

  const draft = await readDraft()

  assert.equal(draft.data.draft.revision, result.revision)
  assert.equal(draft.data.draft.publishedRevision, result.revision)
  // Every reader is answered whole after a discard, because the delta
  // vocabulary has no page tombstone and a discard may remove a page.
  assert.equal(draft.data.draft.full, true)
  assert.equal(draft.data.draft.discardedRevision, result.revision)
  assert.ok(draft.data.draft.discardedAt)
  assert.ok(draft.data.draft.discardedByName)

  // The field that was written after the publish is gone, and the field the
  // publish wrote is what the migration wrote.
  assert.equal(fieldValue(draft.data.draft.delta, DISCARD_FIELD), undefined)
  assert.equal(
    fieldValue(draft.data.draft.delta, PUBLISH_FIELD),
    'published two'
  )

  // A discard is a draft act. It touches no repository and no gateway file.
  assert.equal(await branchHead(), headBefore)
  assert.deepEqual(await patchLines(), linesBefore)

  discardedAtRevision = result.revision
})

test('the draft as it stood one instant before is in the backstop', async () => {
  const answer = await call(DISCARDED, {site: SITE}, ADMIN)

  assert.equal(answer.errors, undefined)

  const snapshot = answer.data.discardedDraft

  assert.equal(snapshot.found, true)
  assert.equal(snapshot.revision, discardedAtRevision - 1)
  assert.ok(snapshot.takenAt)
  assert.ok(snapshot.bytes > 200, `${snapshot.bytes} bytes`)
  assert.ok(snapshot.pages > 0)
  // The discarded value is in it, which is what makes the act undoable. The
  // restore that would put it back is not built.
  assert.equal(publishedField(snapshot.data), 'published two')
  assert.equal(
    snapshot.data.pages.find((page: any) => page.id === PAGE)?.jaenFields?.[
      FIELD_TYPE
    ]?.[DISCARD_FIELD]?.value,
    'this one goes'
  )
})

test("a second editor's outbox is dropped rather than reapplied", async () => {
  // Two editors are one identity here, for the reason draft-state.md gives:
  // accounts.netsnek.com offers no password grant and booklimo has one machine
  // account with jaen:admin. What decides this refusal is the base revision
  // and never who is calling, so what is proven is the mechanism the other
  // editor's browser relies on: a save carrying a base from before the discard
  // is refused, named with the revision that invalidated it, and the draft
  // still holds the published state afterwards.
  const stale = await write(
    `${RUN}Resurrected`,
    'this must not come back',
    discardedAtRevision - 1
  )

  assert.equal(stale.data?.save, undefined)
  assert.equal(errorCode(stale), 'DRAFT_DISCARDED')

  const details = stale.errors?.[0]?.extensions?.details

  assert.equal(details?.discardedRevision, discardedAtRevision)
  assert.ok(details?.discardedAt)

  const draft = await readDraft()

  assert.equal(draft.data.draft.revision, discardedAtRevision)
  assert.equal(
    fieldValue(draft.data.draft.delta, `${RUN}Resurrected`),
    undefined
  )

  // And a save made against the restored draft is taken as usual, which is
  // what keeps the refusal narrow: it is about the outbox of a browser that
  // was holding the discarded draft, not about the site being read only.
  const fresh = await write(
    `${RUN}AfterDiscard`,
    'typed after the discard',
    discardedAtRevision
  )

  assert.equal(fresh.errors, undefined)
  assert.equal(fresh.data.save.revision, discardedAtRevision + 1)
  assert.equal(
    await draftField(`${RUN}AfterDiscard`),
    'typed after the discard'
  )
})

test('a discard with nothing to discard changes nothing', async () => {
  // Everything typed after the discard is put back first, so the draft is the
  // published state again and this run leaves the branch as it found it.
  const back = await call(DISCARD, {site: SITE}, ADMIN)

  assert.equal(back.errors, undefined)
  assert.equal(back.data.discard.discarded, true)

  const at = back.data.discard.revision
  const again = await call(DISCARD, {site: SITE}, ADMIN)

  assert.equal(again.errors, undefined)
  assert.equal(again.data.discard.discarded, false)
  assert.match(again.data.discard.reason, /nothing/i)
  assert.equal((await readDraft()).data.draft.revision, at)
})

test('a discard is refused anonymously and to a caller without the role', async () => {
  const anonymousPreview = await call(DISCARD_PREVIEW, {site: SITE})

  assert.equal(anonymousPreview.data?.discardPreview, undefined)
  assert.equal(errorCode(anonymousPreview), 'AUTH_REQUIRED')

  const anonymous = await call(DISCARD, {site: SITE})

  assert.equal(anonymous.data?.discard, undefined)
  assert.equal(errorCode(anonymous), 'AUTH_REQUIRED')

  const customerPreview = await call(DISCARD_PREVIEW, {site: SITE}, CUSTOMER)

  assert.equal(customerPreview.data?.discardPreview, undefined)
  assert.equal(errorCode(customerPreview), 'FORBIDDEN')

  const customer = await call(DISCARD, {site: SITE}, CUSTOMER)

  assert.equal(customer.data?.discard, undefined)
  assert.equal(errorCode(customer), 'FORBIDDEN')

  // Another site's admin, which is the refusal that is easiest to get wrong.
  const foreign = await call(DISCARD, {site: SITE}, FOREIGN)

  assert.equal(foreign.data?.discard, undefined)
  assert.equal(errorCode(foreign), 'FORBIDDEN')

  const backstop = await call(DISCARDED, {site: SITE}, CUSTOMER)

  assert.equal(backstop.data?.discardedDraft, undefined)
  assert.equal(errorCode(backstop), 'FORBIDDEN')
})

/**
 * The identity server answering nothing is not the same as it answering "no".
 *
 * The agent reads a caller's roles out of one lookup through `idm.<brand>`,
 * because these machine tokens carry no roles claim, and that lookup answers
 * `INTERNAL_SERVER_ERROR` for an account it will not talk about and for an
 * account it cannot reach alike. Until 2026-09-08 both were read as "this
 * person holds no roles" and the person was refused: on the live booklimo.at
 * an account that held `jaen:admin` throughout was answered FORBIDDEN for
 * seven minutes and sixteen calls.
 *
 * This gives the Worker a manager credential of the WRONG organisation, which
 * is the shape of the misconfiguration `okf/decisions/hard-rules.md` was
 * written after, and asks for the draft as the site's own admin. The answer
 * must be that the question cannot be decided, and never that the admin may
 * not edit. It runs last because it restarts the runtime twice.
 */
test('an identity lookup that cannot be made refuses to decide, and does not refuse the person', async () => {
  await stopWorker()
  writeFileSync(
    devVars,
    devVarsContent.replace(
      `ORG_USER_MANAGER_TOKEN=${ADMIN}`,
      `ORG_USER_MANAGER_TOKEN=${FOREIGN}`
    ),
    {mode: 0o600}
  )
  await startWorker()

  try {
    const admin = await call(DRAFT, {site: SITE}, ADMIN)

    assert.equal(admin.data?.draft, undefined)
    assert.equal(errorCode(admin), 'IDENTITY_UNAVAILABLE')
    assert.equal(admin.errors?.[0]?.extensions?.statusCode, 503)

    // An anonymous caller is still told to sign in: nothing was looked up.
    const anonymous = await call(DRAFT, {site: SITE})

    assert.equal(errorCode(anonymous), 'AUTH_REQUIRED')
  } finally {
    await stopWorker()
    writeFileSync(devVars, devVarsContent, {mode: 0o600})
    await startWorker()
  }

  // And the credential put back, the same admin is served again, so the
  // refusal above was the credential and not the account.
  const again = await call(DRAFT, {site: SITE}, ADMIN)

  assert.equal(again.data?.draft?.site, SITE)
})

/**
 * A resolution belongs to a site, and the cache below this file is keyed by
 * the token.
 *
 * The same person is an admin on one site and a stranger on the other, and
 * both sites sign in against one Zitadel with one project and one client, so
 * the token cannot tell them apart. Keyed by the token alone, the empty
 * grants of the site the caller is a stranger on were written under their
 * token and read back on the site they administer, refusing them there for
 * the cache's minute. Measured on the deployed agent on 2026-09-08 and it is
 * the shape of the seven minute lockout of that morning.
 */
test('a refusal on one site does not refuse the same caller on another', async () => {
  // A cold cache, because the poisoning is the FIRST resolution of a token
  // winning for its minute: every test above has already resolved this token
  // against booklimo, and a hit is answered out of the entry before
  // resolveCaller is reached at all. The isolate's map goes with the restart
  // and the shared tier is the simulated KV under --persist-to.
  await stopWorker()
  rmSync(path.join(persistTo, 'v3', 'kv'), {recursive: true, force: true})
  authCacheTtlMs = 60_000
  await startWorker()

  try {
    // The site this caller is a stranger on, asked first. This is what writes
    // the empty grants under the token.
    const stranger = await call(DRAFT, {site: OTHER_SITE}, ADMIN)

    assert.equal(stranger.data?.draft, undefined)
    assert.equal(errorCode(stranger), 'FORBIDDEN')

    // The same token, the same minute, the site it is an admin of.
    const after = await call(DRAFT, {site: SITE}, ADMIN)

    assert.equal(errorCode(after), undefined)
    assert.equal(after.data?.draft?.site, SITE)
  } finally {
    await stopWorker()
    authCacheTtlMs = 0
    await startWorker()
  }
})

/**
 * A save that changes nothing is not a revision.
 *
 * The CMS reads `revision > publishedRevision` as "there is something
 * unpublished", so a write of the value that is already in the draft used to
 * make it say the site had unpublished changes it did not have. Every field
 * write stamps the page's `modifiedAt`, which is why this could not be seen by
 * comparing the page nodes and why the object puts that stamp back.
 */
test('a save of the value already there does not move the revision', async () => {
  const field = `noop-${Date.now()}`
  const value = 'the same either way'

  const first = (await write(field, value)).data.save

  assert.equal(typeof first.revision, 'number')
  assert.ok(first.keys > 0)

  const again = (await write(field, value, first.revision)).data.save

  assert.equal(again.revision, first.revision, 'the revision stood still')
  assert.equal(again.keys, 0, 'and nothing was written')

  const draft = await readDraft()

  assert.equal(draft.data.draft.revision, first.revision)
})
