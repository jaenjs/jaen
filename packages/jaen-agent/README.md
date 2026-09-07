# jaen-agent

The one process that reads a site's jaen data from its repository and writes
every saved change back as a git commit.

**The repository is the store. There is no database.** The draft of a site is
the site's own jaen data in its own repository, in the structure it has today
(`jaen-data/`, the patches, the media nodes), and what editors share is the
repository's HEAD. A Cloudflare Worker, a Pylon v3, one instance for the whole
estate on `agent.jaen.netsnek.com`.

The design is `docs/architecture/draft-state.md` in this repository. This file
is how the thing is run.

## Three verbs

- **`save`** applies a batch of changes and commits it, in the editor's name,
  one commit per call. Committing is fast, that is the point. Saving is
  committing: there is no separate commit verb.
- **`draft`** reads the branch HEAD. `sinceSha` is the head the caller already
  has, and when it still matches the answer is `changed: false` with no body,
  which is what almost every poll of an open CMS costs.
- **`publish`** dispatches the site's build workflow and commits nothing,
  because everything was committed at save time.

## The API

The schema pylon derives is `.pylon/schema.graphql` after a build. It is
reproduced here because a client is written against it.

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

input SaveChangesInput {
  kind: JaenChangeKind!
  pageId: String
  section: SectionInput
  fieldType: String
  fieldName: String
  value: Any!
  props: JSONObject
  at: String
}

input SectionInput {
  path: [PathInput!]!
  id: String
}

input PathInput {
  fieldName: String!
  sectionId: String
}

enum JaenChangeKind {
  fieldWrite
  sectionAdd
  sectionRemove
  sectionMove
  pageUpdate
  pageDelete
  siteMetadata
  widgetWrite
}

type Version {
  agent: String!
  commit: String
  builtAt: String
}

type Draft {
  site: String!
  headSha: String!
  blobSha: String!
  changed: Boolean!
  data: JSONObject
  authors: JSONObject
  readAt: String!
}

type SaveResult {
  headSha: String!
  blobSha: String!
  commitSha: String!
  commitUrl: String!
  savedAt: String!
  rebased: Boolean!
  overwrote: [FieldOverwrite!]!
}

type FieldOverwrite {
  field: String!
  previousAuthor: String
  previousAt: String
}

type PublishResult {
  queued: Boolean!
  headSha: String!
  workflow: String
  runUrl: String
  reason: String
}
```

Three things about it that a client has to know, because pylon derives the
schema from the TypeScript and not the other way round:

1. **The input type is `SaveChangesInput`, not `JaenChangeInput`.** Pylon names
   a generated input after the field and the argument it belongs to, never
   after the TypeScript interface, so `save(changes:)` gives
   `SaveChangesInput`, and the nested ones are `SectionInput` and `PathInput`.
   An operation that declares `$changes: [JaenChangeInput!]!` is refused with
   "Unknown type".
2. **`value` is `Any!` and is always sent.** A jaen field's value is whatever
   its field type stores, a string as often as an object, so it is pylon's
   `Any` scalar, and pylon renders a TypeScript `any` as non-null with no
   spelling that makes it nullable. A kind that carries no value sends `{}`,
   which every branch of the applier ignores. `props` is an object in every
   kind and is `JSONObject`, so that one may be omitted.
3. **`data` and `authors` are null when `changed` is false.** That is the cheap
   poll, and it is the only case in which they are null.

### What a change is

One dispatched redux action, named and flattened, so the client sends what it
already produces and the agent needs no diffing. Which slot carries what:

| kind            | redux action                 | fields                                                                   |
| --------------- | ---------------------------- | ------------------------------------------------------------------------ |
| `fieldWrite`    | `pages/field_write`          | `pageId`, `fieldType`, `fieldName`, optional `section`, `value`, `props` |
| `sectionAdd`    | `pages/section_add`          | `pageId`, `section.path`, `props: {between, sectionItemType}`            |
| `sectionRemove` | `pages/section_remove`       | `pageId`, `section.path`, `section.id`, `props: {between}`               |
| `sectionMove`   | `pages/section_move`         | `pageId`, `section.path`, `section.id`, `props: {between, move}`         |
| `pageUpdate`    | `pages/page_updateOrCreate`  | `pageId` (absent creates), `value` = the page payload                    |
| `pageDelete`    | `pages/page_markForDeletion` | `pageId`                                                                 |
| `siteMetadata`  | `site/updateSiteMetadata`    | `value` = the metadata partial                                           |
| `widgetWrite`   | `widget/writeData`           | `value` = the widget payload                                             |

`at` is the client's instant and is advisory. The agent stamps the author
itself out of the introspected token and ignores any author the client sends,
because a commit author line a caller can choose is not an audit trail.

A call carries at most 200 changes and at most one megabyte.

### Conflicts

`baseSha` is the head sha the client last saw. A stale save is **rebased and
never rejected**: the changes are applied onto the document read under the
lock, the answer is `rebased: true`, and `overwrote` names every field whose
remote value a change replaced together with who had written it and when.
Because a change is a field and not a document, two editors on different
fields never collide at all; two editors on one field resolve as the later
commit winning.

## Where the draft lives in the repository

One head patch per site, **`jaen-data/live.json`**, the last line of
`jaen-data/patches.txt`. Every save rewrites it with the merged draft of the
whole site in the patch shape the build already reads,
`{createdAt, message, data: {pages, site, widgets}}`, plus one key the build
ignores, `authors`, which is where the field authorship the CMS shows lives.
Because it is last in the chain it wins the deepmerge, so the repository's HEAD
is at all times a buildable statement of the current content, and publish
commits nothing.

`patches.txt` is touched only when `live.json` is not in it yet, once per site,
right after the first save. The historical patches stay frozen exactly as they
are.

## Identity

`AUTH_ISSUER` is mandatory. There is no unauthenticated variant of this
service and the Worker refuses to answer without it, because the agent holds
write access to every site repository of the estate.

Pylon's own `@requireAuth()` is not used anywhere: `useAuth` sets `auth` on
every request, an anonymous one included, and the decorator only checks that
`auth` is truthy. The guard is `src/auth` `requireSiteAdmin`, which demands a
subject and then decides.

**Which site a caller may touch.** The site key names the repository, the
identity decides the permission. limosen.at and booklimo.at sign in against the
same Zitadel, the same CMS project `268283277977065078` and the same client
`268283382465631862@cms`, so the audience is identical on both and cannot tell
them apart. What differs is the organisation. A call is allowed when the caller
holds the entry's `adminRole` (`jaen:admin`) and the organisation that granted
it, or failing that the organisation the account lives in, is the entry's
`organizationId`. limosen's admin therefore gets a `FORBIDDEN` on booklimo, and
an anonymous call an `AUTH_REQUIRED`.

Roles come from the token pylon validated. When it asserts none, the agent
makes one lookup through the site's identity facade, `iamApiUrl`
(`https://idm.booklimo.at/graphql`), with the Worker's own
`ORG_USER_MANAGER_TOKEN` as the bearer and never the caller's token. The facade
answers the roles and the `resourceOwner`, which is the organisation. A failed
lookup answers nothing, which is a caller with no roles and never an admin.

Every outgoing fetch carries a `User-Agent`, because Cloudflare fronts both the
issuer and the facade and answers a request without one with `error code: 1010`
in plain text, which is not JSON.

The introspection is cached in the isolate for `AUTH_CACHE_TTL_MS`, sixty
seconds by default, keyed by the SHA-256 of the token and refreshed in the
background past half its life. Without it every five second poll of every open
CMS would pay an introspection and a userinfo round trip, about 1.5 s, before a
resolver ran.

## The GitHub credential and the commit author

The credential is the agent's own, never the editor's. A **GitHub App**,
`jaen-agent`, installed per repository: the Worker holds `GITHUB_APP_ID` and
`GITHUB_APP_PRIVATE_KEY`, signs its own JWT with WebCrypto RS256 and mints an
installation token per request, cached in KV for its hour. WebCrypto imports
PKCS#8 only and GitHub hands out PKCS#1, so the secret is stored converted:

```
openssl pkcs8 -topk8 -nocrypt -in jaen-agent.private-key.pem
```

A fine grained personal token, `GITHUB_TOKEN`, is the interim before the App
exists and wins when it is set. It is the interim and not the destination
because it belongs to one human, expires within a year at the latest and takes
every site down when it does, while an App installation adds a site by
installing the App.

The editor's identity goes into the commit, which the contents API takes on the
`PUT`: `author` is the editor, `committer` is `jaen-agent`. An editor without
an email claim gets `<sub>@users.noreply.<site>`, which is stable and never
routes anywhere. `git log --format='%an <%ae>'` on the site repository is then
the audit trail.

## Configuration

Everything is in `wrangler.toml`, which carries the comments that matter.

`SITES` is the site table, a JSON object keyed by site key. There is no
database, so a site is added there and nowhere else:

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

`publishWorkflow` is deliberately absent on both limousine sites. No Actions
build has ever succeeded on either (the jaen packages are `link:` dependencies
on a sibling checkout the runner does not have), so the build is
`scripts/deploy.sh` run by a human after a pull, and `publish` answers
`queued: false` with that as the reason rather than pretending a build started.

The **KV namespace** holds three kinds of key and nothing else: `head:<site>:<branch>`,
the read cache, honoured for thirty seconds; `lock:<site>`, the in-flight lock,
honoured for fifteen; and `ghtoken:<installation>`, the App token for its hour.
KV refuses an `expirationTtl` below sixty seconds, so the first two live for
KV's minute and carry their own deadline inside, which is what they are read
against. A cold or lost KV is a slower read and never a lost change, because
every write re-reads GitHub under the lock before it applies anything.

**Secrets**, `wrangler secret put <name>`, never in a file:

| name                     | what                                                                                                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_KEY`               | the JSON key of an API app **in `AUTH_PROJECT_ID`**, which pylon introspects with. Zitadel puts the introspecting application's project into the audience it demands, so an API app of another project refuses every CMS token. |
| `GITHUB_TOKEN`           | the interim repository credential, `contents:write` on both site repositories                                                                                                                                                   |
| `GITHUB_APP_ID`          | the `jaen-agent` App, once it exists                                                                                                                                                                                            |
| `GITHUB_APP_PRIVATE_KEY` | its private key, PKCS#8                                                                                                                                                                                                         |
| `ORG_USER_MANAGER_TOKEN` | the bearer the grant lookup through `idm.<brand>` is made with                                                                                                                                                                  |

## Deploying

```
scripts/deploy.sh            # build, deploy, read the stamp back
scripts/deploy.sh --dry-run  # print the commands, deploy nothing
```

The build is `npm run build`, which hands the pylon CLI to node rather than
running it as a program. `npx pylon build` cannot work here: `pylon-dev` ships
its CLI as an ESM file with no shebang line, so the shell reads the first line
of JavaScript as shell syntax and dies on `import{program as G}from"commander"`.
`scripts/deploy.sh` and the `build`, `dev` and `test` scripts all call it the
same way.

Bump the version in `package.json` first: the number is a decision and not a
side effect. The script stamps `AGENT_VERSION`, `AGENT_COMMIT` and
`AGENT_BUILT_AT` as vars and then asks the deployed Worker for
`{ version { agent commit builtAt } }` until it answers with the stamp it was
given, up to six times ten seconds apart, because the custom domain keeps
answering from the previous version for about twenty seconds. A bare
`wrangler deploy` leaves the three unset and the query answers nulls, which
reads as "deployed without the script", so this is the one way to deploy.

`CLOUDFLARE_API_TOKEN` is dropped from the environment: a Pages token exported
from a site checkout would otherwise win over the account login.
`NODE_OPTIONS=--no-network-family-autoselection` is exported, because node's
fetch dies on this machine's unreachable AAAA records and wrangler is node.

The KV namespace is created once:

```
env -u CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID=92920a0740087f4d54d9201675220d43 \
  npx wrangler kv namespace create CACHE
```

and the id it prints replaces the placeholder in `wrangler.toml`.

## Tests

```
npm test
```

`tests/agent.test.ts`, run by node's own test runner. It creates a throwaway
branch of `netsnek/booklimo.at`, starts a local `wrangler dev` against it with
a `SITES` entry pointing at that branch and a KV of the run's own, and deletes
the branch afterwards. Nothing runs against `limosen.at`, and nothing reaches
booklimo.at's `main`.

What it proves: a save is one commit in the editor's name and reads back
through the agent; a stale save is rebased and keeps the other editor's field;
the head patch ends up last in `patches.txt`; a poll whose `sinceSha` is the
head answers with no body; publish commits nothing; and the agent refuses
another site's admin, a caller of this site without the role, an anonymous
call and an unknown site key.

The callers are the taxi machine accounts of `~/.config/taxi-app/tokens.env`
rather than the human logins beside them, because `accounts.netsnek.com` does
not offer the password grant (`unsupported_grant_type: password not supported`,
measured 2026-09-07) and a human token therefore needs a browser. The three
machine accounts are real accounts in the two organisations and carry exactly
the three identities the refusals are about: booklimo's `jaen:admin`,
booklimo's `krc:customer`, and limosen's `jaen:admin`. The issuer's discovery
document says the same thing in the positive: its `grant_types_supported` is
`authorization_code`, `implicit`, `refresh_token`, `client_credentials`,
`jwt-bearer` and `device_code`, and none of those mints a token from a login
name and a password without a browser.

There is one editor in the run rather than two, because the second identity a
second editor needs is another account holding `jaen:admin` on booklimo, and
the only other booklimo account in the set is the customer, whose refusal is
one of the things the run proves. What a second editor would add over the
stale save is the author line of a different account, and the author line is
already asserted on the one save that is made.

Measured 2026-09-07, all ten green in 22.7 s against a local `wrangler dev` on
port 8977 and a throwaway branch of `netsnek/booklimo.at`, the branch deleted
by the teardown and no `jaen-agent-test-*` branch left on the repository.

## Why this package is not in the workspace

The root `package.json` lists the packages yarn hoists, and this one is not
among them on purpose. It is a Worker and not a library: it has its own
`package-lock.json` and its own `node_modules`, so its pylon, hono and wrangler
never enter a site build's dependency graph, and a site's dependency resolution
never decides what the agent deploys.

## What of `~/git/jaen-agent-v2` is here

Its `src/stubs` unchanged: `ts-morph`, which pylon uses to derive the schema at
build time and whose import survives into the bundle esbuild cannot resolve,
and `hono/compress`, which gzips a body and sets `Content-Encoding` that
Cloudflare's edge then drops, so the client receives gzip bytes it has been
told are plain JSON. Both are aliased in `wrangler.toml`. Its `src/hosts` is
not: a publish there was one text file and one appended line, and this reads
and writes a document, resolves a branch head, dispatches a workflow and mints
an App token, which is `src/github.ts`.
