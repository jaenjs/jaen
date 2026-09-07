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
