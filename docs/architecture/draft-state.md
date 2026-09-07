# The shared draft: jaen's editing state lives on a jaen service, not in one browser

Owner (Florian), 2026-09-07: "it would make sense putting all of it in the
jaen agent pylon. It does make sense to commit everything to the
repository, but committing is fast, building is slow, and just committing
the jaen data does not take a great amount of time, it is the build that
does. The same concept applies for publishing in general: we already have
a system that supports a temporary data state in editing mode, but
unfortunately it is only in local storage and not shared. A saved state
would make sense, but it is important that it is jaen native, not an
add-on from an app. It would fix a major flaw that currently exists in
jaen."

## Today

The CMS keeps every unpublished change in a redux store persisted to
`localStorage` (`packages/jaen/src/redux/persist-state.ts`), so a change
exists in exactly one browser until it is published. Publishing writes the
jaen data to the site's repository and starts the build, which takes
minutes, so an editor who only wants a colleague to see a draft, or a
picture in the media library on a second device, has to publish and
wait. Media uploads reach the storage gateway at once, but their entries
(`media_nodes`) are page data and follow the same path.

## Target, corrected by the owner the same evening

Owner: "I still want the jaen agent to store in git with git commits and
the jaen data structure like currently. I want it to retrieve that data
from GitHub as well, not a separate database."

**The repository is the store. There is no database.** The draft of a
site is the site's own jaen data in its own repository, in the structure
it has today (`jaen-data/`, the patches, the media nodes), and the jaen
agent is the one process that reads it from GitHub and writes it back as
git commits. What editors share is the repository's HEAD, not a copy of
it anywhere else.

**One jaen service, the jaen agent, a Pylon of jaen's own.** It is jaen
native: `packages/jaen-agent` in this repository, configured on a site
through one plugin option (`agent: {url, repository}`), with no knowledge
of any app. It holds no state of its own beyond a short cache of what it
last read from GitHub and a queue of commits in flight, both in memory or
in a KV of the Worker, never a database of record.

**Three verbs instead of one.**

- **Save** (automatic, on every change, debounced): the CMS sends the
  change to the agent, the agent reads the current jaen data of the
  repository, applies the change, and commits it to the repository in
  the editor's name, one commit per saved change or per debounced batch,
  through the GitHub API. Every other editor's CMS receives the new HEAD
  (a poll of the agent while the CMS is open). Committing is fast, that
  is the point. `localStorage` stays as the offline queue and the cache,
  nothing else. Two editors on one field: the later commit wins, and the
  CMS shows the field's last author and instant.
- **Publish** (the button that exists): the build, as today, from the
  repository's HEAD. Nothing is committed at publish time that was not
  committed at save time.
- There is no separate commit button: saving is committing.

**Media without a build.** The media library reads its nodes from the
repository's HEAD through the agent, so a picture uploaded on one device
(the file on the storage gateway, the node committed by the agent)
appears in the library on every device at once, and a page that uses it
shows it after the next publish, as before. The app folders of the taxi
platform stay where they are (its own pylon).

**Identity.** The agent trusts the same identity server the site uses
(Zitadel, the site's own organisation), introspects the CMS's token
through the identity facade where one exists, and lets `jaen:admin` of
that site read and write that site's repository, nobody else. The
repository credential is the agent's own (a GitHub App installation or a
fine-grained token per repository, held as a Worker secret), the editor's
identity goes into the commit's author line.

**Where it runs.** A Cloudflare Worker beside the taxi pylons in the same
account, deployed with the same script family, one instance for every site of
the estate, limosen.at and booklimo.at first. `agent.jaen.netsnek.com` is not
the name it could take: a Worker custom domain needs its zone in the Worker's
own Cloudflare account, `netsnek.com` is a zone of the account
`a4b0e1ba603b529a64d355679ff2911a`, and the taxi pylons live in
`92920a0740087f4d54d9201675220d43`, whose zones are booklimo.at, limosen.at,
colorpedia.org, psylon.dev and whiss.org. The account was the requirement and
the name gave way: one Worker under one custom domain per site,
`jaen-agent.booklimo.at` and `jaen-agent.limosen.at`, each on the site's own
zone, which also keeps the two brands off each other's hostnames. A KV namespace for the read cache and the in-flight
queue is allowed, D1 or any other database is not.

## Design

### The draft in redux today

`packages/jaen/src/redux/index.tsx` builds one store out of five reducers
and preloads it from `localStorage` under the key `jaenjs-state`. Three of
the five carry the draft, two do not.

| slice    | holds                                                                                                                                                                                      | part of the draft            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| `page`   | `pages.nodes`, a `Record<pageId, Partial<JaenPage>>` with `jaenFields`, `sections`, `childPages`, `deleted`, `modifiedAt`, plus the session's `registeredPageFields` and `lastAddedNodeId` | yes, `nodes` only            |
| `site`   | `siteMetadata`                                                                                                                                                                             | yes                          |
| `widget` | `nodes`, an array of widgets with `createdAt` and `modifiedAt`                                                                                                                             | yes                          |
| `status` | `isEditing`, `isPublishing`                                                                                                                                                                | no, one browser tab's mode   |
| `popup`  | `nodes` and `advanced.<id>.pageViews`                                                                                                                                                      | no, a visitor's own counters |

The media library is not a slice. `containers/media.tsx` reads and writes
one jaen field, `useField('media_nodes', 'IMA:MEDIA_NODES')`, which lands
in `page.pages.nodes[<media page>].jaenFields['IMA:MEDIA_NODES'].media_nodes.value`,
so a media node is a page field like any other and needs no path of its
own in what follows.

`persist-state.ts` is the whole persistence layer. `PersistState(persistKey)`
returns `loadState`, `saveState`, `persistState` and `persistMiddleware`.
`persistState` subscribes to the store and writes the entire state to
`localStorage` after every action, stripping `isLoading` and `error`
recursively on the way out. `persistMiddleware` is `onErrorResetAndRery`,
which drops the key and dispatches `RESET_STATE` when a reducer throws.
There is no other writer and no reader but the browser that wrote it, which
is the flaw the target names.

### Where the publish action commits today

`packages/jaen/src/contexts/cms-management.tsx`, `publishDraft` at line 557:

1. It prompts for a commit message.
2. It builds `{message, createdAt, data: {pages, site, widgets}}` out of the
   three draft slices and uploads it to the storage gateway as
   `migrations-<epoch>.json` through `utils/open-storage-gateway`, which is
   `storageUrl` of the plugin options, `https://osg.netsnek.com` on both
   sites.
3. It calls the `publish` mutation with that URL and a config of
   `__JAEN_REMOTE__.repository` and `__JAEN_REMOTE__.cwd` through `sqJaen`,
   which posts to `__JAEN_PYLON_URL__`. Both `gatsby-config.ts` files set
   that to `https://services.netsnek.com/jaen/graphql`, and the OIDC access
   token out of `sessionStorage` is the bearer.
4. On success it sets `isPublishing` and leaves the draft in the store.

The service behind that URL has no source in the estate's checkouts, and
what it does is legible from the workflow it triggers. It fires a GitHub
`repository_dispatch`, `POST https://api.github.com/repos/<owner>/<repo>/dispatches`
with `{"event_type": "UPDATE_JAEN_RESOURCE", "client_payload": {"migrationURL": ...}}`,
signed with the service's own GitHub token, and
`.github/workflows/jaen-publish.yaml` in the site repository answers it: it
checks out `main`, refuses a URL outside the storage gateway, appends the
line to `jaen-data/patches.txt` unless it is already there, commits as
`jaen publish <noreply.snek.at@gmail.com>`, rebases and pushes. That is the
only commit a publish makes. **No build follows on these two sites**, because
the jaen packages are `link:` dependencies on a sibling checkout the runner
does not have, so the build stays `scripts/deploy.sh` run by a human after a
pull.

`~/git/jaen-agent-v2` is the rewritten agent that replaces the dispatch with
two contents API calls, `GET /repos/<repo>/contents/jaen-data%2Fpatches.txt?ref=main`
and a `PUT` of the same path with the read `sha`, on `agent.jaen.io`. It is
not what `services.netsnek.com/jaen` serves today. It is the starting point
for the agent below, and its `src/hosts` and `src/stubs` move into it
unchanged rather than being written a third time.

At build time `gatsby-source-jaen/src/source-nodes/jaen-data.ts` reads
`jaen-data/patches.txt`, one entry per line, fetches the `https://` lines
through `fetchWithCache` and reads any other line as a file **inside**
`jaen-data` with a traversal and symlink check, then deepmerges every
`{createdAt, message, data}` in file order with `deepmergeArrayIdMerge`.
The last patch wins a field. That local file path already exists and is what
makes the design below cheap.

### The repository as the store: one head patch

The agent owns exactly one file per site, **`jaen-data/live.json`**, listed
as the last line of `jaen-data/patches.txt`. Every save rewrites it with the
merged draft of the whole site, in the patch shape the build already reads,
`{createdAt, message, data: {pages, site, widgets}}`. Because it is last in
the chain it wins the deepmerge, so the repository's HEAD is at all times a
buildable statement of the current content.

That is what lets publish commit nothing. The alternative, sealing the head
file into a dated patch at publish time and starting a fresh one, was
rejected: it puts a commit back into the publish path, which the target
forbids, and it buys only a tidier file list. The historical patches
(`2025-11-30-1653-sanitised.json` and the rest) stay frozen exactly as they
are, and a maintainer who wants to fold the head file into a dated one does
it with an ordinary commit that the agent neither makes nor needs to know
about.

`patches.txt` is touched only when `live.json` is not yet in it, once per
site, in the same commit as the first save.

### The agent's API

`packages/jaen-agent`, a Pylon v3 service. Positional arguments, because
Pylon maps them to flat GraphQL arguments. Resolvers are plain object
literals or arrow properties, never class methods, because Pylon v3 pulls a
resolver off its parent and calls it without a receiver, so a method loses
`this`.

```graphql
type Query {
  version: Version!
  draft(site: String!, sinceSha: String): Draft!
}

type Mutation {
  save(
    site: String!
    changes: [SaveChangesInput!]!
    baseSha: String
  ): SaveResult!
  publish(site: String!): PublishResult!
}

type Draft {
  site: String!
  headSha: String! # the branch HEAD commit the answer was read at
  blobSha: String! # jaen-data/live.json at that commit
  changed: Boolean! # false when sinceSha is still the head
  data: JSONObject # null when changed is false
  authors: JSONObject # fieldKey -> {sub, name, at}
  readAt: String!
}

type SaveResult {
  headSha: String!
  blobSha: String!
  commitSha: String!
  commitUrl: String!
  savedAt: String!
  rebased: Boolean!
  overwrote: [FieldOverwrite!]! # field, the previous author, the previous instant
}

type PublishResult {
  queued: Boolean!
  headSha: String!
  workflow: String
  runUrl: String
  reason: String # why not, when queued is false
}
```

`draft(site)` reads the repository's HEAD. It resolves the branch head with
`GET /repos/<repo>/commits/<branch>`, reads `jaen-data/live.json` with
`GET /repos/<repo>/contents/...?ref=<branch>`, and answers the parsed `data`
plus both shas. `sinceSha` is the head the caller already has: when it still
matches, the answer is `changed: false` with no body, which is what almost
every poll costs.

`save(site, changes, baseSha)` applies the changes and commits, in the
editor's name, one commit per call. `publish(site)` triggers the build and
commits nothing.

### The shape of a change

A change is one dispatched redux action, named and flattened, so the client
sends what it already produces and the agent needs no diffing.

```ts
interface JaenChangeInput {
  kind:
    | 'fieldWrite' // page.field_write
    | 'sectionAdd' // page.section_add
    | 'sectionRemove' // page.section_remove
    | 'sectionMove' // page.section_move
    | 'pageUpdate' // page.page_updateOrCreate
    | 'pageDelete' // page.page_markForDeletion
    | 'siteMetadata' // site.updateSiteMetadata
    | 'widgetWrite' // widget.writeData
  pageId?: string
  section?: {path: Array<{fieldName: string; sectionId?: string}>; id: string}
  fieldType?: string
  fieldName?: string
  value?: any // Any! in the schema, see below: always sent
  props?: Record<string, any> // JSONObject, may be omitted
  at: string // the client's instant, advisory only
}
```

`value` and `props` are the `JSON` scalar, because a jaen field's value is
whatever the field type stores. The agent stamps the author itself out of
the introspected token and ignores any author the client sends. It applies a
change with the same reducer logic the client has, extracted into
`packages/jaen/src/redux/apply-change.ts` and imported by both sides, so the
browser and the agent can never disagree about what `sectionMove` means.

Three names in that schema are pylon's and not this document's, because pylon
derives the schema from the TypeScript rather than the other way round, and a
client that guesses them wrong is refused before a resolver runs. The input
type is **`SaveChangesInput`**, named after the field and the argument it
belongs to and never after the TypeScript interface, with `SectionInput` and
`PathInput` nested in it. `value` is **`Any!`**, non-null, because pylon
renders a TypeScript `any` that way and offers no spelling that makes it
nullable, so a kind that carries no value sends `{}` and every branch of the
applier ignores it. `props` is `JSONObject` and may be omitted. The derived
schema is `packages/jaen-agent/.pylon/schema.graphql` after a build and is the
authority over this block.

A call carries at most 200 changes and at most one megabyte, which the
debounce below never approaches.

### Conflicts: the later commit wins

`baseSha` is the head sha the client last saw, from its last `draft` or
`save` answer. The rule is that a stale save is rebased and never rejected.

1. Take the site's lock, a KV key `lock:<site>` written with a fifteen second
   TTL, waited on for at most three seconds. Two saves of one site serialise
   instead of racing the contents API.
2. Read `jaen-data/live.json` at the branch HEAD, now, ignoring the cache.
3. When `baseSha` is not the current head, the save is stale. Apply the
   changes onto the document just read, which is the rebase, and answer
   `rebased: true` with `overwrote`, the fields whose remote value a change
   replaced together with who wrote them and when.
4. `PUT` the file with the blob sha from step 2 as `sha`, so GitHub refuses
   the write if the file moved in between. On a 409 the whole loop repeats,
   three times, then the call answers an error and the client keeps the
   changes in its queue.
5. Release the lock.

Because a change is a field and not a document, two editors on different
fields never collide at all. Two editors on one field resolve as the target
says, the later commit wins, and the CMS shows the field's last author and
instant from `Draft.authors`, which the agent keeps in the head patch beside
the data.

### Identity

Copied from the taxi pylon, `pylon/src/auth` and `pylon/src/oidc/zitadel.ts`.

`AUTH_ISSUER` is mandatory. There is no unauthenticated variant of this
service and the Worker refuses to start without the variable, because the
agent holds write access to every site repository of the estate.

`useAuth({issuer: AUTH_ISSUER})` runs on every request, wrapped in the
introspection cache: the answer is remembered per SHA-256 of the bearer for
`AUTH_CACHE_TTL_MS`, sixty seconds by default, and refreshed in the
background past half its life. Without it every call pays two round trips of
about 750 ms to `accounts.netsnek.com`, which is what the taxi pylon
measured on 2026-09-05. Pylon's own `@requireAuth()` is not used, because it
only checks that `auth` is truthy and `useAuth` sets that on an anonymous
request as well. The agent has its own `requireAuth` demanding `auth.user`.

Roles come from the `urn:zitadel:iam:org:project(s):(<id>:)?roles` claims of
the introspection answer, with a project scope stripped off the key. When
the token asserts none, the agent makes one grant lookup through the site's
identity facade, `iamApiUrl` of the site entry, `https://idm.limosen.at/graphql`
and `https://idm.booklimo.at/graphql`, with the Worker's own
`ORG_USER_MANAGER_TOKEN` as the bearer rather than the caller's token. A
failed lookup answers an empty list, which is a caller with no roles and
never an admin. Every outgoing fetch carries a `User-Agent`, because
Cloudflare fronts the issuer and answers a request without one with
`error code: 1010` in plain text, which is not JSON.

**Which site the caller may touch.** The site is named by a site key and not
derived from the audience. limosen.at and booklimo.at sign in against the
same Zitadel, the same CMS project `268283277977065078` and the same client
`268283382465631862@cms`, so the audience is identical on both and cannot
tell them apart. What differs is the organisation, `339284789469124181` for
limosen and `356348844407002709` for booklimo. So: the site key names the
repository, the identity decides the permission. A call is allowed when the
token introspected at the entry's issuer, the caller holds the entry's
`adminRole` (`jaen:admin`) in one of its `projectIds`, and the caller's
resource owner (`urn:zitadel:iam:user:resourceowner:id`) or the organisation
of that grant is the entry's `organizationId`. limosen's admin therefore
gets a `FORBIDDEN` on booklimo, and an anonymous call an `AUTH_REQUIRED`,
which is acceptance 3.

The site table is a Worker var `SITES`, a JSON object, not a database:

```json
{
  "booklimo.at": {
    "repository": "netsnek/booklimo.at",
    "branch": "main",
    "issuer": "https://accounts.netsnek.com",
    "organizationId": "356348844407002709",
    "projectIds": ["268283277977065078"],
    "adminRole": "jaen:admin",
    "iamApiUrl": "https://idm.booklimo.at/graphql",
    "publishWorkflow": "deploy.yaml",
    "installationId": "<GitHub App installation>"
  }
}
```

### The GitHub credential and the commit author

A **GitHub App**, `jaen-agent`, installed per repository. The Worker holds
`GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY` as secrets, signs its own JWT
with WebCrypto RS256 (no Node crypto needed on a Worker) and mints an
installation token per request, cached in KV for its hour. A fine grained
personal token per repository, `GITHUB_TOKEN`, stays supported as the
interim before the App exists and as the fallback for a repository outside
the App's account, and a site entry may name which it uses.

The App is the decision because a fine grained token belongs to one human,
expires within a year at the latest and takes every site down when it does,
and adding a site means minting and deploying a new secret. An App
installation adds a site by installing the App, and its token is short
lived by construction.

The credential is the agent's own either way. The editor's identity goes in
the commit, which the contents API takes on the `PUT`:

```json
{
  "message": "jaen: Florian Kleber edited 3 fields on /leistungen",
  "author": {
    "name": "<the token's name claim>",
    "email": "<the token's email claim>"
  },
  "committer": {"name": "jaen-agent", "email": "noreply.snek.at@gmail.com"}
}
```

An editor without an email claim gets `<sub>@users.noreply.<site>`, which is
stable and never routes anywhere. `git log --format='%an <%ae>'` on the site
repository is then the audit trail acceptance 2 asks for.

### The client: a persistence layer beside persist-state

A new file, `packages/jaen/src/redux/remote-state.ts`, next to
`persist-state.ts` and shaped like it. `RemoteState(agent)` returns
`{recordMiddleware, connect(store)}` and `index.tsx` adds the middleware to
the store and calls `connect` when `__JAEN_AGENT__` is defined. Nothing
changes when it is not, so a site without the plugin option behaves exactly
as it does today.

**A new `remote` slice**, added to `combineReducers`, holding `outbox` (the
recorded changes not yet acknowledged), `headSha`, `saveState` of
`idle | saving | saved | offline | error`, `lastSavedAt`, `authors` and
`lastError`. `status` keeps `isEditing` and `isPublishing` untouched. The
outbox lives in the store rather than in a module, so `persist-state`
already writes it to `localStorage` on every action and reloads it on the
next start. **That is the offline queue, for free**: a browser that loses the
network keeps editing, the outbox grows in `localStorage`, and the flusher
drains it when a call succeeds again. `RESET_STATE` clears the outbox with
the rest, because discard means the unsent changes go too.

**The recorder** is a middleware that translates the eight draft-bearing
actions of the `page`, `site` and `widget` slices into a `JaenChangeInput`
and appends it. It only records. It never sends, so a save cannot make a
dispatch fail.

**The flusher** sends after 800 ms of quiet or at twenty queued changes,
whichever comes first, in one `save` call carrying the batch and the known
`headSha`. On success it drops the flushed entries, stores the new head and
sets `saved` with the instant. On a network failure it leaves the outbox
alone, sets `offline` and retries after 2, 5, 15 and then every 30 seconds.
The debounced batch is the unit of a commit, not the single change: a commit
per keystroke would be one contents API round trip per character and a
history nobody can read.

**The poller** asks `draft(site, sinceSha: headSha)` every five seconds
while the CMS is mounted or `status.isEditing` is set, and stops otherwise.
`changed: false` is the usual answer and costs almost nothing. When the head
moved, the client dispatches `hydrateFromRemote` on the three draft slices
with the remote document, and those reducers keep any field that has an
entry in the outbox, so a local unsent edit is never overwritten by a poll.
Five seconds is comfortably inside the ten second acceptance.

Polling and not a socket: a socket on a Worker needs a Durable Object, and a
Durable Object is a store of record on the wrong side of the no-database
rule.

### The plugin option

One option in `JaenPluginOptions`
(`packages/gatsby-plugin-jaen/gatsby/gatsby-node.ts` and
`src/gatsby/types.ts`), defined for the browser in the same
`plugins.define` block as the existing four globals, as `__JAEN_AGENT__`:

```ts
agent?: {
  /** GraphQL endpoint, https://jaen-agent.<site>/graphql */
  url: string
  /** The key of this site in the agent's SITES table, e.g. "booklimo.at" */
  site: string
  pollMs?: number      // default 5000
  debounceMs?: number  // default 800
}
```

`remote`, `pylonUrl` and `storageUrl` stay as they are. `remote.repository`
is still what the old publish path sends, and `storageUrl` is still where a
media file goes, which does not change at all: the file is uploaded to the
gateway as before and only its `media_nodes` entry travels through the agent.
booklimo.at gains the block first, limosen.at at its next deploy.

### The save state and the publish button

`containers/cms-toolbar.tsx` and `components/cms/ToolbarButtons`. With the
agent configured:

- **The discard button goes.** Once a change is committed, discard cannot
  undo it, and a button that claims otherwise is worse than no button. In
  its place the toolbar shows the save state: "Saving", "Saved 12:04",
  "Offline, 3 changes waiting", "Save failed, retrying". Undo is git, and
  the answer of a save carries `commitUrl` for exactly that.
- **The publish button keeps its label, its place and `isPublishing`.** Its
  meaning narrows to "build now", and the commit message prompt goes with
  it, because the commit has already happened and asking for its message at
  publish time would be asking about something that no longer exists. It
  becomes a plain confirm.
- **There is no commit button**, which is the target's rule: saving is
  committing.
- A field's last author and instant come from `remote.authors` and are shown
  in the field's own editing chrome.

`publish(site)` on the agent fires `POST /repos/<repo>/actions/workflows/<publishWorkflow>/dispatches`
with `{"ref": "<branch>"}` and answers `queued: true` with the run URL. A
site entry without `publishWorkflow` answers `queued: false` with the reason,
and the CMS says the build is run by the operator. That is the honest answer
for both limousine sites today, where no Actions build has ever succeeded
and the build is `scripts/deploy.sh` after a pull. The agent reports what
GitHub answered and does not pretend a build started.

### Deployment

`packages/jaen-agent` in this repository, a Cloudflare Worker beside the
taxi pylons in account `92920a0740087f4d54d9201675220d43`, one instance for
the whole estate, under one custom domain per site,
`jaen-agent.booklimo.at` and `jaen-agent.limosen.at`. See "Where it runs" for
why the name is not `agent.jaen.netsnek.com`.

`wrangler.toml`:

```toml
name = "jaen-agent"
main = ".pylon/index.js"
compatibility_date = "2026-07-01"
compatibility_flags = ["nodejs_compat"]
workers_dev = false
send_metrics = false

[[routes]]
pattern = "jaen-agent.booklimo.at"
custom_domain = true

[[routes]]
pattern = "jaen-agent.limosen.at"
custom_domain = true

# Pylon derives its schema with ts-morph at build time and the import survives
# into the bundle, and hono/compress gzips a body whose Content-Encoding the
# edge then drops. Both are stubbed, as in jaen-agent-v2.
[alias]
"ts-morph" = "./src/stubs/ts-morph.ts"
"hono/compress" = "./src/stubs/hono-compress.ts"

[vars]
AUTH_ISSUER = "https://accounts.netsnek.com"
AUTH_CACHE_TTL_MS = 60000
DEFAULT_BRANCH = "main"
PYLON_TELEMETRY_DISABLED = 1
SITES = "{...}"

[[kv_namespaces]]
binding = "CACHE"
id = "6e75d473808c48e7ac39c4391cce02fb"
```

No `[[d1_databases]]`, no prisma, no migrations directory. The KV holds two
kinds of key and nothing else: `head:<site>`, the head sha and the parsed
document with a thirty second TTL, and `lock:<site>`, the in-flight lock with
a fifteen second TTL. A cold or lost KV is a slower read and never a lost
change, because every write re-reads GitHub under the lock before it applies
anything.

Secrets, `wrangler secret put`: `AUTH_KEY`, the JSON key of an API
application of the CMS project the introspection's `client_assertion` is
signed with, the same application key the storage gateway and the identity
facade hold; `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY`, or `GITHUB_TOKEN`
in the interim; and one organisation manager token per site, named by the site
entry's `orgManagerTokenVar`, the way the taxi pylons hold theirs. The facade
answers for the organisation of the token it is sent, so one estate wide
manager token would answer for one brand and fail for the other:
`ORG_USER_MANAGER_TOKEN_BOOKLIMO` and `ORG_USER_MANAGER_TOKEN_LIMOSEN`, with
`ORG_USER_MANAGER_TOKEN` left as the fallback for a site that names none.

`scripts/deploy.sh`, the taxi pylon's script with the database parts removed:
the version out of `package.json`, the commit with a `-dirty` marker when the
tree is not clean, `builtAt`, `npx pylon build`, then
`env -u CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID=<account> npx wrangler deploy`
with `AGENT_VERSION`, `AGENT_COMMIT` and `AGENT_BUILT_AT` as `--var`, and
afterwards up to six attempts ten seconds apart at
`{ version { agent commit builtAt } }` until the deployed Worker answers
with the stamp it was given. `CLOUDFLARE_API_TOKEN` is dropped because a
Pages token exported from a site checkout would otherwise win over the
account login. `NODE_OPTIONS=--no-network-family-autoselection` is exported,
because node's fetch dies on this machine's unreachable AAAA records and
wrangler is node.

### The open points, decided

1. **Where the draft lives in the repository.** One head patch,
   `jaen-data/live.json`, last in `patches.txt`, rewritten on every save.
   The build already reads local patch files out of `jaen-data`, the last
   patch wins the merge, and nothing needs committing at publish time.
   Sealing it into a dated patch at publish was rejected for putting a
   commit back into the publish path.
2. **Commit granularity.** One commit per debounced batch, not per change.
3. **What publish triggers.** `workflow_dispatch` on the workflow the site
   entry names, `deploy.yaml` by default, and an honest `queued: false` with
   a reason where a site has no working Actions build, which is the state of
   both limousine sites.
4. **The old publish mutation.** Not carried over. Bundles already deployed
   keep calling `services.netsnek.com/jaen`, which stays deployed and
   untouched. A site moves by rebuilding with the `agent` option.
5. **The GitHub credential.** A GitHub App installation, with a fine grained
   token per repository as the interim. An App adds a site by installing it,
   a token adds a secret and an expiry date to every site at once.
6. **Which site a token may write.** The site key names the repository, the
   identity decides the permission, the organisation id discriminates. The
   audience cannot, because both sites share one Zitadel project and client.
7. **Live updates.** A five second poll of `draft(site, sinceSha)`, not a
   socket, because a socket needs a Durable Object and that is a store of
   record.
8. **Discard.** Removed from the toolbar when the agent is configured, and
   replaced by the save state. Undo is git, and the save answer carries the
   commit URL.
9. **The media library.** No path of its own. `media_nodes` is a jaen field
   of the media page and rides the same save. The file keeps going straight
   to the storage gateway.
10. **Where the agent lives.** `packages/jaen-agent` in this repository, jaen
    native as the owner asked. `~/git/jaen-agent-v2` contributes its
    `src/hosts` and `src/stubs` and is retired once
    the agent serves.
11. **The conflict rule.** Field level, later commit wins, a stale save is
    rebased on the current HEAD and never rejected, and the answer names
    every field it overwrote and who had written it.

Out of scope on purpose: per field locking, presence indicators, a comment
or review step, and any branch but the site's own build branch.

## Identity, the one way, owner 2026-09-07

Owner: "ich hoffe du machst die Authentifizierung und Autorisierung so wie
im jaen agent und zitadel-gql und kochst fürs osg nicht eine eigene Suppe
mit dem Authentication-Plugin." Every jaen service (the agent, the storage
gateway, the identity facade) authenticates and authorises the same way:
the module of zitadel-gql (`apps/graphql/src/auth.ts`, its `requireAuth`
replacing Pylon's, the introspection against Zitadel) and of the taxi
pylon (`pylon/src/auth`, the introspection through the organisation's
facade with the org manager token, the sixty second cache, `requireRole`
with the organisation's role keys). That module is copied, not
reinvented: the same token, the same introspection, the same cache, the
same errors, the same role names, no scheme of a service's own and no
use of Pylon's authentication plugin in a way the others do not share.

## Deployed, 2026-09-07

The estate runs it. One Worker, `jaen-agent` 3.0.0 (`c4ec838`, built
`2026-09-07T21:18:30Z`), in the Cloudflare account
`92920a0740087f4d54d9201675220d43` beside the taxi pylons, answering
`https://jaen-agent.booklimo.at/graphql` and
`https://jaen-agent.limosen.at/graphql`. Deployed with
`packages/jaen-agent/scripts/deploy.sh`, which reads the stamp back off both
hosts.

**What was created.** The KV namespace `jaen-agent-CACHE`,
`6e75d473808c48e7ac39c4391cce02fb`, bound as `CACHE`, holding only
`head:<site>:<branch>` and `lock:<site>`. Two Worker custom domains, one on
each site's own zone. Four secrets, none of them in any file of this
repository: `AUTH_KEY` (the CMS project's application key
`346283756287432310`, the same the storage gateway and the identity facade
introspect with), `GITHUB_TOKEN`, `ORG_USER_MANAGER_TOKEN_BOOKLIMO` and
`ORG_USER_MANAGER_TOKEN_LIMOSEN`.

**The GitHub credential is the interim one and has to be replaced.** GitHub
offers no API that mints a fine grained personal access token, and a GitHub
App is created through a browser manifest flow, so neither could be minted
from here. `GITHUB_TOKEN` is therefore the estate's existing classic token,
which carries far more than `contents:write` on two repositories. The agent
is the only thing that holds it and it never leaves the Worker, but the blast
radius of a mistake in the site scoping is the whole organisation rather than
two repositories. Replace it with the `jaen-agent` App, or with a fine
grained token limited to `netsnek/booklimo.at` and `netsnek/limosen.at`, and
`wrangler secret put GITHUB_TOKEN` is the whole of the change.

**Both sites are configured and deployed.** `booklimo.at` (`d3197db`, the
Pages deployment `fc939ea9`) and `limosen.at` (`69c5cae`, `7f72e742`), each
naming its own agent host in its `gatsby-config.ts` and each polling every
2500 ms rather than the design's 5000. The two push workflows of
`booklimo.at` ignore `jaen-data/**`, because the agent commits
`jaen-data/live.json` on every saved change and a save must never start a
build. `limosen.at` has no push triggered workflow and needed nothing.

**Measured on the live sites, not on a local build.** Two browser contexts
signed in as two real admins of booklimo.at, the second being the brand's
test customer given `jaen:admin` on booklimo alone for the run and revoked
afterwards.

- A text change in the first reached the second in **9.5 s** with no publish,
  and the first's toolbar went "Saving" then "Saved 12:04 AM".
- A picture uploaded in the first's media library reached the second's
  library in **8.9 s**, and the first's own library in 0.5 s.
- Every saved change is one commit of `jaen-data/live.json` in the editor's
  name, `author Taxi Test Admin <office+taxi-test-admin-krc@netsnek.com>`,
  `committer jaen-agent <noreply.snek.at@gmail.com>`, and **no Actions run
  started on any of them**.
- The browser taken offline kept editing, said "Offline, 1 change waiting",
  drained to "Saved 12:15 AM" when the network came back, and the edit was
  then readable from the repository through the agent.
- `publish(site: "booklimo.at")` answered `queued: false`, "This site names
  no publish workflow. Everything is committed already; the build is run by
  the operator.", and the head sha was the same before and after.
- An anonymous call is `AUTH_REQUIRED`, limosen's admin on booklimo and
  booklimo's admin on limosen are `FORBIDDEN`, and an unlisted site key is
  `UNKNOWN_SITE`.

**Why the poll is 2500 ms.** At the design's 5000 the same two measurements
were 9.0 s and 12.1 s, and the picture missed the ten second acceptance. The
save is already committed by then, so the interval only decides how long the
other CMS waits before it asks, and a poll whose `sinceSha` is still the head
answers `changed: false` with no body out of the agent's KV. The remaining
tail is the save itself: the toolbar reads "Saving" for four to six seconds,
which is the lock, the fresh read of the head and the `PUT` of a
`live.json` that carries a hundred and forty media nodes. Ten seconds holds,
but not with much room, and shortening the save is where the next second
comes from, not shortening the poll again.

**The identity server fell over in the middle of the run.**
`accounts.netsnek.com` answered `Errors.Internal` and then 503 on
`/oauth/v2/authorize` for about four minutes around 22:08 UTC, which took the
CMS login of both sites and every introspection with it, the agent included.
It recovered by itself at 22:12 UTC and the measurements above are from after
it. Nothing in this deployment caused it and nothing in this deployment
survives it: the agent is exactly as available as the identity server it
introspects against.

## Acceptance

- Two browser contexts signed in as two admins of booklimo.at: a text
  change in the first appears in the second's CMS within ten seconds
  without a publish; a picture uploaded in the first's media library
  appears in the second's library within ten seconds.
- Every saved change is one commit in the site's repository in the
  editor's name, readable with git log within ten seconds, and no build
  starts; publish starts the build as before. A second editor's CMS
  reads the change from the repository through the agent, not from any
  other store.
- The agent refuses a token of another site's admin and an anonymous
  call; it answers the draft of booklimo.at only to booklimo's admins.
- A browser offline keeps editing, and the queue drains when it is back.
- Nothing about this lives in `gatsby-jaen-app`; the taxi platform only
  gains the plugin option in its two site configs.
