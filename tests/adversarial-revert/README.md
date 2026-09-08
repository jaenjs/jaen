# The revert gate, verified adversarially on the live booklimo.at, 2026-09-09

An Opus session that built none of it. Every run is against the deployed
`https://booklimo.at` and the deployed `jaen-agent` 4.4.0 (`091d3f1`,
built `2026-09-08T18:49:12Z`), signed in as the booklimo human admin.
booklimo only; nothing was written on limosen, whose draft object still
answers `revision 0`.

The verifier is `../support/adversarial-revert-live.py`. It writes no
credential into any of these files.

| file                          | the run                                                                |
| ----------------------------- | ---------------------------------------------------------------------- |
| `draft-before.json`           | every text field of the object before anything was typed, revision 400 |
| `smoke-forced.json`           | one forced round, to prove the instrument before the twenty            |
| `forced20.json`               | the forced race twenty times in one session, 20 of 20, 0 reverts       |
| `two-browsers.json`           | two browsers, two humans, two fields, six rounds                       |
| `focused-same.json`           | the caret in the field while the other editor writes that very field   |
| `plain-five.json`             | five fields typed and left, then a reload                              |
| `readback-third-context.json` | a third fresh context and the object, while the five markers stood     |
| `readback-setback.json`       | the same after the set-back, all nine fields                           |
| `draft-after.json`            | the field-by-field proof that the draft is what it was, revision 486   |

Fixture fields: `FaqSubtitle` and `ServicesSubtitle`, and for the plain path
`ServicesTitle`, `FeedbackBoxText` and `FaqTitle` beside them. The owner's own
unpublished `FleetTitle`, `AboutP1`, `AboutP2` and `AboutP3` were read and
never written, and are byte for byte what this run found.
