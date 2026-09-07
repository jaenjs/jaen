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
