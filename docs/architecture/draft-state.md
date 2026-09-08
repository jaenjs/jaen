# The shared draft: a workshop per site, and a chain of migrations

> **REVIEW REQUIRED.** This touches the one thing a CMS is sold on, that an
> edit is never lost. It is planned and built by Opus sessions. **A Fable
> 5.1 session must review it** with the diff, the notebooks and their
> stored outputs in front of it, and record a Reviewed note at the bottom
> of this file. Until that note exists the safety is argued, not proven.

## What the owner asked for, in the order he asked it

2026-09-07, the problem: "we already have a system that supports a
temporary data state in editing mode, but unfortunately it is only in
local storage and not shared. A saved state would make sense, but it is
important that it is jaen native, not an add-on from an app."

2026-09-08, three corrections to the first build, each one narrowing it:

1. "I still want the migrations to be in files on an osg where the data is
   protected by Zitadel. Live and published should only be the collections
   of migration files."
2. "I don't want the changes to be committed to GitHub, as it will
   generate an unbelievable amount of git commits. I would rather save the
   drafts in another way, maybe a key value store as a very fast caching of
   the local storage."
3. The store is a Durable Object, after asking what one is, whether it is
   like S3, and what the escape from Cloudflare would be.

The first build got the storage wrong in both directions: it committed
every save to GitHub, and it put the head patch into `patches.txt`, which
quietly made every unfinished edit part of the published site. Both are
undone here.

## The two lifecycles, which is the whole design

**A draft** changes every few seconds, is mutable, is shared between the
people editing right now, and matters for hours. Its history has no
lasting value.

**A migration** is made rarely, is immutable, is permanent, and is the
site's content. The ordered collection of them, and nothing else, is what
"live" and "published" mean.

Storing the first like the second is what produced the file and commit
explosion. They get separate homes.

## The draft: one Durable Object per site

The jaen agent keeps a site's draft in a Durable Object addressed by the
site's name, so there is exactly one instance, it is single threaded, and
two editors cannot save onto stale bases. Nothing about a draft touches
git or the gateway.

Its keys, which is also why a field save is cheap:

```
meta                → revision, publishedRevision, updatedAt, the snapshot
page:<pageId>       → that page's fields
media:<nodeId>      → one media node
author:<fieldPath>  → who wrote it last, and when
```

A save writes only the keys it touched and bumps `revision`. A reader asks
for everything above a revision.

### What a Durable Object actually allows

Confirmed against `developers.cloudflare.com/durable-objects/platform/limits`
and `.../reference/durable-objects-migrations`, read 2026-09-08, because the
catalogue's shape was argued from a remembered number and a remembered number
is not a measurement. The paragraph above used to say "the per value limit of
an object's store is small, on the order of 128 KB". That is the figure of the
**key-value backed** object, and this object is not one.

| what                  | SQLite backed (this object)      | key-value backed (the old kind) |
| --------------------- | -------------------------------- | ------------------------------- |
| one key and its value | 2 MB, key and value **together** | 128 KiB value, 2 KiB key        |
| one object            | 10 GB                            | unlimited                       |
| objects per class     | unlimited                        | unlimited                       |
| one `put` of many     | 128 pairs                        | 128 pairs                       |
| WebSocket message     | 32 MiB received                  | 32 MiB received                 |
| socket attachment     | 16,384 bytes                     | 16,384 bytes                    |
| CPU per request       | 30 s, configurable to 5 min      | 30 s                            |
| alarm handler         | 15 minutes of wall time          | 15 minutes                      |

There is no choice to make between the two: Cloudflare recommends the SQLite
backend for every new namespace and an account without an existing key-value
backed namespace **cannot create one at all**, which this account has not. So
`wrangler.toml` says `new_sqlite_classes`.

The larger ceiling does not change the key layout, and it is worth saying why
the design's reason was wrong while its conclusion was right. booklimo's whole
draft is about 120 KB and its catalogue 118,617 bytes of that, so one blob
would fit inside 2 MB comfortably. What makes a field save cheap is not the
ceiling but that a save writes only the keys it touched: with one blob, every
picture and every text change would write the whole 118 KB catalogue, which is
exactly the cost this design set out to remove. One key per node also lets two
editors add a picture each without either holding the whole catalogue, which is
what makes the merge safe rather than merely small.

Two figures do bind. The 128 pair limit of one `put` is why a write that
touches more nodes than that is chunked, which a whole-catalogue write does.
And the 16 KB socket attachment is why a socket carries the editor's subject
and name and nothing else.

Editors are pushed to over a WebSocket held by the object, so the polling
of the first build goes away. A poll remains as the fallback for a browser
whose socket is refused.

The object sets an alarm on itself and writes a snapshot of the draft
every few minutes and when the last editor leaves, into one file that is
**not** part of the chain. That is the backstop against losing the object,
and it costs a handful of writes a day rather than thousands.

### Built 2026-09-08, the object itself, and what it cost

`packages/jaen-agent/src/draft/`, four files, and `src/store.ts` deleted with
the commit-on-save path it carried. Everything above this heading was written
before any of it was built.

**The four operations, and the two beside them.** `src/draft/store.ts` declares
`read`, `write`, `subscribe` and `snapshot` and nothing Cloudflare shaped, and
`src/draft/durable.ts` is the only file in the agent that names a Durable
Object at all. Two operations stand beside the four and are named in the file
rather than hidden. `markPublished` is one, because `publishedRevision` lives in
the object and only publish may set it, and a `write` that set it would bump the
revision it had just published; the publish session reached the same conclusion
independently on the same day, which is the argument that it is a property of
the design and not of this implementation. `connect` is the other, and it is
transport: `subscribe` mints the handle, the stream itself is a WebSocket the
browser holds, and a promise of an async iterable cannot cross a Worker's
request boundary. A single process implementation upgrades the same way.

**The object applies the changes, the Worker does not.** `write` sends the
batch into the object, which loads the pages, the site metadata and the widgets
it needs, runs the agent's own `applyChanges`, and writes back only the keys
whose serialisation changed. That is what makes "two editors cannot save onto
stale bases" true rather than hoped for: the read, the apply and the write
happen inside one single threaded actor, so there is no window between them.
The first build's answer to the same problem was a KV lock with no
compare-and-set and a blob sha on a GitHub PUT.

**The catalogue never enters the applied document.** A `fieldMerge` of
`IMA:MEDIA_NODES` is handled as key operations, one `media:<id>` per picture
added and one tombstone per picture removed, so a picture costs three keys (the
node, its author, `meta`) and never reads the other 139. A whole-catalogue
`fieldWrite` is still accepted, for a client that cannot send a merge, and it
tombstones everything it does not name.

**A delta, or the whole draft, and the object says which.** A reader with no
revision, a revision older than the pruning window, or a revision **above** the
object's own gets `full: true` and replaces its copy. The last of those is what
a lost or rebuilt object looks like from the outside, and answering it with a
delta would leave the browser holding edits the object has never heard of as
though they were shared. The client's own half of that is
[the second place safety won](#the-second-place-safety-won-a-revision-that-goes-backwards).

**The ticket, and why the socket carries no token.** A browser's WebSocket
constructor sets no header, so a credential can ride in a query parameter or in
a subprotocol, and a query parameter lands in every proxy log, in a `Referer`
and in a shared link. So `subscribe` is an ordinary GraphQL mutation,
authorised the one way, and it answers a random single use ticket that lives
for a minute; the socket is `GET /draft/<site>` with `jaen-draft.v1` and
`ticket.<id>` offered as subprotocols, and the object checks the ticket because
it is the only thing that knows what it minted. The socket then carries
revisions and never content, so there is one read path and one authorisation
path for the data.

**Where the snapshot goes, which is a deliberate departure.** This file asks
for "one file that is not part of the chain".
`okf/decisions/hard-rules.md` is narrower and wins: a draft "reaches no
repository and no gateway file". The two sentences disagree about the
snapshot's home, so it goes where both hold, a KV entry
(`draft-snapshot:<site>`, with `:previous` beside it so a bad write is not the
only copy), which is neither a repository nor a gateway file, is not in the
chain and cannot be reached by a build. It keeps the purpose, a backstop in a
different storage system from the one it backs up. A namespace of its own would
be tidier than sharing the auth cache's and is not worth a migration today.

`publishedSha` of the key layout above is **not** stored, because publish hands
the object a revision and nothing else, and the commit sha is in the answer
publish already returns. A field nothing can fill is worse than no field.

**Two things the run found rather than assumed**, both of which would have been
quiet losses:

- A tombstone was pruned by the snapshot's revision, so every alarm pushed
  every reader into a full answer, and on a two second alarm the delta could
  not be read at all. Tombstones carry their own timestamp now and are kept for
  an hour, which is how far behind a reader may be and still be told what went.
- The alarm wrote back the `meta` it had read before its own KV write. A
  Durable Object's input gate closes around a **storage** operation and the
  snapshot's write is a KV fetch, so a save can land inside that window and the
  alarm would put the older revision back. A revision handed out twice is two
  editors' work under one number. The alarm re-reads `meta` under the storage
  gate and stamps only the snapshot fields.

**Measured, and how.** `packages/jaen-agent/tests/agent.test.ts`, twenty four
tests, all green, 78 s, against a local `wrangler dev` with the object's
storage in a directory of the run's own, the real accounts.netsnek.com and a
throwaway branch of `netsnek/booklimo.at`. A save writes three storage keys and
moves no branch, asserted by reading the branch head before and after. Six
concurrent saves get six consecutive revisions and every one of the six fields
is in the draft afterwards, five of them rebased and none refused. The whole
runtime is stopped and started between two saves and the draft and the counter
both continue. The alarm snapshots on its own, with the interval at two seconds
for the run rather than the deployed five minutes, and nothing else about it
differs.

**What is not proven, and is the reviewer's to weigh.**

- Nothing is deployed. Everything above is `wrangler dev` on this machine, on
  the runtime workerd falls back to (`2025-07-18`, because the installed
  wrangler is older than this file's compatibility date). Hibernation, the auto
  response and the alarm's real cadence are worth measuring once on the deployed
  Worker.
- Two writers are one identity. accounts.netsnek.com offers no password grant
  and booklimo has exactly one machine account with `jaen:admin`, so a second
  identity would have to be granted the role by the test itself and a run that
  died would leave that grant behind on a real identity server. What is proven
  is what the object guarantees, that concurrent writes each get a revision and
  none is lost; that `overwrote` names the **other** editor needs two people and
  belongs to the live CMS run.
- The pruning window is an hour of wall clock. An editor whose CMS has been
  open longer than that and who missed a deletion in between is answered with
  the whole draft, which is correct and costs one 77 KB answer. Nobody has
  measured how often that happens in a working day.
- The object is addressed by `idFromName(site)` and its storage is a Cloudflare
  managed thing. There is no measured drill for "the object is lost": the
  snapshot exists, and reading one back into a new object is not built.

## Publish: the only writer of history

Publish reads the draft, writes one migration file in the shape jaen has
always used, `{message, createdAt, data}`, uploads it to the storage
gateway with the site's machine token, appends its URL as one line to
`jaen-data/patches.txt`, commits that one line, and triggers the build.
`publishedRevision` is recorded in the object so the CMS can say what is
published and what is not.

That is the old publish path, restored, with the upload now going through
a gateway where every read carries a Zitadel token
(`private-storage.md`). One file and one commit per publish, which is what
it always was.

### Built 2026-09-08, and measured on a throwaway branch of booklimo.at

`packages/jaen-agent/src/publish.ts`, with `src/gateway.ts` beside it for the
one file it uploads. Everything above this heading was written before any of it
existed.

**The order is the safety, and it is the only thing in this path that is not
obvious.** The gateway file is written before the commit, so a failure between
the two leaves a file that nothing names: a few kilobytes on a gateway with no
delete, and no site changed. The commit is made before `markPublished`, so a
failure between those two leaves a published migration the object still calls
unpublished, and the CMS then says "not published" about something that is.
Both failures understate what is live. The reverse order of either pair would
overstate it, which is the direction that names a file that is not there or
claims an unpublished edit is public.

**The migration is read back off the gateway before its line is committed.**
One extra round trip on an act that happens rarely, against the one failure
this path can produce that nobody would notice for weeks: a line in
`patches.txt` naming a file the build cannot fetch. Every build of the site
from then on replays that line. If the read back fails, nothing has been
committed and the publish is simply not made.

**`markPublished` is a fifth operation and the design asked for four.** It is
not expressible as a `write` of the `meta` key, because a write bumps the
revision: a publish that bumped the revision it had just taken would either
stamp the new revision as published, which is a lie the moment an editor's
save lands in the same instant, or leave `revision > publishedRevision`
immediately after a publish, which tells every editor there is something
unpublished when there is not. The toolbar may say neither. The interface
grows by one operation instead, named in `src/draft/store.ts` beside the four
rather than hidden among them. The two sessions that built the two halves
arrived at that independently.

**The credential is the brand's storage machine user and not the editor's
token.** `osgTokenVar` per site, `OSG_TOKEN_BOOKLIMO` and `OSG_TOKEN_LIMOSEN`,
because the gateway stamps a file with the organisation of the token that sent
it and one estate wide token would give every brand's migration one owner. It
is `osg-krc` and `osg-limosen`, which hold `storage:write`, and never
`osg-build-<brand>`, which `private-storage.md` gave `storage:read` and nothing
else on purpose. `osg-krc` was introspected at `accounts.netsnek.com` before it
was used rather than tried: active, organisation `356348844407002709`,
`storage:read`, `storage:write`, `storage:sign`. Who published is recorded
where it belongs, in the commit's author line, and a publish that outlives the
editor's access token does not fail on a credential that expired between the
snapshot and the upload.

**Two answers and not one.** `published` and `queued` are different questions
and the result keeps them apart. Both limousine sites name no
`publishWorkflow`, so a publish there writes the migration and queues nothing,
and a caller reading only `queued` would call that a failure. A publish with
nothing new writes no file, no line and no commit and still dispatches the
build, because publish with nothing to publish is a person asking for a
rebuild.

**Measured.** `packages/jaen-agent/tests/agent.test.ts`, six tests, against a
throwaway branch of `netsnek/booklimo.at`, the live `osg.netsnek.com` and the
live identity server. Run twice, 6 / 0 both times, 52 s and 50 s. The branch is
cut before and deleted after, and nothing of it reached `main`.

| what was asked                  | what the systems answered                                                                                                                                                               |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a save produces no commit       | a field write into the object left the branch head exactly where it was                                                                                                                 |
| one gateway file                | `…/storage/BQACAgQAAx0Ed6zoewACBg5qn7p40HERKjukVLWWOlVSesj0FgACCh4AAlWvAAFRd6amM6vGE-g9BA`, 485 bytes, sha256 `b1a9f1be…`, keys exactly `createdAt`, `data`, `message` and no `authors` |
| the gate is on it               | 401 anonymously, 200 to the KRC storage token                                                                                                                                           |
| one line                        | `patches.txt` after equals `patches.txt` before plus that URL, and nothing else about the file moved                                                                                    |
| one commit                      | one commit between the two heads, one file changed, `jaen-data/patches.txt` +1 −0                                                                                                       |
| in the publishing editor's name | author the calling editor, committer `jaen-agent`, the body naming the migration URL, the revision and the publisher                                                                    |
| nothing new publishes nothing   | `published: false`, no file, no line, the head unmoved, the reason "Everything in the draft is already published."                                                                      |
| a second publish appends        | a second URL after the first, the first still at its own index and named once                                                                                                           |
| the chain still replays         | all 22 lines of the branch's `patches.txt` fetched and merged the way `gatsby-source-jaen` merges them, and the merged value of the field is what the second publish wrote              |
| the refusals stay apart         | anonymous `AUTH_REQUIRED`, a `krc:customer` of the same site `FORBIDDEN`                                                                                                                |

The migration is 485 bytes because a throwaway branch's object holds only what
the test saved into it. The chain it was appended to is booklimo's real one:
twenty existing lines, the remote ones fetched off the private gateway with the
site's own credential.

**What the CMS says, which is the other half.** The save state item reads
"Saved 14:02, not published" while `revision` is past `publishedRevision`, and
the control beside it reads "Everything published" when it is not. Both are
translated in all seven locales `gatsby-plugin-jaen` carries rather than left
as an English `defaultMessage` on a German site. The publish flow prompts for
the migration's message, passes it, and reads `published` rather than `queued`,
so a site with no Actions build is told its migration is in the chain instead
of being told nothing happened.

**What this did not do.** Neither site carries the `agent` plugin option, which
is where the transition of 2026-09-08 left them and is this design's own
rollback, and the agent Worker is not deployed with the Durable Object binding.
So the publish path is proven on a throwaway branch and against the live
gateway and the live identity server, and it has not been driven from a browser
on the live `booklimo.at`. That is the deploy step's, and until it is taken the
acceptance below is measured and not served.

### Built 2026-09-08, the client half

`packages/jaen/src/clients/agent` and `packages/jaen/src/redux/remote-state.ts`,
after the transition and against the agent as it stands.
`packages/jaen/src/redux/apply-change.ts` is not touched, and neither is the
browser side of `editing-performance.md`.

**The whole of "where the draft is" is one number.** `headSha` and `blobSha` are
gone from the wire, from the redux store and from what `localStorage` carries.
They only ever made sense while a save was a commit. What replaces them is
`revision` on a read (`sinceRevision`) and on a write (`baseRevision`), and
`publishedRevision` beside it, which is what lets the CMS say what is saved and
not yet published. That sentence is now a label in the toolbar: "Saved 14:02,
not published" whenever `revision` is past `publishedRevision`, and the plain
"Saved 14:02" only when it is not. The save state item opens nothing any more,
because a save produces no commit to open.

**A read is a delta.** The design says a reader asks for everything above a
revision, and the draft store's interface answers `full` or a `delta` of pages,
media, `removedMedia`, site, widgets, authors and the `mediaField` the catalogue
belongs to. So the client merges rather than replaces: a page whole by id, the
catalogue node by node with `removedMedia` deleting, the site metadata only when
the answer carries it, because `null` there means leave it and not empty it, and
widgets by id. The order that holds the invariant is unchanged and is still in
one place: the remote answer is the base, this browser's unsent outbox is
applied on top of it, and only then is the store hydrated.

**The socket carries revisions and never content.** `subscribe` is an ordinary
GraphQL call with the bearer and answers a single use, short lived ticket; the
`WebSocket` opens with that ticket and never with the person's token, and the
ticket travels as `Sec-WebSocket-Protocol` and never as a query parameter, for
the reason `private-storage.md` gives about a credential in a URL. A frame is a
number this browser did not have, and what it makes the client do is ask the
same `draft` query the poll asks. That keeps one read path, one authorisation
path and one place where the outbox is folded back on. A ticket is spent by the
socket that used it, so every reconnect mints a new one and a live socket costs
none.

**The poll is never switched off, only slowed.** With a socket up it runs every
thirty seconds instead of every 1,500 ms. It could be switched off and the CMS
would be faster and cheaper, and it is not, because an open socket that has
stopped delivering frames is indistinguishable from a site nobody is editing,
and the failure that produces is an editor looking at a stale field for as long
as they keep the tab open. Thirty seconds of a `changed: false` answer is what
that costs. Where the plan and speed disagree, the plan wins; where the plan and
safety disagree, safety wins and it is written down, and this is one of the two
places it did.

**An agent that does not know `subscribe` costs nothing.** The mint fails, the
client logs it, the poll carries everything and the CMS behaves exactly as it
did. That is what makes the socket an optimisation rather than a dependency, and
it is what the notebook's `socketRefused` scenario measures.

#### The second place safety won: a revision that goes backwards

A revision is monotonic while its object lives. A read that comes back **below**
the revision this browser already holds is therefore not a race, it is a
different object answering in the place of one that is gone, at a state older
than what is on the screen. Applying it would take an edit away from the person
who made it.

So the client skips exactly that answer, adopts the object's revision so the
next save carries a base the new object recognises, records the instant in
`remote.objectRestartedAt`, and warns. Everything after that read arrives
normally, so it self heals and does not need a person.

**What this does not recover, and nothing in a browser can**: what the _other_
editors had written into the object that died. The design's answer to that is
the snapshot the object writes outside itself, and it is the agent's. This is
the client refusing to make the loss worse.

#### Where the client and the agent meet, and what could not be checked

`publish` is read off the agent's own `PublishResult`, which landed in `d583d2e`,
and the CMS answers both of its questions: `published` and `queued` are
different, and a site with no build workflow, which is both limousine sites,
writes a migration and a commit and queues nothing. Reading only `queued` there
would call a real publish a failure. The migration takes a message again, which
is the line the publish list shows.

`draft`, `save` and `subscribe` were written against
`packages/jaen-agent/src/draft/store.ts` while it was still another session's
uncommitted work, and the object landed in `7ace7ad` before this session ended.
So the guess is gone and the two halves are checked against each other by a
machine: `tests/support/validate-agent-documents.cjs` parses every document out
of the client and validates it against `packages/jaen-agent/.pylon/schema.graphql`,
the agent's own generated schema, and
`tests/10-draft-persistence.ipynb` runs it. **Five of five valid.**

That check exists because this client is hand written and a field renamed on the
agent's side is not a compile error anywhere: it is a
`GRAPHQL_VALIDATION_FAILED` at runtime that refuses the whole operation rather
than one field, which for `save` means an editor's work is never sent at all.

What it settled, and what could not have been settled by reading: Pylon renders
`delta.pages`, `delta.media`, `delta.site` and `delta.authors` as the scalar
`JSONObject` and `delta.widgets` as `[JSONObject!]!`, all of which take no
subselection, while `delta.mediaField` is an object type and demands one. Every
one is still optional at runtime in the client, so a field that ever arrives as
something else is an editor who sees less rather than a CMS that throws.

The socket agrees as well, read off the agent's own `object.ts`: the path is
`/draft/<site>` with the site in the path and nothing in the query, the
subprotocols are `jaen-draft.v1` and `ticket.<handle>` and `jaen-draft.v1` is
echoed back, and the frames are `{type: 'hello', revision, publishedRevision}`
on connect and `{type: 'revision', revision}` on every accepted write. The
client is lenient about the name of the frame and strict about the field, so
both are acted on and a third would be too.

The revision arguments are declared `Number` and not `Int`, because Pylon
renders a `number` argument as the scalar `Number` and an operation declaring
`Int` is refused before the resolver is reached. That is the trap the storage
gateway's `signedUrl` already cost a run.

#### Measured, and what is not

`tests/09-editing-latency.ipynb` 16 PASS 0 FAIL 5 SKIP 1 WARN, and
`tests/10-draft-persistence.ipynb` 30 PASS 0 FAIL 5 SKIP 2 WARN, both stored in
`tests/draft-object/`. The three scenarios this design names are new and green:
the object restarted between two saves, the socket refused so the poll carries
it, and two editors racing on one field. Beside them the socket carrying it,
which also asserts that the ticket is a subprotocol, that the person's token is
not, and that the query string is empty.

The eleven checks that were already there are unchanged and still green, and the
two acceptances of `editing-performance.md` that the baseline had red are green:
one blur is one whole-store write of 1,312 B rather than four of 309,253, and
three field writes 120 ms apart are one call rather than three.

**The ten SKIPs are the honest part.** Every one is a browser half, and every one
skips for the same measured reason: the transition removed the `agent` option
from both sites, so a built site carries no shared draft to drive. The guard
reads the built bundle rather than a configuration file. **The client against a
real agent is therefore not measured at all**, and it cannot be until the
agent's `draft`, `save` and `subscribe` land and a site carries the option
again. What is measured is what the client does against a stand in that behaves
the way this design says the object does, including in the two ways it is not
supposed to.

One browser measurement was taken back rather than left as a skip. `09` grew a
`localBlur` mode, the same field typed and left in the real CMS on a local
production build of booklimo signed in as the booklimo human admin, with
`localStorage` as the only store, which is what a site without the `agent`
option is and which is this design's own rollback. It measures that the rollback
holds: no request to any agent host, nothing queued, the toolbar claiming no
save because none was made, the edit in `localStorage`, the field set back, and
the value read back out of an emptied browser being the one the run found. And
one WARN, that the blur to paint gap is still 25.0 ms against one frame at 16,
whose cause `editing-performance.md` already named and which this session did
not touch.

The fixture moved with the transition. `live.json` and `live-media.json` are
gone from the site, so the notebooks merge the two the transition kept beside it
into one draft, which is the shape `snapshot(site)` answers. It is deliberately
the draft and not the build's sourced jaen data, which the transition also kept
and which is three and a half times larger: the store holds the draft, and the
larger fixture would inflate every number against the baseline. Measured 77,096 B
of store against the baseline's 77,090, and the catalogue 99.0% of it either way.

## What localStorage does

It keeps being the per browser copy and the offline queue, which is what
it is good at, and it is never the shared copy and never the record. Its
cost on the main thread is the subject of `editing-performance.md`, and
that work stands whatever the draft is stored in.

## Identity

The one way, as everywhere: the module of zitadel-gql and the taxi pylon,
introspection against the site's identity server with the sixty second
cache, `jaen:admin` of the site's organisation, `AUTH_REQUIRED` and
`FORBIDDEN`. No scheme of its own. See "Identity, the one way" in
`private-storage.md`.

## The escape from Cloudflare

The draft store sits behind one narrow interface in the agent, four
operations and nothing else:

```
read(site, sinceRevision?)   → the keys at or above that revision
write(site, keys, base)      → the new revision, or a rebase
subscribe(site)              → a stream of revisions
snapshot(site)               → the whole draft, for the alarm and for publish
```

Two operations stand beside those four and are declared with them, because
hiding them would make the interface look narrower than it is:
`markPublished(site, revision)`, which only the publish path calls and which
cannot be a `write` because a write bumps the revision, and
`connect(site, request)`, which is the transport that turns the handle
`subscribe` mints into the socket the object pushes down. Every
implementation has to provide both.

One implementation on a Durable Object today, `src/draft/object.ts` behind
`src/draft/durable.ts`, and those two files are the only ones in the agent
that name a Cloudflare type. One on a single process with SQLite the day the
estate wants its own machine, where the guarantee is free because there is
only one process. Cloudflare's own runtime, workerd,
is open source and implements the same actor model on a VPS, so even the
Worker itself is portable. The interface is a requirement of this design,
not an afterthought.

## The transition, which must lose nothing

Today booklimo carries `live.json` and `live-media.json` as the last two
lines of its chain, written by the first build's agent, and limosen
carries neither because nobody edited there. Those two files hold real
content: everything the chain replayed plus every edit made through the
agent since.

So the order is: turn the head into one proper migration on the gateway
and append its line, remove the two head lines, prove that a build
produces the same data before and after, and only then take the
commit-on-save path out of the agent. Nothing is deleted from the gateway
and no old migration is touched.

### Done 2026-09-08, on booklimo, and what it cost

Everything above this heading was written before any of it was carried out.
This is what happened, in the order the section above asks for, with every
stamp. booklimo only, because that is where this estate tests
(`okf/decisions/hard-rules.md`). limosen carried no head files and nothing was
written on it beyond its own configuration.

**The truth first, so the comparison is against an artifact.** A local
production build of booklimo as it stood, with `OSG_TOKEN` of `osg-build-krc`,
`SENTRY_OFF=1` and the ipv4 preload, rsynced beside the site as
`booklimo.at-transition-before/`, 196 MB and 272 files in `public/osg/`. The
data that build sourced was kept as well, which needed a way to take that
reading at all: after a build the merged jaen data lives only in Gatsby's LMDB
datastore, so `gatsby-source-jaen` gained `JAEN_DATA_DUMP`, an environment
variable naming a file it writes the created `JaenData` node into, without
Gatsby's own `id` and `internal`. It writes nothing when the variable is
unset. A gate nobody can take a reading for is not a gate.

**One migration, made by jaen's own code.** `scripts/head-to-migration.ts`
reads a site's two head files, merges their `data` with the very deepmerge the
build replays the chain with (`deepmergeArrayIdMerge` and the `IMA:MdxField`
customMerge, so the one file replays to what the two replayed to), writes one
`{message, createdAt, data}` and uploads it through jaen's own
`uploadFileFromNode`, which is the path every publish takes. It touches
neither `patches.txt` nor the files it read, so the irreversible half and the
reversible half stay apart.

| piece             | value                                                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| the migration     | `https://osg.netsnek.com/storage/BQACAgQAAx0Ed6zoewACBgRqn7FvFQ_GCav3z710E1wuVuOWkwAC6x0AAlWvAAFRYskaLNkdwJw9BA`                  |
| message           | `draft: the agent's head of 2026-09-08, live.json and live-media.json, as one migration`                                          |
| size and checksum | 119,589 bytes, sha256 `6699b247b7b97889f33b82636a5fa6d9a18251196837daf58994ab36e51b3980`, read back off the gateway byte for byte |
| the gate          | 401 `AUTH_REQUIRED` with no token, 200 to the KRC machine token, ownership stamped `356348844407002709`                           |
| the credential    | `osg-krc` of `~/.config/taxi-app/tokens.env`, `storage:read`, `storage:write`, `storage:sign`, introspected before it was used    |
| commits           | booklimo.at `e6866d7` and `27a0120`, jaen `c004978`, `b2692a9` and `c974684`                                                      |

**The credential is not the one this section first named.**
`~/.config/jaen/osg-booklimo.env` holds `osg-build-krc`, which carries
`storage:read` and nothing else, because `private-storage.md` gave the site
builds a read-only credential on purpose: a build downloads what the data
names and never uploads. So the upload used the brand's storage machine user,
`osg-krc`, out of the taxi platform's token file. Both were introspected at
`accounts.netsnek.com` first rather than tried, and the introspection needs a
`User-Agent` header or Cloudflare answers 403 in front of the identity server.

**The gate, which is the whole point of the phase.** A second build with the
same token and the same flags, and the sourced jaen data of the two builds
compared. `pages`, `site` and `widgets` are **byte identical**, 629,854 bytes,
sha256 `061e5491f389e37647f044a3beccc77990a3dd2735312f54f5e6a07e0be46cf6`
before and after. Measured four times over four builds and identical every
time.

The one thing that does differ is the `patches` index, which is the change
itself and carries no content: twenty entries become nineteen, the two head
entries

```
2026-09-08T01:39:37.395Z  jaen: Taxi Test Admin edited 1 field on JaenPage /            live.json
2026-09-08T01:41:22.198Z  jaen: Taxi Test Admin edited 1 field on JaenPage /cms/media/  live-media.json
```

replaced by the one line `patches.txt` now ends with. Everything else about
the two builds was compared as well, not only the sourced data: of 134
differing paths in `public`, the 37 `page-data` and slice payloads are
identical once the build's own createdAt and modifiedAt stamps, the webpack
compilation hash and the order of an unordered `allJaenPage` result are taken
out, and every HTML file is identical once the hashed chunk names go. Three
files are left and each is explained. `cms/index.html` renders the publish
list, which is the two head entries becoming one migration. `cms/debug/index.html`
carries the content hash of `gatsby-config.ts`, which changed because the
agent option was removed. `cms/pages/index.html` renders a build clock.

**Both sites off the live agent.** The `agent` option is gone from
`booklimo.at/gatsby-config.ts` and `limosen.at/gatsby-config.ts`, replaced by
a comment saying why and what it costs. Without it `__JAEN_AGENT__` is
undefined, `agentConfig()` answers null and the CMS keeps its draft in
`localStorage` alone, which is this design's own rollback. Both sites built
and deployed through their own `scripts/deploy.sh`, booklimo twice because the
migration was cut twice.

Read back on the systems that serve: `booklimo.at/app/version.json` and
`limosen.at/app/version.json` both answer app `1.8.1` at commit `9b33062`, so
the two brands still agree, and `/`, `/de/` and `/cms/` answer 200 on both.
Neither site's built bundle mentions a `jaen-agent` host any more. In a
browser, signed in on the live `booklimo.at` as the booklimo human admin,
`/cms/` and `/cms/media/` both render, the media library draws 31 pictures,
the draft is the single `jaenjs-state` key in `localStorage`, **zero** requests
go to any `jaen-agent` host and every request to the storage gateway carries a
bearer.

### Two things this transition got wrong before it got them right

**A migration must not carry `authors`, because a site publishes its own
patches.** The first cut of the migration carried the two head files' `authors`
maps, on the reasoning that they are the only record of who last wrote each
field and that historical patches carry extra top-level keys of their own. The
reasoning was wrong in one step and the measurement found it: a patch is a
gateway file and the gateway is private, but the build is a reader.
`gatsby-source-jaen` downloads every gateway file the data names, patch
payloads included, into `public/osg/<id>.<ext>`, so booklimo.at already serves
fourteen of its own patch payloads to anybody, and the migration made a
fifteenth naming two accounts and their identity-server ids. The payload is
`{message, createdAt, data}` now, which is the shape this design asked for,
and the authorship is written beside it out of every repository. That the
build publishes patch payloads at all is worth a decision of its own and is
not this transition's to take.

The withdrawn first cut,
`BQACAgQAAx0Ed6zoewACBe1qn6sq2kXoEzWmFArVGCFcjoUswwAC0R0AAlWvAAFR84UzP1Boiuo9BA`,
is not deleted from the gateway, where it is behind the Zitadel gate and is
the durable private record of the head's authorship. It is out of the
deployment: `booklimo.at/osg/<that id>.json` answers 404 on a fresh URL. It is
**not** out of Cloudflare's cache, which was measured answering 200 with
`cache-control: public, s-maxage=604800`, and the API token in the site's
`.env` reads zones but cannot purge, so it ages out within seven days of its
first fetch unless somebody with a cache purge credential for the
`booklimo.at` zone removes it sooner. The exposure is five field paths, the
display names of two test accounts and their two Zitadel ids, at an
unguessable id nothing has ever linked to.

**The notebooks lost their fixture.** `tests/09-editing-latency.ipynb` and
`tests/10-draft-persistence.ipynb` build their synthetic store out of
`booklimo.at/jaen-data/live.json` and `live-media.json`, read straight off
those two paths by `tests/support/editing-harness.ts`. The transition deletes
both, so the node halves of both notebooks will fail on a missing file until
they are pointed at the migration instead. The two files are kept outside every
repository, beside the site at `booklimo.at-transition-before.head/`, together
with the authors map, so nothing is lost while that is arranged.

### What this transition deliberately did not do, and what has since been done

Written on the day of the transition: "the agent's commit-on-save path is still
in `packages/jaen-agent/src/store.ts` and the agent Worker is still deployed.
Taking it out is the next step and this one is its precondition, which is the
order this section asks for."

That step is taken. `src/store.ts` is deleted, with the head patch, the split
between `live.json` and `live-media.json`, the blob sha lock and the
`patches.txt` head lines that went with it; `src/document.ts` is two constants;
and the GitHub client is left for the one thing that writes history, which is
publish. The agent is version 4.0.0 for it.

What is still true of the sentence above: **nothing is deployed**. The Worker
serving `jaen-agent.booklimo.at` and `jaen-agent.limosen.at` today is 3.1.0,
which still knows how to write to a repository, and no site carries the agent
option so nothing reaches it. Deploying 4.0.0 also creates the Durable Object
namespace for the first time, which is a migration and not a redeploy, and it
belongs with the run that puts the agent option back on booklimo.

## Acceptance

- Two editors on booklimo: a change in one reaches the other in under two
  seconds, and it produces no commit and no gateway file.
- A publish produces exactly one gateway file and one commit, and the line
  it appends is the only change to `patches.txt`.
- Nothing in `patches.txt` names a draft. An unpublished edit never
  reaches the built site.
- The build of booklimo produces byte identical data before and after the
  transition, proven by comparing the sourced jaen data.
- Every loss scenario of `10-draft-persistence.ipynb` passes: reload,
  hidden tab, closed tab, offline, agent unreachable, two editors racing,
  the object restarted between two saves.
- With the agent option removed the CMS still works on `localStorage`
  alone, which is the rollback.
