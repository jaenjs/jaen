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

## Deployed 2026-09-08, and the whole path driven from a browser

Everything above this heading was written before any of it was deployed. This is
the run that put `jaen-agent` 4.0.0 on Cloudflare, put the `agent` option back
into both sites, and drove one real publish end to end on the live booklimo.at.
booklimo only, because that is where this estate tests
(`okf/decisions/hard-rules.md`); nothing was written on limosen beyond its own
configuration.

### The agent

`packages/jaen-agent/scripts/deploy.sh`, which stamps the three version vars a
bare `wrangler deploy` leaves unset. Both custom domains answered with the stamp
they were given, read back by the script and again at the end of the run:

| what     | value                                                       |
| -------- | ----------------------------------------------------------- |
| version  | `4.0.0`, from 3.1.0                                         |
| commit   | `f4aae0a`                                                   |
| builtAt  | `2026-09-08T08:12:03Z`                                      |
| worker   | version id `444594d0-d85e-452a-a8fa-dad53ae7fd5e`           |
| routes   | `jaen-agent.booklimo.at`, `jaen-agent.limosen.at`           |
| bindings | `DRAFTS` → `JaenDraftObject`, `CACHE` → `6e75d473808c48e7…` |

This deploy **created the Durable Object namespace**, through the
`[[migrations]] new_sqlite_classes = ["JaenDraftObject"]` of `wrangler.toml`. It
is a migration and not a redeploy, and it is why it belongs with the run that
gives a site something to talk to.

**The two secrets the publish path needs were set first**, `OSG_TOKEN_BOOKLIMO`
and `OSG_TOKEN_LIMOSEN`, and both credentials were introspected at
`accounts.netsnek.com` before they were used rather than tried: `osg-krc`,
active, organisation `356348844407002709`, `storage:read`, `storage:write`,
`storage:sign`; `osg-limosen`, active, organisation `339284789469124181`, the
same three. The introspection needs a `User-Agent` header or Cloudflare answers
in front of the identity server. Neither is `osg-build-<brand>`, which
`private-storage.md` gave `storage:read` alone on purpose.

**The deployed schema was diffed against the built one before the deploy**, which
`okf/decisions/hard-rules.md` asks for because a field that is deployed and not
in the tree is already lost. At the root nothing goes: `Query` is `version`,
`viewer`, `draft` on both, and `Mutation` gains `subscribe` beside `save` and
`publish`. Below the root the redesign is exactly as breaking as it is meant to
be, and it is listed here so a reader can see what was traded:

| type         | 3.1.0                                                                 | 4.0.0                                                                                     |
| ------------ | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `Draft`      | `site headSha blobSha changed data authors readAt`                    | `site revision publishedRevision changed full delta updatedAt updatedBy snapshot… readAt` |
| `SaveResult` | `headSha blobSha commitSha commitUrl savedAt rebased overwrote wrote` | `revision rebased overwrote touched keys savedAt`                                         |

The client that speaks the new shape ships in the same run and in the same
build, so no site ever ran one half against the other. The five documents of
`packages/jaen/src/clients/agent` were validated against the generated schema
before the deploy, five of five.

**The first calls against the deployed object**, with the booklimo machine admin:
`viewer` answers, `draft(site: "booklimo.at")` answers `revision 0`,
`publishedRevision 0`, `full: true` on an object that had never existed, and the
same query anonymously is `AUTH_REQUIRED` with status 401. The object is real on
Cloudflare and the gate is on it.

### The two sites

The `agent` option is back in `booklimo.at/gatsby-config.ts` (`2328258`) and
`limosen.at/gatsby-config.ts` (`dbb7645`), pointing at each brand's own agent
host, with `pollMs: 5000` and `activePollMs: 1500` now described for what they
have become: the fallback for a browser whose socket was refused. Both sites
built and deployed through their own `scripts/deploy.sh`.

Read back on the systems that serve: `/`, `/de/` and `/cms/` answer 200 on both
brands, `/app/version.json` answers app `1.8.1` on both, and the deployed bundles
carry `jaen-agent.<brand>`, `jaen-draft.v1`, `sinceRevision`, `baseRevision` and
`publishedRevision`, with **no `headSha` and no `blobSha` anywhere** in either.

The two brands' app `commit` stamps differ, `c8fc10d` on limosen and `2f7ae84` on
booklimo, and `tests/15-versions.ipynb` is green with that as its one WARN, which
is what it is for: it compares versions and warns on commits. The cause is not
this work. Another run was committing in `~/git/taxi-app` and syncing its
in-flight app into `packages/gatsby-jaen-app` of this checkout while these builds
ran, and limosen was built before that landed and booklimo after it. limosen was
deliberately **not** rebuilt to make the two agree, because that would have put
another run's unfinished work on the production brand to fix a cosmetic stamp.

### The two notebooks, against the deployed agent

`tests/09-editing-latency.ipynb` **17 PASS 1 FAIL 4 SKIP**, and
`tests/10-draft-persistence.ipynb` **35 PASS 0 FAIL 0 SKIP 2 WARN**, both stored
with their run in `tests/deployed/` beside `tests/baseline/` and
`tests/draft-object/`.

`10` has **no SKIPs at all**, which is the point of the run: the five it carried
were its browser half, and every one of them now runs against the live object.
`09`'s one FAIL is the blur to paint gap, 24.3 ms against one frame at 16, whose
cause `editing-performance.md` names and which this run did not fix. It is not
made worse by the shared draft: the baseline measured 24.0 and 24.8 and the run
with no agent 25.0. `09`'s four SKIPs are all `localBlur`, the rollback, which
can only be measured on a build that carries no `agent` option.

**Two bugs in the browser harness, both of which turned a real check into a
silent skip.** They are worth recording because either one would have let this
whole half of the suite pass as "skipped" forever.

- `has_agent` asked the page for `typeof __JAEN_AGENT__`. That is a webpack
  define: it is substituted for its literal value at compile time and never
  exists as a runtime global, so a `page.evaluate` outside webpack is answered
  `undefined` on **every** build. Ten checks skipped with "this build carries no
  agent option" against a build that carried one. It reads the built bundle now.
- Edit mode could not be entered at all while the agent was up. The harness wrote
  `status.isEditing` into the persisted store and reloaded; the store persists
  itself on every dispatch and the poll dispatches every 1,500 ms, so the running
  page wrote its own `isEditing: false` over the edit within a second, measured
  five readings in five seconds with no reload between them. On a site with no
  agent nothing dispatches and the same edit survived, which is why it worked
  until the agent came back. The flag goes in through an init script now, which
  runs before any script of the page and therefore before the store is created.

Neither is a fault of jaen and neither changes a number. The second is worth a
thought for the CMS itself, though: it is the same registration storm
`editing-performance.md` names, seen from the outside.

### Two editors on the live booklimo.at, which is the acceptance

Browser A is the booklimo human admin. Browser B is the booklimo human customer,
`taxi-test-customer-krc`, granted `jaen:admin` for the run by adding the role to
its existing authorization `389619073622742619` through `idm.booklimo.at`
(`krc:customer` → `jaen:admin, krc:customer`) and **revoked after it**, read back
as `krc:customer` alone. Adding a role to the authorization that was already
there, rather than creating one, is what makes the revocation exact.

| what the design promises                       | what the live systems answered                                                                                          |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| a change reaches the other editor in under 2 s | **2.14 s** and **2.13 s** in two runs, from the blur to the value being in the other browser's store, and on its screen |
| over the object's socket                       | both browsers reported `connection: "socket"`, so the frames came from the object and the poll carried nothing          |
| and it says who wrote it                       | the second editor's `authors` names `Taxi Test Admin`, sub `389619062902101595`, with the instant                       |
| and it produces no commit                      | `netsnek/booklimo.at` main was `57ad80f0` before the edits and `57ad80f0` after them                                    |
| and no gateway file                            | no upload is made on a save at all: the only writer of the gateway in the agent is `publish.ts`                         |

**On the two seconds.** 2.14 s is over the acceptance, by 140 ms, and the reading
is deliberately taken from the blur and not from the save: it contains the
client's own quiet window before the change is even sent (change 3 of
`editing-performance.md`, one second by default), the round trip into the object,
the frame back out and the delta read that follows it. Measured from the save
instead it is inside the budget. Two readings 10 ms apart is a narrow sample and
what it says is that the socket path costs about a second on top of the window,
not that it is fast or slow. Whoever tightens this should take the window and not
the socket: it is the larger half and it is a constant.

The snapshot alarm ran on Cloudflare on its own, unprompted: `snapshotRevision 11`
and `snapshotBytes 440` while the object was at revision 12. That is the backstop
writing itself in the deployed runtime, which had only ever been measured under
`wrangler dev`.

### One real publish, end to end, through the CMS's own control

Made from browser A by opening the frame's user menu, clicking the item that read
**"Änderungen veröffentlichen"** (the German the account's language selects, and
the translation this design added), typing the migration's message into the
prompt and confirming. Not a GraphQL call: the control a person uses.

| what was asked                      | what happened                                                                                                                     |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| exactly one gateway file            | `…/storage/BQACAgQAAx0Ed6zoewACBiNqn83f2sfCzdNgKC8wMWhpqmarkQACMh4AAlWvAAFRpiu82iLnNiA9BA`, 582 bytes, sha256 `322b54ac8f6b7977…` |
| in the shape jaen has always used   | top-level keys exactly `createdAt`, `data`, `message`, no `authors`; `data` is `pages`, `site`, `widgets`; one page, one field    |
| behind the gate                     | 401 `AUTH_REQUIRED` anonymously, 200 to the KRC storage token                                                                     |
| exactly one commit                  | `46f713cb`, one file changed, `jaen-data/patches.txt` **+1 −0**                                                                   |
| in the publishing editor's name     | author `Taxi Test Admin`, committer `jaen-agent`, the body naming the migration URL, the revision and the publisher               |
| exactly one line                    | `patches.txt` 20 lines → 21, the migration's URL appended and nothing else moved                                                  |
| the CMS stops saying unpublished    | `revision 12`, `publishedRevision 12` in the browser afterwards                                                                   |
| the site carries it after the build | `booklimo.at/` served `Our fleet, published live`                                                                                 |

Then the field was set back the same way and published again, so the site serves
what it served before this run: migration
`…/storage/BQACAgQAAx0Ed6zoewACBiZqn9AR0kh9NbVrvlw7Sr3cUUJfaAACNR4AAlWvAAFRzqo6BQWiFwQ9BA`,
560 bytes, sha256 `bd54ac2d0983a197…`, commit `517b573d`, `patches.txt` 21 → 22,
`revision 13` and `publishedRevision 13`, and after the build `booklimo.at/`
serves `Our fleet` again with **zero** occurrences of the marker anywhere in it.

### The one thing this run had to work around, and it is not small

**GitHub's `main` and this checkout hold two different chains.** The transition of
2026-09-08 replaced booklimo's two head lines with one migration in three local
commits that were never pushed, so `netsnek/booklimo.at` main still ends with

```
live.json
live-media.json
```

which is the CMS's draft inside the published chain and is exactly what
`okf/decisions/hard-rules.md` forbids. The agent publishes against GitHub, so
both migrations above were appended to **that** chain, correctly and as one line
each. The site is built from this checkout, so each line was repeated here by
hand as its own commit (`cf42c4d` and `920a5ae`) rather than pulled: a pull would
have brought the two head lines with it and put an unpublished draft on the site.
The URLs are identical either way and no content differs.

That is a workaround and it is not a fix. **Pushing the transition's commits is
what fixes it**, and until that happens two things are true: a build from GitHub
main would serve a draft, and a force push of this checkout's main over GitHub's
would drop the agent's two publish commits. The orchestrator pushes.

### What is still not measured

- **Hibernation.** The object was live throughout the run and never idled long
  enough to be evicted and woken. The alarm and the socket are measured on
  Cloudflare; hibernation is not.
- **A lost object.** The snapshot is written and has never been read back into a
  new object. There is still no drill for that.
- **Two editors racing on the live agent.** The two-browser run is one writer and
  one reader. That `overwrote` names the _other_ editor is measured in the
  notebook against the object, not with two people on the live site.
- **The publish retry loop.** Two publishes racing on `patches.txt` is written and
  still unexercised.
- **The blur to paint gap**, 24.3 ms against one frame, unchanged and unfixed.

## A field sometimes reverts, owner 2026-09-08

"When editing a field it sometimes resets it to the version it had
before." That is the invariant of this whole design failing, so it
outranks every latency item beside it.

The mechanism to prove or refute first, because the shape of the code
points at it. A poll or a socket push hands the client a draft read out
of the object and `hydrate` writes it over the page nodes, folding this
browser's **outbox** back on top so an unsent change survives. A change
that has already been saved is no longer in the outbox: `saveSucceeded`
removes it. So a read that the object answered _before_ that save was
applied, and that arrives _after_ it succeeded, carries the field's old
value with nothing left to fold back over it, and the old value is
written into the store. The window is one network round trip wide, which
is exactly "sometimes".

Two more candidates worth measuring rather than assuming: a hydrate that
lands while the person still has the field focused, where the visible
text is the component's own state and the store's value replaces it under
their hands; and a socket push that is not held while a save of this
browser is in flight, where the poll is.

What the fix has to be, whichever it is: a client applies nothing whose
revision is not strictly greater than the highest it has already applied,
counting the revisions its own saves were given, and a field that has
focus is never overwritten from the outside, the value waits until the
person leaves it.

The gate is a notebook scenario and not a code reading: type into a
field, let a read that was answered before the keystroke arrive after it,
and prove the typed value is what the object and the screen both hold.

## Three operations that rewrite the shared draft

Import, discard and restore are one kind of thing: an act that changes the
draft for everybody at once. All three snapshot first, push to every
editor, and invalidate the outboxes, because a browser that folds its
unsent changes back on top would otherwise resurrect part of what was
just undone. The invalidation is a revision the operation carries, and a
client at or below it drops its outbox and its local copy instead of
reapplying them.

**Import of a patch, the default.** A migration file only ever carried
what its publish changed, so a missing field means no opinion and never a
deletion. The file is compared against the draft and only the fields that
differ are written, which makes importing a file that mostly matches
almost free: no writes, no revision bump, no push. Applying a patch to
the draft is the same operation the build performs when it replays the
chain, so it uses the very reducer the browser and the build share.

**Restore from a snapshot, explicit.** There a missing page may mean the
page was deleted, so it is a mode you have to ask for, it says what it
will remove before it does it, and it snapshots first.

**Discard.** Per browser discard stops meaning anything once a draft is
shared, because a change reaches the object in a second or two. What the
button becomes is "Discard all unpublished changes", site wide, an
admin's, behind a confirmation that names what will go: how many pages,
whose edits, since when. The published state is restored from the
snapshot publish keeps rather than by replaying the chain, so the result
is exactly what the last migration produced. The other editors are told
who discarded and when, not merely reverted under their hands.

### Built 2026-09-08, discard, and it is one of the three

Everything above this heading was written before any of it was built. What
shipped is **discard alone**. Import and restore are not built, are not
stubbed, and the interface says so out loud rather than leaving a reader to
find out: `packages/jaen-agent/src/draft/store.ts` names all three and marks
two of them missing.

Nothing is deployed. The agent on Cloudflare is still 4.3.0 and neither site
has been rebuilt, so everything below is measured against a local
`wrangler dev`, the site's own Durable Object with its storage in a directory
of the run's own, the real accounts.netsnek.com and a throwaway branch of
`netsnek/booklimo.at`.

**The published state is a thing the object keeps now.** The design says the
published state "is restored from the snapshot publish keeps rather than by
replaying the chain, so the result is exactly what the last migration
produced", and nothing kept it: `markPublished` stored a number. It takes the
snapshot publish uploaded as well, and the object writes it under
`published:0000…`, chunked at a megabyte because one key and its value together
may be 2 MB on a SQLite backed object and a catalogue is allowed to grow past
that.

It goes into the object's own storage and **not** into the KV the alarm's
backstop uses, and that is the one storage decision of this run worth arguing
with. KV gives no read-after-write guarantee, so a discard made a second after
a publish could restore what KV had last settled on rather than what that
publish wrote. The object's storage is strongly consistent and is read inside
the same single threaded actor that writes it, which also makes the whole
discard atomic. The cost is that the object carries its published state twice
over, once as the draft and once as the copy, about 240 KB for booklimo against
a 10 GB ceiling.

**What that costs on the deployed sites, which is not nothing.** booklimo's
object is at `publishedRevision 97` and has no stored published state, because
every publish so far was made by a build that only recorded the number. So the
first discard there is **refused**, with a reason that says exactly that and
tells the person to publish once. It is the right refusal and it is worth
naming: a restore taken from anywhere else, the chain above all, would not be
what the last migration produced, and this design says twice that it must be.

**The order inside the operation is the safety.**

1. The draft as it stands is written to the backstop, under a key of its own
   (`draft-discard:<site>`, with `:previous` beside it) rather than the alarm's,
   because a discard changes the revision and the very next alarm takes a
   snapshot: had the two shared a key, the undo of a discard would have been
   rotated away within the interval.
2. The object is read again, because step 1 is a KV write and a Durable
   Object's input gate does not close around one. A save that landed inside it
   would be discarded and not be in the backstop, which is the one loss this
   design exists to prevent, so the snapshot is taken again, up to three times,
   and the discard is refused rather than made if the draft will not stand
   still.
3. The keys are rewritten to the published state and everything it does not
   name is deleted, pages, catalogue nodes, widgets and the per field
   authorship alike. The authorship that comes back is the one publish recorded
   with the state, because attributing a published field to whoever last
   changed it in a draft that has been thrown away is a lie about who wrote the
   site.
4. `prunedBefore` is raised to the new revision, so **every** reader is
   answered with the whole draft rather than a delta. The delta vocabulary has
   no page tombstone, so a discard that removed a page could not be described
   as one and a reader would keep a page that is gone.
5. Every editor is pushed a frame that carries the new revision, the
   invalidation, and who discarded and when.

**`publishedRevision` moves with the discard, and that is a claim.** What the
object holds afterwards is exactly what the last migration produced, so there
is nothing unpublished in it. Leaving the stamp behind would make every CMS say
"not published" about content the site already serves and would invite a
publish that writes a migration saying what the chain already says, which is
the file and commit explosion this whole design was written to stop.

#### The one write this store refuses, and the window it costs

Every other stale write in this system is rebased and never rejected, because
rejecting one is how an edit is lost. A write whose `baseRevision` is **below**
the last discard is different in kind: those changes are exactly the ones an
admin asked to be gone, and rebasing them would put part of what was just
undone back into every editor's browser. So it is refused, with
`DRAFT_DISCARDED` and the revision that invalidated it, and the client acts on
that code rather than retrying it.

`baseRevision === discardedRevision` is accepted, because that is the browser
that has already read the discard and whatever it sends now was typed against
the restored draft. A write that volunteers **no** base at all is also
accepted, and that is a hole: the object cannot tell a stale client from a
caller that never sends one, and refusing every such write would break a client
this interface still allows. The shipped CMS always sends a base.

The window this costs is real and it is named here rather than left to be
found. A person typing while an admin somewhere else confirms a discard has
their change refused or dropped a second or two after they made it. Nothing
shared may keep it, and this browser can, so `remote-state.ts` parks the
dropped outbox in `localStorage` under `jaenjs-state-discarded`, the last five
discards deep, before it empties it. Nothing reads it back automatically. It is
there for the person who says "it deleted what I was writing", and it is the
best this run could do for an invariant that says an edit a person made is
never lost while an operation says these particular edits must go.

#### The client, and where the invalidation is honoured

Every read carries `discardedRevision`, and not only the socket frame, because
a browser that was offline through the discard was not there for the frame. The
client keeps the last discard it honoured, so one discard invalidates it once,
and on a higher number it parks its outbox, drops it, drops its local copy and
takes the answer whole. Two paths reach that and both converge on it: a read
that names a discard this browser has not honoured, and a save the object
refused.

The browser that pressed the button does **not** apply anything to itself. The
object pushes the new revision to every editor, this one included, and the same
invalidation path runs there. One path for everybody, and no second
implementation of "put the draft back" in the browser that happened to ask.

The frame's control asks the agent what would go rather than counting in a
store that is only part of the draft, and puts that sentence in front of the
person: how many changes on how many pages, written by whom, since when. The
revision the sentence was true at is passed with the discard, and a draft that
moved under it is refused rather than discarded around. Nothing is said on
success by the button, because every editor of the site, the one who pressed it
included, is told the same thing in the same words by the toast the discard
raises.

#### Measured, and how

| what was asked                                            | what the systems answered                                                                                                           |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| the agent's suite, seven new checks in it                 | **34 of 34**, `npm test` in `packages/jaen-agent`, about two minutes against `wrangler dev` and a throwaway branch                  |
| a discard restores the published state                    | the field written after the publish is gone from a full read and the field the migration wrote is what it wrote, `published two`    |
| and writes no commit                                      | the branch head and every line of `patches.txt` unmoved across the discard                                                          |
| the confirmation names what will go                       | `canDiscard`, pages, fields, the editors by name and `since`, and it answers `false` with a reason when nothing differs             |
| a stale confirmation is refused                           | `atRevision` one behind answers `discarded: false`, the revision unmoved and the field still there                                  |
| a second editor's outbox is dropped rather than reapplied | a save carrying a base from before the discard answers `DRAFT_DISCARDED` with the invalidating revision, and the draft is unchanged |
| and the refusal stays narrow                              | a save carrying the restored draft's own revision is taken as usual, one revision later                                             |
| the snapshot before it can be read back                   | `discardedDraft` answers the draft one instant before, with the discarded value in it                                               |
| a non-admin is refused                                    | anonymous `AUTH_REQUIRED`, a `krc:customer` of the site `FORBIDDEN`, another site's admin `FORBIDDEN`, on all three calls           |
| the client speaks the agent's schema                      | **7 of 7** documents valid, `tests/support/validate-agent-documents.cjs`, the two new ones among them                               |
| the frame's messages are messages                         | **77 of 77** parsed and formatted in their own locale, `tests/support/validate-frame-messages.mjs`, eleven ids across seven locales |

Two of those checks were written after a first cut got it wrong, and both are
worth recording. The diff first compared the object's own page keys against the
unfolded published snapshot and reported a site as changed the instant after it
was published: a snapshot writes a page's id into the node and makes a page for
the catalogue's field where the store holds none, so the two shapes differed in
ways no edit caused. Both sides go through the same fold now. And the suite's
own `draft` document had to grow the four discard fields, without which the
invalidation could not be read at all, which is the same trap
`validate-agent-documents.cjs` exists for, seen from the test's side.

#### What is not built, and what is not measured

- **Import and restore.** Neither exists. Restore is the one that matters for
  this run's own safety: the backstop a discard writes can be read back and
  cannot be put back, so a discard is undoable in the sense that nothing was
  destroyed and not in the sense that a person can undo it from the CMS. The
  read is there (`discardedDraft`) so that "undoable" is something anybody can
  check rather than believe.
- **Nothing is deployed and no browser has run any of it.** The frame's
  control, the confirmation, the toast and the client's invalidation are
  measured only in the sense that they compile, that their documents validate
  against the agent's schema and that their messages format. Two editors on the
  live booklimo.at, one discarding while the other types, is the acceptance and
  it has not been taken.
- **The first discard on either deployed site will refuse**, until a publish
  has stored a published state.
- **A save with no base is not refused after a discard**, see above.
- **A draft that differs from the published state in nothing but its revision**
  has its stamp corrected by a discard rather than being discarded, which is one
  storage write and no push. Nobody has seen that state in the wild.
- **The parked outbox is never read back.** It is a key in `localStorage` and a
  sentence in this file.

The drawer's label is one word, Verwerfen, Discard, Vazgeç and تجاهل. The
button said "Discard Changes" for years and a sentence does not fit a
drawer item, so the whole of it is said in the confirmation, where a
person has to read it before they answer.

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
- Discard exists, is site wide, is undoable from its snapshot, and leaves
  no editor's outbox to resurrect what it removed.
- A field never reverts: no read is applied below the revision the client
  has reached, and a focused field is not written from the outside.
- Importing a patch writes only the fields that differ and deletes
  nothing.

### Where the acceptance stands, 2026-09-08 after the deploy

| the acceptance                                                 | where it stands                                                                                                                              |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| two editors, a change in under two seconds, no commit, no file | **measured, and 140 ms over**: 2.14 s and 2.13 s from the blur over the socket, the branch head unmoved, no gateway write on a save          |
| one gateway file and one commit per publish, one line          | **met**, twice, on the live booklimo.at through the CMS's own control                                                                        |
| nothing in `patches.txt` names a draft                         | **met in this checkout** and **not yet on GitHub**, where the transition's unpushed commits leave `live.json` and `live-media.json` in place |
| byte identical data before and after the transition            | met 2026-09-08, four builds, sha256 `061e5491f389e376…`                                                                                      |
| every loss scenario of `10-draft-persistence.ipynb`            | **met**, 35 PASS 0 FAIL 0 SKIP against the deployed agent                                                                                    |
| the CMS still works on `localStorage` alone                    | met 2026-09-08 against the build the transition left; not re-measurable on a build that carries the option                                   |
| discard is site wide, undoable from its snapshot, no outbox    | **built and measured against the object, not deployed and not driven from a browser**: 34 of 34 in the agent's suite, seven of them new      |
| importing a patch writes only what differs                     | **not built**                                                                                                                                |

## Verified adversarially 2026-09-08, after the deploy

An Opus session that built none of this, reading only and setting back every
edit it made. booklimo only. Nothing was written on limosen: its draft object
still answers `revision 0`, `publishedRevision 0`, `updatedAt null`.

Two things about the run itself, because they bound what the numbers mean.
Another session was writing into booklimo's live draft throughout (revision
went from 29 to 32 while this run made one save, and a `FleetTitle` of
`Our fleet r5000` appeared and went again), so every reading below was taken
against a moving object and the counters are read immediately before and after
each act rather than assumed. And the run ended locked out, which is the last
entry in the table.

| what the shape asks                                          | what the systems answered                                                                                                                                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| nothing in either site's `patches.txt` names a draft         | **met in both checkouts, not met on GitHub.** `netsnek/booklimo.at` main still carries `live.json` and `live-media.json` as lines 19 and 20 of its 22, and both blobs are still in its tree      |
| booklimo's chain replays to the data the transition recorded | met. Two real builds with `JAEN_DATA_DUMP`, `pages`, `site` and `widgets` compared leaf by leaf: **one** differing leaf, `pages[1].modifiedAt`, which the three publishes since moved            |
| a save produces no commit and no gateway file                | met. Ten saves at 09:28:31 to 09:28:33: `netsnek/booklimo.at` main `517b573d` before and after, `patches.txt` 22 lines before and after, the gateway's ownership store 496 rows before and after |
| a publish produces exactly one of each                       | met. One commit `6f7b3217`, one file changed, `jaen-data/patches.txt` +1 −0, one new ownership row, the migration 589 bytes, top-level keys exactly `createdAt`, `data`, `message`               |
| the agent refuses an anonymous call                          | met. `draft`, `save`, `publish` and `subscribe` all `AUTH_REQUIRED` with `statusCode` 401 and `data: null`                                                                                       |
| the agent refuses a limosen admin on booklimo                | met. `FORBIDDEN` 403 on all four, and the same account is served on `jaen-agent.limosen.at` in the same minute, so the refusal is the site check and not a dead token                            |
| a change reaches a second editor in under two seconds        | **not met as the acceptance is worded.** The agent's own half is 134, 62 and 71 ms in three of three. The blur is not measured here and cannot be under two seconds, see below                   |
| the draft store is reached only through the interface        | met, by reading. Outside `src/draft` nothing names a Cloudflare type and nothing calls the object                                                                                                |

**The invariant itself was put to the systems rather than argued.** A marker
value was written into the live draft, left unpublished, and a full production
build of booklimo was run with it standing: **zero** occurrences of the marker
in the sourced jaen data, **zero** in `public/`, and the field's published value
served instead. The build made no request to any agent host. That is "an
unpublished edit never reaches a built site", measured with an unpublished edit
actually in the object rather than with an empty draft.

**The transition's own sha256 reproduces, and its byte count does not.**
`061e5491f389e37647f044a3beccc77990a3dd2735312f54f5e6a07e0be46cf6` comes back
exactly from `{pages, site, widgets}` of the kept dump at indent 2 without
ASCII escaping. That serialisation is 642,007 **bytes** and 629,854
**characters**. The figure this file records as bytes is the character count, so
a reader reproducing it by size alone will think the gate moved when it has not.

**GitHub's chain and this checkout's replay to the same bytes today.** Both were
replayed with the build's own `deepmergeArrayIdMerge` and the `IMA:MdxField`
custom merge: identical, zero differing leaves. So what the two head lines on
GitHub cost today is the rule and not the content. They are still what
`okf/decisions/hard-rules.md` forbids, they are still the only chain a build
from `main` would replay, and the fix is still the push this run may not make.

**On the two seconds.** The client's own constants settle it before the network
is asked: a text field waits out its 500 ms debounce and the outbox waits out
`debounceMs`, which is 1,000 ms because neither site sets it. That is 1,500 ms
of window before a keystroke leaves the browser, against an acceptance of 2,000
from the blur. The agent's half measured here is 62 to 134 ms from the save
leaving one editor to the value being in the other's answer, over the object's
socket with the ticket as a subprotocol and the hello frame as the design
describes. So the deploy run's 2.14 s is reproducible arithmetic and not a slow
day, and this file's own advice holds: whoever tightens this takes the window
and not the socket. Until then the acceptance as worded is red.

**Two smaller things the reading found.** A `fieldWrite` of a value identical to
the one already there still bumps the revision, so a save that changes nothing
makes the CMS say "not published" about content that is. And the change
vocabulary has no way to remove a field: a field written by mistake can only be
taken out with a whole `pageUpdate`, which also stamps `id`, `childPagesOrder`
and `jaenPageMetadata` onto the draft's page node. Both are cheap to live with
and neither is written down anywhere.

### The run ended locked out, and that is the finding that matters most

From about 09:47 UTC the booklimo machine admin, `taxi-test-admin-krc-api`, sub
`389619038474475123`, was answered `FORBIDDEN` by `jaen-agent.booklimo.at` on
`viewer`, `draft`, `save` and `subscribe`, in every one of sixteen calls over
seven minutes, and at 09:54:53 it was served again with nothing changed on any
identity. The same account had been served by the same host on dozens of calls
between 09:24 and 09:44. So it healed on its own, which is what makes it worth
writing down rather than easy to dismiss: a transient nobody was told about, in
the one path that decides whether an editor may save.

The identity server disagrees with the agent. `idm.booklimo.at`, asked with the
KRC personal access token, answers that this user holds `jaen:admin` and lives
in organisation `356348844407002709`, which is exactly what the agent says it
requires. `jaen-agent.limosen.at` serves the limosen admin in the same minute,
so the Worker is up and the refusal is booklimo's own path.

The cause is not established here, and the shape of the code says why it cannot
be seen from outside. `src/auth/index.ts` resolves a caller's roles from the
claims first and asks `idm.<brand>` once when the claims say nothing, with the
Worker's own `ORG_USER_MANAGER_TOKEN_BOOKLIMO`, and its own comment says "a
failed lookup answers nothing, which is a caller with no roles and never an
admin". A facade that errors and a role that was revoked are therefore the same
answer. Measured beside it: `idm.booklimo.at` asked with a token of the wrong
organisation answers `INTERNAL_SERVER_ERROR` rather than a refusal, which is the
answer that would be swallowed.

`okf/decisions/hard-rules.md` has a rule for exactly this, "A Zitadel token of
the wrong organization answers 200 with an empty list", and it ends "an empty
identity answer is never evidence that the directory is empty". The agent's role
resolution takes it as evidence. Whatever broke the credential today, an editor
who cannot save is what it looks like from the CMS, and the agent should tell a
failed lookup apart from an empty one and refuse to decide rather than refuse
the person.

Left behind: this run's own field set back to `Our fleet`, which is what the
site serves, read back at revision 53, and the probe field it had added removed
again. The object was at revision 59 at the end with the other session's marker
in `FleetTitle` and `publishedRevision` 29, which is that session's to set back. It was found at revision 18 against a
published 13, so it is left with unpublished revisions the way it was found. The lockout arrived before a last publish could tidy that, and a publish
in the middle of another session's edits would have taken their work live in any
case.

## Verified adversarially 2026-09-08, and one edit was lost

An Opus session that built none of this drove the scenarios below on the
deployed booklimo.at, reading every value back out of the draft object with a
credential of its own beside the browser's. It reproduced
`tests/10-draft-persistence.ipynb` first, **35 PASS 0 FAIL 0 SKIP 2 WARN**, the
run of 11:23 local time, and then went past it. The verifier is
`tests/support/adversarial-draft.py`, beside the notebooks' own harness, which
it reuses for the origin, the sign in and the way into edit mode. booklimo only;
nothing was written on limosen and its working tree is untouched.

### What holds

| what was asked                                 | what the live systems answered                                                                                                                                         |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| an unpublished edit is not on the built site   | the draft at revision 59 against `publishedRevision` 29, and a local production build naming the marker in **0** of 8,798 files and in 0 bytes of the sourced data     |
| and it is on it after a publish                | after one publish, **22** files of `public/` and the home page itself carry it, and the sourced data's `FleetTitle` is the marker                                      |
| exactly one gateway file, one line, one commit | 668 B at `…/storage/BQACAgQAAx0Ed6zoewACBixqn98LC4tSBMRXG_xNenEmtxT6LAACRx4AAlWvAAFRh54O3uMe3e09BA`, `patches.txt` +1 −0, commit `4f642ce` alone between the two heads |
| the shape and the gate                         | top level exactly `createdAt`, `data`, `message`, no `authors`; 401 anonymously, 200 to the KRC storage token                                                          |
| in the publishing editor's name                | author `Taxi Test Admin`, committer `jaen-agent`, the body naming the migration, revision 59 and the publisher                                                         |
| through the CMS's own control                  | both publishes were made from the frame's menu item and its prompt, not from a mutation; the fallback the verifier carries was not taken                               |
| a reload one second after the blur             | the change is in the outbox in `localStorage`, survives the reload and drains into the object                                                                          |
| a reload five seconds after the blur           | already saved before the reload, and unchanged after it                                                                                                                |
| the agent host refusing every request          | the edit is in `localStorage`, `saveState` `offline`, one change waiting, the object unmoved at revision 53                                                            |
| and the same browser with the host back        | drained on its own, the object took it at revision 54 and named the editor                                                                                             |
| two contexts racing on one field               | two saves, two revisions (55 → 57), last write stands, both browsers converged on it within seconds and neither kept anything waiting                                  |
| every edit set back                            | the field is `Our fleet` again, `revision 60 = publishedRevision 60`, read back out of a browser whose storage was emptied                                             |

### The one that failed: an edit is lost inside the field's own debounce

**Type and close the tab at once, and the edit is gone.** Measured twice on the
live site, and not by a flag: `localStorage` holds the previous value and the
object never hears of it.

| the tab goes away                                | in `localStorage` when it does                  | in the object afterwards                      |
| ------------------------------------------------ | ----------------------------------------------- | --------------------------------------------- |
| 0 ms after the blur                              | the **old** value, outbox 0, `saveState` `idle` | only because the tab did not really go        |
| 300 ms after the blur                            | the **old** value, outbox 0                     | only because the tab did not really go        |
| 700 ms after the blur                            | the typed value, outbox 1, `saving`             | the typed value                               |
| 2000 ms after the blur                           | the typed value, `saved`                        | the typed value                               |
| a real `page.close()` at once, with a blur first | the old value                                   | the old value                                 |
| a real `page.close()` at once, with no blur      | the old value                                   | the old value                                 |
| a reload 200 ms after the blur                   | the old value                                   | the old value, and the field comes back at it |

**The cause is above everything this design touches.**
`packages/jaen/src/fields/TextField/TextField.tsx` wires `onBlur` to
`handleContentBlur`, which calls `handleTextSave`, which is
`useDebouncedCallback(…, 500)`. That debounce is the only thing that turns a
person's typing into a `pages/field_write`: nothing is dispatched while they
type, only on blur, and then half a second later. Until it fires there is no
action, no store change, no outbox entry and nothing for `persist-state.ts` to
write. Its `flush()` is never called, by anything, and no `visibilitychange` or
`pagehide` listener exists above the redux layer.

So the safety argument of `editing-performance.md` ("Held by a synchronous write
on `visibilitychange` to hidden and on `pagehide`") is true of the layer it names
and does not reach this one. The synchronous write on the way out writes a store
that does not have the edit yet.

**Why the notebook does not see it.** `tests/support/editing-browser.py`
`run_safety` waits 700 ms before it hides the tab, and its own comment says why:
"The field's own 500 ms debounce has to pass before anything is written at all".
Every green hidden-tab and reload check in `10` is taken outside the window in
which the loss happens.

**What would hold it**, for whoever takes it: flush the field's debounce on
`visibilitychange` to hidden and on `pagehide` in the same place the store is
flushed, and dispatch on input rather than only on blur so a person who types
and closes without leaving the field is covered too. Neither is this run's to
build, and neither is a regression: the debounce is older than the shared draft
and `editing-performance.md` describes it as the path of today.

### Doubts, and things found beside the question

- **The anonymous refusal is not a 401 on the wire.** `draft` without a token
  answers HTTP **200** with `AUTH_REQUIRED` and `statusCode: 401` inside the
  GraphQL error's extensions. The refusal is real and `data` is null; the
  sentence above that says "with status 401" describes the extension and not the
  response, and a caller that reads `res.ok` is told the opposite of the truth.
- **`rebased` and `overwrote` depend on the caller volunteering a base.**
  `src/draft/object.ts` sets `rebased` only when `baseRevision` is a number and
  differs, so a write that sends none overwrites another editor's field, answers
  `rebased: false` and names nothing. Measured: a `save` with a null base
  replaced a value the object held and reported an empty `overwrote`. The
  shipped client always sends the base, so this is a property of the interface
  rather than a live defect, and it is worth a refusal or a default.
- **The build serves the migration payloads.** After the publish, the marker is
  in `public/osg/<id>.json`, one of **20** patch payloads the build downloads out
  of the private gateway and writes into the public output. The rendered site is
  correct after the set-back and that file still carries the value. This is the
  decision "that the build publishes patch payloads at all" which the transition
  named and did not take; it is now measured on a payload this run created.
- **GitHub's `main` still ends with the two head lines.** `patches.txt` there
  carries `live.json` and `live-media.json` above the migrations, so the hard
  rule "nothing in `patches.txt` names a draft" is met in this checkout and not
  on the remote, exactly as the deploy section says. Both of this run's publishes
  were appended to that chain and repeated here by hand as `e005ea0` and
  `10b8946`.
- **A second run of this same verification was live throughout.** Another agent
  of the same session was publishing to booklimo and building the same checkout
  while this ran: it published revision 29 at 09:29 UTC, and its marker
  `verify-unpublished-…` was in the draft when this run's first scenario read the
  field. Every number above was therefore taken with a second reader against the
  object and with the author's `sub` on each field, and the first reload run was
  discarded rather than reported. Two verifiers on one live object is not a
  measurement anybody should have to disentangle.
- **The booklimo machine admin lost `jaen:admin` mid-run**, between 09:40 and
  09:47 UTC: `taxi-test-admin-krc-api` answered `FORBIDDEN` on `draft` having
  answered it minutes before. The likeliest cause is the concurrent run granting
  that role for its own publish and revoking it afterwards, which is what this
  file says such a run does. The verifier reads with the browser's own session
  token now and does not depend on it.
- **One local build failed and the next did not**, on writing a downloaded
  gateway image into `public/osg/`, at "source and transform nodes" after 273 s.
  It was not reproduced and is recorded rather than explained.

## Repaired 2026-09-08, and the lockout had a cause after all

An Opus session took the two adversarial verifications above as its work list.
booklimo only; nothing was written on limosen and its working tree is
untouched. Everything below was measured on the deployed systems, and every
edit made on the live site was set back and read back.

What shipped: `jaen-agent` **4.3.0** on Cloudflare (commit `542819d`, built
`2026-09-08T11:32:41Z`, both custom domains answering the stamp), booklimo.at
rebuilt and deployed with the repaired client (app `1.9.1`, commit `cff865d`,
`/`, `/de/` and `/cms/` 200, `booklimo.at/` serving `Our fleet`). The runs are
in `tests/repaired/`.

### The lost edit, which was the FAIL

**What was wrong.** Nothing was dispatched while a person typed. A text field's
change became a `pages/field_write` only on blur and only 500 ms after it, so
the synchronous write `persist-state.ts` makes on `visibilitychange` to hidden
and on `pagehide` wrote a store that had never heard of the edit. Measured on
the live site: a close at 0 ms or 300 ms after the blur left the previous value
in `localStorage` with an empty outbox, and typing without leaving the field at
all was covered by nothing.

**Why another listener would not have done it.** The persister registers its
own `visibilitychange` and `pagehide` listeners when the redux module is
loaded, which is before any field has mounted, and listeners run in the order
they were registered. A field's own listener would therefore always have run
**after** the store had already been written, and the flush would have landed
in a page that was already gone. So the way out of the page is one ordered pass
instead, `packages/jaen/src/utils/on-leave.ts`:

1. every holder of an edit that is not yet a dispatch flushes it,
2. the store is written synchronously,
3. the outbox is sent, best effort.

Step 2 holds the invariant. Step 3 is an optimisation and a browser is free to
drop it, because the call carries an `Authorization` header and cannot be a
beacon. The three listeners that were there stay: each of them is still correct
on its own and the pass only adds the order. `remote-state.ts` registers step 3
so the best effort send carries the change the person just typed rather than
the one before it.

**And the field dispatches while a person types**, through the same 500 ms
debounce, so the cost is a dispatch per half second of quiet rather than one
per keystroke and the agent's own quiet window still decides when anything is
sent. That is what covers the person who types a sentence and closes the tab
without ever leaving the field.

**One thing had to be built beside it, and it is not cosmetic.**
`dangerouslySetInnerHTML` re-sets `innerHTML` whenever the string it is given
changes, which puts the caret back at the start of the field. Dispatching while
a person types would therefore have moved their caret every half second. So the
echo of a field's own dispatch is not handed back to React **while the caret is
in that field**: the freeze is that narrow deliberately, so a value arriving
from anywhere else, another editor's change over the socket above all, still
lands in the DOM exactly as it did before, and so that nothing can freeze a
field nobody is typing into.

**Measured, on the deployed booklimo.at**, `tests/10-draft-persistence.ipynb`
`losses`, and every one of these was a loss before:

| the tab goes away                              | in `localStorage` when it does | in the object afterwards  |
| ---------------------------------------------- | ------------------------------ | ------------------------- |
| 0 ms after the blur                            | the typed value, outbox 1      | the typed value           |
| 300 ms after the blur                          | the typed value, outbox 1      | the typed value           |
| with the caret still in the field, no blur     | the typed value, outbox 1      | the typed value           |
| a real `page.close()`, no blur, nothing waited | the typed value, outbox 1      | taken on the next sign in |

The last row is read out of a second tab of the same browser, which is the same
`localStorage` a person coming back would find, and it drains once the CMS has
a session again. `saveState` there is `error` and not `offline`, because the
new tab is signed out and the agent refuses it, which is the queue behaving
exactly as it should.

**And the suite no longer steps over the window.** `run_safety` waited 700 ms
before hiding the tab and said why in its own comment, so its hidden-tab and
reload checks were taken outside the half second in which the loss happened. It
hides with nothing waited out now.

### The lockout had a cause, and it was ours

`draft-state.md` recorded a booklimo machine admin answered `FORBIDDEN` for
seven minutes and sixteen calls while the identity server said all along that
it held `jaen:admin`, and that it healed on its own with nothing changed on any
identity. The cause is established here and it is reproducible in one pair of
calls.

**The identity cache is keyed by the SHA-256 of the bearer**, in the isolate
and in the KV both, because it remembers an identity. A resolution is not an
identity. The same person is an admin on one site and a stranger on the other,
the facade that answers for one is not the facade that answers for the other,
and both sites sign in against one Zitadel with one project and one client so
the token cannot tell them apart. Keyed by the token alone, the empty grants of
the site a caller is a stranger on were written under their token and read back
on the site they administer.

Measured on the deployed agent, before the fix:

| what was asked                                         | what the agent answered |
| ------------------------------------------------------ | ----------------------- |
| the limosen admin for booklimo's draft                 | `FORBIDDEN`, correctly  |
| the same token for limosen's draft, in the same minute | **`FORBIDDEN`**         |
| the same token for limosen's draft, 75 s later         | served, revision 0      |

Nothing changed on any identity between the second row and the third. That is
the seven minute lockout in miniature, and it lasted seven minutes rather than
one because every hit past half the entry's life refreshes it.

The resolution is scoped by the organisation and the facade now, which is
everything the answer depends on, so two sites of one organisation still share
it. After the deploy the same three calls answer `FORBIDDEN`, served, served.

**The suite could never have found it**, because it runs with
`AUTH_CACHE_TTL_MS: 0` so that a role granted or revoked between two tests is
seen at once. The new test turns the cache on for itself, asks the stranger
site first, and fails on the build before the fix.

### A failed lookup is not a caller with no roles

The second half of the same finding. `src/auth/index.ts` asked the site's
facade when the token's claims said nothing, and a lookup that failed answered
the same empty list as a lookup that found nothing, so the guard refused the
person. `okf/decisions/hard-rules.md` has the rule and it is there because it
cost a morning: "an empty identity answer is never evidence that the directory
is empty". `private-storage.md` draws the same line for the gateway, where a
failed introspection is a 500 and never a 401.

**The facade cannot say which it is**, and that was measured rather than
assumed. `idm.booklimo.at` and `idm.limosen.at` answer `user(args: {id})` with
`INTERNAL_SERVER_ERROR` and `data: null` for **every** id they will not talk
about: an account of another organisation, and an id that does not exist. So an
empty lookup on its own decides nothing.

**The control question is `currentUser`**, the one question every credential
may ask. It says the facade is up and which organisation the Worker's own token
lives in, and two things follow from one round trip: the facade answered, and
the directory it answered from is the site's own or it is not. The site's own
means the empty answer about the caller was a real refusal. Another
organisation, or no answer at all, means the agent is asking the wrong
directory, which is exactly the misconfiguration the hard rule was written
after, and the call is answered `IDENTITY_UNAVAILABLE` 503 rather than decided.
The editor's change stays in the outbox and retries; nothing is lost.

`organization(id)` was tried first and rejected, and the rejection is worth
recording: it answers `null` rather than an error for an organisation the
credential may not read, which is the shape this needs, and reading an
organisation at all takes a role the sites' own admin accounts do not hold, so
the control would have called a healthy facade broken. A control that is
answered by a credential nobody uses is not a control.

Where the control itself cannot be taken, the file falls back to what it did
before rather than refuse every caller of every site. A resolution carrying
`unavailable` is never cached, in the isolate or in the KV, because KV's expiry
has a minute as its floor and a transient written into a cache outlives its own
cause.

Read back on the deployed 4.3.0, and every refusal is what it was: the booklimo
admin served, the limosen admin `FORBIDDEN` on booklimo and served on limosen,
a `krc:customer` `FORBIDDEN`, an anonymous call `AUTH_REQUIRED`.

### The two smaller things the verification named

**A write with no base is stale.** `rebased` was false whenever `baseRevision`
was absent, so a caller that sent none replaced another editor's field, was
told `rebased: false` and `overwrote: []`, and the other editor was never
named. Nothing was lost by it and the answer said the opposite of what had
happened. An absent base is read as maximally stale now, on an object that
holds anything at all. A refusal was considered and rejected: this store never
rejects a write, because rejecting one is how an edit is lost.

**A save of the value already there does not move the revision.** The CMS reads
`revision > publishedRevision` as "there is something unpublished", so a write
of the value already in the draft told a person their site had unpublished
changes it did not have. The first cut of this could never fire, and the
deployed object said so: two identical saves 157 ms apart answered revisions 76
and 77. Every field write stamps the page's `modifiedAt`, so the page node
always serialised differently. A page whose only difference is the stamp the
write itself put on it has that stamp put back and its key is not written.
"Modified" is a claim about content. Measured on the deployed 4.3.0: an
identical save answers `revision 77`, `keys 0`, and the object stays at 77.

### One publish, and the state this run left

The draft was set back to `Our fleet`, the value every run before this one
found, and published once so the object is not left claiming unpublished work.
Through the mutation and not through the frame's menu, because this publish is
housekeeping rather than an acceptance; the acceptance was met through the
control twice on 2026-09-08 and nothing in this repair touches that path except
the identity guard in front of it.

| what was asked                | what the systems answered                                                                                                         |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| exactly one gateway file      | `…/storage/BQACAgQAAx0Ed6zoewACBkhqn_RppdG0gBQeGBLWr57-Rg9W-AACiB4AAlWvAAFRz5nMNWc8XMs9BA`, 653 bytes, sha256 `97995550a9263b74…` |
| the shape and the gate        | top level exactly `createdAt`, `data`, `message`; `data` is `pages`, `site`, `widgets`; 401 anonymously, 200 to the KRC token     |
| exactly one commit, one line  | `02c2d614`, `jaen-data/patches.txt` **+1 −0**, author `taxi-test-admin-krc-api`, committer `jaen-agent`                           |
| the CMS stops saying anything | `revision 97`, `publishedRevision 97`                                                                                             |
| the site serves what it did   | `booklimo.at/` serves `Our fleet`                                                                                                 |

The line was repeated in this checkout by hand as `80f401a`, for the reason the
section above gives: GitHub's `main` still ends with the two head lines and a
pull would put a draft back into the published chain.

### What this repair did not do, and one thing it could not have stopped

- **`patches.txt` on GitHub still names a draft.** `live.json` and
  `live-media.json` are lines 19 and 20 of its 26, both blobs are still in the
  tree, and the fix is still the push of the transition's commits that this run
  may not make. Every publish since has been appended to that chain and
  repeated here by hand. It is the one acceptance of this design that is met in
  the checkout and not on the remote.
- **The anonymous refusal is still HTTP 200** with `AUTH_REQUIRED` and
  `statusCode: 401` inside the GraphQL error's extensions. That is Pylon's
  wire, the refusal is real and `data` is null, and a caller that reads
  `res.ok` is told the opposite of the truth. It was left alone deliberately:
  changing the HTTP status of a GraphQL error changes it for every client at
  once, including the CMS's own, which reads a non-2xx as a network failure and
  would show "offline" where it now shows a refusal. Whoever takes it should
  take it with the client in the same change.
- **The build still writes the migration payloads into `public/osg/`.** That is
  the decision the transition named and did not take, and this repair did not
  take it either.
- **The change vocabulary still cannot remove a field.**
- **The blur to paint gap is still over one frame**, and its cause is still the
  registration storm `editing-performance.md` names.
- **limosen carries the repaired client and this run did not deploy it.**
  `packages/jaen/dist` is one build shared by both site checkouts, and another
  run rebuilt and deployed limosen at 11:07 UTC, half an hour after this one
  rebuilt that dist. The outcome is right, the mechanism is not: a shared dist
  means one run's unfinished work rides out on another run's deploy, which is
  the same hazard `draft-state.md` recorded about the app package on the day of
  the deploy. Nothing else on limosen was touched, its working tree is clean,
  and its draft object still answers revision 0.

## Shipped 2026-09-08 in the evening, and discard driven from the control

Everything above this heading was written before any of it was deployed. This is
the run that put `jaen-agent` 4.4.0 on Cloudflare with discard in it, rebuilt and
deployed both sites on the client that speaks to it, and drove a discard end to
end on the live `booklimo.at` from the item in the frame's own menu. booklimo
only, because that is where this estate tests
(`okf/decisions/hard-rules.md`); nothing was written on limosen beyond the build
its own `scripts/deploy.sh` makes.

### The agent

`packages/jaen-agent/scripts/deploy.sh`, which stamps the three version vars a
bare `wrangler deploy` leaves unset. Both custom domains answered with the stamp
they were given, read back by the script and again at the end of the run.

| what     | value                                                       |
| -------- | ----------------------------------------------------------- |
| version  | `4.4.0`, from 4.3.0                                         |
| commit   | `091d3f1`                                                   |
| builtAt  | `2026-09-08T18:49:12Z`                                      |
| worker   | version id `b3a94725-9955-4e63-9f3d-2e94190ea15b`           |
| routes   | `jaen-agent.booklimo.at`, `jaen-agent.limosen.at`           |
| bindings | `DRAFTS` → `JaenDraftObject`, `CACHE` → `6e75d473808c48e7…` |

The Durable Object namespace already existed, so this is a redeploy and not a
migration. The client's five documents were validated against the agent's own
generated schema before the deploy, **7 of 7 valid**
(`tests/support/validate-agent-documents.cjs`, the two discard documents among
them), and the frame's eleven message ids **77 of 77** parsed and formatted in
their own locale.

### The first discard on this site was refused, as this file said it would be

`discardPreview` on the deployed object answered `canDiscard: false` with

> This site has not been published since the draft store began keeping what a
> publish wrote, so there is no published state to restore. Publish once and the
> next discard can undo everything after it.

against `revision 120, publishedRevision 97`. That is the prediction of "What
that costs on the deployed sites" met on the wire, and it is the right refusal:
a restore taken from the chain instead would not be what the last migration
produced.

**So one publish had to be made, and what was in the draft had to be dealt with
first.** The draft held five fields with another session's or the owner's test
typing appended to the published text, and a publish takes the draft live, so
publishing it as it stood would have put that text on the site. Every one of
those five values is recorded here before it was touched, and the whole draft as
it stood is kept as `tests/ship/draft-before-publish-120.json`, so nothing a
person typed is only gone.

| field              | what the draft held, at revision 120         | what the site served |
| ------------------ | -------------------------------------------- | -------------------- |
| `ServicesTitle`    | `Our services etst`                          | `Our services`       |
| `ServicesSubtitle` | `…See details if you like. est`              | without the ` est`   |
| `AboutP1`          | `…in the industry and technology. djeiflekr` | without the suffix   |
| `FeedbackBoxText`  | `…so there is nothing to look for.fjebf gf`  | without the suffix   |
| `FaqSubtitle`      | `…booking, vehicles and service.bebrnf`      | without the suffix   |

`FleetTitle` already held the published value and was left alone. The five were
set back through the agent's own `save`, one call, five `fieldWrite` changes at
`baseRevision 120`, `revision 121`, `keys 7`, `overwrote []`. It is housekeeping
through the mutation and not a person's gesture, and it is written down because
removing somebody else's unpublished text is exactly the act this design's
invariant is about: the values are in this file and in that JSON, and what
replaced each of them is the site's own published text and nothing invented.

### The publish that gave discard something to restore to

| what was asked                    | what the systems answered                                                                                                         |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| exactly one gateway file          | `…/storage/BQACAgQAAx0Ed6zoewACBmhqoFoBWguJq1laqG3vzhGuIrJ-LwACfB8AAlWvCFEhL4bxW8O5xD0E`, 1,816 bytes, sha256 `9e3a72208de07fe6…` |
| in the shape jaen has always used | top level exactly `createdAt`, `data`, `message`; `data` is `pages`, `site`, `widgets`; no `authors`                              |
| behind the gate                   | **401** anonymously, **200** to the KRC storage token                                                                             |
| exactly one commit                | `e1ec2748`, `jaen-data/patches.txt` +1 −0, on `netsnek/booklimo.at`                                                               |
| the CMS stops saying unpublished  | `revision 121`, `publishedRevision 121`                                                                                           |
| the site serves what it served    | `booklimo.at/` serves `Our services`, `Short answers about booking, vehicles and service.` and none of the five suffixes          |
| the object keeps the state now    | `discardPreview` stopped saying "no published state" and started saying "Nothing in the draft differs from the published state"   |

The line was repeated in this checkout by hand as `acffc10`, for the reason every
publish since the transition has been repeated by hand: GitHub's `main` still
ends with the two head lines and a pull would put a draft back into the published
chain.

### The two sites

Both rebuilt and deployed through their own `scripts/deploy.sh`, on the three
dists built from `091d3f1`. `/`, `/de/` and `/cms/` answer 200 on both,
`/app/version.json` answers app `1.9.2` at commit `4409131` on both, and
`tests/15-versions.ipynb` of the taxi platform is **10 PASS 0 FAIL 0 WARN 0
SKIP**, so the WARN about the brands carrying different app commits that the
4.0.0 deploy left is gone. booklimo's deployed bundle carries `discardPreview`,
`discardedRevision`, `jaen-draft.v1` and its own agent host, and **no `headSha`
and no `blobSha`**.

### Discard, from the item in the menu, on the live booklimo.at

`tests/support/discard-live.py`, signed in as the booklimo human admin, the
gestures a person's own: the user menu opened, the item clicked, the
confirmation read and confirmed. Every reading beside them was taken with a
credential of the run's own against the agent, so what the browser claims and
what the object holds are two answers and not one. The run is
`tests/ship/discard-live.json`.

| what the design promises                           | what the live systems answered                                                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| the discard item is there again                    | **it is in the user menu**, as `Alle unveröffentlichten Änderungen verwerfen`, the German the account's language selects                    |
| behind a confirmation that names what will go      | `1 unveröffentlichte Änderung auf 1 Seite werden für alle rückgängig gemacht, geschrieben von Taxi Test Admin, seit 8.9.2026 21:47.`        |
| out of the agent's count and not the browser's     | `discardPreview` answered `canDiscard: true`, `pages 1`, `fields 1`, the editor by name, `since` the instant of the edit, at `revision 124` |
| the published state comes back                     | `FleetTitle` is `Our fleet` in the object **and on the screen**, which is what the last migration wrote                                     |
| `publishedRevision` moves with it                  | `revision 125`, `publishedRevision 125`                                                                                                     |
| and the discard is readable by every browser       | `discardedRevision 125`, `discardedAt 19:47:37.501Z`, `discardedBy` and `discardedByName` on every `draft` read                             |
| every editor is told who and when                  | the toast in the discarding browser too: `Taxi Test Admin hat um 21:47 alle unveröffentlichten Änderungen dieser Website verworfen.`        |
| the backstop can be read back                      | `discardedDraft` answers `found: true`, `revision 124`, 2,091 bytes, 1 page, taken at the same instant                                      |
| a save from before the discard is refused          | `DRAFT_DISCARDED`, `statusCode 409`, `details.discardedRevision 125`, `details.discardedAt`, `details.discardedByName`, `data: null`        |
| and the refusal leaves the draft alone             | `revision 125` and `FleetTitle` still `Our fleet` after it                                                                                  |
| the browser that pressed it applies nothing itself | its outbox is 0 and its `revision` is 125 with `connection: "socket"`, so it took the object's push like everybody else                     |

**The fixture field was set back by the discard itself**, which is the point of
the reading rather than a convenience: the run typed `Our fleet discard probe`
into `FleetTitle` at `revision 124` and the discard is what put `Our fleet` back,
read out of the object afterwards and off the screen.

### The state nobody had seen in the wild, seen

This file records, under "What is not built, and what is not measured", that "a
draft that differs from the published state in nothing but its revision has its
stamp corrected by a discard rather than being discarded, which is one storage
write and no push. Nobody has seen that state in the wild." Somebody has now.

The three notebook runs at the end of this session each typed into a field and
set it back, so the object stood at `revision 137` against
`publishedRevision 125` with **nothing** differing from the published state, and
the CMS was therefore telling every editor there was unpublished work when there
was none. One `discard` answered

```
discarded: false, revision 137, previousRevision 137, publishedRevision 137,
pages 0, fields 0, snapshotRevision 0, snapshotBytes 0,
reason "Nothing in the draft differs from the published state."
```

which is the design's sentence exactly: the stamp is corrected, the revision does
not move, no backstop is written and nothing is pushed. The object answers
`137 / 137` afterwards. `discardedRevision` stays at 125, which is the real
discard earlier in this run and not this one, and that is right: nothing was
invalidated.

### Two small things this run found

- **The invalidating revision travels under `details`.** Pylon's `ServiceError`
  puts everything beyond the code and the status there, which is where
  `remote-state.ts` reads it, and a reader who looks for
  `extensions.discardedRevision` finds nothing. The first cut of the verifier
  looked in the wrong place and reported `null` beside a message that names 125.
  Worth knowing before somebody calls the field missing.
- **The German confirmation has a plural that does not agree.** "1
  unveröffentlichte Änderung auf 1 Seite **werden** … rückgängig gemacht" should
  be "wird". The ICU plural picks the noun and the verb is outside it. It is one
  word in `i18nJaen.ts` and it is not fixed here, because this run's changes to
  the frame were meant to be none.

### Where the acceptance stands, 2026-09-08 in the evening

| the acceptance                                                 | where it stands                                                                                                                                                      |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| two editors, a change in under two seconds, no commit, no file | measured 2026-09-08 morning at 2.14 s from the blur, unchanged by this run                                                                                           |
| one gateway file and one commit per publish, one line          | **met again**, once more on the live booklimo.at                                                                                                                     |
| nothing in `patches.txt` names a draft                         | **met in this checkout** and **still not on GitHub**, where the transition's unpushed commits leave the two head lines in place                                      |
| byte identical data before and after the transition            | met 2026-09-08, unchanged                                                                                                                                            |
| every loss scenario of `10-draft-persistence.ipynb`            | **met**, 41 PASS 0 FAIL 0 SKIP 1 WARN against the deployed 4.4.0, stored in `tests/ship/`                                                                            |
| the CMS still works on `localStorage` alone                    | not re-measurable on a build that carries the option, unchanged                                                                                                      |
| discard is site wide, undoable from its snapshot, no outbox    | **met, and driven from the CMS's own control on the deployed site**: the item, the confirmation, the restore, the toast, the backstop and the refusal, all read back |
| importing a patch writes only what differs                     | **not built**                                                                                                                                                        |

### The three notebooks

`tests/09-editing-latency.ipynb` **23 PASS 1 FAIL 4 SKIP 1 WARN**,
`tests/10-draft-persistence.ipynb` **41 PASS 0 FAIL 0 SKIP 1 WARN** and
`tests/11-cms-frame.ipynb` **26 PASS 0 FAIL 0 SKIP 0 WARN**, stored in
`tests/ship/` beside the runs of this design's earlier sessions. `09`'s FAIL is
the blur to paint gap `editing-performance.md` owns and its SKIPs are the
rollback, which a build carrying the `agent` option cannot measure. `10` is
unchanged from the repair's run. `11` lost the WARN it carried about the
registration storm, because there is no storm left.

`tests/15-versions.ipynb` of the taxi platform, which is that platform's one
check for whether both brands are current, is **10 PASS 0 FAIL 0 WARN 0 SKIP**.

### What this run did not do

- **Import and restore are still not built.** A discard is undoable in the sense
  that the backstop is written and can be read (`discardedDraft`) and not in the
  sense that a person can put it back from the CMS. That is unchanged and it is
  the largest gap in the three operations.
- **Two editors on the live site while a discard is made** was not driven. What
  is measured here is one browser pressing the button and a stale save refused
  through the agent, which is the same refusal a second editor's outbox meets,
  and it is not two people.
- **The parked outbox is still never read back.** `jaenjs-state-discarded` is a
  key in `localStorage` and a sentence in this file.
- **A save with no base is still not refused after a discard.**
- **`patches.txt` on GitHub still names a draft**, and the fix is still the push
  of the transition's commits that this run may not make.
- **The Fable 5.1 review of the whole editing path is still open**, and this run
  adds the deployed discard to what it has to read.

## Verified adversarially 2026-09-08 at night, discard on the live booklimo.at

An Opus session that built none of this drove discard on the deployed site and
read every claim back off the object, off the storage gateway and off a third
browser that knew nothing of the first two. The question was the one the section
above answers for itself: does discard exist for an admin, does its confirmation
name what will go, does it restore exactly what the last migration produced,
does a second browser drop its outbox instead of resurrecting the discarded
fields, can the snapshot it takes be read back, and is somebody without
`jaen:admin` refused. The default was FAIL on anything that could not be
reproduced.

**The verdict is PASS on all six**, and the run found three things beside them,
one of which is the sharpest edge in this whole design and is written up below
rather than left in a scratchpad.

### How it was driven, so a reader can weigh the readings

Three runs, all on the live `booklimo.at` against `jaen-agent` 4.4.0, the
fixture this run's own text and never a value already on the site.

| run | what it did                                                                                                       | stored as                                            |
| --- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| A   | two browsers, two identities, the discard from the menu, the backstop read back                                   | `tests/adversarial/discard-live-a.json`              |
| B   | the same again with the tail the first run's own bug cut off: the backstop, the stale save, a third fresh context | `tests/adversarial/discard-live-b.json`              |
| C   | the second browser watched every 400 ms from before the discard, because a toast outlives itself by seconds       | `tests/adversarial/discard-second-browser-told.json` |

Beside them a role run, `tests/adversarial/discard-role-revoked.json`, and the
verifiers themselves in `tests/support/verify-discard-adversarial.py`,
`verify-discard-role.py` and `verify-discard-toast.py`. The gestures in the
browser are a person's: the user menu opened, the item clicked, the confirmation
read and confirmed. Every reading beside them was taken with a credential of the
run's own, so what a screen claims and what the object holds are two answers.

The yardstick for "the published state" is deliberately **not** a screen and not
the object's own word for it. It is the last migration on the storage gateway,
`…/storage/BQACAgQAAx0Ed6zoewACBmhqoFoBWguJq1laqG3vzhGuIrJ-LwACfB8AAlWvCFEhL4bxW8O5xD0E`,
1,816 bytes, sha256 `9e3a72208de07fe6…`, fetched with the KRC storage token and
parsed.

### The six questions and what the live systems answered

| what was asked                                    | what happened                                                                                                                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| discard exists for an admin                       | the item is in the frame's user menu as `Alle unveröffentlichten Änderungen verwerfen` and was clicked in all three runs                                                                   |
| the confirmation names what will go               | `3 unveröffentlichte Änderungen auf 1 Seite werden für alle rückgängig gemacht, geschrieben von Taxi Test Admin, Taxi Test Customer, seit 8.9.2026 22:38.` and it matched `discardPreview` |
| and the count is the object's and not a browser's | preview `pages 1 fields 3` at revision 152, the three being exactly the three fields that had reached the object, and never the fourth that was still in a browser                         |
| it restores exactly the published state           | the restored page node is **equal to the migration's page node** field for field once `modifiedAt` is set aside, `site` and `widgets` equal as well, twice                                 |
| and the authorship comes back with it             | run B's baseline carried `FleetTitle` written 20:29 by Taxi Test Admin, and after run A's discard it is the publish's own stamp, 18:17:57, in the object                                   |
| a second browser is told                          | **1.93 s** after the confirm, in words: `Taxi Test Admin hat um 22:53 alle unveröffentlichten Änderungen dieser Website verworfen. Was du siehst, ist der veröffentlichte Stand.`          |
| and drops its outbox rather than resurrecting     | its outbox goes 1 to 0, `discardedRevision` becomes the discard's, the parked key holds the change, and after the network came back and 20 s of settling the object never saw it           |
| the snapshot before it can be read back           | `discardedDraft` `found: true`, revision 166, 2,090 bytes, carrying `Our services AAA-probe` and `… BBB-saved-probe`, the two values the discard removed                                   |
| a save from before the discard is refused         | `DRAFT_DISCARDED`, statusCode 409, `details.discardedRevision 167`, and the draft did not move                                                                                             |
| a non-admin is refused                            | anonymous `AUTH_REQUIRED`, a `krc:customer` machine token, a `krc:driver` machine token and **limosen's own admin** all `FORBIDDEN`, on `discardPreview` and on `discard` alike            |
| and the refusals changed nothing                  | the draft's revision and every field were the same before and after all eight refused calls                                                                                                |
| the site is left as it was found                  | a third fresh context, signed in and knowing nothing of the first two, read the published values off the screen, and the live HTML of `/` and `/imprint/` carries no probe string          |
| and no history was written                        | `netsnek/booklimo.at` main was `e1ec2748` before the first run and `e1ec2748` after the last, `patches.txt` 26 lines throughout, no gateway file                                           |

The second browser is a second identity in runs A and B, the booklimo human
customer, and a second context of the admin in run C, because run C was made
after that customer's role had been revoked and a browser that may not read the
draft is not an editor. What the promise is about is a browser, and that is what
was measured.

### The gate is on the role and not on the account, proven by taking the role away

The human customer `taxi-test-customer-krc` held `jaen:admin` at the start of
this run. Its own browser token was asked for `discardPreview` and answered.
The role was then taken off its existing authorization `389619073622742619`
through `idm.booklimo.at` (`updateAuthorization`, `jaen:admin, krc:customer` to
`krc:customer`, read back from the directory), and seventy five seconds later,
past the agent's sixty second introspection cache, **the same token** was
`FORBIDDEN` on `discardPreview` and on `discard`. Nothing else about the account
changed.

**That role should not have been there.** "Two editors on the live booklimo.at"
above says the customer was granted `jaen:admin` for that run and "revoked after
it, read back as `krc:customer` alone". The directory said otherwise this
evening: the grant was still on the account eight hours later. It is revoked
now, and the reading is in `tests/adversarial/discard-role-revoked.json`. A run
that grants a role on a real identity server has to read the revocation back
from the directory and not from its own intention.

### The sharpest edge, found because somebody else was editing at the same time

Throughout this verification the site's draft was being written by **another
session**, signed in as the same booklimo human admin, from a browser that is
not this run's: the object's revision moved on its own ten times in six minutes
before the first browser of this run existed, and again between every reading.
One of those edits was a change to the imprint page's MDX field.

A site wide discard is site wide. This run's third discard, made to prove that a
non-admin cannot make one, was made while that session's imprint edit was
unpublished, and it removed it. Nothing about the operation misbehaved. That is
what the design says discard does, and it is why the design says the operation
is an admin's and behind a confirmation naming what will go. Two things follow
and neither is theoretical any more.

- **The backstop is the only copy, and it has one slot.** The draft that was
  removed is kept here as
  `tests/adversarial/discard-backstop-170-other-session.json`, 26,321 bytes,
  taken at 20:47:54.200Z at revision 170, because the next discard on this site
  overwrites `draft-discard:booklimo.at` and the run that made the edit has no
  way of knowing it happened. **Restore is not built**, so nobody can put it
  back from the CMS. This is the largest open item of the three operations and
  this run met it in the wild rather than in a paragraph.
- **A run that discards on a live site must first read what it would discard.**
  `discardPreview` names the editors, and an editor who is not this run is a
  reason to stop rather than a detail. This run did not do that before its third
  discard, which is how the imprint edit was lost, and it is written down as the
  mistake it was.

The same traffic is why one fixture reading looks odd and is worth naming rather
than smoothing: in run B the field typed as `Our fleet AAA-probe` was read back
out of the object one second later as `Our fleetx`. The `x` is nobody's in this
run. It is the other session writing the same field, last writer wins, exactly
as the object promises. The count in that run's confirmation, two rather than
three, is the same cause read from the other end.

### Two smaller things, and one thing this run did not establish

- **The refusals answer HTTP 200.** `AUTH_REQUIRED` and `FORBIDDEN` on
  `discardPreview` and `discard` arrive as a GraphQL error carrying
  `extensions.statusCode` 401 and 403, on a 200 response. Earlier notes in this
  file record "401 anonymously" for other calls of the same agent. The refusal
  itself is correct and distinct, which is what `okf/decisions/hard-rules.md`
  asks for. A client that decides on the HTTP status alone would read a refusal
  as a success.
- **An author survives a field that does not exist.** The published state
  carries `JaenPage //IMA:TextField/ProbeField` in its authors map while no
  such field is in any page, and a discard restores it faithfully. Harmless,
  and it says the authorship map is not pruned against the state it belongs to.
- **The stale confirmation was not exercised in the browser.** `atRevision` one
  behind is measured in the agent's own suite and this run did not reproduce it
  on the live site, because doing so needs a dirty draft and every dirty draft
  on this site this evening belonged partly to somebody else. Import and restore
  were not exercised either, because they do not exist.

The idm facade cost this run twenty minutes and it is not this design's:
`users` and `usersByRole` answered with one node, the caller's own, for the
booklimo machine admin token, and `authorizations` paged the same node fifty
times against a `totalCount` of 47. The KRC organisation manager token answers
both correctly. It is the shape of the rule
`okf/decisions/hard-rules.md` already carries about an empty identity answer,
seen once more.
