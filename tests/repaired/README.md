# The runs of 09 and 10 after the repair, 2026-09-08

`../baseline/` is the two notebooks against the code as it stood before the
editing path was touched. `../draft-object/` is them against the redesigned
code with nothing deployed. `../deployed/` is the first run where both halves
were real, `jaen-agent` 4.0.0 on Cloudflare and booklimo's build carrying the
`agent` option again. This directory is the run after the repair of the loss an
adversarial session found on the deployed site, against `jaen-agent` 4.3.0 and
a booklimo build carrying the repaired client.

| notebook                     | PASS | FAIL | SKIP | WARN |
| ---------------------------- | ---- | ---- | ---- | ---- |
| `09-editing-latency.ipynb`   | 17   | 1    | 4    | 0    |
| `10-draft-persistence.ipynb` | 41   | 0    | 0    | 1    |

`10` was 35 / 0 / 0 / 2 in `../deployed/`. Six checks are new and one WARN is
gone.

## What is new in 10, and it is the whole point of the run

The `losses` scenario, five checks, on the deployed booklimo.at:

- the edit is in `localStorage` the moment the tab goes, **0 ms** after the
  blur, **300 ms** after it, and with the caret still in the field and no blur
  at all;
- the object has it once the tab comes back, in all three;
- a real `page.close()` with the caret in the field leaves the typed value in
  `localStorage`, one change in the outbox, and the object takes it the moment
  the CMS is signed in again;
- the field is set back and read out of a browser whose storage was emptied.

Every one of those was a **loss** before this repair, measured the same way on
2026-09-08 and written up in `docs/architecture/draft-state.md`, "The one that
failed".

`run_safety` also hides the tab with nothing waited out now. It waited 700 ms,
past the field's own 500 ms debounce, so its own hidden-tab and reload checks
were taken outside the window in which the loss happened.

The WARN that went is the first retry after a failed save, which was five
seconds where all three documents say two, because `RETRY_SECONDS` was indexed
with a failure count the catch had already incremented. The WARN that stays is
the asynchronous storage write, which is change 1 of
`editing-performance.md` working as designed.

## 09's one FAIL is the one it had, and its number moved by noise

`a blur is painted within one frame`, the acceptance
`editing-performance.md` names and whose cause it also names, the registration
storm rather than the persistence path. It was red in `../deployed/` at
24.3 ms and it is red here.

The reading is noisier than it looks and this run says so rather than picking
its best one. Three notebook runs of this same scenario measured **26.2**,
**26.0** and **25.2 ms**, and the scenario run on its own on a quiet machine
measured **24.4**. Against 24.0 and 24.8 in `../baseline/`, 25.0 with no agent
and 24.3 in `../deployed/`. The client now dispatches while a person types,
which is the repair, and it cannot land in this measurement: the scenario types
and blurs at once, so the field's debounce has not fired when the blur arrives
and the blur replaces it. What is honest is that the numbers overlap and that
nobody should read 1 ms of this as a change.

Beside it, in the four seconds after a blur: **12 store writes and 13,590 B**,
against the baseline's 185 writes and 14.4 MB and `../deployed/`'s 13 and
9,054 B.

## How they were run

`jupyter nbconvert --to notebook --execute`, from `tests/`, against the
deployed `jaen-agent` 4.3.0 (commit `542819d`) and a local production build of
booklimo.at served under its own name, signed in as the booklimo human admin.
09 needs `--allow-errors` to store its notebook because its last cell asserts a
green run. Nothing was written on limosen.
