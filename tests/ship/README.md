# The runs of the shipping session, 2026-09-08 in the evening

`../baseline/` is the two editing notebooks against the code as it stood before
the editing path was touched. `../draft-object/` is them against the redesigned
code with nothing deployed, `../deployed/` the first run where both halves were
real, `../repaired/` the run after the loss an adversarial session found.
`../register/` is the storm before and after its fix, `../frame/` the drawers.
This directory is the run that deployed all of it: `jaen-agent` 4.4.0 with
discard in it, and both sites rebuilt on the client that speaks to it.

## The notebooks

| notebook                     | PASS | FAIL | SKIP | WARN |
| ---------------------------- | ---- | ---- | ---- | ---- |
| `09-editing-latency.ipynb`   | 23   | 1    | 4    | 1    |
| `10-draft-persistence.ipynb` | 41   | 0    | 0    | 1    |
| `11-cms-frame.ipynb`         | 26   | 0    | 0    | 0    |

`09`'s FAIL is the blur to the next painted frame, 93.8 ms against one frame at
16, which is the acceptance this file's own `editing-performance.md` says stays
red and whose cause it names. Its four SKIPs are the `localBlur` scenario, the
rollback, which can only be measured on a build that carries no `agent` option.
Its WARN is the longest long task in the second after a click on a field, 52 to
68 ms.

`10` is unchanged from `../repaired/`: 41 / 0 / 0 / 1, the WARN being that the
store's write is asynchronous by design and is therefore not in storage in the
dispatch's own frame.

`11` is **26 / 0 / 0 / 0**, where `../frame/` was 25 / 0 / 0 / 1. The WARN that
is gone is "the storm is present, which is the condition the drawers work
under": the same check now reads 0.2 commits a second, 59.8 frames a second and
0.0 `localStorage` writes a second with nobody typing, and reports that the storm
is gone.

Run with `jupyter nbconvert --to notebook --execute --allow-errors` from
`tests/`, against the deployed `jaen-agent` 4.4.0 (commit `091d3f1`) and a local
production build of booklimo.at served under its own name, signed in as the
booklimo human admin. Nothing was written on limosen.

## The readings taken on the deployed site itself

The three the owner's sentence asks about, read on `https://booklimo.at` as it
is served to a person rather than on a local build. `JAEN_LIVE=1` is the switch
on the two probes.

| file                            | what it is                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `storm-live.json`               | `register-probe.py`, two five second windows: 0 dispatches, 0 writes, 0 bytes with edit mode on              |
| `storm-live-soak.json`          | the same at thirty seconds a window, three of them: the same zero                                            |
| `frame-live.json`               | `frame-drawer.py`: 40 of 40 first clicks, 4 of 4 crossings, 10 of 10 closes, the storm dispatched on purpose |
| `discard-live.json`             | `discard-live.py`: discard driven from the item in the frame's menu, with the object read beside the browser |
| `draft-before-publish-120.json` | the whole draft as it stood before this run published, kept because five fields held another session's text  |
| `publish-121.json`              | the publish that gave discard a published state to restore to                                                |

`discard-live.json` has the booklimo human admin's Zitadel `sub` replaced by
`<sub of the booklimo human admin>`. The display name is left, because what the
discard promises is that it says who, and this repository is public.

## What the runs left on the live site

`booklimo.at`'s draft object at `revision 137 = publishedRevision 137`, nothing
differing from the published state, an empty outbox, and the site serving what it
served before the session. `limosen.at`'s object answers `revision 0`,
`publishedRevision 0`, `updatedAt null`: nothing was ever written on it.
