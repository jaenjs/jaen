# The runs of 09 and 10 against the deployed agent, 2026-09-08

`../baseline/` is the two notebooks against the code as it stood before the
editing path was touched. `../draft-object/` is them against the redesigned code
with **nothing deployed**: the agent ran under `wrangler dev` on this machine and
neither site carried the `agent` option, so every browser check that needed a
shared draft skipped. This directory is the first run where both halves are
real: `jaen-agent` 4.0.0 on Cloudflare with its Durable Object namespace, and
booklimo's own deployed build carrying the option again.

| notebook                     | PASS | FAIL | SKIP | WARN |
| ---------------------------- | ---- | ---- | ---- | ---- |
| `09-editing-latency.ipynb`   | 17   | 1    | 4    | 0    |
| `10-draft-persistence.ipynb` | 35   | 0    | 0    | 2    |

## What is new, and it is the whole point of the run

`10` has **no SKIPs at all**. The five it carried in `../draft-object/` were its
browser half, and every one of them now runs against the live object: the socket
comes up, a second editor's field is read out of the store, the token never
travels on the socket, a refused socket leaves the client on the poll, and the
live field is set back to the value the run found. `09`'s `blur` runs for the
same reason, and the value it reads back out of an emptied browser came from the
Durable Object and from nowhere else.

## The one FAIL, which is not new

`09`, "a blur is painted within one frame": **24.3 ms** against one frame at 16.
The baseline measured 24.0 and 24.8 ms and the run with no agent 25.0, so the
shared draft costs nothing here and the gap is what it always was. Its cause is
named in `docs/architecture/editing-performance.md`: with edit mode on and
nobody touching anything, a text field's registration effect dispatches the store
about forty-seven times a second, and the deferred single pass persist hides the
cost of those writes without removing the dispatches or the React work they drag.
It is red rather than warned here because the acceptance is written against the
target, and this run did not fix it.

## The four SKIPs of 09

All four are `localBlur`, the rollback scenario, and it can only be measured on a
build that carries no `agent` option. It was measured on 2026-09-08 against the
build the transition left behind and its numbers are in
`docs/architecture/editing-performance.md`. On a build that carries the option
the scenario would be measuring something else while claiming to measure the
escape, so it says so instead.

## Two bugs in the harness this run found, both of which hid a green check

**`has_agent` could only ever answer false.** It asked the page for
`typeof __JAEN_AGENT__`, and that is a webpack define: it is substituted for its
literal value at compile time and never exists as a runtime global, so a
`page.evaluate` outside webpack is answered `undefined` on every build including
one that carries the option. Ten checks skipped with "this build carries no agent
option" against a build that carried one. It reads the built bundle now, which is
what the notebook's own `AGENT_IN_BUILD` always did.

**Edit mode could not be entered while the agent was up.** The harness put
`status.isEditing` into the persisted store and reloaded. The store persists
itself on every dispatch and the poll dispatches every 1,500 ms, so the running
page wrote its own `isEditing: false` over the edit inside a second: five
readings in five seconds, all false, with no reload in between. On a site with no
agent nothing dispatches and the same edit survived, which is why this worked
until the agent came back. The flag goes in through an init script now, which
runs before any script of the page and therefore before the store is created.

Neither is a fault of jaen. Both are the kind of thing that turns a real check
into a silent skip, which is why they are written down here.

## The two WARNs of 10

Unchanged from `../draft-object/`: a hidden tab has the edit in storage within the
idle deadline rather than in the dispatch's own frame, which is what an
asynchronous writer means; and the first retry after a failed save is at five
seconds rather than the two both architecture documents claim, because
`RETRY_SECONDS` is indexed with a failure count that has already been
incremented. Nothing is lost by either, the queue only waits longer than the
documents say.
