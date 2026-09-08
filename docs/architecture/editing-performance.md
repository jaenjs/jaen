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

## The baseline, measured 2026-09-08

Taken before anything in the persistence path was changed, by the two
notebooks this file names, on an Apple M1 Max under Asahi. `tests/09` is the
cost, `tests/10` is the safety. Both end red on purpose: their acceptance
checks are written against the target below rather than against the code as it
stands, so the same notebooks are the gate after the change.

**How it was measured.** The node halves bundle `packages/jaen/src/redux`
itself with the repository's own esbuild and drive the real store, the real
`persist-state`, the real recorder and the real flusher, with only the browser
globals and the agent's HTTP replaced (`tests/support/editing-harness.ts` and
`editing-shim.ts`). One scenario per process, because the store is a module
singleton. The browser halves serve booklimo's own production build under its
own origin, `gatsby serve` behind a socat TLS listener with a chromium told to
resolve booklimo.at to it, and sign in as the booklimo human admin
(`tests/support/editing-browser.py`). The live agent commits what they type and
they set the field back, reading the value back out of a browser whose storage
was emptied first, so the proof is the repository's answer. Nothing was written
on limosen.

**The payload is 77 KB, not 120.** booklimo's draft is 1,899 bytes of pages and
118,617 bytes of catalogue on disk, and those files are written pretty printed.
What the store holds, and therefore what `JSON.stringify` produces, is 77,090
bytes. The share the catalogue takes of it is larger than this file assumed:
the same store without the catalogue's page is **742 bytes**, so the catalogue
is 99.0% of everything that is copied and stringified on every dispatch.

**One blur is four whole-store writes, and 309 KB.** Measured over sixty blurs
in node, with the flusher's stubbed round trip: four `localStorage` writes per
blur (the field write, the recorder's `remote/record` nested inside it,
`saveStarted` and `saveSucceeded`), 309,253 bytes written per blur, and the sum
of the dispatches a blur causes blocking the main thread for a median of 18.8
ms and a p95 of 27.2 ms. Read those milliseconds as a shape and not as a
verdict: a node property assignment is not a browser storage write.

**In the browser the same work is cheap.** The four steps of `saveState` on a
payload of the real size, timed inside chromium and amortised over sixty runs
because `performance.now()` is clamped to a tenth of a millisecond: 0.457 ms
for one whole-store save, so 1.8 ms for a blur's four. On this machine the four
serialisations alone are not a frame.

**What the real CMS costs is something else entirely.** Signed in on the local
production build against the live agent, one blur measured 24.0 ms and 24.8 ms
from the blur event to the next painted frame in two runs, over one frame at 16
ms, and in the four seconds after it the store was written **185 and 187
times**, 14.4 and 14.6 MB, with a longest long task of 51 ms.

The cause is not the blur. With edit mode on and nobody touching anything, the
store is written about **forty-seven times a second**, and the persisted
payload is byte for byte identical between those writes, so nothing is being
saved: they are dispatches that change no state. Two hundred and thirty-six
writes in five seconds, against **zero** in the same five seconds with edit
mode off. Resolved through the build's own source map, the stack is
`redux/persist-state.js:36` under `hooks/use-field.js:85` (`register`) under
`connectors/connect-field.js:45` under `fields/TextField/TextField.js:110`,
which is a text field's registration effect.

That is a second cause of the lag the owner reported and this plan does not
name it. Change 1 would hide most of its cost by coalescing those writes into
one idle callback, and the dispatch storm and the React work it drags with it
would still be there. It is written down rather than fixed, because that run
was the baseline. Whoever builds the four changes should decide whether a fifth
belongs beside them, and the reviewer should see that the persistence path was
not the whole answer.

**The safety half is green today, except the two acceptances.**
`tests/10-draft-persistence.ipynb` reads every value back rather than a flag.
Green: the payload carries the unsent change and the edit, an edit survives the
browser being started again, a hidden tab has it in storage in the same frame,
an edit made offline is kept and drains when the agent returns, an `online`
event drains it in 25 ms, a poll arriving mid-edit does not overwrite an unsent
change, discard drops the outbox and keeps the head and the authors, and
without the `agent` option the CMS still saves to `localStorage` alone with
nothing leaving the browser. In the browser, against the live agent: an edit
survives a hidden tab and a reload, an edit made offline drains, a second
editor reads it out of the repository, and the field was back to the value the
run found when it was read out of an emptied browser.

Red, both of them acceptance of a change not yet made: the persisted payload
still carries the catalogue (change 2), and three field writes 120 ms apart
still become three commits instead of one (change 3).

**One observation beside the plan.** The first retry after a failed save is at
five seconds, not the two this file and `draft-state.md` both claim:
`RETRY_SECONDS` is indexed with a failure count that has already been
incremented. Nothing is lost by it, the queue only waits longer than the
documents say, and the notebook records it as a WARN rather than a failure.

The stored runs of both notebooks are in `tests/baseline/`, and the review this
file asks for is still open.
