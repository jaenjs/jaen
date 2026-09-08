# The gate on the field that reverted, 2026-09-08 in the evening

`../revert/` is the nine runs that reproduced the owner's "a field sometimes
resets to the version it had before" on the deployed `booklimo.at` and named its
three mechanisms. This directory is the same instrument with the fix in, on
**this checkout's own production build** of booklimo.at served under its own
name against the live `jaen-agent`, the live object and the live identity
server. See `docs/architecture/draft-state.md`, "Repaired 2026-09-08 in the
evening".

| notebook                     | PASS | FAIL | SKIP | WARN |
| ---------------------------- | ---- | ---- | ---- | ---- |
| `10-draft-persistence.ipynb` | 52   | 0    | 0    | 1    |
| `09-editing-latency.ipynb`   | 22   | 3    | 4    | 0    |

`10` is the notebook of this work and it is green, with the two scenarios this
run added, `staleReadRace` in node and the browser's `forced` and `focused`
beside it. Its one WARN is the old one, that the store's write is asynchronous.

`09` is the latency notebook and it is not this run's subject. Its three FAILs
are one number and one harness fault, and neither is the fix:

- **the blur to paint gap**, 103.8 ms against one frame at 16, which
  `editing-performance.md` names and which was 93.8 ms in `../ship/` before this
  change. The same run measured a blur that dispatches nothing at **13.8 ms**
  against `../ship/`'s 71.8 ms, so the machine, which was building and driving
  browsers throughout, moves this number further than the change does. It is
  reported rather than argued away.
- **two set-back checks**, and they are a fault of `support/editing-browser.py`
  worth its own line. Its `blur` scenario types into whichever field the theme
  renders first, which on this draft is the owner's own unpublished `FleetTitle`,
  and it finds the field to set back by comparing the store's **raw** value with
  the element's rendered text. That value carries `&nbsp;`, the comparison can
  never match, and the set-back is skipped without a word: two runs left
  ` probe probe` on the owner's field. It was set back through the agent by hand
  and read back byte for byte. A run that writes on a live draft must restore
  through the agent and read back, which is what `--restore` of
  `support/revert-probe.py` does.

## The files

| file                              | what it is                                                                          |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| `forced-a.json`, `forced.json`    | the first mechanism forced, twice: a read answered before a save, arriving after it |
| `focused-a.json`, `focused.json`  | the second, twice: a hydrate while the caret is in the field                        |
| `draft-after.json`                | the whole draft as this run left it, revision 332                                   |
| `10-draft-persistence.gate.ipynb` | the run, with its outputs                                                           |
| `*.results.json`                  | the checks and their evidence                                                       |

`09`'s notebook is not stored because the run that produced its results was
followed by a second that was stopped part way through; the results file is the
complete one.

## What this run left on the live draft

Every field's value is byte for byte what `../revert/draft-before-203.json`
holds, the owner's four unpublished fields included, compared field by field.
`publishedRevision` is 183 throughout, nothing was published and nothing was
discarded. The object went from 203 to 332.

What did move is the authorship stamp of four fields, and it cannot be put back
because the object stamps the writer of every write: `FleetTitle` and `AboutP2`
were the owner's and are now a test account's, and `FaqSubtitle` and
`ServicesSubtitle` carry a newer instant of the account that already held them.
The two fixture fields are this suite's own. The two of the owner's are the
`09` fault above, and they are the reason it is written down here rather than
noted in passing.
