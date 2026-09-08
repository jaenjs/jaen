# Editing must feel local: the persistence path of a jaen field

> **REVIEW REQUIRED.** This change touches the one thing a CMS is sold on,
> that an edit is never lost. It was planned and built by an Opus session
> on 2026-09-08. **A Fable 5.1 session must review it before it is
> trusted**, with the diff, the two notebooks and their stored outputs in
> front of it, and must say so in a Reviewed note at the bottom of this
> file. Until that note exists, treat the numbers as measured and the
> safety as argued rather than proven.

Owner (Florian), 2026-09-08: "editing jaen fields feels extremely laggy
now, is it committing changes every time I leave a text field? I want the
old localStorage saving too, it should work asynchronously and not
synchronously, as sync is interrupting the editing greatly."

## What happens today when a field is left

`Field.Text` waits out its own 500 ms debounce and dispatches one
`pages/field_write`. Three consumers hang off that single dispatch.

1. **`persist-state.ts`**, unchanged since long before the shared draft.
   Its `store.subscribe` runs on _every_ dispatch and does, synchronously
   on the main thread: `JSON.parse(JSON.stringify(state))` (a full deep
   clone), a recursive walk of the clone deleting `isLoading` and `error`,
   a second `JSON.stringify`, and `localStorage.setItem`.
2. **The recorder** in `remote-state.ts` translates the action into a
   change and dispatches a second action, `remote/record`, so the writer
   above runs a second time.
3. **The flusher**, because a text field is not matched by
   `STREAMING_FIELD`, flushes at once: `saveStarted` (writer runs a third
   time), the network call to the agent, `saveSucceeded` (a fourth).

So one blur costs four whole-store serialisations, each a clone plus two
stringifies plus a synchronous storage write.

That was cheap while the store held only this browser's unpublished
changes. Since the shared draft the poller hydrates the whole draft into
the same store, and on booklimo that draft is 1,900 bytes of pages and
118,617 bytes of media catalogue. Every one of the four serialisations
now copies and stringifies about 120 KB twice, in the frame the editor
leaves the field.

The network is not the block: the flush is fire and forget. The commit
per blur is real, though, and it is the design's own rule that saving is
committing.

## The invariant, above every number

**An edit a person made is never lost.** Every change below is measured
against that first and against latency second. The three ways it could
break, and what holds it:

- The storage write becomes asynchronous, so a tab that dies between the
  edit and the write loses the tail. Held by a synchronous write on
  `visibilitychange` to hidden and on `pagehide`, which is the pair iOS
  Safari actually delivers.
- The save batches, so a browser closed inside the quiet window has
  changes only in the outbox. Held because the outbox is part of the
  persisted store and drains on the next start, which is exactly the
  offline queue the design already relies on.
- A poll that arrives mid-edit must fold the unsent outbox back on top of
  the remote answer. That is `hydrate` today and stays untouched.

## The four changes

**1. The storage write becomes asynchronous and single-pass.**
`persist-state.ts` marks the store dirty on a dispatch and writes in a
`requestIdleCallback` with a 250 ms timeout (a `setTimeout` where the
browser has no idle callback), coalescing every dispatch that happened in
between. The clone and the recursive walk go: one
`JSON.stringify(state, replacer)` where the replacer drops `isLoading`
and `error`. `visibilitychange` to hidden and `pagehide` write
synchronously and immediately.

**2. The catalogue leaves the persisted payload.** The media catalogue
is 118 KB of the 120, it is never edited by hand, and the agent hands it
back on the next poll, so it is not persisted. Everything else stays
persisted exactly as before, which keeps the offline story whole. A
narrower split, persisting only the local edits and asking the agent for
the rest, is a bigger change and is left to the reviewer as an open
question rather than taken now.

**3. Saving batches for every field, not only for MDX.** The quiet
window (proposed 1,500 ms, to be set by the measurement) applies to every
`fieldWrite`. Flushed at once regardless: a media write, a page created,
deleted or moved, the outbox reaching its batch size, the tab going
hidden, `pagehide`. The toolbar must say "not saved yet" during the
window rather than claiming a save that has not happened.

**4. Only if 1 to 3 leave a measurable block:** the stringify moves off
the main thread, or the store stops being the thing that is persisted.
Not built speculatively.

## The escape

Both sites carry the agent through one plugin option. Removing it makes
the CMS behave exactly as it did before the shared draft, with
`localStorage` as the only store. That is the rollback, and the notebook
asserts it still works.

## The notebooks

`tests/09-editing-latency.ipynb`, no browser needed for its first half:
it builds a synthetic store of the real sizes out of booklimo's
`live.json` and `live-media.json`, drives the persistence path in node,
and reports the main-thread milliseconds and the bytes written per
dispatch, before and after. Its second half drives a local production
build in playwright and measures the gap between the blur and the next
painted frame, skipping when playwright is absent.

`tests/10-draft-persistence.ipynb`, the safety half, and the one that
matters: the persisted payload carries the outbox and the local edits and
not the catalogue; an edit followed by a reload survives; an edit
followed by a hidden tab is written synchronously; an edit made offline
drains when the agent returns; a save inside the quiet window still
becomes exactly one commit; a poll arriving mid-edit does not overwrite
an unsent change; discarding clears the outbox and nothing else; and with
the agent option removed the CMS still saves to `localStorage` alone.

## Acceptance

- The main-thread block of one field blur, with a draft of 140 media
  nodes, is under one frame at 16 ms, measured as the sum of the
  serialisation and the storage write, against the four whole-store
  serialisations measured today.
- Every check of `10-draft-persistence.ipynb` passes, and each of its
  loss scenarios is asserted by reading the value back rather than by
  reading a flag.
- A field blur no longer produces a commit of its own inside the quiet
  window, and a picture still does at once.
- The shared draft's own budget in `draft-state.md` is re-measured after
  the change and does not get worse.
