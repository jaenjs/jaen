# The run of the blur repair, 2026-09-09 at night

`../ship/` is the shipping session's run and `../adversarial/` the readings that
found this repair. This directory is the run after it: the field highlighter
stops rebuilding its frame on every focus, and `app.css` stops making `html`,
`body`, `#___gatsby` and `#momo` the subjects of a `:has(.jaen-app)` on every
page of both sites.

| notebook                   | PASS | FAIL | SKIP | WARN |
| -------------------------- | ---- | ---- | ---- | ---- |
| `09-editing-latency.ipynb` | 22   | 3    | 4    | 0    |
| `11-cms-frame.ipynb`       | 26   | 0    | 0    | 0    |

`11` is green, where the first run of it in this session was 24 / 2: one of
those two FAILs was a second session moving the draft's revision under the
storm window, and the other was this run's own set-back deleting twelve
characters out of the middle of a live field. Both are written up in
`docs/architecture/editing-performance.md`; the set-back is repaired in
`support/frame-drawer.py` and the field was put back and read back.

`09`'s three FAILs are one of the editing path's and two of the collision. The
one is the blur to the next painted frame, 139.9 ms on a single
change-carrying blur, which `support/blur-typed.py` re-took ten times as a
median of 114.2 ms. The other two are its live edit and the read-back of it,
which a second session was typing into while the notebook ran.

`10-draft-persistence.ipynb` was not run: its notebook, its harness and
`packages/jaen/src/redux` were being edited by that other session at the time.

Run with `jupyter nbconvert --to notebook --execute --allow-errors` from
`tests/`, against the deployed `jaen-agent` 4.4.0 and a local production build
of booklimo.at served under its own name, signed in as the booklimo human
admin. Nothing was written on limosen.
