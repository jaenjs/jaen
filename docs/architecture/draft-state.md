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

### The repository as the store: two head patches

The agent owns two files per site, **`jaen-data/live.json`** and
**`jaen-data/live-media.json`**, listed as the last two lines of
`jaen-data/patches.txt` in that order. A save rewrites the one its changes
belong to, in the patch shape the build already reads,
`{createdAt, message, data: {pages, site, widgets}}`. Because they are last in
the chain they win the deepmerge, so the repository's HEAD is at all times a
buildable statement of the current content.

It was one file until 2026-09-08 and the second one is a budget decision, not
a new data path. `media_nodes` is a jaen field like any other, but it is the
one field that holds a catalogue: booklimo.at's head patch weighed 120 KB of
which 80 KB were the 140 media nodes, and the page everything else lives on
was 502 bytes. Every text change committed the whole catalogue and every
picture committed the whole site. Split, a text change writes about two
kilobytes and a picture writes the catalogue, and neither opens the other's
file at all. `live-media.json` carries one page stub with one field, so the
build merges it onto the page `live.json` already described.

That is what lets publish commit nothing. The alternative, sealing the head
file into a dated patch at publish time and starting a fresh one, was
rejected: it puts a commit back into the publish path, which the target
forbids, and it buys only a tidier file list. The historical patches
(`2025-11-30-1653-sanitised.json` and the rest) stay frozen exactly as they
are, and a maintainer who wants to fold the head file into a dated one does
it with an ordinary commit that the agent neither makes nor needs to know
about.

`patches.txt` is touched only when the two files are not already its last two
lines in that order: once per site on the first save, and once more when the
catalogue is lifted out of `live.json`, which the first save after the split
does by itself. `live-media.json` is never listed before it exists, because
the build reads a local patch line as a file and panics on one that is not
there. The answer is then remembered in the agent's KV for an hour, because
reading `patches.txt` on every save was one GitHub round trip out of four for
a file that changes twice in the life of a site.

### The agent's API

`packages/jaen-agent`, a Pylon v3 service. Positional arguments, because
Pylon maps them to flat GraphQL arguments. Resolvers are plain object
literals or arrow properties, never class methods, because Pylon v3 pulls a
resolver off its parent and calls it without a receiver, so a method loses
`this`.

```graphql
type Query {
  version: Version!
  viewer(site: String!): Viewer!
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

type Viewer {
  site: String!
  sub: String!
  name: String!
  email: String!
  at: String!
}

type SaveResult {
  headSha: String!
  blobSha: String!
  commitSha: String!
  commitUrl: String!
  savedAt: String!
  rebased: Boolean!
  overwrote: [FieldOverwrite!]! # field, the previous author, the previous instant
  wrote: [String!]! # the head files this save actually wrote
}

type PublishResult {
  queued: Boolean!
  headSha: String!
  workflow: String
  runUrl: String
  reason: String # why not, when queued is false
}
```

`viewer(site)` answers who is calling and touches no repository at all. Its
whole cost is the introspection the auth middleware pays before a resolver
runs, which is exactly what it is for: the CMS calls it once when it opens, so
that a token nobody has introspected lately is paid for while the toolbar is
still coming up rather than inside the editor's first save.

`draft(site)` reads the repository's HEAD. It resolves the branch head with
`GET /repos/<repo>/commits/<branch>`, reads both head files with
`GET /repos/<repo>/contents/...?ref=<branch>`, merges them and answers the
parsed `data` plus both shas. `sinceSha` is the head the caller already has:
when it still matches, the answer is `changed: false` with no body **and no
file read at all**, one commit lookup, which is what almost every poll of
every open CMS costs.

`save(site, changes, baseSha)` applies the changes and commits, in the
editor's name, one commit per call and per head file the batch touched.
`wrote` names those files, which is how the CMS and the tests can see that a
text change did not commit the catalogue. `publish(site)` triggers the build and
commits nothing.

### The shape of a change

A change is one dispatched redux action, named and flattened, so the client
sends what it already produces and the agent needs no diffing.

```ts
interface JaenChangeInput {
  kind:
    | 'fieldWrite' // page.field_write
    | 'fieldMerge' // page.field_write of a field that holds a catalogue
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

**`fieldMerge`, the field sent as the difference it is.** The media gallery
reads `media_nodes` as one object of every picture in the site and writes the
whole object back on every upload, clone, edit and delete, so a single new
picture used to send 76 KB up the wire and commit 120 KB back down. The
recorder diffs the write against the value it replaced and sends
`value`, the entries that changed, and `props.removed`, the ids that went, and
the applier folds them onto whatever the base holds. Measured on booklimo.at's
catalogue of 140 nodes: the request went from 76 604 bytes to 449. A base that
is not a record, which is a browser that has not seen a remote value for the
field yet, and a write that changes more than half of it both fall back to
sending the field whole, so the merge is an optimisation and never the only
way a value can travel.

It is also the honest conflict rule for a catalogue. Two editors uploading at
the same time each used to write a catalogue without the other's node, and the
later commit won. Now each sends its own node and both pictures survive, which
is why `overwrote` never names a merge.

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
measured on 2026-09-05.

**Two tiers, because one was not enough.** The module scoped map belongs to
one Worker isolate and Cloudflare starts isolates as it pleases, so a token
this isolate has not seen pays the round trips again however warm the caller
is: the adversarial read below measured 3.77 s on the first call of a run and
1.7 s on the three after it, twice. The same answer therefore also goes into
the `CACHE` KV under `auth:<sha256 of the token>`, with the resolved grant
list beside it, which every isolate of every colo reads. A cold isolate then
pays a KV read of a few milliseconds. The key is the hash of the token and
nothing else: reading the entry back means holding the token, which already
means being that caller. A refresh that comes back inactive deletes both
tiers, so a revoked token stops working within the minute wherever it lands. Pylon's own `@requireAuth()` is not used, because it
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

**The flusher** sends at twenty queued changes, or after 800 ms of quiet where
the change is one keystroke of a stream, or at once where it is not. On success
it drops the flushed entries, stores the new head and sets `saved` with the
instant. On a network failure it leaves the outbox alone, sets `offline` and
retries after 2, 5, 15 and then every 30 seconds.

The quiet time is for one case: a field written character by character, where a
commit per keystroke would be one contents API round trip per letter and a
history nobody can read. The MDX editor is the only family in jaen that writes
that way, its CodeMirror state change runs `onUpdateValue` on every character.
Nothing else does. `Field.Text` writes on blur and has already waited out its
own 500 ms debounce before the change is even recorded, an image is picked
once, a media node is uploaded once, a section is added or moved by a click.
Waiting 800 ms for those is waiting for a second change that cannot arrive, so
they flush at once, and an immediate flush is never pushed back out by a
keystroke recorded after it.

**The poller** asks `draft(site, sinceSha: headSha)` while the CMS is mounted
or `status.isEditing` is set, and stops otherwise. `changed: false` is the
usual answer and costs almost nothing. When the head moved, the client
dispatches `hydrateFromRemote` on the three draft slices with the remote
document, and those reducers keep any field that has an entry in the outbox,
so a local unsent edit is never overwritten by a poll.

The interval is adaptive: `activePollMs`, 1500 by default, while the tab is
visible or while this browser's own save is still out or waiting in the
outbox, and `pollMs`, 5000, while the tab is hidden. Coming back to a hidden
tab asks at once rather than waiting the idle interval out. The interval is not
a load question, a poll whose `sinceSha` is still the head answers out of the
agent's KV with no body, it is the tail of the acceptance: it decides how long
the other editor's CMS waits before it asks about a change that is already
committed. Fast where somebody is reading the answer, slow where nobody is.

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
  /** The poll while the tab is hidden. */
  pollMs?: number       // default 5000
  /** The poll while the tab is visible or a save is out. */
  activePollMs?: number // default 1500
  /** The quiet a streaming field waits out before its batch is committed. */
  debounceMs?: number   // default 800
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

No `[[d1_databases]]`, no prisma, no migrations directory. The KV holds four
kinds of key and nothing else. `head:<site>:<branch>`, the head sha and the
parsed document with a thirty second TTL. `lock:<site>`, the in-flight lock
with a fifteen second TTL. `auth:<sha256 of a bearer>`, the introspected
identity and its grants for `AUTH_CACHE_TTL_MS`. And
`patches:<site>:<branch>`, one word saying that patches.txt already ends with
the head files, for an hour. A cold or lost KV is a slower read and never a
lost change, because every write re-reads GitHub before it applies anything
and every PUT carries the blob sha it read.

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

1. **Where the draft lives in the repository.** Two head patches,
   `jaen-data/live.json` and `jaen-data/live-media.json`, last in
   `patches.txt` in that order, and a save rewrites the one its changes
   belong to. The build already reads local patch files out of `jaen-data`,
   the last patch wins the merge, and nothing needs committing at publish
   time. Sealing them into a dated patch at publish was rejected for putting
   a commit back into the publish path. It was one file until 2026-09-08,
   when the catalogue turned out to be two thirds of every commit.
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
7. **Live updates.** A poll of `draft(site, sinceSha)`, not a socket, because
   a socket needs a Durable Object and that is a store of record. The interval
   is 1500 ms while the tab is visible and 5000 ms while it is hidden, see
   "The budget".
8. **Discard.** Removed from the toolbar when the agent is configured, and
   replaced by the save state. Undo is git, and the save answer carries the
   commit URL.
9. **The media library.** No data path of its own: `media_nodes` is a jaen
   field of the media page and rides the same save, the same applier and the
   same conflict rule. It has a file of its own, `live-media.json`, and a
   change kind of its own, `fieldMerge`, and both are budget and not
   architecture: the field is a catalogue, it was two thirds of every commit
   the agent made, and the gallery writes it whole. The picture file keeps
   going straight to the storage gateway.
10. **Where the agent lives.** `packages/jaen-agent` in this repository, jaen
    native as the owner asked. `~/git/jaen-agent-v2` contributes its
    `src/hosts` and `src/stubs` and is retired once
    the agent serves.
11. **The conflict rule.** Field level, later commit wins, a stale save is
    rebased on the current HEAD and never rejected, and the answer names
    every field it overwrote and who had written it.

12. **The introspection cache.** Two tiers, the isolate's map and the
    Worker's KV, keyed by the SHA-256 of the bearer with one deadline. A
    module scoped cache alone is a cache one isolate has, and the two second
    tail the adversarial read found was a cold isolate paying the round trips
    again. The CMS warms it with `viewer(site)` when it opens.

Out of scope on purpose: per field locking, presence indicators, a comment
or review step, and any branch but the site's own build branch.

### Still open

**A media node deleted leaves its file on the gateway.** Removing a picture in
the library removes its entry from `media_nodes` and nothing else: the blob
stays at `osg.netsnek.com` with nothing pointing at it, and the library has no
sweep that would find it. That was already true before the agent existed, the
adversarial read on 2026-09-08 recorded it again after deleting its two test
pictures, and the split does not change it either way, because the entry and
the file were never written by the same thing. It is worth naming rather than
leaving as folklore, and it is worth deciding rather than building on a hunch,
because a sweep is the kind of job that deletes somebody's picture when it is
wrong: it needs to know that every site that could name a blob has been
consulted, and one storage gateway serves more than one site. Nothing here
builds it.

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

**Why the poll was 2500 ms.** At the design's 5000 the same two measurements
were 9.0 s and 12.1 s, and the picture missed the ten second acceptance. The
save is already committed by then, so the interval only decides how long the
other CMS waits before it asks, and a poll whose `sinceSha` is still the head
answers `changed: false` with no body out of the agent's KV. The remaining
tail is the save itself: the toolbar reads "Saving" for four to six seconds,
which is the lock, the fresh read of the head and the `PUT` of a
`live.json` that carries a hundred and forty media nodes. Ten seconds held,
but not with much room. The flat 2500 was superseded the next day by the split
interval in "The budget" below.

**The identity server fell over in the middle of the run.**
`accounts.netsnek.com` answered `Errors.Internal` and then 503 on
`/oauth/v2/authorize` for about four minutes around 22:08 UTC, which took the
CMS login of both sites and every introspection with it, the agent included.
It recovered by itself at 22:12 UTC and the measurements above are from after
it. Nothing in this deployment caused it and nothing in this deployment
survives it: the agent is exactly as available as the identity server it
introspects against.

## The budget, measured 2026-09-08

The ten second acceptance held on the deployed estate, but only just: the
shared draft verifier read 9.6 and 10.1 s for a text change and 8.4 and 9.2 s
for a picture, with one of the four already over the line. This is where those
seconds go, what was taken out of them and what is left.

**How it is measured.** Two browser contexts, both signed in as the booklimo
human admin, both talking to the live `jaen-agent.booklimo.at`. The first
writes a jaen text field on the home page and blurs it, or drops a four by four
PNG into the media library; the clock starts on that gesture and stops when the
second context's own draft carries the change. The before numbers are read on
the deployed booklimo.at, the after numbers on a local production build of the
same site against the same live agent, because reads and saves on a throwaway
branch are not possible: the agent commits to `main`. The field is set back to
the value it had afterwards, one commit each way, both by the human admin, and
the test picture is deleted from the library again.

**Where the seconds go.**

| leg                      | before         | after                      |
| ------------------------ | -------------- | -------------------------- |
| the field's own debounce | 500 ms on blur | unchanged                  |
| the save debounce        | 800 ms, always | 0 unless the field streams |
| the save round trip      | 4 to 6 s       | unchanged                  |
| the other editor's poll  | 0 to 2500 ms   | 0 to 1500 ms               |

**The numbers.** Measured as above, one run each.

| what                                    | before | after |
| --------------------------------------- | ------ | ----- |
| a text change reaches the second editor | 9.3 s  | 6.9 s |
| a picture reaches the second editor     | 9.3 s  | 7.3 s |
| a picture in the uploader's own library | 1.4 s  | 1.4 s |

**What was taken out.** Two waits that bought nothing. The save debounce now
applies to a streaming field only, because `Field.Text` writes once on blur
after its own 500 ms and a picture is uploaded once, so the 800 ms was spent
waiting for a second change that could not arrive. And the poll became 1500 ms
while the tab is visible instead of a flat 2500, which halves the average wait
of the editor who is actually looking, while a hidden tab drops to 5000 and
costs the agent less than it did before.

**What is left, and it is most of it.** The save round trip is four to six
seconds and none of it is the client's: the agent takes the site's lock, reads
`jaen-data/live.json` at the head, applies the change and `PUT`s a file that
carries a hundred and forty media nodes through the contents API. That is where
the next three seconds are, not in any interval on this side. Nothing above
shortens it and nothing above needs to: with the two waits gone the acceptance
has three seconds of room instead of half of one.

**The gallery, in the same run.** Three defects the verifier found, on the
local build against the live agent:

- The grid is newest first. `Object.values` of the media field answered
  whatever order the keys had and the uploader appended, so a picture just
  uploaded landed at the bottom and the second editor never saw it at the top
  either. After the fix the just uploaded file is the first item in both.
- Inside a car's folder the cover is first. The nodes arrive from the app in
  position order and the gallery no longer sorts them by date: a car with three
  pictures reads "Bild 1, Bild 2, Bild 3" inside its folder and "Bild 3, Bild 2,
  Bild 1" in the undivided grid, which is the date order there.
- Load more fires. It hung off a scroll listener on `window` measuring
  `#last-media-item`, an id the preview also uses, so it was ambiguous and it
  saw nothing wherever an ancestor rather than the window scrolled. An
  IntersectionObserver on a sentinel at the end of the grid answers whichever
  ancestor scrolls: at 1440 by 900 and at 390 by 780 the grid grew 23 to 53 to
  143 nodes, the whole library.

**Built and served, 2026-09-08 shortly after two in the morning.** Everything
above was measured on a local production build against the live agent, so it
was not on the two sites until this deploy. The three dists were rebuilt in
this checkout first (`jaen`, `gatsby-source-jaen`, `gatsby-plugin-jaen`), then
each site through its own `scripts/deploy.sh` with
`JAEN_APP_COMMIT=eed49d1` passed to both so the four values name one sha:
booklimo built `2026-09-07T23:47:23Z` and deployed as `19e69aba`, limosen
built `23:55:17Z` and deployed as `1a8a5096`. The app is untouched at 1.8.1
and the pylons at 1.8.0, because nothing of `app/` changed and this fix lives
in packages of the jaen checkout.

Read back off both live sites: `/app/version.json` answers `1.8.1` and
`eed49d1` on booklimo.at and on limosen.at, `/cms/` and `/cms/media/` answer
200 on both, the shared chunk each media page loads carries `media-load-more`,
the test id of the sentinel the new load more observes, and the bundle each
site serves carries `activePollMs:1500` beside the idle `pollMs: 5000`. The
old window scroll listener is gone from both. The deploy line is in the taxi-app
checkout, `okf/operations/versions.md`.

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

## Read adversarially off the live site, 2026-09-08 at half past two

Two browser contexts on the deployed booklimo.at, the first signed in as the
booklimo human admin `taxi-test-admin-krc` and the second as the brand's human
customer `taxi-test-customer-krc`, whose CMS authorization was widened to
`jaen:admin` on the CMS project `268283277977065078` for the run and set back
to `krc:customer` alone afterwards. Both contexts drove the real
`jaen-agent.booklimo.at`, and every edit below is a commit on `main` of
`netsnek/booklimo.at`.

**A text change reaches the second editor, but not inside eight seconds every
time.** Six samples in two runs of three, each run a fresh sign in of both
contexts, the clock starting on the blur of `AboutTitle` on the home page and
stopping when the second context renders the new value.

| run | first sample | second | third  |
| --- | ------------ | ------ | ------ |
| 1   | 8.77 s       | 7.44 s | 6.36 s |
| 2   | 8.24 s       | 6.58 s | 6.52 s |

The warm samples sit where "The budget" left them, 6.4 to 6.6 s. The first
sample of each run is two seconds slower, in both runs, and both of those are
over eight seconds.

**Where the two seconds are.** The agent's introspection cache, the copied
module of the taxi pylon, holds a token for `AUTH_CACHE_TTL_MS` and defaults to
sixty seconds, in a module scoped map of one Worker isolate. Measured straight
against the agent with a machine token: a call whose token the isolate has not
seen takes 3.77 s, the three calls after it take 1.72, 1.47 and 1.77 s. That is
the whole of the gap. It is not a warm up that an editor pays once: it comes
back after a minute without a save, and again on any request that lands on
another isolate. Ten seconds absorbs it, eight does not.

**A picture reaches the second editor at the top of the gallery.** Two samples,
9.82 s and 9.71 s, the uploader's own library 2.15 s and 2.81 s. In both the new
node is item zero of the second editor's grid and of the first's. Both are
inside the ten second acceptance with less than three tenths of a second to
spare, and the same cold introspection above is inside those numbers.

**Load more loads the whole library.** Scrolling the grid to its end grew it 30
to 60 to 90 to 120 to 150 to 151 nodes, the whole library, at 1440 by 900 and
again at 390 by 780.

**Every change is one commit by the editor.** Twelve saves, twelve commits, each
touching `jaen-data/live.json` and nothing else, `author Taxi Test Admin
<office+taxi-test-admin-krc@netsnek.com>` for the admin's and `author Taxi Test
Customer <office+taxi-test-customer-krc@netsnek.com>` for the two the customer
made, `committer jaen-agent` on all of them. No Actions run started on any of
them: the newest run on the repository is still the deploy of `0457b9c7` from
the evening before.

**Reverted.** `AboutTitle` is `"About us"` again in `jaen-data/live.json`, the
media field is back at 140 nodes and holds no `verify-pic.png`, and both test
pictures are gone from both galleries. The uploaded blobs stay on the storage
gateway with nothing pointing at them, which is what deleting a node in the
library has always done.

**What has to change for eight seconds.** Introspect once when the CMS opens
rather than on the first save, or raise `AUTH_CACHE_TTL_MS` toward the token's
own expiry, which the cache already caps against. Nothing else in the six
samples is over budget.

## The budget again, measured 2026-09-08 in the afternoon

The adversarial read above left two things over budget. The first sample of
every run was two seconds slower than the warm ones, in both runs, because a
Worker isolate that had not seen the token paid the introspection again. And
the save round trip was four to six seconds, of which the biggest single item
was a `PUT` of a `live.json` carrying 140 media nodes. Both are addressed
here, and this is what was measured.

**How it was measured, and what it is not.** Against a local `wrangler dev` of
the agent on two throwaway branches of `netsnek/booklimo.at`, one running the
agent as it was deployed (`ae0e224`) and one running this work, both talking to
the real `api.github.com` with the real repository and both introspecting the
real `accounts.netsnek.com` with a real booklimo `jaen:admin`. The two saves
were alternated, old, new, old, new, so the drift of this machine's link falls
on both alike, ten samples each, twice. Nothing ran against `main`: the two
branches were cut from it, written only by the agent, and deleted afterwards.

These are **not** the live agent's numbers and they are not meant to be. The
link from this machine to GitHub is not Cloudflare's, so every absolute figure
here is smaller than the deployed one. What carries over is the ratio and what
disappeared. The ship measures live.

**The introspection, which is the two second tail.** The probe is one
authenticated call that reaches no repository, so its whole cost is the
middleware.

| what                                              | before  | after  |
| ------------------------------------------------- | ------- | ------ |
| a token nothing has seen, cold isolate, cold KV   | 1388 ms | 893 ms |
| the same token again on that isolate              | 13 ms   | 13 ms  |
| **a new isolate, the token already introspected** | 1358 ms | 79 ms  |

The third row is the finding. Before, every isolate paid the round trips for
itself and an editor met that again after any minute without a save. Now the
first isolate pays it and the rest read the KV. The first row is a token the
whole estate has not seen, which is what `viewer(site)` is called for when the
CMS opens: it is still about a second, and it is now spent before the editor
has typed anything.

**The poll, which is what every open CMS does between saves.**

| what                                             | before | after |
| ------------------------------------------------ | ------ | ----- |
| `draft(sinceSha = head)`, the agent's cache cold | 866 ms | 6 ms  |
| the same, cache warm                             | 12 ms  | 7 ms  |

`changed: false` no longer reads a file at all, only the branch head, and the
head comes out of KV where it is fresh.

**The save round trip, ten samples each, alternated, twice.**

| what                       | before            | after             |
| -------------------------- | ----------------- | ----------------- |
| a text change is committed | 2.60 s and 2.38 s | 1.24 s and 1.14 s |
| a picture is committed     | 2.46 s and 2.56 s | 1.80 s and 1.80 s |

Three things did that, and none of them is a shorter interval. The save used
to open with three sequential round trips to GitHub before it wrote anything,
the branch head, then the file at that sha, then `patches.txt`. The head
lookup now runs beside the file read, because the file is read at the branch
and the branch is at least as fresh as the sha it resolves to, and
`patches.txt` is remembered in KV for an hour. What makes the write safe is
still the blob sha on the `PUT` and the retry loop behind it, which is
unchanged. And the file that is written is now the small one: booklimo.at's
`live.json` is 2 188 bytes without the catalogue and was 120 156 with it.

**The request, which never showed up in a timing on this link and will on a
phone.** One new picture used to send the whole catalogue to the agent,
76 604 bytes of nodes it already had. It now sends 449.

**The two legs, put back together.** These are the parts, not a stopwatch on
two browsers, and they are stated as parts on purpose: the end to end figure
belongs to the live estate and the ship agent measures it there. A text change
reaching the second editor is the field's own 500 ms on blur, plus the save,
plus up to `activePollMs` of the other CMS waiting to ask, plus its read of the
changed head. The save halved and the poll's cold case went from most of a
second to nothing. The cold introspection, which was two of the eight and a
half seconds the adversarial read measured, is paid before the first save
instead of inside it, and it is paid once for the whole estate instead of once
per isolate. Nothing in the client's intervals changed: 1500 ms while the tab
is watched, 5000 ms while it is not, and the quiet only for a streaming field.

**What is still there.** A save is two GitHub round trips and cannot be fewer
without the git trees API, which would let one commit carry both head files
and is a bigger change than this one. `viewer` still costs about a second the
first time the estate sees a token, because that is Zitadel's introspection and
userinfo, and the only ways past it are a longer `AUTH_CACHE_TTL_MS`, which the
cache already caps against the token's own expiry, or not introspecting, which
is not on offer.
