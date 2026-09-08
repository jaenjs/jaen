# The runs of 09 and 10 after the draft became an object, 2026-09-08

`../baseline/` holds the two notebooks against the code as it stood before the
editing path was touched at all. This directory holds them against the code
after the shared draft stopped being the site's repository: a save writes the
site's Durable Object and bumps a revision, a publish writes the one migration
and the one commit, and the object pushes revisions over a WebSocket with the
poll left as the fallback.

The suite ignores `out/` and `results-*.json`, and these runs are copied here on
purpose: the review `docs/architecture/editing-performance.md` and
`docs/architecture/draft-state.md` both ask for needs the numbers in front of
it, and a run nobody can read afterwards is not evidence.

| notebook                     | PASS | FAIL | SKIP | WARN |
| ---------------------------- | ---- | ---- | ---- | ---- |
| `09-editing-latency.ipynb`   | 16   | 0    | 5    | 1    |
| `10-draft-persistence.ipynb` | 29   | 0    | 5    | 2    |

**What the baseline's red checks did.** `09`'s three acceptance checks are green:
one blur is one whole-store write rather than four, 1,312 B rather than 309,253,
and its p95 in node is 4.98 ms against one frame at 16. `10`'s two are green as
well: the catalogue is out of the persisted payload, and three field writes
120 ms apart are one call rather than three.

**One browser measurement was taken back.** `09` grew a `localBlur` mode: the
same field typed and left in the real CMS on a local production build of
booklimo.at signed in as the booklimo human admin, with `localStorage` as the
only store, because that is what a site without the `agent` option is and it is
exactly the browser side of `editing-performance.md`. A number nobody can take
any more is not an acceptance.

What it found. The escape holds: the built site carries no agent option, **no
request went to any agent host**, nothing was queued and the toolbar claims no
save because none was made. The edit reached `localStorage`, the field was set
back, and the value read out of an emptied browser is the one the run found. In
the four seconds after the blur the store was written **12 times and 33,873 B**,
against 185 and 187 times and 14.4 MB in the baseline.

And one WARN, which is the honest half of that measurement: the blur to paint
gap is **25.0 ms**, still over one frame at 16, against the baseline's 24.0 and
24.8 ms. Change 1 coalesced the writes and did not remove the dispatches. The
cause is the registration storm `editing-performance.md` already named, about
forty-seven store dispatches a second with edit mode on and nobody touching
anything, and it is React work rather than the persistence path. It is recorded
as a WARN rather than a FAIL because this file predicted it in as many words
before the change was made.

**What the five SKIPs are, and they are the honest part of this run.** Every one of them needs a live shared draft, and every one of them skips for the
same measured reason: the transition removed the `agent` option from both sites'
`gatsby-config.ts`, so a built site carries no shared draft to drive. The guard
reads the built bundle rather than a configuration file. The client's behaviour
against a real agent is therefore **not** measured here, and it cannot be until
the agent's own `draft`, `save` and `subscribe` land and a site carries the
option again. What is measured is what the client does against a stand in for
the object that behaves the way the design says the object does, including in
the two ways it is not supposed to: going away between two saves, and refusing
a socket.

**The two WARNs are the baseline's own.** The asynchronous writer leaves nothing
in storage in the dispatch's own frame, which is what change 1 of
`editing-performance.md` asks for and what its `visibilitychange` and `pagehide`
writers exist for, and the first retry after a failed save is at five seconds
rather than the two both documents claim, because `RETRY_SECONDS` is indexed
with a failure count that has already been incremented.

**The fixture moved.** These scenarios used to read
`booklimo.at/jaen-data/live.json` and `live-media.json` off the site. The
transition deleted both and kept them at `booklimo.at-transition-before.head/`,
and the notebooks merge those two into one draft, which is the shape the
object's own `snapshot(site)` answers. The store it produces is 77,096 B against
the baseline's 77,090, and the catalogue is 99.0% of it either way, so the
numbers are comparable with the baseline line for line.

Taken on an Apple M1 Max under Asahi, node v24.13.0, headless chromium.
