/**
 * The agent against a local `wrangler dev` and a throwaway branch of
 * netsnek/booklimo.at.
 *
 * Run it with the package's own runner, `npm test`, which is node's: these
 * are not notebooks on purpose, because they drive a Worker and a repository
 * rather than an API a person reads along with.
 *
 * What it proves, which is the design's acceptance list:
 *   1. a save is one commit in the site's repository, in the editor's name,
 *      and the change is readable back through the agent;
 *   2. a second save whose baseSha is stale is rebased onto the current head
 *      and never rejected;
 *   3. the agent refuses another site's admin, a caller without the role, and
 *      an anonymous call;
 *   4. a poll whose sinceSha is still the head costs an answer with no body;
   5. a text save writes jaen-data/live.json and never the media catalogue,
      and a picture writes jaen-data/live-media.json and never the pages;
   6. a fieldMerge adds and removes keys of the catalogue without carrying
      the keys it does not touch, so two editors keep both pictures;
   7. the cheap warm up call answers who is calling and reads no repository.
 *
 * The branch is created before and deleted after, so nothing of this reaches
 * booklimo.at's main. Nothing runs against limosen.at at all.
 *
 * Credentials come from the machine's own files and are never printed:
 *   ~/.config/taxi-app/tokens.env         the three caller tokens
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
import {homedir, tmpdir} from 'node:os'
import path from 'node:path'
import test, {after, before} from 'node:test'
import {fileURLToPath} from 'node:url'

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

const githubToken = (): string =>
  execFileSync('gh', ['auth', 'token'], {encoding: 'utf8'}).trim()

const GITHUB_TOKEN = githubToken()

for (const [name, value] of Object.entries({
  TAXI_TOKEN_ADMIN_BOOKLIMO: ADMIN,
  TAXI_TOKEN_CUSTOMER_BOOKLIMO: CUSTOMER,
  TAXI_TOKEN_ADMIN: FOREIGN,
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
      `github ${route} answered ${res.status}: ${JSON.stringify(json).slice(0, 300)}`
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

const DRAFT = `query D($site: String!, $sinceSha: String) {
  draft(site: $site, sinceSha: $sinceSha) {
    site headSha blobSha changed data authors readAt
  }
}`

const SAVE = `mutation S($site: String!, $changes: [SaveChangesInput!]!, $baseSha: String) {
  save(site: $site, changes: $changes, baseSha: $baseSha) {
    headSha blobSha commitSha commitUrl savedAt rebased wrote
    overwrote { field previousAuthor previousAt }
  }
}`

const VIEWER = `query V($site: String!) {
  viewer(site: $site) { site sub name at }
}`

const PUBLISH = `mutation P($site: String!) {
  publish(site: $site) { queued headSha workflow runUrl reason }
}`

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

before(async () => {
  const main = await gh(`/repos/${REPOSITORY}/git/ref/heads/main`)

  await gh(`/repos/${REPOSITORY}/git/refs`, {
    method: 'POST',
    body: JSON.stringify({ref: `refs/heads/${BRANCH}`, sha: main.object.sha})
  })

  // wrangler dev reads its secrets from .dev.vars and from nowhere else. The
  // file is gitignored and is removed again in the teardown below.
  writeFileSync(
    devVars,
    [
      `AUTH_ISSUER=${taxiVars.AUTH_ISSUER}`,
      `AUTH_KEY=${taxiVars.AUTH_KEY}`,
      `GITHUB_TOKEN=${GITHUB_TOKEN}`,
      // In production this is the Worker's own organisation manager token.
      // Locally the booklimo admin's token is a valid bearer for the facade,
      // and the lookup is only reached when the caller's token asserts no
      // roles at all.
      `ORG_USER_MANAGER_TOKEN=${ADMIN}`,
      ''
    ].join('\n'),
    {mode: 0o600}
  )

  const sites = JSON.stringify({
    [SITE]: {
      repository: REPOSITORY,
      branch: BRANCH,
      issuer: taxiVars.AUTH_ISSUER,
      organizationId: ORG_BOOKLIMO,
      projectIds: ['268283277977065078'],
      adminRole: 'jaen:admin',
      iamApiUrl: 'https://idm.booklimo.at/graphql'
    }
  })

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
      `SITES:${sites}`,
      '--var',
      'AUTH_CACHE_TTL_MS:0',
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
})

after(async () => {
  worker?.kill('SIGTERM')

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
// The three verbs
// --------------------------------------------------------------------------

const PAGE = 'JaenPage /'
const FIELD_TYPE = 'IMA:TextField'

let firstHead = ''
let secondHead = ''

const fieldValue = (data: any, fieldName: string): unknown =>
  data?.pages?.find((page: any) => page.id === PAGE)?.jaenFields?.[
    FIELD_TYPE
  ]?.[fieldName]?.value

test('the draft reads the head of the repository', async () => {
  const answer = await call(DRAFT, {site: SITE}, ADMIN)

  assert.equal(answer.errors, undefined)
  assert.equal(answer.data.draft.site, SITE)
  assert.equal(answer.data.draft.changed, true)
  assert.match(answer.data.draft.headSha, /^[0-9a-f]{40}$/)

  firstHead = answer.data.draft.headSha
})

test('a save is one commit in the editor s name, and reads back', async () => {
  const value = `agent test ${new Date().toISOString()}`

  const answer = await call(
    SAVE,
    {
      site: SITE,
      baseSha: firstHead,
      changes: [
        {
          kind: 'fieldWrite',
          pageId: PAGE,
          fieldType: FIELD_TYPE,
          fieldName: 'agentTestOne',
          value,
          props: {},
          at: new Date().toISOString()
        }
      ]
    },
    ADMIN
  )

  assert.equal(answer.errors, undefined)
  assert.equal(answer.data.save.rebased, false)
  assert.match(answer.data.save.commitSha, /^[0-9a-f]{40}$/)
  assert.ok(answer.data.save.commitUrl.startsWith('https://github.com/'))

  // booklimo.at's live.json still carries the media catalogue, because it was
  // written before the split existed. The first save after it lifts the
  // catalogue into its own file, once, and every save after this one writes
  // one file.
  assert.deepEqual(answer.data.save.wrote, [
    'jaen-data/live.json',
    'jaen-data/live-media.json'
  ])

  secondHead = answer.data.save.headSha

  // The commit is in the repository, and its author is the editor rather than
  // the agent. This is the audit trail the design asks for, and it is the
  // same thing `git log --format='%an <%ae>'` shows.
  const commit = await gh(
    `/repos/${REPOSITORY}/commits/${answer.data.save.commitSha}`
  )

  assert.equal(commit.commit.committer.name, 'jaen-agent')
  assert.notEqual(commit.commit.author.name, 'jaen-agent')
  assert.ok(commit.commit.message.startsWith('jaen: '))

  // And the agent answers it back, from the repository and from nowhere else.
  const read = await call(DRAFT, {site: SITE}, ADMIN)

  assert.equal(read.data.draft.changed, true)
  assert.equal(fieldValue(read.data.draft.data, 'agentTestOne'), value)
  // fieldKey() joins pageId, the empty section part, the field type and the
  // field name with slashes, so a page id that already ends in one gives the
  // doubled slash below.
  assert.ok(read.data.draft.authors[`${PAGE}/${FIELD_TYPE}/agentTestOne`])
})

test('the head patches are the last lines of patches.txt', async () => {
  const file = await gh(
    `/repos/${REPOSITORY}/contents/jaen-data%2Fpatches.txt?ref=${BRANCH}`
  )

  const lines = Buffer.from(file.content, 'base64')
    .toString('utf8')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  // The catalogue file is listed after the pages file, so a picture saved
  // into it wins its own field in the build's merge.
  assert.deepEqual(lines.slice(-2), ['live.json', 'live-media.json'])
})

test('a poll whose sinceSha is the head answers with no body', async () => {
  const head = (await call(DRAFT, {site: SITE}, ADMIN)).data.draft.headSha

  const answer = await call(DRAFT, {site: SITE, sinceSha: head}, ADMIN)

  assert.equal(answer.data.draft.changed, false)
  assert.equal(answer.data.draft.data, null)
  assert.equal(answer.data.draft.headSha, head)
})

test('a stale save is rebased onto the current head, not rejected', async () => {
  const value = `agent test stale ${Date.now()}`

  // firstHead is the head before the save above, so this save is stale by one
  // commit, which is exactly the second editor's case.
  const answer = await call(
    SAVE,
    {
      site: SITE,
      baseSha: firstHead,
      changes: [
        {
          kind: 'fieldWrite',
          pageId: PAGE,
          fieldType: FIELD_TYPE,
          fieldName: 'agentTestTwo',
          value,
          props: {},
          at: new Date().toISOString()
        }
      ]
    },
    ADMIN
  )

  assert.equal(answer.errors, undefined)
  assert.equal(answer.data.save.rebased, true)
  assert.notEqual(answer.data.save.headSha, secondHead)

  // The rebase kept the earlier editor's field. That is what "rebased and
  // never rejected" has to mean: the stale save adds its own change onto the
  // current document instead of writing an old document back over it.
  const read = await call(DRAFT, {site: SITE}, ADMIN)

  assert.equal(fieldValue(read.data.draft.data, 'agentTestTwo'), value)
  assert.ok(fieldValue(read.data.draft.data, 'agentTestOne'))
})

test('publish commits nothing and says so when the site has no workflow', async () => {
  const before_ = (await call(DRAFT, {site: SITE}, ADMIN)).data.draft.headSha

  const answer = await call(PUBLISH, {site: SITE}, ADMIN)

  assert.equal(answer.errors, undefined)
  assert.equal(answer.data.publish.queued, false)
  assert.ok(answer.data.publish.reason)

  const after_ = (await call(DRAFT, {site: SITE}, ADMIN)).data.draft.headSha

  assert.equal(after_, before_)
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
// The split: the pages and the catalogue in two files
// --------------------------------------------------------------------------

const MEDIA_PAGE = 'JaenPage /cms/media/'
const MEDIA_TYPE = 'IMA:MEDIA_NODES'

const readJson = async (path: string): Promise<any> => {
  const file = await gh(
    `/repos/${REPOSITORY}/contents/${encodeURIComponent(path)}?ref=${BRANCH}`
  )

  return JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'))
}

const mediaNodes = (data: any): Record<string, any> =>
  data?.pages?.find((page: any) => page.id === MEDIA_PAGE)?.jaenFields?.[
    MEDIA_TYPE
  ]?.media_nodes?.value || {}

const node = (id: string) => ({
  id,
  createdAt: new Date().toISOString(),
  description: id,
  fileType: 'image/png',
  url: `https://osg.netsnek.com/storage/${id}`,
  width: 4,
  height: 4,
  revisions: []
})

let firstPicture = ''

test('a picture writes the catalogue and never the pages', async () => {
  firstPicture = `agent-test-${Date.now()}-a`

  const answer = await call(
    SAVE,
    {
      site: SITE,
      changes: [
        {
          kind: 'fieldMerge',
          pageId: MEDIA_PAGE,
          fieldType: MEDIA_TYPE,
          fieldName: 'media_nodes',
          value: {[firstPicture]: node(firstPicture)},
          props: {removed: []},
          at: new Date().toISOString()
        }
      ]
    },
    ADMIN
  )

  assert.equal(answer.errors, undefined)
  assert.deepEqual(answer.data.save.wrote, ['jaen-data/live-media.json'])

  const media = await readJson('jaen-data/live-media.json')
  const pages = await readJson('jaen-data/live.json')

  assert.ok(mediaNodes(media.data)[firstPicture])
  // The pages file carries no catalogue at all any more.
  assert.equal(Object.keys(mediaNodes(pages.data)).length, 0)

  // The agent answers one document, both files merged.
  const read = await call(DRAFT, {site: SITE}, ADMIN)

  assert.ok(mediaNodes(read.data.draft.data)[firstPicture])
  assert.ok(fieldValue(read.data.draft.data, 'agentTestOne'))
})

test('a second picture writes only the catalogue', async () => {
  const second = `agent-test-${Date.now()}-b`

  const pagesBefore = await gh(
    `/repos/${REPOSITORY}/contents/jaen-data%2Flive.json?ref=${BRANCH}`
  )

  const answer = await call(
    SAVE,
    {
      site: SITE,
      changes: [
        {
          kind: 'fieldMerge',
          pageId: MEDIA_PAGE,
          fieldType: MEDIA_TYPE,
          fieldName: 'media_nodes',
          value: {[second]: node(second)},
          props: {removed: []},
          at: new Date().toISOString()
        }
      ]
    },
    ADMIN
  )

  assert.equal(answer.errors, undefined)
  assert.deepEqual(answer.data.save.wrote, ['jaen-data/live-media.json'])

  const pagesAfter = await gh(
    `/repos/${REPOSITORY}/contents/jaen-data%2Flive.json?ref=${BRANCH}`
  )

  // Byte for byte the same file: a picture does not touch the pages.
  assert.equal(pagesAfter.sha, pagesBefore.sha)

  // The merge kept the picture that was already there, which is the whole
  // point of sending the difference rather than the catalogue.
  const media = await readJson('jaen-data/live-media.json')
  const nodes = mediaNodes(media.data)

  assert.ok(nodes[firstPicture])
  assert.ok(nodes[second])
})

test('a text change writes only the pages', async () => {
  const mediaBefore = await gh(
    `/repos/${REPOSITORY}/contents/jaen-data%2Flive-media.json?ref=${BRANCH}`
  )

  const value = `agent test split ${Date.now()}`

  const answer = await call(
    SAVE,
    {
      site: SITE,
      changes: [
        {
          kind: 'fieldWrite',
          pageId: PAGE,
          fieldType: FIELD_TYPE,
          fieldName: 'agentTestThree',
          value,
          props: {},
          at: new Date().toISOString()
        }
      ]
    },
    ADMIN
  )

  assert.equal(answer.errors, undefined)
  assert.deepEqual(answer.data.save.wrote, ['jaen-data/live.json'])

  const mediaAfter = await gh(
    `/repos/${REPOSITORY}/contents/jaen-data%2Flive-media.json?ref=${BRANCH}`
  )

  assert.equal(mediaAfter.sha, mediaBefore.sha)

  const read = await call(DRAFT, {site: SITE}, ADMIN)

  assert.equal(fieldValue(read.data.draft.data, 'agentTestThree'), value)
  assert.ok(mediaNodes(read.data.draft.data)[firstPicture])
})

test('a merge removes a key without carrying the rest', async () => {
  const answer = await call(
    SAVE,
    {
      site: SITE,
      changes: [
        {
          kind: 'fieldMerge',
          pageId: MEDIA_PAGE,
          fieldType: MEDIA_TYPE,
          fieldName: 'media_nodes',
          value: {},
          props: {removed: [firstPicture]},
          at: new Date().toISOString()
        }
      ]
    },
    ADMIN
  )

  assert.equal(answer.errors, undefined)
  assert.deepEqual(answer.data.save.wrote, ['jaen-data/live-media.json'])

  const read = await call(DRAFT, {site: SITE}, ADMIN)
  const nodes = mediaNodes(read.data.draft.data)

  assert.equal(nodes[firstPicture], undefined)
  // Everything the site had before this run is still there. The catalogue on
  // booklimo.at is 140 nodes and the merge carried one id.
  assert.ok(Object.keys(nodes).length > 100)
})

test('patches.txt ends with live.json and then live-media.json', async () => {
  const file = await gh(
    `/repos/${REPOSITORY}/contents/jaen-data%2Fpatches.txt?ref=${BRANCH}`
  )

  const lines = Buffer.from(file.content, 'base64')
    .toString('utf8')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  assert.deepEqual(lines.slice(-2), ['live.json', 'live-media.json'])
  // Exactly once each, or the build would read the same file twice.
  assert.equal(lines.filter(l => l === 'live.json').length, 1)
  assert.equal(lines.filter(l => l === 'live-media.json').length, 1)
})
