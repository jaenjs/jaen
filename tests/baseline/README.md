# The baseline runs of 09 and 10, 2026-09-08

The two notebooks of `docs/architecture/editing-performance.md`, executed by
papermill against the code as it stood before the change, with their outputs
kept. The suite ignores `out/` and `results-*.json`, and these two runs are
copied here on purpose: the review that file asks for needs the numbers in
front of it, and a run nobody can read afterwards is not evidence.

Both runs end red. `09` fails its three acceptance checks (the main-thread
block in node, the blur to paint gap, and the number of whole-store writes one
blur causes), `10` fails the two that belong to changes 2 and 3 of the plan
(the catalogue is still persisted, three field writes are still three commits).
Everything else in `10` is green, which is the CMS's promise as it already
stands.

Taken on an Apple M1 Max under Asahi, node v24.13.0, headless chromium 151,
against booklimo's own draft and the live `jaen-agent.booklimo.at`.
