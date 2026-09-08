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

## The engine of the storm, read 2026-09-08 while the owner was blocked

The baseline said the forty-seven writes a second come through
`useField`'s register. Reading the hook itself, the loop is one effect in
`packages/jaen/src/hooks/use-field.ts`:

```ts
const getField = (): ... => { ...reads the store... }

React.useEffect(() => {
  setField(getField)
}, [jaenPage.id, getField])
```

`getField` is a new function on every render, so the effect runs on every
render. `setField(getField)` hands React the updater, React calls it, and
it returns a freshly built object read out of the store, a new identity
every time, so the state is always "changed" and the component renders
again. That is a render loop with nothing to stop it, throttled only by
React's scheduling, which is the shape of the forty-seven.

The effect below it resubscribes to the store on every one of those
renders, because its dependency list carries `field`, which is one of the
new objects. And a field component whose register effect has an unstable
dependency then dispatches `field_register` per render, which is how a
render loop became a store write loop and reached `persist-state`.

So the fix is three narrow things in that one file, and none of them is in
the agent or in the persistence path: `getField` gets a stable identity or
leaves the dependency list, the first effect only sets state when the
value really differs the way the subscription below it already does, and
the subscription stops depending on the object it produces. The gate stays
what the plan says: with edit mode on and nobody typing, the store is
written zero times.

Written down by the orchestrating session rather than fixed there, because
a builder was measuring the same file at the same moment and this file is
jaen's core field hook. It is the first place that builder should look.

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

## After the draft became an object, 2026-09-08

The four changes of this file are unchanged and still in force. What moved
under them is the backend: `docs/architecture/draft-state.md` took the shared
draft out of the site's repository and put it in one Durable Object per site,
so a save is no longer a commit. This section records only what that did to the
measurements in this file, because the browser side of it did not change at
all.

**Nothing in the persistence path moved.** `persist-state.ts` is byte for byte
what change 1 and change 2 made it, the quiet window of change 3 is the same
window, and the toolbar still says `pending`, `saving`, `saved`, `offline` and
`error`. It says one thing more, "Saved 14:02, not published", whenever the
draft's revision is past the published one, which is a sentence the CMS could
not say while a save was a commit.

**What the quiet window saves is one thing fewer than it was.** It used to save
a commit, a round trip and a whole-store write per field. The commit was the
wrong direction and is gone, so it saves a round trip and a whole-store write,
which is what it was for.

**The numbers hold.** Re-measured with the same two notebooks after the change,
against the same draft: one blur is one whole-store write of 1,312 B where the
baseline measured four of 309,253, its p95 in node is 4.98 ms against the
baseline's 27.2 and against one frame at 16, and in chromium one blur is
0.010 ms of serialisation and write where the baseline measured 1.680. The
store is 77,096 B and the catalogue is 99.0% of it, the same figures this file
recorded, which is what makes the two runs comparable.

**The fixture had to move and the numbers say it moved honestly.** These
notebooks read `booklimo.at/jaen-data/live.json` and `live-media.json` straight
off the site, and the transition deleted both, because a head named in
`patches.txt` made every unfinished edit part of the published site. The two
files are kept beside the site at `booklimo.at-transition-before.head/`, and the
notebooks merge them into one draft, which is the shape the object's own
`snapshot(site)` answers. 77,096 B against the 77,090 this file measured is the
proof that the same thing is being weighed.

**Two things this file measured are still true and still unfixed.** The first
retry after a failed save is at five seconds and not the two both documents
claim, because `RETRY_SECONDS` is indexed with a failure count that has already
been incremented, and the notebook still records it as a WARN. And the
registration storm this file found, about forty-seven store writes a second with
edit mode on and nobody touching anything, is untouched: change 1 coalesces its
cost into one idle callback and the dispatches and the React work they drag are
still there. Neither was this session's to fix and both are named again here so
the reviewer does not have to find them twice.

**The blur in the real CMS, re-measured without an agent.** Every browser half
that needs a live shared draft skips, because the transition removed the `agent`
option from both sites. The blur to paint gap is the one number in this file
that came off a person's own machine rather than off a bench, and a number
nobody can take any more is not an acceptance, so `09` grew a `localBlur` mode:
the same field typed and left in the real CMS on a local production build of
booklimo.at signed in as the booklimo human admin, with `localStorage` as the
only store, which is what a site without the option is and which is exactly the
half of this file that does not depend on the agent.

In the four seconds after the blur the store was written **12 times and
33,873 B**, against the **185 and 187 times and 14.4 MB** this file measured
before the change. The escape holds beside it: the built site carries no agent
option, no request went to any agent host, nothing was queued, and the toolbar
claims no save because none was made. The edit reached `localStorage`, the field
was set back, and the value read out of a browser whose storage was emptied is
the one the run found.

**And the gap is still 25.0 ms.** Against the baseline's 24.0 and 24.8, and
still over one frame at 16. Change 1 coalesced the writes and did not remove the
dispatches, which is what this file said it would do before it was built: the
cause is the registration storm above, and it is React work rather than the
persistence path. The notebook records it as a WARN rather than a FAIL for that
reason. The acceptance at the top of this file, "the main-thread block of one
field blur ... measured as the sum of the serialisation and the storage write",
is met and is met by a wide margin, 0.012 ms in chromium against one frame; the
gap a person feels is a different number with a different cause and this file
now carries both.

The two runs are stored in `tests/draft-object/` beside `tests/baseline/`.

## Against the deployed agent, 2026-09-08

`jaen-agent` 4.0.0 is on Cloudflare with its Durable Object and both sites carry
the `agent` option again (`draft-state.md`, "Deployed 2026-09-08"), so the ten
browser checks that had nothing to talk to have something to talk to. The runs
are stored in `tests/deployed/`.

`09` **17 PASS 1 FAIL 4 SKIP**, `10` **35 PASS 0 FAIL 0 SKIP 2 WARN**. `10` has
no skips at all for the first time.

**The gap is 24.3 ms**, against the baseline's 24.0 and 24.8 and the no-agent
run's 25.0, so the shared draft costs nothing here and the cause is still the
registration storm this file named. It is a FAIL in `09` rather than the WARN
`localBlur` records, because the `acceptance, browser` check is written against
the target and this run did not fix it. **The acceptance at the top of this file
is red and stays red until the dispatches go, not the writes.** Beside it, in
the four seconds after the blur, 13 store writes and 9,054 B against the
baseline's 185 and 14.4 MB, and a longest long task of 66 ms.

**Two bugs in `tests/support/editing-browser.py` this run found**, both of which
turned a real check into a silent skip and neither of which is a fault of jaen.
`has_agent` asked the page for `typeof __JAEN_AGENT__`, which is a webpack define
and therefore never a runtime global, so it could only ever answer false and ten
checks skipped against a build that carried the option. And edit mode could not
be entered while the agent was up: the harness wrote `status.isEditing` into the
persisted store and reloaded, and the running page wrote its own `false` back
over it within a second, five readings in five seconds, because the store
persists itself on every dispatch and the poll dispatches every 1,500 ms. The
flag goes in through an init script now.

That second one is this file's own subject seen from the outside. The store is
written often enough that an external edit to it does not survive one second.

## The half second before this file begins, measured 2026-09-08

An adversarial run on the deployed booklimo.at found the one loss this file's
safety argument does not cover, and it is upstream of everything this file
changed. The measurements and the table are in
`docs/architecture/draft-state.md`, "Verified adversarially 2026-09-08, and one
edit was lost"; what belongs here is the cause, because the persistence path of
a jaen field is this file's subject.

**Nothing is dispatched while a person types.** `TextField` wires `onBlur` to
`handleContentBlur`, which calls `handleTextSave`, and `handleTextSave` is
`useDebouncedCallback(…, 500)`. So a field's change becomes a
`pages/field_write` only on blur, and only half a second after it. Before that
there is no action, no store change, no outbox entry, and nothing for
`persist-state.ts` to write.

**So the pair this file relies on cannot help.** "Held by a synchronous write on
`visibilitychange` to hidden and on `pagehide`, which is the pair iOS Safari
actually delivers" is true of the store and says nothing about the field. The
write on the way out writes a store that does not have the edit. Measured on the
live site: a tab that goes away 0 ms or 300 ms after the blur leaves the
**previous** value in `localStorage` with an empty outbox, and a real tab close
at once loses the edit entirely, with a blur before it and without one. At 700 ms
it is in the outbox and at 2,000 ms it is saved. A reload 200 ms after the blur
loses it the same way and the field comes back at its old value.

**The notebook steps over the window on purpose.** `run_safety` in
`tests/support/editing-browser.py` waits 700 ms before it hides the tab, and its
comment says why. Every hidden-tab and reload check of `10` is therefore taken
outside the half second in which the loss happens, which is why the suite is
green and the invariant is not met.

**What would close it**, for whoever takes it and not for this run: call the
debounced callback's `flush()` on `visibilitychange` to hidden and on `pagehide`
beside the store's own flush, and dispatch on input rather than only on blur, so
a person who types and closes the tab without leaving the field is covered too.
Neither is a regression of the four changes above: the 500 ms debounce is the
path this file describes as today's, and it was never the part that was measured.

## The half second is closed, 2026-09-08

The section above is the measurement of a loss. This is the repair, and its
numbers are in `tests/repaired/` beside the three runs before it. The four
changes of this file are untouched: nothing in `persist-state.ts` moved, the
quiet window is the same window, and the toolbar says what it said.

**What changed is above them.** `TextField` dispatches while a person types,
through the same 500 ms debounce it always had, so a keystroke becomes a
`pages/field_write` half a second after the typing stops rather than half a
second after the field is left. And the way out of the page is one ordered pass
rather than a set of listeners, `packages/jaen/src/utils/on-leave.ts`: every
holder of an edit that is not yet a dispatch flushes it, then the store is
written synchronously, then the outbox is sent best effort. The order is the
whole of it. A field's own `visibilitychange` listener could never have worked,
because this file's persister registers its listeners when the redux module
loads and a field's would always run after the store had been written.

So the safety argument at the top of this file now reaches the field as well.
"Held by a synchronous write on `visibilitychange` to hidden and on `pagehide`"
is true of the store, and what is written is a store that has the edit in it.

**One thing had to be built with it.** `dangerouslySetInnerHTML` re-sets
`innerHTML` whenever the string it is given changes, so dispatching while a
person types would have put their caret back at the start of the field every
half second. A field does not hand React the echo of its own dispatch while the
caret is in it. The freeze is that narrow on purpose: a value from anywhere
else, another editor's over the socket above all, still lands in the DOM the
way it did before.

**Measured on the deployed booklimo.at**, the three cases that used to lose the
edit and one real tab close, in `10-draft-persistence.ipynb`'s new `losses`
scenario: at 0 ms after the blur, at 300 ms, with the caret still in the field,
and on a `page.close()` with nothing waited out at all, the typed value is in
`localStorage` with one change in the outbox and the object has it afterwards.
`10` is **41 PASS 0 FAIL 0 SKIP 1 WARN**, where the run against the deployed
agent was 35 / 0 / 0 / 2.

**And the suite stops stepping over the window.** `run_safety` waited 700 ms
before hiding the tab, past the debounce, which is why every hidden-tab and
reload check of `10` was green while the invariant was not met. It hides with
nothing waited out now.

**The first retry is two seconds.** `RETRY_SECONDS` was indexed with a failure
count the catch had already incremented, which this file recorded as a WARN and
which is fixed, so `10`'s two WARNs are one.

**The blur to paint gap is unchanged and still over one frame**, and the reading
is noisier than one number can carry: 26.2, 26.0 and 25.2 ms in three notebook
runs of this repair and 24.4 ms with the same scenario run on its own on a quiet
machine, against 24.0 and 24.8 in the baseline, 25.0 with no agent and 24.3
against the deployed agent. Dispatching while a person types cannot land in this
measurement, because the scenario types and blurs at once and the blur replaces
the pending call, and nobody should read a millisecond of this spread as a
change either way. The cause is still the registration storm this file named and
the acceptance stays red until the dispatches go, not the writes. In the four
seconds after a blur: 12 store writes and 13,590 B, against the baseline's 185
and 14.4 MB.

## The drawer that would not open, measured 2026-09-08 on the live booklimo.at

Owner, 2026-09-08, on the live CMS: "der discard button in jaen ist jetzt
verschwunden, und nach dem Bearbeiten lassen sich das Hamburger-Menue nicht
mehr oeffnen, also beide Drawer. Erst nach vielen Versuchen gehen sie
irgendwann wieder auf."

This section measures the second half of that sentence and changes no
behaviour. The first half is settled and is not re-derived here: the discard
item was replaced by the shared draft's save state item, and it survives only in
the branch `slices/jaen-frame.tsx` takes when `sharedDraft.enabled` is false, so
with the agent configured there is no discard at all.

Two causes were put to the systems. **A**, the main thread is saturated by the
registration storm this file names, so the click's work never gets a frame.
**B**, `DrawerLeft` holds its open state in its own `useDisclosure`, and
something in the frame's render path gives it a new identity, so it is remounted
and the state thrown away milliseconds after the click. B predicts a mount count
that climbs while edit mode is on. A predicts long tasks and a late but eventual
open.

**Neither is the cause. A third is, it reproduces on demand, and it is not the
storm's: while any drawer stands, a click on either drawer button reaches
nothing at all.**

### How it was measured

`tests/support/drawer-probe.py`, on the real `booklimo.at` signed in as the
booklimo human admin, playwright chromium at 1440x900, de-AT. Eight runs, stored
as `tests/drawer/*.json`. Nothing was written to the draft except the one field
of the `afterEdit` run, which was typed, read back and set back to the value the
run found (`Our fleet test`, the value another session had left), with
`revision 108` before and after every run that followed.

Four things are read on every gesture. A mount counter, which is the identity of
the two trigger nodes watched in a `requestAnimationFrame` loop with a
`MutationObserver` counting insertions beside it, so the frame loop is a floor
and the observer cannot miss one. The store writes, counted in a wrapper around
`localStorage.setItem` installed before any script of the page. The long tasks,
from a `PerformanceObserver` and from the CDP performance domain's
`TaskDuration` around each click. And React's own work, `commits` and fiber
deletions off the devtools hook.

The click is `mouse.move`, `mouse.down`, `mouse.up` at the button's own
coordinates and never `locator.click()`, because playwright re-resolves and
retries a locator whose node went away, which is the failure the run is trying
to see.

### What the storm costs, with nobody touching anything

| five seconds of an untouched CMS   | edit mode off | edit mode on           |
| ---------------------------------- | ------------- | ---------------------- |
| `localStorage` writes a second     | 0.0           | 3.2 (70,576 B per 5 s) |
| React commits a second             | 0.7           | 53.6 to 59.0           |
| React fiber deletions per 5 s      | 0             | 31,510 to 33,810       |
| animation frames a second          | 60.0          | 26.8 to 29.4           |
| main thread busy per second        | 0.09 to 0.11  | **1.000 to 1.001**     |
| longest long task                  | 0 to 54 ms    | 50 to 59 ms            |
| a 50 ms `setTimeout` loop fires at | 50 to 51 ms   | **110 to 113 ms**      |

The main thread is fully occupied. The store writes are down from the
baseline's forty-seven a second because change 1 coalesces them, and the
dispatches that caused them are untouched, which is exactly what this file
predicted when it recorded the storm. The soak of 68 seconds says it is steady
rather than growing: 967 elements throughout, 57.6 to 58.8 commits a second at
the end as at the beginning, and no node or listener growth.

### Hypothesis B, refuted with a large denominator

**177 measurement windows, 0 mounts and 0 DOM insertions of either trigger
button.** Not one remount of `DrawerLeft` or `DrawerRight` was seen with edit
mode on, with edit mode off, under CPU throttle, or over a soak of 68 seconds in
edit mode. The fiber deletions above are real and they are elsewhere in the tree:
the ones the run could name are `path`, `Link`, `VStack` and `Text`, at about
2,000 icon paths and 300 links a second, and none of them is a drawer.

### Hypothesis A, refuted as the cause and confirmed as the cost

**From a page with no drawer standing, 109 of 109 gestures opened the drawer on
the first click**, at a median of 5 ms and a maximum of 27 ms from the mouse up
to the panel having geometry. That count is the 15 gestures of the runs that
read the inert state plus the 94 of the earlier cycles, both drawers, edit mode
on and off.

Throttling the CPU is the knob that tells A from B, and it moves nothing about
the click:

| CPU throttle | commits a second | frames a second | longest long task around a click | opened on the first click |
| ------------ | ---------------- | --------------- | -------------------------------- | ------------------------- |
| 1x           | 59.0             | 29.4            | 56 ms                            | 10 of 10                  |
| 4x           | 13.6             | 12.8            | 284 ms                           | 10 of 10                  |
| 8x           | 6.0              | 6.0             | 390 ms                           | 10 of 10                  |
| 20x          | 2.0              | 2.0             | **1,782 ms**                     | 10 of 10                  |

A machine twenty times slower than this one, painting two frames a second, still
opens the drawer on the first click. So the storm does not lose the click. What
it does is make the answer late enough to feel like nothing happened, which is
the half of A that is real and which the next section joins to the cause.

### The third cause: while a drawer stands, the page answers no click

Read on the live site at 1440x900, and identical with edit mode on and off:

| what                                          | left drawer                              | right drawer         |
| --------------------------------------------- | ---------------------------------------- | -------------------- |
| the trigger button                            | x 16, y 14, 36x36                        | x 1388, y 14, 36x36  |
| the panel when it is open                     | x 0, y 0, 320x900                        | x 1120, y 0, 320x900 |
| the panel covers its own trigger              | **yes**                                  | **yes**              |
| the panel covers the other trigger            | no                                       | no                   |
| `body` while it is open                       | `overflow: hidden; pointer-events: none` | the same             |
| `#___gatsby` while it is open                 | `aria-hidden="true"`                     | the same             |
| `elementFromPoint` at either trigger's centre | never the button                         | never the button     |

So a person who has one drawer open and reaches for either drawer button clicks
a document that has been made inert. **56 of 56 gestures taken with a drawer
standing produced no `pointerdown`, no `mousedown`, no `mouseup` and no `click`
on the button.** They are not lost, they are spent: a gesture a second or more
after the open dismisses the standing drawer (the dialog node count goes from 1
to 0 across the gesture) and the next click opens the drawer that was asked for.
Measured as a pair four times, left then right and right then left, with edit
mode on and with it off, and it is always exactly two clicks.

Two details of the same mechanism, both measured:

- **The left drawer cannot be closed by its own button at all**, 0 of 26
  closing gestures, at a person's pace, at 120 ms, and under throttle. Its
  panel covers the trigger and the point lands on the drawer's own header, so
  the pointer is inside the layer and nothing is dismissed. The right drawer
  reads as a toggle instead, 6 of 6, because the same point there lands outside
  its content and dismisses it. That asymmetry is a reading of where the point
  falls and not a proof.
- **Clicks in a fast burst do nothing whatever.** Two, three, four or five
  clicks 60 ms or 150 ms apart are one click seen and the drawer open at the
  end, because the dismissable layer is not armed yet inside the opening
  animation. So an impatient burst leaves the drawer exactly as the first click
  left it, and a click a second later closes it.

The cause of all of it is in the frame's own two components rather than in
Chakra: `DrawerLeft` and `DrawerRight` put their `IconButton` **outside**
`Drawer.Root` and wire it to `onToggle`, instead of using `Drawer.Trigger`
inside the root. A trigger inside the root is part of the dismissable layer and
is excluded from "outside", which is what makes a toggle a toggle. A button
outside it is furniture the layer covers and ignores.

**And the inert state is never stuck**, which had to be measured because a
cleanup starved by the storm was the obvious way for this to become permanent.
Sampled from inside the page every 50 ms: after a close the page is clickable
again at 240 to 462 ms in edit mode and at 284 to 370 ms with edit mode off, and
the drawer node itself goes at 441 to 589 ms, which is its exit animation. The
same reading taken over the click on "Bearbeitung starten", which is the owner's
own door into edit mode and which closes the user drawer as it goes, has the
body inert at no point at all and the drawer gone at 496 ms. What the sampler
does show is A again: its own 50 ms interval fires at a median of 110 ms while
the storm runs and at 50 ms with edit mode off.

### Which hypothesis the measurement supports, plainly

**Neither A nor B.** B is refuted, 0 mounts in 177 windows. A is refuted as the
cause of a click that does not open a drawer, 109 of 109 first clicks including
at 20x throttle, and is confirmed as a cost, a main thread that is busy 100% of
the time with nobody typing and a 50 ms timer that fires at 110.

The owner's sentence is produced by the two of them together, and the order
matters. The storm makes the CMS answer late enough that a person clicks again.
The second click, and every click after it while the drawer stands, reaches
nothing, and depending on when it lands it either does nothing at all or closes
the drawer he was trying to open. That is "erst nach vielen Versuchen gehen sie
irgendwann wieder auf", and it needs no drawer state to be thrown away and no
click to be dropped by the scheduler.

### What is not established, and what this run could not do

- **The owner's own failure was not reproduced as he describes it**, a drawer
  that stays shut on a first click from a page with nothing open. This run never
  saw one in 109 attempts. What it saw is a click that is swallowed whenever
  something is already open, which produces the same sentence and is a different
  fact. A reader should hold the difference.
- **The build he used is gone.** booklimo was rebuilt and deployed twice on the
  day he wrote it, once at 18:08 by another run of this session, so what is
  measured here is today's deployment and not his.
- **The reading is one machine, one browser and one viewport.** At a narrower
  width the panel and the triggers sit differently and nothing here says how.
- **The mount counter is a floor for the frame loop and a true count for the
  observer.** A remount and re-insertion inside one animation frame would be
  missed by the first, and the `MutationObserver` beside it saw zero insertions,
  which is what makes the refutation of B a measurement rather than a sample.
- **Why the storm is 3.2 store writes a second and 57 commits** is this file's
  own subject and is named above it, not here. The engine is the render loop in
  `use-field.ts`.
- **Nothing was fixed.** The fix is the next phase's, and the two things it has
  to take are separate: the dispatch loop, which this file's acceptance is
  already red against, and the trigger that lives outside its own drawer.

**What this run left on the live site.** One field was typed in and set back in
the `afterEdit` run and nothing was typed after it. Read back at the end out of
a browser of its own: `revision 108`, `publishedRevision 97`, `saveState idle`,
an empty outbox, `FleetTitle` in the draft the `Our fleet test` this run found
there, and `booklimo.at` serving `Our fleet` to a visitor. The unpublished
difference between those two is another session's and is left standing the way
it was found. Nothing was written on limosen.

## Built 2026-09-08: the drawers open on the first click, and their state is outside React

Everything above this heading was written before any of it was built. This is
the fix for the section above it, measured on a local production build of
booklimo.at served under its own name, signed in as the booklimo human admin,
against the live agent, with edit mode on and after a field was typed. booklimo
only, which is where this estate tests. Nothing was written on limosen.

The storm is **not** this work's. It was measured as the condition the drawers
have to work under and it is still running: 53.6 to 58.4 React commits a second
with nobody touching anything, 27.0 to 29.4 animation frames a second, 3.0 to
3.2 `localStorage` writes a second. Its engine is the render loop in
`packages/jaen/src/hooks/use-field.ts` and it belongs to the field path.

### Three changes, all of them in the frame's own components

**The open state leaves React.** Both drawers kept their own `useDisclosure`,
which is state in the component that re-renders 53 to 59 times a second. Nothing
was ever measured throwing it away, 0 mounts in 177 windows, and a drawer must
not depend on that: a frame that re-renders is a normal thing.
`components/JaenFrame/drawer-state.ts` holds it in module scope and hands it out
through `useSyncExternalStore`, which is the only React state that survives the
component being thrown away and built again. The two drawers share one value, so
exactly one stands, which is what lets a single gesture go from one to the other.

**The trigger moves inside its own `Drawer.Root`.** `DrawerLeft` and
`DrawerRight` put their button outside the root and wired it to `onToggle`, so
it carried no `aria-controls`, was not excluded from the layer's idea of
"outside", and focus did not come back to it on close. Ark's root renders no DOM
of its own, so the markup changed by attributes and not by layout, measured on
the live DOM: both buttons now carry `data-scope="dialog"`,
`data-part="trigger"`, `aria-haspopup="dialog"` and `aria-expanded`, at the same
36x36 box at x 16 and x 1388 they had before.

**The frame routes gestures on its own two buttons while a drawer stands.** This
is the part worth arguing with, so its reason is written out. Putting the
trigger inside the root does not on its own make it reachable: the exclusion Ark
applies is `contains(trigger, target)`, and with the body at
`pointer-events: none` the target of the gesture is the `<html>` element and
never the button, so Ark cannot know a trigger was aimed at. Coordinates survive
where hit testing does not. So `JaenFrame` installs one `pointerdown` listener
in the capture phase of `window`, active only while a drawer stands, which hit
tests the two trigger rectangles and routes the gesture itself: the standing
drawer's own button closes it, the other one switches. Capture runs window
before document, and this listener is registered when the frame mounts while Ark
registers its own on the next task after a drawer opens, so this one is reached
first and `stopImmediatePropagation` keeps the gesture whole rather than letting
it become a dismissal. The follow-up `click` is swallowed with it, because it
would land on the backdrop of whatever the gesture just opened.

**What was deliberately not done: the modality was not removed.** Making the
drawer non-modal would have made the buttons reachable by themselves, and it
would have taken the focus trap, the `aria-hidden` on the rest of the app and
the scroll lock with it. The run asserts the page is still inert while a drawer
stands, `pointer-events: none` on the body and `aria-hidden="true"` on
`#___gatsby` in 4 of 4 crossings, so what changed is who gets the gesture and
not what a drawer is.

**The settle window, 400 ms, and what it costs.** A gesture on a trigger inside
the opening animation is swallowed rather than toggled, because a person who
clicks again is clicking because the CMS answered late and not because they want
it shut. The enter animation is 300 ms and the earlier measurement saw an exit
finish 441 to 589 ms after a close, so 400 ms is the enter animation plus a
frame. The cost is that a deliberate second click inside 400 ms does nothing, and
the benefit is that the second click of a burst does not close what the first
opened.

### Measured, twice, and what the numbers are

`tests/11-cms-frame.ipynb` on `jaen_testkit`, one notebook for the frame, with
`tests/support/frame-drawer.py` beside it as the verifier and its two runs
stored in `tests/frame/`. **25 PASS 0 FAIL 0 SKIP 1 WARN**, the WARN being the
storm, which this work did not touch. Every gesture is `mouse.move`,
`mouse.down`, `mouse.up` at the button's own coordinates and never
`locator.click()`, which re-resolves and retries and would hide the failure.

| what the owner's sentence asks                 | before, on the live site   | after, on the local production build                         |
| ---------------------------------------------- | -------------------------- | ------------------------------------------------------------ |
| the first click opens the drawer, at 1440      | 109 of 109 already         | **40 of 40**, both drawers, at 1440 and at 390               |
| and it stays open                              | not asked                  | **40 of 40** still open afterwards, 0 to 7 ms                |
| a drawer stands, the other button is clicked   | 0 of 56 reached the button | **4 of 4** switched on one click                             |
| a drawer stands, its own button is clicked     | left 0 of 26 closed        | **10 of 10**, five per drawer                                |
| a burst of four clicks                         | one click seen             | **12 of 12 clicks seen**, and the next click opens it 6 of 6 |
| under the storm, dispatched on purpose         | not asked                  | **20 of 20** opened on the first click                       |
| a standing drawer across five seconds of storm | not asked                  | still open after **236 React commits**, 0 remounts           |

**The storm was reproduced rather than waited for**, which is the only way to
say anything about a re-render the drawer must survive. jaen's store is a module
singleton on no global, so the run takes it off react-redux's Provider fiber
through the devtools hook it installed before React booted, and dispatches
`pages/field_register` in a `requestAnimationFrame` loop: **11,408 actions over
85 s**, 52.6 commits a second and 17.6 animation frames a second under it. That
action and no other, for two reasons. It is the one the register loop actually
dispatches, so this is the storm and not a storm. And it is one the recorder in
`remote-state.ts` does not translate into a change, so it reaches no agent and no
draft, which the run proves rather than claims: the outbox is 0 and the revision
117 before and after.

**What the run left.** One field was typed into, `FleetTitle`, because that is
the state the owner reported the failure in, and it was set back and read back
as the value the run found (`Our fleet test`, another session's). `revision 118`,
`publishedRevision 97` at the end, an empty outbox, and nothing published. The
difference between those two revisions is another session's unpublished work and
is left standing the way it was found.

### What is not established

- **The state surviving an actual remount is argued, not measured.** No remount
  could be forced from outside: 0 in 40 gestures here and 0 in 177 windows in
  the measurement above. What is measured is that the drawer stands through 236
  commits of a storm. That the state survives a remount follows from where it
  lives, module scope read through `useSyncExternalStore`, and not from a
  reading.
- **A burst still ends with the drawer shut** when it runs past the settle
  window, which four clicks a nominal 100 ms apart do: they really span 452 to
  480 ms, because every playwright mouse call is a round trip to a main thread
  the storm keeps busy. That is a toggle toggling and `aria-expanded` promises
  it. What is asserted instead is that every click is seen and the next one
  works.
- **This is one machine, one browser and two widths**, 1440x900 and 390x844, and
  a local production build rather than the deployed booklimo.at. The deployment
  carries the old frame until the next site build.
- **The discard half of the owner's sentence is untouched.** It is located, not
  fixed: `slices/jaen-frame.tsx` keeps `save` and `discard` only in the branch
  it takes when `sharedDraft.enabled` is false, so with the agent configured
  there is no discard item at all. `draft-state.md` says what discard is to
  become, site wide and behind a confirmation, and that is not this work.
- **The storm is still there.** Every number above was taken with it running,
  which is the honest condition, and the notebook WARNs on it so the day it is
  fixed the reading changes visibly rather than silently.

## The storm at its root, 2026-09-08

This file has carried the same unfixed finding since its baseline: with edit
mode on and nobody touching anything the store is dispatched about forty-seven
times a second, change 1 coalesced the writes those dispatches caused and left
every dispatch standing, and every run since has repeated the sentence. It is
fixed here, the cause is named all the way down, and `09-editing-latency.ipynb`
now fails unless the number is zero.

The runs are stored in `tests/register/`. The probe is
`tests/support/register-probe.py`.

### How it was measured, and why not by counting writes

A write counter cannot see this any more. Change 1 defers the write into one
idle callback with a 250 ms deadline, so forty-seven dispatches a second appear
as three writes a second, which is what the drawer run above reported.

So the dispatches are counted where they are made. jaen's store is built with
`devTools: true`, and `configureStore` composes its enhancers through
`window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__` whenever that global exists, so a
shim installed by `add_init_script` before any script of the page can append one
enhancer of its own. It is appended **inside** the middleware, so the dispatch
it wraps is the one that reaches the root reducer and no action is missed,
including the ones the recorder middleware makes. It counts by action type,
keeps a histogram of the `fieldName` of every `pages/field_register`, and stores
stacks. Beside it: a wrapper around `localStorage.setItem`, a long task
observer, React's own commit and fiber-deletion counters through the devtools
hook, a `requestAnimationFrame` counter, and a 50 ms `setTimeout` loop whose
real interval is the main thread's own answer about how busy it is.

Everything was run on booklimo's own production build served under its own name
behind a socat TLS listener, signed in as the booklimo human admin, against the
live agent. The same build directory,
`limosen-v3/booklimo.at-storm-build`, was rebuilt for each of the two readings,
so before and after differ in jaen's `dist` and in nothing else.

### The measurement

Two five second windows with nobody touching anything, on the same build, the
same browser and the same machine.

| five seconds, untouched, edit mode on  | before           | after        |
| -------------------------------------- | ---------------- | ------------ |
| dispatches a second                    | 55.6 to 57.2     | **0.0**      |
| all of them `pages/field_register`     | 100%             | none         |
| `localStorage` writes a second         | 3.0 to 3.2       | **0.0**      |
| bytes written per five seconds         | 41,730 to 44,512 | **0**        |
| React commits a second                 | 55.6 to 57.2     | 0.2          |
| React fiber deletions per five seconds | 32,200 to 33,120 | **0**        |
| animation frames a second              | 28.0 to 28.8     | 59.7 to 60.0 |
| a 50 ms `setTimeout` fires at          | 72.7 to 74.8 ms  | 50 ms        |
| longest long task                      | 0 to 68 ms       | 0 ms         |

Edit mode off is the control and is 0.0 dispatches a second, 0.0 writes and
59.9 frames a second in both readings.

Beside them, on the same runs: eight blurs of a real field, clicked with the
mouse and left with Tab, caused **1,212 dispatches before and 0 after**.

**And a soak.** Three windows of thirty seconds each, ninety seconds of an
untouched CMS with edit mode on: **0 dispatches, 0 `localStorage` writes, 0
React fiber deletions, 0 field nodes replaced, 59.8 animation frames a second
and the 50 ms timer at 50 ms**, with five React commits in each thirty seconds.
So it is zero and stays zero rather than being quiet for five seconds.

The longest long task in the second after a click on a field is the one reading
that separates nothing: 0, 71, 0, 0, 0 and 59 ms before, and 0 ms on all six
clicks in two runs after and 51 to 75 ms in a third taken while the machine was
busier. Clicking a field is the one gesture with real CMS work behind it, the
field highlighter rebuilding its frame and portalling a tooltip, and the spread
is the machine. The notebook records it and warns above 50 ms rather than
failing on it.

### Which fields, and how many

**Two.** Every one of the fifty-five dispatches a second came from
`FooterTagline` and `FooterRights`, twenty-eight times a second each, on a page
with forty-one editable fields. The other thirty-nine register once when the
page boots and never again: the boot window shows thirty-six
`pages/field_register`, one per field, and then nothing.

That is what turned a general suspicion into a cause. A storm that came from
the registration path as such would have shown every field in it.

### The loop, link by link

1. **The site remounts the footer.** booklimo's own
   `src/gatsby-plugin-jaen/components/Layout.tsx` builds the footer as
   `const FooterWithLocale: React.FC = () => <Footer fieldNamePrefix={localePrefix} />`
   inside `Layout`'s render. A component type created during a render is a new
   type on every render, and React answers a new type by unmounting the whole
   subtree and mounting a new one. Nothing else on the page is built that way,
   which is why nothing else stormed.
2. **A remount runs the registration effect.** `TextField`'s effect has
   `[jaenField.isEditing]` for its dependency list and is therefore correct as
   written: it does not re-run because a dependency changed, it re-runs because
   the component is new. It calls `connectField`'s register, which calls
   `useField`'s register.
3. **The registration was a dispatch whatever it said.** `useField` dispatched
   `pages/field_register` unconditionally, and the reducer then replaced
   `state.page.pages.nodes[pageId]` with a spread, so the page node's identity
   changed even when not one byte of it did.
4. **A new page node re-renders the page.** `usePage` subscribes to the store
   and calls `setDynamicPage(populateDynamicPage({...dynamicPage, id}))` on
   every dispatch, unconditionally and with a fresh object, so every consumer of
   a page re-renders. `Layout` is one of them.
5. Back to 1.

The measurement holds each link. The count of times each footer field's DOM
node was replaced, watched in a `requestAnimationFrame` loop, equals the count
of that field's registrations to within one: 144 against 143, 145 against 145,
140 against 140 in three windows. So it is exactly one registration per
remount. And when the dispatch of step 3 goes, everything stops: no commits, no
fiber deletions, no remounts, sixty frames a second. That is the proof the loop
was closed through the store and not driven from outside it.

### What was changed, and where

**`useField`'s `register` dispatches only when the store would change.** It
reads the field out of the store and compares the registration it is about to
write with the one already there. A registration carries no value and is never
recorded as a change (`remote-state.ts` records `pages/field_write` and never
`pages/field_register`), so one that says what the store says has no
consequence at all except its cost, and its cost was the whole storm.
`utils/registration.ts` holds the comparison: by key set and by value, with an
`undefined` value counting as absent, which is what `JSON.stringify` does to it
on the way into `localStorage` anyway.

The guard is in the hook rather than in the reducer because a dispatch that
changes no state still runs every store subscriber, still marks the persister
dirty and still costs a notification. Stopping it in the reducer would have
left all of that, which is damping rather than fixing. **The reducer carries the
same test as a second line** for any caller that is not this hook, and that also
stops it replacing the page node's identity for nothing.

**And the three things this file asked for in `use-field.ts`** in "The engine of
the storm", which are real defects whether or not they were this engine. The
reader leaves both dependency lists through a ref instead of being rebuilt into
them on every render, so the first effect no longer runs after every render and
no longer hands `setField` the reader itself. The first effect sets state only
when the value really differs. The store subscription is made once per field
rather than once per change, and it compares by identity before it serialises
anything: the store is immer's, so a field nothing wrote comes back as the very
same object, where the old code serialised both the new field and the old one on
every dispatch for every field on the page, forty-one fields twice each per
dispatch.

The section a write and a registration name is memoised by its content, because
`SectionBlockContext` is a fresh object on every render of its provider and a
dependency list carrying it is unstable for every field inside a section.

### What was deliberately not changed

- **booklimo's `FooterWithLocale`.** It is the cause of the remount and it is
  the site's own file. Fixing it there would take the remount off booklimo and
  leave every other site exposed to the same storm, and a CMS cannot rely on
  its consumers never defining a component during a render. It is named here so
  it can be fixed in the site as well, which would additionally save the footer
  being rebuilt on every page render.
- **`usePage`'s unconditional `setDynamicPage`.** It is the amplifier of step 4
  and it is still there: one legitimate field write hands every page consumer a
  fresh object and re-renders the page tree, which on booklimo remounts the
  footer once. That is one remount and not a loop, so the gate is met without
  it. It was left because it is not this run's to take, it is not the frame's
  either, and it touches how page data reaches every field. Whoever takes it
  should compare the produced page with the previous one before setting state,
  the way the field subscription now does.
- **Nothing in the persistence path, the agent or the frame moved.**

### The doubts, named

- **No build made from this working tree can hydrate its draft.** The agent
  client in `packages/jaen/src/clients/agent/index.ts` asks a `Draft` for
  `discardedRevision`, `discardedAt`, `discardedBy`, `discardedByName` and
  `discarded`, and the deployed jaen-agent 4.0.0 has none of them, so every
  draft read answers `GRAPHQL_VALIDATION_FAILED`, the CMS never hydrates and
  `remote.revision` stays null while the socket is open and the agent answers
  200 to `viewer` and to `subscribe`. That is somebody else's work in flight and
  not this change: it is identical before and after, the storm is a client
  render loop that does not depend on the draft, and a save still reaches the
  object, revision 119 and then 120 during this run. It does mean that until the
  agent is redeployed or the query is put back, every draft-dependent check of
  `09` and `10` is measuring a CMS that never received a draft. It was worked
  around here by rewriting the query on the wire, read only, to read the draft
  back.
- **The blur to the next painted frame is unchanged**, 14.9 ms median over eight
  blurs before and 20.6 ms after, and neither is a verdict. The gap is the wait
  for the next vsync in both cases: a page painting 28 frames a second and one
  painting 60 both hand the next frame over in about a frame. The first one or
  two blurs of a run are slower than the rest, 71 and 80 ms, because the field
  highlighter builds its frame the first time a field is focused. What the fix
  removes is the work, and the dispatch count is the honest reading of it.
- **The main thread a blur holds was measured with `setTimeout(0)`**, which the
  browser may run after a rendering step, so the 26.9 ms median it reports is an
  upper bound on a task rather than the task. It is recorded and not asserted
  on.
- **booklimo has no section field anywhere**, so nothing in these runs reached
  the block path of `useField`, which is the part of the hook this change
  touched most: the section a write and a registration name is now memoised by
  its content and the subscription is keyed on the section's path and id. The
  payloads are byte for byte what they were and the reader is unchanged, and
  that is an argument rather than a measurement. The comparison the guard turns
  on has eleven cases of its own in
  `tests/support/registration-cases.mjs`, driven from the notebook, including
  the two directions that matter: an alignment tune changed must still be
  written, and a registration that says what the store says must not be.
- **No browser gesture in these runs changed a tune**, for the same reason: the
  tune selector lives in the highlighter's tooltip and reaching it is a second
  thing that can fail. The cases above cover it instead.
- **One machine, one browser, one viewport, one page.** Apple M1 Max under
  Asahi, headless chromium at 1440x900, booklimo's home page with forty-one
  editable fields.
- **The count is of actions reaching the reducer.** An action a middleware
  swallowed before the reducer would not be counted. Nothing in jaen does that.
- **The notebook's own gate was validated against the two stored runs** rather
  than by running `09` end to end, which needs the node bench and three more
  browser scenarios. Every assertion of the new section passes on
  `tests/register/after.json` and fails on `before.json`.

### What this run left on the live site

One field, typed and set back, and it took two attempts to set back.
`FleetTitle` was `Our fleet`, went to `Our fleet storm-probe` at revision 119,
and is `Our fleet` again at revision 120, read back out of the object with an
empty outbox and `publishedRevision` 97. The first restore was dispatched
through the probe's own handle on the store, which is the innermost store below
the middleware chain, so the recorder never saw it, no change reached the outbox
and no save left the browser: the object kept the typed value until it was
corrected by typing in the field the way a person would. The probe says so at
the seam now, because a test that can leave a live draft dirty without noticing
is worse than no test.

The draft's other fields carry other sessions' text (`Our services etst`,
`bebrnf` on `FaqSubtitle`) and were left exactly as they were found. Nothing was
written on limosen.

## Shipped 2026-09-08 in the evening, and read on the deployed booklimo.at

Everything this file records above was measured on a local production build. It
is deployed now, and the two readings this file owns were taken again on
`https://booklimo.at` as it is served to a person: the browser resolves the
name the way any browser does, there is no `gatsby serve` and no socat listener
in front of it, and the only thing the run brings of its own is the probe it
installs before the page's first script. The switch is `JAEN_LIVE=1` on
`tests/support/register-probe.py` and `tests/support/frame-drawer.py`, which is
the whole of the change to either of them.

The build is booklimo's own `scripts/deploy.sh`, app `1.9.2` at commit
`4409131`, `builtAt 2026-09-08T18:56:21Z`, carrying `packages/jaen/dist`,
`packages/gatsby-plugin-jaen/dist` and `packages/gatsby-source-jaen/dist` built
from this checkout at `091d3f1`. The runs are stored in `tests/ship/`.

### The storm at rest, on the deployed site

Two five second windows and then three of thirty, edit mode on and nobody
touching anything, signed in as the booklimo human admin against the deployed
`jaen-agent` 4.4.0. The gate of "The storm at its root" is met where a person
meets it.

| edit mode on, untouched        | two 5 s windows | three 30 s windows |
| ------------------------------ | --------------- | ------------------ |
| dispatches a second            | **0.0**         | **0.0**            |
| `localStorage` writes a second | **0.0**         | **0.0**            |
| bytes written                  | **0**           | **0**              |
| React commits a second         | 0.2             | 0.17               |
| animation frames a second      | 59.69, 59.52    | 59.78, 59.85       |
| a 50 ms `setTimeout` fires at  | 50 ms           | 50 ms              |
| editable fields on the page    | 43              | 43                 |

Edit mode off is the control and is the same zero at 59.92 frames a second. The
draft was `revision 121 = publishedRevision 121` with an empty outbox before and
after every window, and `connection: "socket"`, so the CMS was talking to the
object throughout and still dispatched nothing.

**One number is worse than the last reading of it and this file will not hide
it.** The blur to the next painted frame is 21.5 to 93.5 ms over sixteen blurs
in two live runs, median about 63, where the storm run measured 14.9 before its
fix and 20.6 after it. **It is not a live against local difference**, which is
the first thing that had to be ruled out and was: `09` run on a local
production build in the same hour measures a median of 71.8 ms over eight blurs
and 93.8 ms on its own acceptance scenario, which is the same spread or worse.
The dispatch count is zero in both, so it is not the storm coming back, and the
writes a blur causes are 3 and 8 KB in the four seconds after it against the
baseline's 185 and 14.4 MB.

What is different from the storm run's machine is the machine. A person's own
browsers were running on it throughout this run, about forty per cent of the
CPU across brave, chromium and a WebKit process, and the storm run saw the same
reading move from 0 ms to 51 to 75 ms in the one window it took "while the
machine was busier". So the likeliest cause is load and this run cannot prove
it, because it may not close somebody's browsers to take a measurement. The
cause is not established and the number is recorded rather than explained. At
rest there is also one long task of about 70 ms in every thirty second window,
which is the size and cadence of the poll's own tick with the socket up.

### The drawers, on the deployed site

The same gestures the section above drove on a local build, driven again on the
deployed site after a field was typed into, which is the state the owner
reported. Every gesture is `mouse.move`, `mouse.down`, `mouse.up` at the
button's own coordinates.

| what the owner's sentence asks               | on the deployed booklimo.at                                   |
| -------------------------------------------- | ------------------------------------------------------------- |
| the first click opens the drawer             | **40 of 40**, both drawers, at 1440x900 and at 390x844        |
| and it stays open                            | **40 of 40**, open at 0 ms from the mouse up in every one     |
| and nothing is remounted                     | **0** remounts and **0** DOM insertions of either trigger     |
| a drawer stands, the other button is clicked | **4 of 4** switched on one click                              |
| a drawer stands, its own button is clicked   | **10 of 10**, five per drawer                                 |
| a burst of four clicks                       | **24 of 24 clicks seen**, and the next click opened it 6 of 6 |
| under the storm, dispatched on purpose       | **20 of 20** opened on the first click, all stayed open       |
| a standing drawer under the storm            | still open after five seconds and **256 React commits**       |

The triggers read off the live DOM carry `data-scope="dialog"`,
`data-part="trigger"`, `aria-haspopup="dialog"` and `aria-expanded`, at 36x36 at
x 16 and x 1388. In all four crossings the window capture listener saw the
`pointerdown` and the document listener did not, which is the frame's router
taking the gesture, with `body` at `pointer-events: none` and `#___gatsby` at
`aria-hidden="true"` throughout: the page is still inert and what changed is who
gets the gesture.

The storm was reproduced rather than waited for, because there is none left to
wait for: **16,232 `pages/field_register` actions over 76 s**, 54.8 React
commits a second and 27.4 animation frames a second under it. Nothing of it
reached the agent, the outbox 0 and the draft `revision 122` before and after.

**A burst still ends with the drawer shut when it runs past the 400 ms settle
window**, which is the same reading as before and is a toggle toggling: at a
nominal 100 ms apart four clicks really span 391 to 426 ms and the drawer was
open at the end 2 of 3 times, and at 150 ms apart they span 539 to 565 ms and it
was open 0 of 3. Every click was seen in every one, and the next click opened it
every time.

**What the run left.** `FleetTitle` was typed into and set back, read back as
`Our fleet`, `revision 123`, `publishedRevision 121`, an empty outbox, nothing
published. Nothing was written on limosen.

### The three notebooks, run at the end of it

`tests/09-editing-latency.ipynb` **23 PASS 1 FAIL 4 SKIP 1 WARN**,
`tests/10-draft-persistence.ipynb` **41 PASS 0 FAIL 0 SKIP 1 WARN**, and
`tests/11-cms-frame.ipynb` **26 PASS 0 FAIL 0 SKIP 0 WARN**, all stored in
`tests/ship/` with the notebooks they came out of.

`09`'s FAIL is this file's own browser acceptance, the blur to the next painted
frame, and it stays red for the reason above. Its four SKIPs are `localBlur`,
the rollback, which cannot be measured on a build that carries the option. `10`
is unchanged from `tests/repaired/`.

**`11` lost its WARN, which is the one thing in this table that moved.** The
check is called "the storm is present, which is the condition the drawers work
under" and it read 58.4 commits a second, 29.4 frames a second and 3.2
`localStorage` writes a second when the drawers were built. It now reads **0.2
commits a second, 59.8 frames a second and 0.0 writes a second** and says the
storm is gone. The two pieces of work were built by two sessions that could not
see each other's result, and this is the reading where they meet.

### What is still not established

- **The blur to paint gap is worse than the last reading of it**, on the
  deployed site and on a local build alike, and load is the likeliest cause
  rather than a proven one. See above.
- **One machine, one browser, two widths.** Unchanged.
- **The state surviving an actual remount is still argued and not measured**,
  0 remounts in these 40 gestures as in the 40 before them.
- **The Fable 5.1 review of the editing path is still open**, and this run adds
  the deployed readings to what it has to read.

## Verified adversarially 2026-09-08 in the evening, on the deployed booklimo.at

An Opus session that built none of this. It read this file and
`draft-state.md`, `private-storage.md` and `okf/decisions/hard-rules.md`, then
took the two readings this file owns again rather than trusting the stored runs:
the drawers of `tests/11-cms-frame.ipynb` and the store at rest and the blur to
the next painted frame of `tests/09-editing-latency.ipynb`. Everything below was
measured on `https://booklimo.at` as it is served to a person, signed in as the
booklimo human admin, against the deployed `jaen-agent` 4.4.0 (`091d3f1`) and
the site build app `1.9.2` at `4409131`. No package of this checkout has changed
since that build, so the deployment is this tree. booklimo only. Nothing was
written on limosen and its draft object still answers revision 0.

The runs are in `tests/adversarial/` and the three probes beside them are
`tests/support/adversarial-frame-rest.py`, `adversarial-drawer-390.py`,
`adversarial-blur-cause.py`, `adversarial-blur-fields.py` and
`adversarial-blur-profiler.py`.

**A second session was writing to the same object throughout.** booklimo's
`publishedRevision` went 137, 153, 167, 183 and `discardedRevision` with it while
this run was measuring, which is another session publishing and discarding. So
every reading here is taken with the revision read immediately before and after
the act, and one of this run's own set-backs was completed by somebody else's
discard rather than by its own keystrokes. Two verifiers on one live object is
still not a measurement anybody should have to disentangle.

### The drawers hold, and the audit is of the raw gestures rather than the count

`tests/support/frame-drawer.py` under `JAEN_LIVE=1`, one run of 328 s, edit mode
on, 43 editable fields, after ` frame probe` was typed into `FleetTitle` and left,
which is the state the owner reported.

| what was asked                               | what the deployed site answered                        |
| -------------------------------------------- | ------------------------------------------------------ |
| 1440x900, the left drawer on the first click | **10 of 10** opened, 10 of 10 still open afterwards    |
| 1440x900, the right drawer                   | **10 of 10**, 10 of 10 still open                      |
| 390x844, the left drawer                     | **10 of 10**, 10 of 10 still open                      |
| 390x844, the right drawer                    | **10 of 10**, 10 of 10 still open                      |
| under the storm dispatched from the page     | **10 of 10** and **10 of 10**, both drawers at 1440    |
| a standing drawer through five seconds of it | still open after **257** React commits, **0** remounts |
| and nothing of the storm reached the agent   | outbox 0 and revision 138 before and after             |

The count is not what makes this hold, so the raw attempts were audited instead.
Before every one of the sixty gestures: **0** dialog content nodes standing,
`body` at `pointer-events: auto`, no `aria-hidden` on `#___gatsby`, and
`elementFromPoint` at the trigger's own centre was the trigger button itself. The
panel that answered was resolved through the trigger's own `aria-controls` and
counted only at `data-state="open"` with real geometry. The window capture
listener saw the `pointerdown` in every crossing. **0** mounts and **0** DOM
insertions of either trigger in all sixty.

One weakness of the instrument is worth naming because it looks stronger than it
is. `openBefore` reads the panel through the trigger's `aria-controls`, and while
a drawer is shut that attribute is absent, so `openBefore: false` would be
answered for a shut drawer and for a missing attribute alike. What actually
carries "it started shut" is the `dialogNodes: 0` beside it, which is read off
every `[data-part="content"]` on the page and does not go through the trigger.

**And the storm at 390, which nothing had measured.** `tests/11` drives the first
click at both widths and the storm at 1440 only, because the storm section runs
after the viewport has been put back, and this file records the narrow width as
something its reading does not cover. `tests/support/adversarial-drawer-390.py`
takes the two together: at 390x844, with **13,888** `pages/field_register`
actions dispatched into jaen's own store over 69.7 s (52.0 React commits a
second, 26.0 animation frames a second, 3.4 `localStorage` writes a second), the
left drawer opened on the first click **10 of 10** and the right **10 of 10**,
every one of the twenty from a page with no dialog standing and the trigger the
topmost element at its own centre. The outbox was 0 and the draft at revision 168
before and after the storm, so none of it reached the agent.

### The store at rest is zero, and two instruments say so

Three windows of thirty seconds with edit mode off and three with it on, rather
than the five second windows the ship run took, because with a socket up the poll
ticks about every thirty seconds and a five second window can sit between two
ticks.

| ninety seconds, untouched     | edit mode off  | edit mode on |
| ----------------------------- | -------------- | ------------ |
| dispatches                    | **0**          | **0**        |
| `localStorage` writes         | **0**          | **0**        |
| bytes written                 | **0**          | **0**        |
| animation frames a second     | 59.56 to 59.72 | 59.75        |
| a 50 ms `setTimeout` fires at | 50 ms          | 50 ms        |
| longest long task in a window | 59 to 102 ms   | 64 to 69 ms  |

The second instrument is independent of the first. The `setItem` counter is a
wrapper installed before any script of the page, and beside it the raw persisted
string is read at the start of each window and again at the end: **byte identical
in all six**, by length and by hash. A write the counter missed would still have
moved the payload.

The long task of about seventy milliseconds once or twice in every thirty second
window is present with edit mode off as well, so it is not the CMS's editing
path.

**And it is not a property of the home page.** Every zero this file has recorded
was taken on booklimo's `/` with edit mode on, and the remount that used to drive
the storm came out of the site's own `FooterWithLocale`, which is built from the
locale prefix. Fifteen second windows on three pages, edit mode on:
`/` (43 editable fields), `/de/` (43) and `/imprint/` (3), all **0.0 dispatches a
second and 0.0 writes a second**. The German locale, which is the one that makes
that component's prop differ, storms no more than the default one.

### The blur to the next painted frame is over one frame, and load is not why

Sixty blurs in three runs of twenty, on `FleetTitle` of the home page, edit mode
on. Ten of each run carry a real change (five add a character and five take it away
again, so the run ends at the value it found) and ten carry none at all.

| p95 of ten                | run A      | run B      | run C      |
| ------------------------- | ---------- | ---------- | ---------- |
| a blur with nothing typed | 69.7 ms    | 66.2 ms    | 59.0 ms    |
| a blur carrying a change  | 58.8 ms    | 66.4 ms    | 70.8 ms    |
| medians                   | 57.5, 51.6 | 58.8, 58.2 | 52.8, 54.5 |

**Every one of the sixty is over one frame at 16 ms**, and so are the twelve of a
fourth run taken beside them, whose lowest reading is 25.7 ms. The acceptance at
the top of this file is red where a person meets it.

Two things separate this from the causes this file has offered for it.

**It is not the persistence path and not the dispatches.** A blur with nothing
typed dispatches **0** actions and writes **0** bytes and costs the same 49 to
70 ms as one that dispatches four (`pages/field_write`, `remote/record`,
`remote/saveStarted`, `remote/saveSucceeded`) and writes two or three times.

**It is not the machine.** This file's last word on the cause is "load is the
likeliest cause and this run cannot prove it, because it may not close somebody's
browsers to take a measurement". Load does not have to be removed to be measured
around. Two controls were taken in the same page, the same browser session and
the same minutes as the blurs, with the person's own browsers running throughout
and the load average between 2.3 and 3.7 on a ten core machine:

| in the same page, the same minute                     | median  | p95     |
| ----------------------------------------------------- | ------- | ------- |
| a `requestAnimationFrame` asked for from a timer      | 15.0 ms | 16.9 ms |
| a real Tab that moves focus from one link to the next | 6.8 ms  | 15.2 ms |
| a real Tab that leaves a jaen field                   | 52.8 ms | 59.0 ms |

That is run C. Run B's two controls in its own minutes are a median of 15.3 ms
for the frame and 9.7 ms for the link against a blur of 58.8 ms, so the shape is
the same twice.

A page that hands an ordinary keystroke its next frame in seven milliseconds is
not a page that is short of frames. The forty to fifty milliseconds are spent on
the way out of a jaen field and nowhere else.

### The one instrument that could name the work changes the number

This is the finding this run did not expect and it is why the cause is still not
named. Five blurs measured with the V8 sampling profiler running across each of
them read a median of 14.5 ms, in the same hour as the runs above.

So the two were interleaved in one run, same field, same page, same minutes, ten
of each, alternating:

| twenty blurs, alternating             | median       | max     | over one frame |
| ------------------------------------- | ------------ | ------- | -------------- |
| with `Profiler.start` across the blur | **16.95 ms** | 29.1 ms | 8 of 10        |
| without it                            | **53.1 ms**  | 69.3 ms | 10 of 10       |

The profiler makes the gesture more than three times faster. Whatever the forty
milliseconds are, they are not ordinary main thread JavaScript, because attaching
a sampler that only adds work removes them. The self time the profiler did
collect over five blurs is about 28 ms in the app bundle and 18 ms in one vendor
chunk in total, which is a few milliseconds a blur and nowhere near the gap.

What that leaves, for whoever takes this: the gap is likelier to be a wait for a
frame that the renderer is not producing than a task it is busy with, and the
profiler's presence is exactly the kind of thing that keeps a renderer producing
frames. A reading taken with the profiler attached is therefore not the reading a
person gets, and `09`'s number should keep being taken without one.

### What was left, and what this run could not settle

- **The live draft is back at its published state.** Every field of booklimo's
  draft is the value the run found, `FleetTitle` is `Our fleet`, the site serves
  `Our fleet` and no probe marker appears anywhere in the served home page. The
  object stands at `revision 183 = publishedRevision 183`, which is where the
  other session's own discard left it rather than where this run put it.
- **Nothing was published and nothing was discarded by this run.** A discard
  would have corrected the stamp this run's set-backs moved, and it was not made:
  another session was demonstrably writing to the same object, and a discard
  taken a second after somebody else types refuses their save.
- **The cause of the blur gap is still not named**, only narrowed: not the store,
  not the dispatches, not the machine, and not visible to the profiler that could
  have named it.
- **One machine, one browser, two widths, one site.** Unchanged.
- **The Fable 5.1 review of the editing path is still open.**

## Repaired 2026-09-08 at night, and the forty milliseconds have a name

The section above this one ends with "the cause of the blur gap is still not
named, only narrowed: not the store, not the dispatches, not the machine, and
not visible to the profiler that could have named it". It has a name now, it
has two of them, and both are fixed. The blur to the next painted frame on a
local production build of booklimo.at is a **median of 10.9 to 13.3 ms over
four runs of ten gestures**, against 34 to 45 ms on the same build before the
repair and 72 to 76 ms on the deployed site.

The instrument that could not be used is worth saying first, because it is why
this took three sessions. The V8 sampling profiler makes this gesture more than
three times faster, so the reading taken with it attached is not the reading a
person gets. Two instruments that do not do that were used instead:
`PerformanceObserver` on **long animation frames**, which names a frame's
scripts and its phases without sampling the stack, and Chromium's own
**timeline trace** through CDP, including
`disabled-by-default-devtools.timeline.invalidationTracking`, which says which
element was invalidated and for what reason. Beside them, the method that
settles a cause rather than suggesting one: change one thing at a time in the
live DOM and take the same ten gestures again.

### What was measured, and in what order

`tests/support/blur-bisect.py`, ten real `Tab` gestures out of `FleetTitle` per
condition, nothing typed, the draft's revision read before and after. Every
condition is one change to the page as it stands, and the page is reloaded
between them.

| condition, on the deployed site | what it changed                                    | median  |
| ------------------------------- | -------------------------------------------------- | ------- |
| `base`                          | nothing                                            | 72.1 ms |
| `tab0`                          | every `tabindex="1"` became `tabindex="0"`         | 76.4 ms |
| `nospell`                       | `spellcheck=false` on all 43 editables             | 65.1 ms |
| `blurcall`                      | `activeElement.blur()`, no next element looked for | 33.5 ms |
| `link`                          | Tab from one link to the next, the control         | 6.1 ms  |
| `base` again                    | nothing                                            | 75.6 ms |

Two hypotheses died there. The **positive tabindex** every field carries
(`HighlightTooltip` renders `tabIndex={isEditing ? 1 : undefined}`) is a real
accessibility defect and is not this: turning all 54 of them into `0` made the
gesture slightly slower, not faster. **Spellcheck** on a contenteditable losing
focus is not it either. What the split does say is that the gesture has two
halves: a blur with nothing to focus afterwards cost 33.5 ms and the same blur
followed by focusing the next field cost 72, so the work is on both sides.

### The first name: the highlighter rebuilt itself on every focus

`packages/jaen/src/contexts/field-highlighter.tsx` created the frame element,
the tooltip's portal container and a `ResizeObserver` **inside every focus
handler**, and the blur that followed removed the frame from the document
again. A new container is a new React portal mount, so the tooltip, its two
tune selectors and their Chakra tooltips came down and went back up every time
the caret moved from one field to the next. And the provider handed
`value={{ref}}`, an object literal, to a context every field consumes, so every
render of the provider gave all 43 fields a new context value and re-rendered
every one of them. The provider renders on each focus.

The long animation frame entries said this before it was fixed: the focus
listener of the next field cost 23.8 to 28.3 ms with 13.4 to 17.4 ms of forced
style and layout inside it, and a `MessagePort.onmessage` in the framework
bundle, which is React's scheduler, cost 57.9 to 74.1 ms in the same frames.

What it does now: the frame and the tooltip's container are built once and
kept, hidden with `display: none` rather than removed, one `ResizeObserver` is
re-targeted rather than replaced, the tooltip is portalled into a container
that never changes and only its buttons are state, and the context value is
memoised. The same listener then costs 10.2 to 14.2 ms with 1.8 to 3.4 ms
forced, and the median gap fell from 72 to **38.5 ms**.

### The second name: `:has()` on the document root, and it is not jaen's

38 ms is still over two frames, and the trace named the rest exactly.

```
StyleRecalcInvalidationTracking  reason "Affected by :has()"  HTML
StyleRecalcInvalidationTracking  reason "Affected by :has()"  BODY
StyleRecalcInvalidationTracking  reason "Affected by :has()"  DIV#___gatsby
StyleRecalcInvalidationTracking  reason "Affected by :has()"  DIV#momo
UpdateLayoutTree                 elementCount 1369            27.3 ms
```

inside the `keydown` that leaves the field. `packages/gatsby-jaen-app/src/styles/app.css`
had eleven rules whose subject was `html:has(.jaen-app)`, `body:has(.jaen-app)`,
`#___gatsby:has(.jaen-app)` or `#momo:has(.jaen-app)`, and that sheet is
imported by `gatsby-ssr.tsx` and `gatsby-browser.tsx`, so it is loaded on
**every page of both marketing sites** and not only on the app's own. Chromium
marks the four subjects as affected by `:has()` and re-evaluates them whenever
anything anywhere in the document is inserted or removed. Invalidating `html`
is a style recalculation of the whole document, and the whole document on
booklimo's home page is 1369 elements.

Deleting those eleven rules from the live sheet changes not one computed style
on a page that has no `.jaen-app` on it, which is what makes it a clean
experiment rather than a different page:

| condition | what it changed                                  | median, two runs each |
| --------- | ------------------------------------------------ | --------------------- |
| `base`    | nothing                                          | 34.0, 35.8 ms         |
| `nohas`   | all eleven `:has(.jaen-app)` rules deleted       | **15.2, 16.1 ms**     |
| `nomomo`  | only the two `#coco`/`#momo` rules deleted       | 25.2, 17.9 ms         |
| `patched` | only the four `html:has(...) <descendant>` rules | 39.5, 37.2 ms         |
| `noid`    | the id taken off the highlighter's own tooltip   | 34.2, 38.3 ms         |

The last two rows are the ones worth keeping, because they are how a plausible
story was refused. The four rules whose subject is a _descendant_ of
`html:has(.jaen-app)` looked like the expensive ones and are not: removing them
alone moved nothing. Taking `id="momo"` off jaen's own tooltip, so that the
sheet's `#momo` rule could no longer name it, moved nothing either. What costs
is being a `:has()` subject at all: Chromium invalidates every element marked
for that invalidation set together, wherever the mutation happened.

The repair keeps every rule and changes what decides it. `AppShell` adds
`jaen-app-open` to the root element in a **layout effect**, which runs before
the paint of the commit that renders `.jaen-app` itself, so the rules start
applying no later than the marker they replace; the `/app` routes are client
only, so neither form of the selector matches before hydration. A class is
invalidated when the class changes and at no other time.

### Where the number stands

Four runs of ten gestures each on a local production build with both repairs
in, on booklimo's home page with edit mode on and 43 editable fields:

| run           | gaps, sorted                                         | median  | over one frame |
| ------------- | ---------------------------------------------------- | ------- | -------------- |
| base          | 5.7 8.0 9.4 10.1 10.7 11.0 11.6 11.9 12.7 **30.9**   | 10.9 ms | 1 of 10        |
| control       | 6.0 9.7 10.5 11.7 11.8 12.0 13.3 15.3 18.5 **42.6**  | 11.9 ms | 2 of 10        |
| base again    | 8.8 10.0 10.0 11.4 11.4 11.5 12.2 13.3 13.8 **35.9** | 11.5 ms | 1 of 10        |
| control again | 5.6 7.1 9.5 12.8 13.1 13.4 14.0 14.7 15.1 **50.2**   | 13.3 ms | 1 of 10        |

The `control` rows ran the `nohas` mutation, which now finds nothing to delete
and reports zero rules removed. They are in the table because a control that
reads the same as the subject is what says the sheet no longer carries the
rules, rather than a grep saying so.

**The one gesture in ten that is still slow is the first of each run**, 30.9 to
50.2 ms, and it is the same outlier this file reported in September as "the
first one or two blurs of a run are slower than the rest, because the field
highlighter builds its frame the first time a field is focused". It is now
literally that: `ensureRoots` creates the frame and the tooltip's container on
the first focus of a page and never again. It is not removed, and a person pays
it once per page rather than once per field.

### The behaviour, read rather than argued

Keeping DOM nodes that used to be thrown away is a behaviour change under a
speed change, so `tests/support/highlight-frame.py` reads the highlighter off
the page. Eleven checks, all green, on the local production build:

- nothing focused, no frame standing
- the first field focused, the frame's `top`, `left`, `width` and `height`
  equal to that field's own document rectangle **to the pixel** (685, 498, 443,
  33), the tooltip carrying its three actions with every one of them the
  topmost element at its own centre
- the second field focused, the frame moved to its rectangle (1164, 209, 89, 17) and the actions swapped
- exactly one frame and one tooltip container standing in every reading, which
  is the check that would have caught a leak
- focus off every field, the frame at `display: none`
- a navigation to `/imprint/` with a field focused, no frame left standing at
  the old page's coordinates, and the frame working again on the new page
- the draft's revision 285 before and 285 after, so nothing was written

### What this repair did not do, and what is still open

- **It did not touch the persistence path.** `persist-state.ts`,
  `remote-state.ts`, the outbox and the agent's save are untouched by both
  changes. Nothing here can lose an edit, because nothing here decides when one
  is written.
- **The positive tabindex stays.** `HighlightTooltip` puts `tabIndex={1}` on
  every editable field, which takes all 43 of them out of document order into a
  tab cycle that comes before the site's own navigation. It is measured here as
  not being a speed problem, and it is an accessibility defect that this run
  deliberately did not fix, because changing the tab order of every field of a
  CMS is a behaviour change that wants its own measurement.
- **`id="momo"` is used twice.** jaen's frame renders its header with that id
  (`slices/jaen-frame.tsx`) and the field highlighter's tooltip carries the same
  one. A duplicate id in one document is a defect on its own; it is measured
  here as not costing anything, and it is left.
- **The app package exists twice.** `packages/gatsby-jaen-app` here is the copy
  the two marketing sites link against and `app/` in the taxi checkout is the
  other. Only this copy is changed, and taxi-app needs
  `./scripts/sync-app.sh from-jaen` before its own build carries the repair.
- **The `:has()` finding is bigger than this gap.** Any DOM change anywhere on
  either site recalculated the style of the whole document, so it was not only
  the blur that paid: every hover of a field, every toast, every drawer and
  every render of the app's own screens paid it too. Only the blur was measured.
- **One machine, one browser, one width, one site.** Apple M1 Max under Asahi,
  headless chromium at 1440x900, booklimo's home page.

## The blur path changed again, 2026-09-08 in the evening

Not this file's work, and it is this file's subject, so it is recorded here and
measured in `docs/architecture/draft-state.md`, "A field sometimes reverts". The
owner reported a field resetting to the value it had before, that was reproduced
on demand on the live site, and one of its three mechanisms is in `TextField`
itself.

Three things about a field's own path are different.

**A field that has focus is never written from the outside.** The freeze that
kept the echo of a field's own dispatch out of `dangerouslySetInnerHTML` now
holds for every value while the caret is in the field, and the outside value is
painted when the person leaves. Measured before the change: another editor's
write replaced the sentence under the person's hands, the next two keystrokes
landed at position zero, and the two sides then alternated at four saves in
thirteen seconds.

**The debounce is flushed on the blur.** `handleTextSave` is still
`useDebouncedCallback(…, 500)` and still dispatches while a person types, and
leaving the field now takes what is in it at once instead of half a second
later. It closes the last of the window "The half second is closed" measured,
for the ordinary case of a person who leaves a field and then leaves the page,
and it is what keeps the render after the blur from painting a value that
arrived while they were typing.

**A field the person only clicked into writes nothing.** A blur dispatches only
when an `input` event has touched the field, because with the freeze in place
the DOM of an untouched field still holds the value from before another
editor's change and writing it back would take their work away with a click.

What this costs is one dispatch and one React render inside the blur handler's
own path, which is the path "The blur to the next painted frame is over one
frame" measures. The reading with the change in is reported with the run that
made it.

### The other blur, which is the one `09` decides on, and it is 114 ms

Everything above is a blur **with nothing typed**, which is the gesture that
isolates the cost of leaving a field from the cost of saving what was written
in it. `tests/09-editing-latency.ipynb` decides its browser acceptance on the
other one: it types six characters into a live field and leaves. That check
still fails, and it failed at **139.9 ms** on the build that carries both
repairs, where ten untyped blurs on the same build read a median of 11 to 14.

One reading cannot tell a regression from a sample, so
`tests/support/blur-typed.py` takes the same gesture ten times, alternating so
that five rounds add a character and five take it away and the field ends at
the value it was found at, which it did (read back out of a second browser that
had no memory of the run).

| ten change-carrying blurs | reading                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------- |
| median gap                | **114.2 ms**                                                                           |
| max                       | 129.6 ms                                                                               |
| over one frame            | 10 of 10                                                                               |
| main thread held          | 1.2 to 2.3 ms longer than the gap, so the gap **is** the task                          |
| dispatches per blur       | 4 (`pages/field_write`, `remote/record`, `remote/saveStarted`, `remote/saveSucceeded`) |
| React commits per blur    | **15 to 16**                                                                           |
| `localStorage` writes     | 0 or 1, which is the deferred single pass working                                      |

The long animation frame entry names one script and it is not ambiguous:
`DIV#___gatsby.onfocusout`, 96.6 to 123.8 ms, with 1.6 to 5.4 ms of forced
style and layout inside it. Chromium's trace agrees: the `focusout` dispatch
runs 139.5 ms and a single React call inside it takes 99.9 ms. Style is 9.6 ms
across six traced blurs now, against the 273 ms it was before the `:has()`
repair, so this is not the same cost wearing a different name. It is
JavaScript.

**Why it is synchronous, and why that is right.** Another session closed a hole
on the same day: a field's change used to sit in a 500 ms debounce, so a person
who typed and closed the tab lost it. `handleContentBlur` now calls
`handleTextSave.flush()` when the field is dirty, which puts the write, the
recorder's change and the flusher into the `focusout` event itself. React
treats `focusout` as discrete and flushes synchronously, so the whole chain and
its fifteen commits land in the gesture. An edit that is in the store before
the tab can die is worth more than a frame, and this file's own rule is that
where the plan and speed disagree the plan wins and where the plan and safety
disagree safety wins. So the number is recorded and the flush is not touched.

**What the next session should take.** Four dispatches producing fifteen to
sixteen React commits is the thing to attack, not the flush. One field's value
changing should cost one commit, and the difference between one and fifteen is
where the hundred milliseconds are. Nothing here has measured which components
those commits belong to; that is the first thing to instrument, and
`tests/support/blur-typed.py` already counts them per blur, so the comparison
before and after is a run of that file.

### The notebooks, run at the end of this repair

| notebook                   | PASS | FAIL | SKIP | WARN |
| -------------------------- | ---- | ---- | ---- | ---- |
| `09-editing-latency.ipynb` | 22   | 3    | 4    | 0    |
| `11-cms-frame.ipynb`       | 26   | 0    | 0    | 0    |

`11` is **26 / 0 / 0 / 0**, which is where the shipping run left it, and its
storm check reads 0.2 React commits a second, 60.0 frames a second and 0.0
`localStorage` writes a second with nobody typing.

`09`'s three FAILs are one of this file's and two that are not. The one is the
blur to the next painted frame, 139.9 ms, the section above. The other two are
its live-agent edit and the read-back of it, and they failed because a second
session was typing into the same field of the same live draft while the
notebook ran: the value it expected to find was gone by the time it looked, and
the value it did read back is the one that session had put there. Two verifiers
on one live object is not a measurement anybody should have to disentangle,
which this file has now said twice.

`10-draft-persistence.ipynb` was **not run**. Its notebook, its two harness
files and `packages/jaen/src/redux` were being edited by that other session
while this one worked, and executing a notebook somebody is halfway through
editing measures neither their work nor mine. It is named here as not run
rather than reported as green.

### The live draft, and what this run had to put back

`11`'s first run corrupted a field of the live booklimo draft and the notebook
caught it, which is the whole reason its set-back check reads the value back
instead of trusting the gesture. `AboutP2` on the home page went from
"...reliably economically and with comfort in mind..." to "...reliably
economica comfort in mind...", with the run's own `frame probe` suffix still
standing at the end. The cause is in `tests/support/frame-drawer.py`: it clicked
the field, pressed `End` and backspaced over the suffix, and `End` in a
contenteditable that **wraps** goes to the end of the visual line rather than
the end of the content, so the twelve backspaces ran in the middle of a
paragraph.

It was put back by hand, by typing the value the run had found over the field's
own selection, and read back out of a browser with no memory of the run:
`AboutP2` is the value that was there before, `.uejej` and all, which was
somebody else's unpublished edit and was left exactly as found rather than
tidied. The set-back in `frame-drawer.py` now selects the field's own contents
through the Selection API, which cannot reach outside the node the way
`Control+a` can, types the original over them, and types nothing at all if the
selection is not exactly the field's contents. `11` was re-run and its
set-back check passes on 214 of 214 characters selected inside the field.

One thing was learned the hard way and is written where the next reader will
look: `RESTORE` in `tests/support/register-probe.py` dispatches into the
**innermost** store, below the middleware, so it never reaches the recorder, the
outbox or the agent. Its own comment claimed the opposite while the comment
forty lines above it said so correctly. A first attempt to put `AboutP2` back
went through it, appeared to work in the tab, and left the object holding the
corrupted value. The misleading half is corrected.
