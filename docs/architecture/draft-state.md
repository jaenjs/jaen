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
meta                → revision, publishedRevision, updatedAt, publishedSha
page:<pageId>       → that page's fields
media:<nodeId>      → one media node
author:<fieldPath>  → who wrote it last, and when
```

A save writes only the keys it touched and bumps `revision`. A reader asks
for everything above a revision. The per value limit of an object's store
is small, on the order of 128 KB, which is the reason the catalogue is one
key per node rather than one blob, and the exact figures are confirmed
against Cloudflare's documentation in the build, not taken from memory.

Editors are pushed to over a WebSocket held by the object, so the polling
of the first build goes away. A poll remains as the fallback for a browser
whose socket is refused.

The object sets an alarm on itself and writes a snapshot of the draft
every few minutes and when the last editor leaves, into one file that is
**not** part of the chain. That is the backstop against losing the object,
and it costs a handful of writes a day rather than thousands.

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

One implementation on a Durable Object today. One on a single process with
SQLite the day the estate wants its own machine, where the guarantee is
free because there is only one process. Cloudflare's own runtime, workerd,
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
