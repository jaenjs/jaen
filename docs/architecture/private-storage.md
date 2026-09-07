# Private storage: nothing behind a gateway link is public

Owner (Florian), 2026-09-07: "currently everything behind an osg link is
public. I want to make everything private and jaen to retrieve the data
from osg in the GitHub build workflow using a Zitadel token. The same goes
for the client, it uses the Zitadel token of the user."

## Today

The storage gateway (jaenjs/open-storage-gateway, osg.netsnek.com) has no
authentication, no ACL and no expiring link: `GET /storage/:id` answers
anyone, forever, and the ids are the only secret. jaen's `uploadFile`
(`packages/jaen/src/utils/open-storage-gateway.ts`) uploads without a
credential, the CMS and the built sites load media straight from the
gateway's URL, and the taxi platform's offers, invoices and car pictures
went there on 2026-09-07 (taxi-app okf/architecture/media.md).

## Target

**The gateway is private.** Every read and every write of the gateway
carries a Zitadel token, introspected the way the taxi pylons do it
(through the identity facade of the organisation, `idm.<brand>`, or
directly against the identity server for organisations without one),
and a file belongs to the organisation that uploaded it: a token of
another organisation is refused. The drivers (git, telegram, s3) do not
change, the gate sits in front of them.

**The build fetches with a machine token.** `gatsby-source-jaen` (or the
build step that resolves media nodes) downloads every media file the
site's jaen data names from the gateway at build time with a machine
user's token held as a GitHub Actions secret per site (`OSG_TOKEN`, a
Zitadel machine user of the site's organisation with the gateway role),
and the built site serves the files itself from its own static output,
so a visitor never touches the gateway and the gateway never serves a
visitor. Nothing of a public site depends on the gateway at runtime.

**The client fetches with the user's token.** In the CMS and in the app,
a media file is loaded with the signed-in person's Zitadel token, the
same token the pylons take, and shown through an object URL, never
through a bare `<img src="https://osg…">`. jaen's `uploadFile` and a new
`fetchFile` carry the token, and the media components draw through
them.

**Signed links for people without a token.** A customer who opens an
offer from a mail, a ride page visitor, or a mail client fetching an
attachment has no token. For them the gateway issues short-lived signed
links (`/storage/:id?exp=&sig=`, an HMAC of the gateway's own key, thirty
days for a mail, fifteen minutes for a page) only to an authorised
caller: the taxi pylon asks for one with its machine token when it
composes a mail or answers `documentUrl` to a customer. That brings back
the expiring link the platform had before the gateway move, now issued
by the gateway itself, so the store stays one.

**Push images** (the car's cover in a notification) are fetched by the
browser's push service without a token, so the pylon puts a signed link
there too.

## Identity, the one way, owner 2026-09-07

Owner: "ich hoffe du machst die Authentifizierung und Autorisierung so wie
im jaen agent und zitadel-gql und kochst fürs osg nicht eine eigene Suppe
mit dem Authentication-Plugin." Every jaen service (the agent, the storage
gateway, the identity facade) authenticates and authorises the same way:
the module of zitadel-gql (`apps/graphql/src/auth.ts`, its `requireAuth`
replacing Pylon's, the introspection against Zitadel) and of the taxi
pylon (`pylon/src/auth`, the sixty second cache, `requireRole` with the
organisation's role keys). That module is copied, not reinvented: the
same token, the same introspection, the same cache, the same errors, the
same role names, no scheme of a service's own and no use of Pylon's
authentication plugin in a way the others do not share.

**Corrected 2026-09-07 from the two codebases, because the sentence above
first said the taxi pylon introspects "through the organisation's facade
with the org manager token", and it does not.** Read from
`pylon/wrangler.toml` and `pylon/wrangler-booklimo.toml`: both Workers set
`AUTH_ISSUER = "https://accounts.netsnek.com"` and introspect the caller's
token there, which is also `zitadel-gql`'s issuer. The organisation's
facade (`IAM_API_URL`, `idm.limosen.at` and `idm.booklimo.at`) and
`ORG_USER_MANAGER_TOKEN` are the pylon's **directory** path, how it lists
accounts and their grants, and never how it decides what a caller's own
token is. So one introspection endpoint under one application key is what
all three services share, and the design section below agrees with the
rule rather than departing from it. The facade keeps its job, which is
listing accounts fast for the pylons.

## Acceptance

- An anonymous `GET /storage/:id` on osg.netsnek.com answers 401, the
  same with a token of another organisation 403, with a fitting token 200.
- A site build in GitHub Actions on booklimo.at with `OSG_TOKEN` set
  fetches every media node and the built site serves them from its own
  origin; the same build without the secret fails with a clear message.
- The CMS media library and the app's car pictures render for a signed-in
  admin with no request to the gateway lacking a bearer token.
- The offer mail's link and the ride page's document links are signed
  gateway links that answer 200 until they expire and 410 after.
- The documents and pictures that already exist keep their ids and need
  no re-upload.

## Design

Written 2026-09-07 from the code of the gateway, the two sites, the taxi
platform and jaen itself, and from the identity server's own answers. Every
number below was measured on the live systems on that day.

### The gateway as it stands

`jaenjs/open-storage-gateway`, version 2.0.0, Pylon 3 on Hono. Four files
carry everything the gate touches.

| file                               | what it does                                                                                                                                                                                                      |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/index.ts`                     | the GraphQL block (`storageDrivers`, `storedFile`, `gitStore`, `upload`), the byte route `app.get('/storage/:id{.+}')`, `app.get('/ping')`, and `publicUrl`, which mints a URL on the host the request came in on |
| `src/id.ts`                        | `decodeId`: an id starting `git_` or `s3_` names that driver, anything else is a Telegram id, permanently, because published patches carry those handles                                                          |
| `src/drivers/registry.ts`          | `readTarget(id)` for a read, `writeDriver(requested)` for a write, the order being the caller's choice, then `DEFAULT_DRIVER`, then git                                                                           |
| `src/drivers/{telegram,git,s3}.ts` | `put` and `get`, nothing else. `telegram` is the only one configured on the Worker, because a Worker has no filesystem for git and no bucket is set for s3                                                        |

The upload is the GraphQL multipart request spec:
`mutation upload(args: {file: File!, driver: String})`, one form field
`operations`, one `map`, one part per file. jaen builds it by hand in
`packages/jaen/src/clients/osg/index.ts` (`buildMultipartForm`) and the taxi
Worker builds the same body by hand in
`pylon/src/documents/confirmation.ts` (`uploadToGateway`). There is
deliberately no REST upload.

**Where a request can be gated.** Three places, and the design uses all
three.

1. A Hono middleware in front of the byte route. `app.use('/storage/*', ...)`
   runs before the handler, sees the `Authorization` header and the query,
   and can answer 401, 403 or 410 without a driver ever being asked.
2. The `upload` resolver in the GraphQL block. Pylon's own guard is not
   usable as it stands (`@requireAuth()` only asks whether `auth` is truthy,
   and `useAuth` sets that on an anonymous request too, the defect written up
   in the memory note `pylon-v3-gotchas`), so the check is called from the
   first line of the resolver, the way `zitadel-gql/apps/graphql/src/auth.ts`
   does it.
3. `PylonConfig.plugins`, which is where a middleware for the whole app would
   go if the two above ever need to become one.

`storedFile` and `gitStore` are gated with the same call as `upload`.
`/ping` stays open, a kubelet and a Cloudflare health check do not carry
tokens.

### Where osg.netsnek.com runs, and how it is deployed

| piece      | value                                                                                                                                                                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| shape      | a single Cloudflare Worker named `osg`, `main = .pylon/index.js`, compatibility date 2026-07-01, flag `nodejs_compat`, last deployed 2026-08-22                                                                                                                                      |
| account    | `a4b0e1ba603b529a64d355679ff2911a`, the owner's personal Cloudflare account, which also holds the zones `netsnek.com` and `jaen.io`                                                                                                                                                  |
| names      | two custom domains on one Worker, `osg.netsnek.com` (zone `netsnek.com`) and `osg.jaen.io` (zone `jaen.io`), both declared in `wrangler.toml` as `custom_domain = true`                                                                                                              |
| DNS        | `osg.netsnek.com` is an `AAAA` to `100::` proxied, which is what a Worker custom domain writes. There is no origin behind it                                                                                                                                                         |
| vars       | `PUBLIC_BASE_URL=https://osg.netsnek.com`, `DEFAULT_DRIVER=telegram`, `TELEGRAM_API_URL=https://api.telegram.org`                                                                                                                                                                    |
| secrets    | `TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID`, both `secret_text`, set with `wrangler secret put`                                                                                                                                                                                             |
| deploy     | `npx wrangler deploy` from the repository root against that account. There is no GitHub Actions workflow in the repository, the tree has no `.github` at all                                                                                                                         |
| credential | the Cloudflare global key of `~/.claude/vault/secrets.yml` reaches this account. It does **not** reach `92920a0740087f4d54d9201675220d43`, the account the taxi Workers and both Pages sites live in, so the gateway deploy and a taxi deploy are two credentials and always will be |

The container image (`Dockerfile`, node 22 with git on the path) is the other
deployment shape and is what a host with a filesystem would run for the git
driver. Nothing of ours runs it today.

**The second gateway, which is the hole in all of this.** `osg.snek.at` is an
`A` record to `89.58.34.70`, proxied, a netcup host that also serves
`api.snek.at`. It is the Go service this repository replaced. It still
answers `GET /storage/<id>` for every Telegram id, because a Telegram
`file_id` is scoped to the bot that owns it and both gateways speak to the
same bot. Measured 2026-09-07: the id
`BQACAgQAAx0Ed6zoewACA2xo3WsqU-9YMlKEPHMFpHXqSDzxswACkhoAAi2T6VLhCo3jFwj6_S8E`
answers 200 with the same 1758 bytes on `osg.snek.at` and on
`osg.netsnek.com`. **Gating osg.netsnek.com hides nothing while osg.snek.at
stands**, and `limosen.at/jaen-data/patches.txt` still names osg.snek.at on
every one of its sixteen lines, booklimo on eighteen. Closing it is part of
the work, not a footnote, and it is the first of the two facts this design
could not establish (below).

### Whose file is whose

The gateway has no notion of an organisation. It has no listing either:
`storedFile(id)` answers for an id you already know, and neither Telegram nor
the content-addressed git store can be enumerated, so **there is no way to
ask how many files exist**. Ownership therefore cannot be derived, it has to
be written down.

**The store.** A D1 database `osg-owners` bound to the Worker as `OWNERS`,
one table:

```sql
CREATE TABLE file_owner (
  file_id    TEXT PRIMARY KEY,
  org_id     TEXT NOT NULL,
  driver     TEXT,
  mime_type  TEXT,
  size       INTEGER,
  created_at TEXT NOT NULL,
  created_by TEXT,          -- the sub of the token that uploaded it
  source     TEXT NOT NULL  -- 'upload' or the backfill run that claimed it
);
CREATE INDEX file_owner_org ON file_owner (org_id);
```

D1 rather than KV, although KV would be the faster read: the backfill is a
bulk insert of a few thousand rows and the questions that will actually be
asked of it ("which files does this organisation own", "what is still
unclaimed") are queries, which KV cannot answer. A read costs one D1 lookup,
memoised in the Worker's module scope by file id for the isolate's life,
which is safe because a row is written once and never changed.

**How the existing files are assigned.** Four sources, in this order, run by
`scripts/backfill-owners.py` in the gateway repository.

1. **Each site's jaen data.** Every `https://osg.snek.at/storage/<id>` and
   `https://osg.netsnek.com/storage/<id>` occurring anywhere in the site's
   `jaen-data/*.json` and in every remote patch named in
   `jaen-data/patches.txt`, plus the patch snapshots themselves, belongs to
   that site's organisation. The patch payloads are where the media nodes
   live, and a media node is not the only carrier: an image field's
   `defaultValue` and a page's `jaenPageMetadata.image` hold bare gateway
   URLs too, which is why the scan is over the raw text and not over the
   parsed media nodes. Counted 2026-09-07 in the local patch files alone,
   before the remote snapshots are fetched: 174 distinct ids for limosen.at,
   180 for booklimo.at.

   | site                    | organisation               |
   | ----------------------- | -------------------------- |
   | limosen.at              | `339284789469124181`       |
   | booklimo.at             | `356348844407002709` (krc) |
   | netsnek.com, adlerhorst | `268210807970535009`       |
   | photonq                 | `268207341512496739`       |
   | nadine-hauswirth.com    | `334831568918943355`       |
   | barbara-mauz.at         | `278641258304378483`       |

2. **The taxi platform's D1 rows.** `SELECT fileId FROM CarImage` and
   `SELECT fileId FROM TransferDocument` on each brand's database (`booklimo`
   is `27748264-218f-4ada-994b-ced6785e649d`), each row's file belonging to
   that brand's organisation. The two brands never share a database, so the
   query is per brand and the answer needs no interpretation.

3. **The gateway's own answer.** For every id claimed, `storedFile(id)` fills
   `driver`, `mime_type` and `size`, so the row says what it holds and a
   later audit does not have to fetch bytes.

4. **Everything else stays unclaimed**, and unclaimed is the hinge of the
   migration: a file with no row is public, a file with a row is private.
   That is what makes this a per organisation move instead of a flag day for
   every jaen site the gateway has ever served. The last step of the
   migration sets `CLAIM_ALL=1`, after which an unclaimed file is refused
   like any other, and the netsnek organisation is the owner of record for
   anything that turns up afterwards.

### The token check

The gateway introspects the token itself, once, at the identity server.

```
POST https://accounts.netsnek.com/oauth/v2/introspect
client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer
client_assertion=<RS256 JWT, iss=sub=clientId, aud=the issuer, kid=keyId>
token=<the caller's token>
```

The assertion is signed with the CMS application key, the same JSON the
identity facade holds as `AUTH_KEY` (kubernetes secret
`idm-graphql-netsnek-auth` in the `zitadel` namespace of the photonq
cluster, application `346283756287432310` of project
`268283277977065078`). On the Worker it is a secret, `wrangler secret put
AUTH_KEY`, and Pylon reads exactly that name from the environment before it
looks for a key file, so the shape is already the one this stack uses.

**Measured 2026-09-07 with the four taxi machine tokens.** The answer carries
everything the gate needs and nothing has to be looked up afterwards:

```
active, sub, username, preferred_username, name, scope, aud, exp, iat, nbf, jti,
urn:zitadel:iam:user:resourceowner:id            <- the organisation
urn:zitadel:iam:user:resourceowner:name          <- "krc"
urn:zitadel:iam:user:resourceowner:primary_domain
urn:zitadel:iam:org:project:roles                <- { "krc:driver": {...} }
urn:zitadel:iam:org:project:268283277977065078:roles
urn:zitadel:iam:user:metadata
```

The booklimo tokens come back with `resourceowner:id`
`356348844407002709` and roles `jaen:admin`, `krc:driver`, `krc:customer`
respectively, the limosen admin token with `339284789469124181` and
`jaen:admin`. **The brands' own roles are granted on the CMS project**, so
one introspection under one application key answers for the CMS, for the app
and for the pylons alike. A token that is not one answers `active: false` and
nothing else.

**The tenant is `urn:zitadel:iam:user:resourceowner:id`.** Not an argument,
not a header, not a hostname. It is the rule the taxi pylon already follows
(`pylon/src/auth/index.ts` reads the same claim) and it is what
`okf/decisions/hard-rules.md` means by deciding authorisation in the resolver
and never in the arguments.

**Not through `idm.<brand>`.** The brief sketched the facade as the
introspection path for limosen and booklimo and the identity server directly
for netsnek's own sites. That is one path too many. The facade is a directory
over Zitadel and has no token endpoint, its nearest equivalent is
`currentUser`, which costs a Zitadel round trip of its own on top of the
introspection Pylon does at the facade's own door. Both facade hosts are one
deployment of one Zitadel. And the gateway serves every organisation, not one
brand, so it would have to pick a facade by guessing at the caller. One
introspection at `accounts.netsnek.com` answers the organisation and the
roles for all of them. The facade keeps its job, which is listing accounts
fast for the pylons.

**The cost, and the cache.** The introspection took a median of 735 ms from
this machine over five calls, and a refusal 300 ms. That is the same 750 ms
the taxi pylon measured from Cloudflare's edge, because the issuer sits
behind Cloudflare at the photonq origin. So the gateway remembers an
introspection that came back `active` in the Worker's module scope, keyed by
the SHA-256 of the token, for `AUTH_CACHE_TTL_MS` (60 000 by default, capped
by the token's own `exp`, `0` disables), refreshed in the background past
half its life. This is `pylon/src/auth/cache.ts` of the taxi platform, the
same variable name and the same default, and it carries the same consequence:
a revoked token keeps working for at most a minute. An inactive answer is
never stored, so a bad token pays the round trip every time and is refused
every time.

### The right

| verb                     | who                                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| read a file              | an active token whose organisation is the file's organisation, no role required. Or `storage:admin`, which reads any organisation. Or a valid signature |
| read an unclaimed file   | anyone, until `CLAIM_ALL=1`                                                                                                                             |
| upload                   | an active token holding `jaen:admin`, `storage:write` or `storage:admin`. The new file is stamped with that token's organisation                        |
| mint a signed link       | an active token holding `storage:sign`, `jaen:admin` or `storage:admin`, for a file of its own organisation                                             |
| `storedFile`, `gitStore` | the same rule as a read, and `gitStore` additionally `storage:admin`                                                                                    |

Read is by organisation and not by role on purpose. A KRC driver holds
`krc:driver` and a hotel `krc:customer`, some accounts of the directory hold
no role at all (`digitalerweise` and every machine user, read on the live
organisation 2026-09-07), and all of them have to be able to see a car
picture. An organisation is a tenant boundary. A role inside it is a job.

`storage:read`, `storage:write`, `storage:sign` and `storage:admin` are four
new roles on the CMS project `268283277977065078`, which is where the
introspection asserts from. `jaen:admin` counts as all four inside its own
organisation, so no CMS editor needs a new grant: on booklimo the three human
admins (`krc.kleber`, `sefa`, `koracaltunok`) already hold it. Role matching
accepts the bare key and the project scoped spelling
`268283277977065078:storage:write`, the way Pylon's own `authMiddleware`
does.

The refusals are kept apart, which `okf/decisions/hard-rules.md` requires:
401 `AUTH_REQUIRED` with no token or an inactive one, 403 `FORBIDDEN` with a
token of another organisation or without the role, 404 for an id the driver
does not know, 410 `LINK_EXPIRED` for a signature that has run out.

### Signed links

For a customer opening an offer from a mail, a visitor of the public ride
page, a mail client fetching an attachment and the browser's push service,
none of which has a token.

```
GET /storage/<id>?exp=<unix seconds>&sig=<base64url>
sig = HMAC-SHA256(SIGNING_KEY, `${id}\n${exp}`)
```

This is `pylon/src/documents/sign.ts` of the taxi platform moved into the
gateway, message shape and all: the id and the expiry and nothing a caller
could swap, base64url of the raw HMAC, compared in constant time, 410 once
`exp` has passed. `SIGNING_KEY` is a Worker secret of at least sixteen
characters and a deployment without it mints nothing and says so
(`LINK_KEY_NOT_CONFIGURED`, 503) rather than handing out an unsigned link.
The host is deliberately not part of the message, because the same Worker
answers as `osg.netsnek.com` and as `osg.jaen.io` and a link minted through
one name has to work on the other.

Minting is a mutation, `signedUrl(args: {id: String!, expiresIn: Int})`,
answered as `{url, expiresAt}`. The caller is checked as above. `expiresIn`
is capped at thirty days, defaults to fifteen minutes, and the two callers
that matter use the two ends of that: the offer mail thirty days, the ride
page and the app fifteen minutes. A signature carries no organisation and no
right of its own, it is a delegation of a read the minter already had.

Two response details that are wrong today and have to change with the gate.
The byte route sends `Cache-Control: public, max-age=31536000, immutable` and
`Access-Control-Allow-Origin: *` to everyone. A token read must answer
`private, max-age=60`, a signed read `public` capped at the remaining life of
the signature, and an unclaimed public read may keep the year. And an
`Authorization` header makes the browser preflight, so the route needs an
`OPTIONS` answer carrying `Access-Control-Allow-Headers: authorization` and
`Access-Control-Allow-Origin: *`, which stays legal because the credential is
a bearer header and not a cookie.

Pylon's `useAuth` also accepts a token as `?token=` and as a `pylon-auth`
cookie. The gateway accepts neither. A token in a URL lands in a log, a
`Referer` and a shared link, which is the whole reason the signature exists.

### The build

The site build stops being a visitor of the gateway. It downloads every file
the site names, writes it into the site's own static output, and rewrites the
URLs so the published site never mentions the gateway again.

**The credential.** One machine user per organisation, `osg-build-limosen`
and `osg-build-krc`, holding `storage:read` and nothing else, their personal
access tokens reaching the build as the environment variable `OSG_TOKEN`.
In a GitHub Actions build that is a repository secret per site. **Neither
site is built by Actions today**, and the design does not pretend otherwise:
`limosen.at/.github/workflows/jaen-publish.yaml` only appends the published
patch URL to `jaen-data/patches.txt`, and `booklimo.at`'s `deploy.yaml` calls
`atsnek/jaen/.github/workflows/jaen-deploy.yaml@main`, which the checkout's
own comment records as failing on every run since 2025-11. The build that
actually ships is `scripts/deploy.sh` on this machine, because the jaen
packages are `link:` dependencies on a sibling checkout. So `OSG_TOKEN` is
read from the environment, `deploy.sh` sources it from
`~/.config/jaen/osg.env` (mode 0600, beside the taxi platform's own token
files), and the same name is already the Actions secret for the day the
workflow is repaired. A build without it fails at the first media node with
"OSG_TOKEN is required to fetch media from the storage gateway", never with a
blank image.

**Where it goes in the code.** Two fetches in `gatsby-source-jaen`, both of
which are already the only ones that touch the gateway.

1. `src/source-nodes/jaen-data.ts` fetches every remote patch named in
   `patches.txt` through `src/utils/fetch-with-cache.ts`. That helper takes
   the header. The patches are gateway files like any other and are owned by
   the site's organisation.
2. `src/source-nodes/jaen-pages.ts` calls `createRemoteFileNode({url: node.url, ...})`
   for every media node of the `/cms/media/` page. `createRemoteFileNode`
   takes `httpHeaders`, which is where the bearer goes.

**The static output.** After the media nodes are sourced, a step writes each
downloaded file to `public/osg/<file_id>.<ext>` (the extension derived from
the node's mime type, because Cloudflare Pages picks the content type by
extension) together with `public/osg/index.json`, the map from file id to
path, which is what a check reads. The path is deterministic and carries no
content hash, so one gateway URL maps to exactly one site path.

**The rewrite.** Every `https://osg.snek.at/storage/<id>` and
`https://osg.netsnek.com/storage/<id>` in the sourced jaen data becomes
`/osg/<id>.<ext>`. It has to be a rewrite over the data and not a change to
one component, because the URLs sit inside published patch payloads: in
`MediaNode.url`, in image fields that carry only a `defaultValue`, and in
`jaenPageMetadata.image`, which OpenGraph serves to crawlers that hold no
token and which therefore becomes the absolute `${siteUrl}/osg/<id>.<ext>`
rather than the relative path. The optimised path is unaffected: a field with
a media node renders `GatsbyImage` from the file node Gatsby already made,
which never was a gateway request at runtime.

### The client

**In jaen.** `packages/jaen/src/utils/open-storage-gateway.ts` gains the
counterpart of `uploadFile`:

```ts
export const fetchFile = async (idOrUrl: string): Promise<Blob>
export const useFileObjectUrl = (idOrUrl?: string | null): string | undefined
```

`fetchFile` GETs `${storageOrigin()}/storage/<id>` with
`Authorization: Bearer <access token>`, the token read from the stored OIDC
session with `accessTokenFromOidcStorage`, exactly as
`packages/jaen/src/clients/jaen/src/index.ts` reads it for the CMS API.
`useFileObjectUrl` wraps it as an object URL and revokes it on unmount, so a
picture is never a bare `<img src="https://osg…">` again. Without a session
it answers the plain URL, which is right while a file is still unclaimed and
becomes a 401 and a placeholder afterwards. `uploadFile` sends the same
header on its mutation, which is the whole of the write side in jaen: every
upload in the CMS and in the app goes through it.

**The components that draw.** Four in `gatsby-plugin-jaen` and three in the
app, and no others touch a gateway URL at runtime.

| place                                                                             | line                                                                     |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `components/cms/Media/components/MediaGallery/components/MediaItem/MediaItem.tsx` | `src={node.preview?.url}`                                                |
| `components/cms/Media/components/MediaPreview/MediaPreview.tsx`                   | `src={selectedMediaNode?.url}` and `src={node.preview?.url ?? node.url}` |
| `components/shared/FormMediaChooser/FormMediaChooser.tsx`                         | `src={src}`                                                              |
| `packages/jaen/src/fields/ImageField/ImageField.tsx`                              | the `defaultValue` branch, the unoptimised one                           |
| `taxi-app app/shared/components/CarImage.tsx`                                     | `<Image src={src}>`, the cover                                           |
| `taxi-app app/shared/components/CarImagesField.tsx`                               | the vehicle form's grid                                                  |
| `taxi-app app/shared/components/CarGallery.tsx`                                   | the customer's strip, through `CarImage`                                 |

Each takes `useFileObjectUrl` in place of the raw URL. The image editor in
`MediaPreview` reads its canvas from the same object URL, which also removes
the cross origin dance the gateway's `Access-Control-Allow-Origin: *` comment
was written for.

### The taxi pylon's machine token

The Worker holds one more secret, `OSG_TOKEN`, the personal access token of a
machine user of the brand's own organisation: `osg-limosen` in
`339284789469124181`, `osg-krc` in `356348844407002709`, each granted
`storage:read`, `storage:write` and `storage:sign` on the CMS project. Minted
the way the test accounts are minted, and not by the organisation token,
which cannot issue one: a signed JWT as the system user `claude-admin` (key
`~/.claude/vault/keys/zitadel-photonq-claude-admin.key`, `aud` always
`https://accounts.photonq.org`, `Host: accounts.netsnek.com` picking the
instance), then `AddMachineUser` and `AddPersonalAccessToken` with the
`x-zitadel-orgid` header of the organisation, exactly as
`okf/operations/test-accounts.md` records for the KRC manager token.

It is a new secret and not `ORG_USER_MANAGER_TOKEN`. That token is an
organisation manager and reads the whole directory. A storage credential that
is also a directory credential is one leak with two consequences.

Where the Worker uses it: `pylon/src/documents/confirmation.ts`
(`uploadToGateway`, the confirmation and the offer PDFs), the invoice upload
path, `pylon/src/mail/emailwerk.ts` where it fetches the attachment bytes
back, and the three places that hand a URL to somebody without a token, which
become `signedUrl` calls: `documentUrl` in `pylon/src/documents/services.ts`,
the offer mail's document link, and the push payload's `image` in
`pylon/src/push/customer.ts`, which the browser's push service fetches
anonymously.

### The order, so that nothing breaks

Writes first, reads last, and the sites rebuilt in between. Each step is
deployable on its own and each one is measurable.

1. **The ownership store, empty.** D1 created and bound, the auth code
   deployed with `ENFORCE_WRITES=0` and `CLAIM_ALL=0`. Nothing is refused.
   The gateway logs one line per anonymous read and per anonymous write, so
   the next steps are planned on counts rather than on guesses.
2. **The backfill.** `scripts/backfill-owners.py` claims the two taxi brands
   from their D1 rows and the sites from their jaen data. Claimed files are
   still public, because read enforcement is off. The run prints per
   organisation how many ids it claimed and how many it re-read from the
   gateway to confirm.
3. **Every writer carries a token.** jaen's `uploadFile`, the taxi Worker's
   `uploadToGateway`, the publish flow that uploads a patch. The machine
   users and the four roles are created first, and a pre-flight lists every
   account that uploads on either brand and asserts it holds `jaen:admin` or
   `storage:write`, because a write gate that refuses the dispatcher who adds
   a car picture is an outage. Deployed, and nothing is refused yet.
4. **`ENFORCE_WRITES=1`.** An anonymous upload is 401 from here on, and every
   new file has an owner row from its token. This is the step that stops the
   store growing without an owner, and it breaks no reader.
5. **The readers get their tokens.** `fetchFile` and `useFileObjectUrl` in
   jaen, the seven components, the pylon's signed links for `documentUrl`,
   the offer mail and the push image, the pylon's own attachment fetch with
   `OSG_TOKEN`. App and pylon deployed on booklimo, measured there, then
   limosen.
6. **The sites rebuilt.** `gatsby-source-jaen` with the bearer and the
   rewrite, `OSG_TOKEN` in the environment, both sites built and deployed
   through their own `scripts/deploy.sh`. A visitor of either site makes no
   request to the gateway at all after this, which is the acceptance to
   measure: load every public page with the network log and assert no request
   to an `osg.` host.
7. **Read enforcement, per organisation.** A claimed file now needs a token
   or a signature. Because the gate is by row and not by a global flag, this
   is turned on for the two taxi organisations first, while netsnek.com,
   adlerhorst, photonq, nadine-hauswirth and barbara-mauz are still unclaimed
   and still public, and each of those follows when its own site has been
   rebuilt on the new `gatsby-source-jaen`.
8. **`CLAIM_ALL=1`.** An unclaimed file is refused like any other. Nothing
   behind a gateway link is public any more, which is the owner's sentence.
9. **osg.snek.at closed**, or step 8 is decoration. Every id the gateway ever
   issued is readable there without a token today.

Rolling back is a variable at every step: `ENFORCE_WRITES=0`,
`CLAIM_ALL=0`, and a `wrangler deploy` of the previous version. The
ownership rows are never deleted on a rollback, they are the only thing in
this design that cannot be rebuilt cheaply.

### The two facts this design could not establish

**How osg.snek.at is operated, and therefore whether it can be closed.** It
is an `A` record to the netcup host `89.58.34.70`, which also serves
`api.snek.at`. There is no entry for that host in `~/.ssh/config`, no
checkout of the Go service on this machine, and nothing in the gateway
repository or in the memory notes says who deploys it or what else depends on
it. What is certain is that it serves the same bytes for the same ids as
osg.netsnek.com, measured, and that both sites' `patches.txt` still names it.
Until somebody who knows that host takes it down or puts the same gate in
front of it, the whole of this design is a lock on one of two doors.

**How many files the gateway holds, and how many will never be claimed.**
There is no listing. `storedFile` answers for an id you already have,
Telegram's Bot API offers no enumeration of a chat's documents through the
driver as written, and the git store is not deployed on the Worker. The
backfill can therefore claim what the sites and the databases name and
nothing else, and the size of the remainder is unknown before step 8 turns it
into refusals. That is why `CLAIM_ALL` is its own step at the end and not the
same switch as read enforcement, and why step 1 logs every anonymous read for
a while before anything is refused: the log is the only census this store can
be given.

### Built on the taxi platform's side, 2026-09-07 late

The gateway's own half is this repository's branch `private-storage` of
`jaenjs/open-storage-gateway`. What the taxi platform built against it is
written in `okf/architecture/media.md` of `netsnek/taxi-app`, and three of the
things it cost belong here, because they are true for every jaen service that
talks to this gateway and not only for that platform.

**The mutation argument is `Number`, not `Int`.** Pylon derives the gateway's
schema from its TypeScript and a `number` argument becomes the scalar
`Number`, so a document that declares `mutation SignedUrl($id: String!,
$expiresIn: Int)` is refused with `GRAPHQL_VALIDATION_FAILED` before the
resolver is reached and no link is minted at all. Read off the gateway's own
`schema.graphql`. The same holds for `upload`, whose `driver` is `String` and
whose `file` is `File!`, which is why jaen builds that body by hand.

**A role that exists on the CMS project is still not grantable in another
organisation.** The four roles `storage:read`, `storage:write`,
`storage:sign` and `storage:admin` had to be added to project
`268283277977065078` with the system user `claude-admin` (`AddProjectRole` on
`zitadel.project.v2beta.ProjectService`, the recipe of the memory note
`netsnek-zitadel-admin`), because an organisation manager token cannot add a
project role. And after that `CreateAuthorization` still answered
`Errors.Project.Role.NotFound (COMMAND-mm9F4)`, which reads like a missing
role and is a missing grant: the CMS project is granted to each organisation
with an explicit list of role keys, so `UpdateProjectGrant` has to carry the
**whole** new `roleKeys` list, it replaces rather than adds. Every jaen site's
organisation that is to hold a storage credential goes through both steps.

**A consumer decides how to fetch, it does not guess.** `storageFileId` and
`storageBearer` are exported beside `fetchFile` and `useFileObjectUrl` for
exactly that: a source is fetched with the reader's own token when it is a
gateway file **and** there is a session, and drawn as it stands otherwise,
which covers a signed link on a public page and a path a build wrote. The
taxi app has one component for the whole rule
(`app/shared/components/StorageImage.tsx`, mirrored into
`packages/gatsby-jaen-app`), and a picture whose bytes have not arrived yet
draws a placeholder rather than the gateway URL, because painting the URL for
one frame is a 401 and a broken image in the layout.

**Measured twice**, `tests/44-private-storage.ipynb` of the taxi platform,
6 / 0 / 0 / 0 both times, the second time against an image built from the
gateway head that added the shared read and the backfill: an anonymous read
401 `AUTH_REQUIRED`, the owning organisation's token 200 with
`Cache-Control: private, max-age=60`, another organisation's token 403, a
minted link opening with no `Authorization` header and running out in 900
seconds, an anonymous caller minting nothing, an expired signature 410
`LINK_EXPIRED` where a forged one is 403, and the offer the Worker compiled
reachable by a customer through a thirty day link and by nobody else.

**What is still not true in production.** Read off the live
`osg.netsnek.com` at the end of that run: `/ping` 200, the mutation type
carrying `upload` alone and no `signedUrl`, and an anonymous
`GET /storage/<a known Telegram id>` still 200. The gate ships when this
branch does, and only then does a pylon that mints links get its
`OSG_TOKEN`.

## Built 2026-09-07, the gateway itself

Branch `private-storage` of `jaenjs/open-storage-gateway`, local checkout
`~/git/open-storage-gateway`, seven commits from `a24d325` to `7efc2ae`. Not
deployed: `wrangler deploy` and the D1 database belong to the deploy phase, and
the ownership store is the one thing in this design that cannot be rebuilt
cheaply, so it is created once and never by a build run.

### What the gate does, and where it sits

All three places the design named, and for the reason it gave. A Hono
middleware on `app.use('/storage/*')` decides every byte read before a driver is
asked, so a refusal never confirms that an id exists. Every resolver that is not
`/ping` calls the same check on its first line, because Pylon's `@requireAuth()`
only asks whether `auth` is truthy and `useAuth` sets that on an anonymous
request too, the defect of the memory note `pylon-v3-gotchas`. `/ping` is the
one open route.

`storedFile` is gated like a read, `gitStore` needs `storage:admin` (which
`jaen:admin` is not), `upload` needs `jaen:admin`, `storage:write` or
`storage:admin`, and the new mutation `signedUrl` needs `jaen:admin`,
`storage:sign` or `storage:admin` for a file of its own organisation.

### Identity, and the one difference from the other two services

`src/auth/introspect.ts` posts to `${AUTH_ISSUER}/oauth/v2/introspect` with a
`client_assertion` signed by the CMS application key, which is the request
`zitadel-gql` and both taxi pylons make at the same issuer under the same key.
The tenant is `urn:zitadel:iam:user:resourceowner:id`, the roles are the keys of
the roles claim in either spelling, the scope string is deliberately not read
(a personal access token's scope lists what was asked for, not what was
granted), the cache is `AUTH_CACHE_TTL_MS` at sixty seconds keyed by the
SHA-256 of the token and refreshed past half its life, and the errors are
`AUTH_REQUIRED` 401 and `FORBIDDEN` 403. Same token, same introspection, same
cache, same errors, same role names.

The one difference is that the gateway makes that request itself rather than
letting Pylon's `useAuth` make it, and it is not a scheme of its own but two
things the other services do not have to care about. The byte route is not a
resolver, so there is no Pylon context to read an auth state off, and Pylon's
`useAuth` also accepts a token as `?token=` and as a `pylon-auth` cookie, which
this gateway must refuse: a token in a URL lands in a log, in a `Referer` and in
a shared link, which is the whole reason the signature scheme exists.

An introspection that fails is a 500 `AUTH_UNAVAILABLE` and an ownership store
that cannot be read a 503 `OWNER_STORE_UNAVAILABLE`, never a 401. A broken
credential served as "you are not signed in" is the failure that hides longest,
because every client simply shows a login screen.

### The ownership store, and the column the design did not have

On a Worker it is the D1 database of the design (`scripts/schema.sql`, binding
`OWNERS`). In the container image it is a sidecar index, one JSON object per
line at `OWNER_INDEX_PATH`, by default `$MEDIA_ROOT/.osg-owners.jsonl`, append
only and beside the media, so the container needs no database beside its volume
and survives a restart. Both are read through `src/owners.ts` with the same
memoisation, and the first claim wins in both: a row is written once and never
changed, so an owner a caller can change is not an owner.

**The column the design did not have is `shared`**, a comma separated list of
organisations that may read a file besides its owner. Measured 2026-09-07 over
the two sites' jaen data and their published patches: booklimo.at names 193
gateway ids, limosen.at names 186, and every one of limosen's 186 is among
booklimo's. The two sites are one content lineage, so the same Telegram
`file_id` really is the logo of two companies, and claiming those files for one
organisation would have answered the other site's build with 403 on all 186 of
them. A shared reader reads and nothing more: the owner is who uploaded it, and
minting a signed link stays the owner's, because a signature hands the file to
somebody with no token at all.

`scripts/backfill-owners.py` claims what the sites' jaen data and the taxi
brands' D1 rows name, confirms each id against the gateway's own `storedFile`,
and writes either the sidecar index or the D1 statements. Its default is a dry
run that prints the counts per organisation, which is the only census this store
can be given. It has not been run against the live store.

### Two things a caller has to know

`expiresIn` on `signedUrl` is the scalar **`Number`, not `Int`**. Pylon derives
the schema from the TypeScript and a `number` argument becomes `Number`, so a
document declaring `$expiresIn: Int` is refused with
`GRAPHQL_VALIDATION_FAILED` before the resolver is reached and no link is
minted at all.

The signature's message is `${id}\n${exp}` and the host is deliberately not part
of it, because one Worker answers as `osg.netsnek.com` and as `osg.jaen.io` and
a link minted through one name has to work on the other.

### Measured 2026-09-07 on the container image

`podman build` of the repository's own `Dockerfile`, which is the shape a host
with a filesystem deploys, run with the git driver on a temporary volume, its
own signing key, its own sidecar index and `ENFORCE_WRITES=1`, and with the real
`AUTH_KEY` against `accounts.netsnek.com`. The tokens are the booklimo (krc)
ones of `~/.config/taxi-app/tokens.env`, because every test of this estate runs
on booklimo and never on limosen. Nothing was written to `osg.netsnek.com`,
which has no delete.

`npm test`, 40 of 40, the access table, the roles, the signature, the cache and
the ownership store decided without a network. `npm run typecheck` clean.
`python3 tests/live.py`, 22 of 22 over HTTP:

| what                                                    | answer                                                      |
| ------------------------------------------------------- | ----------------------------------------------------------- |
| `/ping` with no token                                   | 200                                                         |
| a preflight of `/storage/*`                             | 204 with `Access-Control-Allow-Headers: authorization`      |
| an anonymous upload                                     | `AUTH_REQUIRED`                                             |
| an upload by a `krc:driver`                             | `FORBIDDEN`, and not `AUTH_REQUIRED`                        |
| an upload by the booklimo admin                         | 314 ms, stamped `356348844407002709`, source `upload`       |
| that file read by its own organisation                  | 200, the same bytes, `Cache-Control: private, max-age=60`   |
| the same read by a `krc:driver` holding no storage role | 200                                                         |
| the same read anonymously                               | 401 `AUTH_REQUIRED`                                         |
| a file of limosen read by the booklimo admin            | 403 `FORBIDDEN`, not 401 and not 404                        |
| an id nothing ever stored                               | 404 from the driver, the gate having passed it              |
| a link minted by a `krc:driver`                         | `FORBIDDEN`                                                 |
| a link minted by the admin, 900 seconds                 | opens with no token at all, `public, max-age=900`           |
| the last four characters of that signature changed      | 403                                                         |
| a link minted for one second, read two seconds later    | 410 `LINK_EXPIRED`                                          |
| `storedFile` anonymous, then with the token             | `AUTH_REQUIRED`, then the file                              |
| `gitStore` with `jaen:admin`                            | `FORBIDDEN`, because it is `storage:admin` and nothing less |
| a second read within the minute                         | 9 ms, so the remembered token costs no round trip           |

And the credential the taxi Worker will actually carry, `osg-krc`, a machine
user holding `storage:read`, `storage:write` and `storage:sign` and no
`jaen:admin` at all: it uploads, it mints the thirty day mail link
(`expiresAt` 2026-10-07), and that link opens with no token. The role table is
therefore measured on the production credential and not only on an admin's.

### What is still open

The Worker is not deployed, the D1 database is not created and the backfill has
not run, all three of which are the deploy phase's. `ENFORCE_WRITES` and
`CLAIM_ALL` ship at `0`, which is step one of the order: nothing is refused, the
anonymous reads and writes are logged, and the next steps are planned on counts
rather than on guesses. And `osg.snek.at` still answers every id without a
token, so until somebody who knows that netcup host closes it, all of this is a
lock on one of two doors.

## Built 2026-09-07, the jaen side

The client half and the build half of the design, in the jaen checkout and in
the two sites. The gateway's own half is the section above.

### What jaen does now

`packages/jaen/src/utils/open-storage-gateway.ts` has `fetchFile` and
`useFileObjectUrl` beside `uploadFile`, and
`packages/jaen/src/clients/osg/index.ts` puts the credential on every call it
makes. The token is the signed-in person's, read out of the stored OIDC session
under oidc-client-ts's own key
`oidc.user:https://accounts.netsnek.com:268283382465631862@cms`, exactly as the
CMS's own GraphQL client reads it, and in a Node process it is `OSG_TOKEN` off
`globalThis.process.env`, read indirectly so webpack cannot inline a build
machine's credential into a visitor's bundle.

Three values deliberately pass through `useFileObjectUrl` without a fetch: a
source that is not a gateway file at all, which is what a built site's
`/osg/<id>.<ext>` path is, a foreign origin, because sending this person's
token to somebody else's host would be the worse bug, and a gateway file while
nobody is signed in, which is still the right request for a file the gateway has
not claimed. So the hook is inert on a public page and only the CMS and the app
pay for it.

The components that draw are `MediaItem` (the gallery tile, its preview and its
document link), `MediaPreview` (the preview and the editor's canvas),
`FormMediaChooser` and `ImageField`'s unoptimised `defaultValue` branch. None
of them is a bare `<img src="https://osg...">` any more.

### What the build does now

`gatsby-source-jaen` stops being a visitor of the gateway.
`src/utils/osg-media.ts` collects every gateway URL in the sourced jaen data
(`MediaNode.url`, an image field carrying only a `defaultValue`, and
`jaenPageMetadata.image`, over the raw text rather than over parsed nodes,
because published patch payloads are immutable history), fetches each file with
`OSG_TOKEN`, writes it to `public/osg/<file_id>.<ext>` with `public/osg/index.json`
beside it, and rewrites the data onto the site's own origin. `jaenPageMetadata.image`
becomes absolute, because a crawler resolves a relative path against nothing.
The remote patches named in `patches.txt` go through the same header in
`src/utils/fetch-with-cache.ts`, and `createRemoteFileNode` takes it as
`httpHeaders`, so the optimised path is unaffected. The gateway origin is the
`storageUrl` plugin option, forwarded by `gatsby-plugin-jaen` from the same
value the client half uses as `__JAEN_STORAGE_URL__`.

A build without the secret stops at the first media node, in the source phase
after twelve seconds, with `OSG_TOKEN is required to fetch media from the
storage gateway` and the three places to put it, never with a blank image. Both
sites' `scripts/deploy.sh` source `~/.config/jaen/osg-<brand>.env` before
`osg.env`, because one machine user per organisation means the other brand's
token reads none of this site's files, and both `.github/workflows/deploy.yaml`
name `OSG_TOKEN` as a secret of the build for the day those workflows are
repaired.

**A rewritten path comes back as an id.** The CMS on a built site reads the
rewritten data, so a publish writes `/osg/<id>.<ext>` into the patch it uploads.
`collectLocalMediaIds` recognises exactly that shape and the next build fetches
those ids from the gateway again, which closes the loop. Nothing else in the
estate reads a site's jaen data, so no other consumer meets those paths.

### Measured 2026-09-07 on a local production build of booklimo.at

The build: 271 files, 27 800 kB, `jaen media: ... served from /osg/`. Afterwards
no `/storage/` URL is left anywhere in `public` except inside the eight
downloaded patch payloads, which are gateway files themselves and carry their
own history, and the only mentions of `osg.netsnek.com` in the HTML are the four
privacy pages naming the storage processor in prose.

A visitor of `/de/`: 63 requests, none of them to any `osg.` host, the pictures
drawn from the site's own origin.

The CMS as the booklimo human admin, signed in against the live identity server,
the built site served under its own name so the identity server's redirect URI
matches: the media library draws 49 to 60 pictures, none of them a bare gateway
src, and the twelve gateway reads it does make all carry
`Authorization: Bearer`. Those twelve are the taxi app's own folders, which read
the pylon's `CarImage.url` and document URLs at runtime rather than out of the
built data (one of the ids matched a `CarImage.fileId` on `api.booklimo.at`), so
the app's pictures inside the CMS are a token read like any other. An upload
through the gallery carried the same bearer, and the gateway image of this run,
with `ENFORCE_WRITES=1`, accepted it instead of answering `AUTH_REQUIRED`. Four
tiles were drawn through `blob:` object URLs. Fifteen checks, fifteen passed.

Without a browser, jaen's own client against the same image, upload and read
through `uploadFile` and `fetchFile`: the upload is stored under
`356348844407002709`, the read gives the same bytes back by checksum, the same
file read anonymously is 401 `AUTH_REQUIRED` and read with the limosen storage
token 403 `FORBIDDEN`. Five checks, five passed.

**Two things the browser measurement could not do**, and they are the reason the
byte path was measured without a browser as well. Chromium exposes no `File`
body to an interception, so a forwarded upload arrives with an empty part and
the gateway stores zero bytes, which is the interception's defect and not
jaen's. And the image of this run holds only what this run put into it, so the
historical Telegram ids the CMS asked for were answered from the deployed
gateway, which is still the ungated build. Nothing here proves the gate on
`osg.netsnek.com`, which is the deploy step's to prove.

**A trap worth knowing.** The sign-in ends on `/loading/?code=...`, and the code
is exchanged there. Navigating away before that finishes leaves no session in
`sessionStorage`, and then every jaen client that reads the token from it, the
CMS API, the agent and the storage gateway alike, is silently anonymous while
the CMS still looks signed in, because its shell renders from the persisted
redux state. Three verification runs failed that way before the check waited for
the key.

### What is open on this side

`gatsby-plugin-jaen`'s typecheck has thirty errors, all of them in files this
work did not touch (the Settings forms, `PasswordReset`, `WaitingScreen`,
`wrap-page-element`, `cms/pages/index.tsx` and `jaen-frame.tsx`).
`gatsby-source-jaen` typechecks clean and so does the `jaen` package's build.
The sites' `OSG_TOKEN` secrets carry a reference in the workflows and a value
only in the deploy phase, and neither site is built by Actions today anyway.

## Deployed 2026-09-07 at night, and the gate is live

Everything above this heading was written before anything of it served. This
section is what actually happened on the wire, in the order the design's
migration section asks for, with every stamp.

### The order, and why each step is only safe after the one before it

1. **The gateway, refusing nothing.** D1 `osg-owners` created and bound, the
   secrets `AUTH_KEY` and `SIGNING_KEY` set, `wrangler deploy` with
   `ENFORCE_WRITES=0` and `CLAIM_ALL=0`. Worker version `4c549ec6` at 21:03
   UTC. From this moment `signedUrl` exists, which is what everything after it
   needs, and nothing is refused, which is why deploying it costs nothing.
2. **The credentials.** The two site builds' machine users minted, the four
   `OSG_TOKEN` values placed: two GitHub repository secrets and two Worker
   secrets. Placing a credential refuses nobody either.
3. **Both sites rebuilt and deployed.** This is the step that takes the
   gateway out of a visitor's path, and it has to come before any read is
   refused: 271 media files written into booklimo's `public/osg/` and 265 into
   limosen's, the URLs rewritten onto each site's own origin.
4. **Both Workers deployed**, pylon 1.8.0, each carrying its brand's
   `OSG_TOKEN`, so `documentUrl`, the offer and invoice mail links and the
   push payload's image became signed links rather than bare URLs.
5. **`ENFORCE_WRITES=1`.** Worker version `d7c3548f` at 21:19 UTC. An
   anonymous upload is 401 from here on and every new file carries its
   caller's organisation.
6. **The ownership rows**, 284 of them, which is the read gate: a file with a
   row is private. It is last because it is the only step with no cheap way
   back.

### The stamps

| piece           | value                                                                                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Worker          | `osg` on Cloudflare account `a4b0e1ba603b529a64d355679ff2911a`, versions `4c549ec6` (write gate off) and `d7c3548f` (write gate on)                                             |
| names           | `osg.netsnek.com` and `osg.jaen.io`, both custom domains of the one Worker, unchanged                                                                                           |
| ownership store | D1 `osg-owners`, `8bd4639d-a4c9-4cc4-a7fa-32679c3518de`, western Europe, `scripts/schema.sql` applied remotely                                                                  |
| secrets         | `AUTH_KEY` (the CMS application key JSON), `SIGNING_KEY` (64 characters, kept at `~/.config/jaen/osg-signing-key.txt`), beside the two Telegram secrets that were already there |
| branch          | `private-storage` of `jaenjs/open-storage-gateway`, nine commits from `a24d325` to `bc8eaf6`, `npm test` 40/40 and `npm run typecheck` clean before the deploy                  |

**The D1 database was made twice, and the second time on purpose.**
`wrangler d1 create` takes its primary region from where the command runs and
chose APAC. Every owner lookup that misses the isolate's memo is a query
against that primary, so a gateway in Europe would have put a Pacific round
trip in front of a byte read. The empty database was deleted and made again
with `--location weur`, beside the issuer the gate introspects at. Anybody
recreating this store passes `--location`.

### The credentials, and the one the design named that had not existed

Four machine users, all on the CMS project `268283277977065078`, none of their
tokens ever printed.

| user                                       | organisation         | roles                                           | where it lives                                                                             |
| ------------------------------------------ | -------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `osg-limosen`                              | `339284789469124181` | `storage:read`, `storage:write`, `storage:sign` | `OSG_TOKEN` on the limosen Worker                                                          |
| `osg-krc`                                  | `356348844407002709` | the same three                                  | `OSG_TOKEN` on the booklimo Worker                                                         |
| `osg-build-limosen` (`389766322365404787`) | `339284789469124181` | `storage:read`                                  | `~/.config/jaen/osg-limosen.env` and the GitHub secret `OSG_TOKEN` of `netsnek/limosen.at` |
| `osg-build-krc` (`389766313003718235`)     | `356348844407002709` | `storage:read`                                  | `~/.config/jaen/osg-booklimo.env` and the GitHub secret of `netsnek/booklimo.at`           |

The two build users are new. The pass before this one had let the site builds
carry the Workers' own tokens, which works and is one power too many: a build
downloads what the site's data names and never uploads or mints, and its token
sits in a repository secret. `scripts/osg-machine-user.py --brand <brand>
--build` in the taxi platform mints them, because that script already holds
the recipe for minting in these two organisations, and it writes them where
each site's `scripts/deploy.sh` reads them.

All four were introspected at `accounts.netsnek.com` before anything was set,
and the answers are the gate's own reading: `active`, the organisation in
`urn:zitadel:iam:user:resourceowner:id`, and the roles as the keys of the
roles claim.

### Who may upload, established before anonymous writes were refused

The design asks for this pre-flight and it is the step that decides whether a
write gate is a gate or an outage. Read off Zitadel's own grants rather than
off a guess: fifteen accounts hold a role on the CMS project in the limosen
organisation and twenty-one in the KRC one, of which five and six may upload,
each set being the brand's storage machine user and its `jaen:admin` editors.
Every other account holds a driver or a customer role only. On the code side
there is no anonymous upload path left in either brand: every call goes
through jaen's `uploadFile`, which needs a CMS or app session, or through the
Worker's own `OSG_TOKEN`.

The gate proved itself before anybody measured it. An 85 byte PNG was uploaded
through the live gateway at 21:07:11 UTC by another run and carries an
ownership row stamped `356348844407002709`, the organisation of the token that
sent it.

### The backfill, which is the read gate

`scripts/backfill-owners.py` over both site checkouts and both brands' D1,
confirmed against the gateway so every row says what it holds.

| source         | named | claimed | shared |
| -------------- | ----- | ------- | ------ |
| limosen.at     | 370   | 266     | 0      |
| booklimo.at    | 447   | 7       | 266    |
| `limosen-mock` | 0     | 0       | 0      |
| `booklimo`     | 11    | 11      | 0      |

284 rows: limosen owns 266 and KRC owns 18, and every one of limosen's 266 is
shared with KRC, which is the `shared` column earning its existence. The two
sites are one content lineage and the same Telegram file_id is the logo of two
companies; without that column the second site's build would have answered 403
on every one of them.

**`limosen-mock` really holds no media rows**, checked rather than read as a
failure: 15,352 transfers, zero `CarImage` and zero `TransferDocument`. All of
the platform's own files are booklimo's four car pictures and seven documents.

**No other jaen site was claimed.** The 284 ids were compared against the jaen
data of adlerhorst, netsnek.com, photonq, nadine-hauswirth, barbara-mauz,
fhkit and emailwerk.com and share nothing with any of them, so those sites are
still unclaimed and still public, which is exactly what the per organisation
move is for. Each follows when its own site has been rebuilt on the new
`gatsby-source-jaen`.

### The acceptance, on the systems that serve

`tests/46-private-storage-live.ipynb` of the taxi platform, 11 / 0 / 0 / 0
against `osg.netsnek.com`, `api.booklimo.at`, `booklimo.at` and `limosen.at`.
It is the sibling of `44-private-storage.ipynb`, which measures the same chain
against a gateway image the notebook starts itself: an image of a branch is
the right thing to read while the gate is being built and the wrong thing once
it ships.

| the design's acceptance                                                                                                   | what the live systems answered                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| anonymous read 401, another organisation 403, a fitting token 200                                                         | 401 `AUTH_REQUIRED`, 403 `FORBIDDEN`, 200 with `Cache-Control: private, max-age=60`. The organisation the row shares the file with reads it too, the same 13,951 bytes, and the read-only build credential reads it with `storage:read` alone  |
| a build with `OSG_TOKEN` fetches every media node and the site serves them, a build without it fails with a clear message | 271 files in booklimo's `/osg/`, a site-served picture byte for byte what the gateway holds, and a build with the variable taken away stops with "OSG_TOKEN is required to fetch media from the storage gateway"                               |
| the CMS and the app render for a signed-in admin with no gateway request lacking a bearer                                 | on the live booklimo.at, 9 of 9: the media library draws 143 pictures, none a bare gateway source, its twelve gateway reads all carry a bearer, none is refused, and four tiles are object URLs                                                |
| the offer mail's link and the ride page's document links are signed, 200 until they expire and 410 after                  | `documentUrl` a 900 second link opening with no `Authorization` header onto a 590,178 byte PDF, the offer mail's 2,591,999 seconds and opening the same way, a valid signature with an expiry in the past 410 `LINK_EXPIRED`, a forged one 403 |
| the files that already exist keep their ids and need no re-upload                                                         | all seven of booklimo's documents answer under the id `TransferDocument` has always held, and nothing was re-uploaded                                                                                                                          |

One thing the wire cannot say and a browser can: a page of either site,
loaded signed in as the CMS admin, makes no request to any `osg.` host at all.

### What is still open after the deploy

**`osg.snek.at` is still open.** It answers `GET /storage/<id>` for every
Telegram id without a token, from the netcup host `89.58.34.70`, and both
sites' `patches.txt` still name it. Every one of the 284 files now refused on
`osg.netsnek.com` is readable there. This deploy locks one of two doors and
nobody here knows who operates the other, which is why it stays the first of
the design's two unestablished facts and not a footnote.

**`CLAIM_ALL` is still `0`**, deliberately. A file with no ownership row is
still public, which is what lets the other jaen sites go on serving while they
are rebuilt one at a time. It is also why the owner's sentence, nothing behind
a gateway link is public, is true today for the taxi brands and their two
sites and not yet for everything the gateway has ever served.

**Rolling the read gate back means deleting rows and redeploying.** There is
no `ENFORCE_READS` flag: a row is the gate. A positive owner lookup is
memoised for the isolate's life, so deleting rows alone leaves running
isolates serving the old answer, and a `wrangler deploy` is what recycles
them. The rows themselves can be rebuilt from the same four sources, which is
the one reason deleting them is recoverable at all.

## Verified adversarially 2026-09-07, on the systems that serve

A read only pass over the live `osg.netsnek.com`, `api.booklimo.at`,
`booklimo.at` and the ownership store itself. Nothing was written, no mail was
sent, and every token read came from `~/.config/taxi-app` and
`~/.config/jaen`. Four of the five things it set out to reproduce reproduced.
The fifth did not, and the reason is in the store rather than in the code.

**Anonymous reads are refused, and not only on the three ids it was asked
about.** Every one of the 180 gateway ids the two sites' local `jaen-data`
names answers 401 `AUTH_REQUIRED` without a token, and so does every one of
the eleven files the platform itself owns on booklimo, the seven
`TransferDocument` rows and the four `CarImage` rows. All eleven answer 200 to
the brand's own machine token. A site picture (13,951 bytes, `image/jpeg`), a
car picture and the offer `AN-260006` (159,008 bytes, `application/pdf`) were
the three the pass was asked for, and each is 401 anonymous and 200 to the
token whose organisation the row names.

**A booklimo token is not refused on a limosen site picture, and no booklimo
token can be.** Read off the D1 store rather than off a guess:

```
SELECT org_id, shared, COUNT(*) FROM file_owner GROUP BY org_id, shared
339284789469124181 | 356348844407002709 | 266
356348844407002709 | NULL               |  19
```

Every one of limosen's 266 rows carries KRC in `shared`, so there is no
limosen file in the store that a KRC token is refused on. Measured: the
limosen owned site picture answers 200 to the KRC storage machine user, to a
`krc:driver` machine token, to a `krc:customer` machine token and to
`osg-build-krc`, which holds `storage:read` and nothing else. The refusal
itself works and is measurable in the other direction only: the limosen
storage token on booklimo's car picture and on the offer is 403 `FORBIDDEN`
with `This file belongs to another organisation`.

That is the `shared` column doing what it was added for, and it is also the
sentence in **Target** above ("a token of another organisation is refused")
being true of 19 files out of 285 rather than of the store. Anybody writing
the cross organisation leg of an acceptance test picks a **KRC owned** file
and a limosen token, never the reverse, and the acceptance list should say so
instead of leaving the reader to find it on the wire.

**What `shared` costs, said plainly.** Read is by organisation and no role, so
a share is a share with every account of the other organisation. Every KRC
driver and every KRC customer account can read all 266 of limosen's site media
by id. Those files are the pictures limosen.at serves publicly anyway, so the
exposure is the ids and not the content, but the same column used one day for
a file that is not public would hand it to a whole tenant. A share belongs
only on content that is already public on its owner's own site.

**The signed link chain holds, measured off the mail's own values.** The
booklimo pylon's `mailPreview(event: OFFER, audience: CUSTOMER)` for the ride
carrying `AN-260006` answers a `documentUrl` of
`…/storage/<id>?exp=1791409902&sig=…`, which is `signedGatewayLink(url,
MAIL_LINK_TTL_SECONDS)` and thirty days out. Fetched with no `Authorization`
header at all it is 200 `application/pdf`, 159,008 bytes, `Cache-Control:
public, max-age=2591990`. A signature this pass minted itself from
`SIGNING_KEY` over `${id}\n${exp}` with `exp` an hour in the past is 410
`LINK_EXPIRED`, the same message with a fresh 900 second `exp` is 200, and the
same message signed with a wrong key is 403 `FORBIDDEN`. So expiry and
forgery are told apart and neither is a 401.

**No visitor of booklimo.at touches the gateway.** In a browser, `/` and
`/de/` each make 91 requests and none of them to any `osg.` host. All 41
`img` elements load, their sources are `booklimo.at` itself and the two
Mercedes COSY renders the site has always linked, and the served HTML mentions
no gateway host at all while it does carry `/osg/<id>` paths of the site's own
origin.

**The CMS media library carries a bearer on every gateway request.** Signed in
on the live `booklimo.at` as the booklimo human admin, `/cms/media/` draws 145
`img` elements of which 144 load, the one that does not has an empty `src` and
is a placeholder rather than a refused read. Not one is a bare
`<img src="https://osg…">`, four are `blob:` object URLs, and the twelve
gateway requests the page makes all carry `Authorization` and all answer 200.
Measured twice with the same numbers.

**The second door is open for the sites' media and shut for the platform's.**
`osg.snek.at` still answers the limosen site picture anonymously with the same
13,951 bytes that `osg.netsnek.com` refuses. It answers 502 for the car
picture and for the offer PDF, because those were uploaded through a different
Telegram chat than the one the old Go service reads. So the open door is real
and it is the two sites' media, not the platform's documents, which is a
sharper statement than "every id the gateway ever issued is readable there"
and does not make it less urgent.
