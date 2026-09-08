"""Snapshot the live draft's text fields, and put back anything a run moved.

Why this exists, and it is not a convenience. `tests/revert-gate/README.md`
records two notebook runs of this suite writing into the owner's own
unpublished `FleetTitle` and failing to set it back without a word: the
harness sets a field back by typing and finds the field to restore by
comparing the store's **raw** value against the element's rendered text, and
the owner's value carries `&nbsp;`, so the comparison can never match. Two
runs left ` probe probe` standing on his field.

The invariant of `docs/architecture/draft-state.md` is that an edit a person
made is never lost, so a run that drives a browser over a live draft carries
its own restore rather than trusting the harness's. This one does not depend
on a browser, on a rendered string or on any comparison the harness makes: it
reads every text field of the object before the run, reads them again after,
and writes back through the agent's own `save` every value that differs,
reading each one back out of the object byte for byte.

    python3 draft-guard.py before <file>
    python3 draft-guard.py after  <file>     # restores and reports

`after` exits non-zero when a field could not be put back, which is the one
outcome a run must not walk away from.
"""
import importlib.util
import json
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("revert_probe", HERE / "revert-probe.py")
RP = importlib.util.module_from_spec(spec)
spec.loader.exec_module(RP)


def read():
    token = RP.load_tokens()
    answer = RP.draft(token)
    return token, answer, RP.draft_fields(answer)


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "before"
    path = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else "draft-guard.json")
    token, answer, fields = read()

    if mode == "before":
        path.write_text(json.dumps(
            {"revision": answer["revision"],
             "publishedRevision": answer["publishedRevision"],
             "fields": fields}, indent=1))
        print("before: revision %s, %d field(s) -> %s"
              % (answer["revision"], len(fields), path))
        return 0

    kept = json.loads(path.read_text())
    moved = {name: value for name, value in kept["fields"].items()
             if fields.get(name) != value}
    added = sorted(set(fields) - set(kept["fields"]))
    report = {"revisionBefore": kept["revision"],
              "revisionAfter": answer["revision"],
              "moved": sorted(moved), "added": added, "restored": {}}

    for name, wanted in moved.items():
        RP.write_field(token, name, wanted)
    if moved:
        _, answer, fields = read()
        for name, wanted in moved.items():
            report["restored"][name] = {
                "was": kept["fields"][name][:120],
                "readBack": fields.get(name, "")[:120],
                "ok": fields.get(name) == wanted}
        report["revisionAfter"] = answer["revision"]

    ok = all(entry["ok"] for entry in report["restored"].values())
    report["ok"] = ok
    print(json.dumps(report, indent=1))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
