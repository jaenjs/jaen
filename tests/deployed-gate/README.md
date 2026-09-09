# The revert gate on the deployed booklimo.at, 2026-09-09

`../revert/` reproduced the owner's "a field sometimes resets to the version it
had before" and named its three mechanisms. `../revert-gate/` is the fix, driven
on a local production build. This directory is the same instrument on the
**deployed** `https://booklimo.at`, after the build carrying the fix was
deployed, against the live `jaen-agent` 4.4.0, the live object and the live
identity server. See `docs/architecture/draft-state.md`, "Shipped 2026-09-09".

| file                                | what it is                                                                                                     |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `forced-a.json`, `forced-b.json`    | the first mechanism forced on the **deployed site**, twice: a read answered before a save, arriving after it   |
| `focused-a.json`, `focused-b.json`  | the second on the deployed site, twice: another editor writes the very field the caret is in                   |
| `forced.json`, `focused.json`       | the notebook's own two, which it drives with `JAEN_LIVE=0` on this checkout's production build                 |
| `draft-before.json`                 | every text field of the live draft as this run found it, taken by `support/draft-guard.py`                     |
| `draft-after.json`                  | the same after everything, field for field identical to it                                                     |
| `10-draft-persistence.ship.ipynb`   | the run, with its outputs                                                                                      |
| `10-draft-persistence.results.json` | the checks and their evidence                                                                                  |

`10-draft-persistence.ipynb` is **52 PASS 0 FAIL 0 SKIP 1 WARN**, the same
counts as `../revert-gate/` and now against the deployed build. Its one WARN is
the old one, that the store's write is asynchronous.

## The run before this one, which is why `support/editing-browser.py` moved

The first execution of the notebook on this build was **42 PASS 0 FAIL 10 SKIP**,
and every one of the ten skips said "the field carrying
`dudhdtttttOur fleet &nbsp;test &nbsp;dudhd` was not editable". That value is the
owner's own unpublished `FleetTitle`, the harness looked for the field by
comparing the store's raw value against the element's rendered text, and a value
carrying `&nbsp;` can never match. The scenarios skipped rather than damaging
anything, which is the good half; the bad half is that ten safety checks would
have gone on skipping silently. Both are repaired in `efc4ed6`: the harness types
into `FaqSubtitle`, the fixture this suite already uses, and finds a field by its
own id.

## What this run left on the live draft

`draft-after.json` equals `draft-before.json` field for field, the owner's
`FleetTitle` included, read back out of the object by `support/draft-guard.py`.
The object went from 376 to 400 against `publishedRevision` 183, which is where
every run since 2026-09-08 has found it. Nothing was published and nothing was
discarded. Nothing was written on limosen.
