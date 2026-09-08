"""Adversarial re-measurement of the two readings `editing-performance.md` owns.

This file trusts nothing in `tests/09` or `tests/11` beyond the browser plumbing
it reuses (the sign in, the edit-mode init script, the probe): every number it
prints is taken again here, on the deployed `https://booklimo.at`, signed in as
the booklimo human admin, against the deployed agent.

What it measures, and why each is shaped the way it is.

**The store at rest.** Three windows with edit mode off and three with it on,
thirty seconds each rather than five, because with a socket up the poll ticks
every thirty seconds and a five second window can sit entirely between two
ticks. Two instruments answer the same question: the `localStorage.setItem`
counter of `register-probe.py`, and, independently of it, the raw persisted
string read at the start of the window and again at the end. A write that the
counter missed would still change the payload; a payload that is byte for byte
what it was is the corroboration.

**The blur to the next painted frame.** Ten blurs and not one, each of them
carrying a real change, because the acceptance of `editing-performance.md` is
about the blur a person makes after typing and a blur with nothing to dispatch
is a different gesture. The rounds alternate: five add one character to the
field and five take it away again, so the tenth blur leaves the field at the
value the run found. Beside them, ten blurs with nothing typed, which is what
`register-probe.py` measures, so the two shapes can be compared rather than
confused.

Nothing is published. The one field this run touches is set back and read back
out of the object with a credential of the run's own.
"""
import asyncio
import importlib.util
import json
import os
import pathlib
import statistics
import sys
import time
import urllib.request

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location(
    "register_probe", HERE / "register-probe.py")
RP = importlib.util.module_from_spec(spec)
spec.loader.exec_module(RP)

ORIGIN = RP.ORIGIN
PERSIST_KEY = RP.PERSIST_KEY
AGENT = "https://jaen-agent.booklimo.at/graphql"
SITE = "booklimo.at"

# The raw persisted payload, which is the instrument that does not depend on
# the setItem wrapper having been installed first.
RAW = """() => {
  try {
    const raw = localStorage.getItem('%s')
    if (raw === null) return null
    let hash = 5381
    for (let i = 0; i < raw.length; i++) hash = ((hash * 33) ^ raw.charCodeAt(i)) >>> 0
    return {length: raw.length, hash: hash}
  } catch (error) { return {error: String(error)} }
}""" % PERSIST_KEY

# One blur, armed for exactly one gesture, with the listener taken off again so
# ten rounds are ten independent readings and not ten listeners racing.
ARM = """() => {
  if (window.__advBlurListener) {
    document.removeEventListener('blur', window.__advBlurListener, true)
  }
  window.__advBlur = {at: null, frameAt: null, taskEnd: null}
  window.__advBlurListener = () => {
    if (window.__advBlur.at !== null) return
    window.__advBlur.at = performance.now()
    setTimeout(() => { window.__advBlur.taskEnd = performance.now() }, 0)
    requestAnimationFrame(() => { window.__advBlur.frameAt = performance.now() })
  }
  document.addEventListener('blur', window.__advBlurListener, true)
  return true
}"""

READ_BLUR = "() => window.__advBlur"

FIELD_TEXT = """(stem) => {
  const nodes = Array.from(document.querySelectorAll('[contenteditable="true"]'))
  for (const node of nodes) {
    const text = (node.innerText || '').trim()
    if (text.startsWith(stem)) {
      const box = node.getBoundingClientRect()
      return {text: text, x: box.x + box.width / 2, y: box.y + box.height / 2}
    }
  }
  return null
}"""


def agent(query, variables, token):
    body = json.dumps({"query": query, "variables": variables}).encode()
    request = urllib.request.Request(
        AGENT, data=body,
        headers={"content-type": "application/json",
                 "authorization": "Bearer " + token,
                 "user-agent": "adversarial-frame-rest/1"})
    with urllib.request.urlopen(request, timeout=60) as answer:
        return json.loads(answer.read())


def draft(token):
    return agent(
        "query($s:String!){draft(site:$s){revision publishedRevision "
        "discardedRevision updatedAt full delta{pages}}}", {"s": SITE}, token)


def field_of(answer, name):
    pages = (((answer.get("data") or {}).get("draft") or {}).get("delta")
             or {}).get("pages") or {}
    for node in pages.values():
        for fields in ((node or {}).get("jaenFields") or {}).values():
            entry = fields.get(name)
            if entry and isinstance(entry.get("value"), str):
                return entry["value"]
    return None


async def window_at_rest(page, seconds):
    before = await page.evaluate(RAW)
    await page.evaluate(RP.RESET)
    await page.wait_for_timeout(int(seconds * 1000))
    reading = await page.evaluate(RP.READ_PROBE)
    after = await page.evaluate(RAW)
    tasks = reading.pop("longTasks", [])
    return {
        "seconds": round(reading["elapsed"], 2),
        "dispatches": reading["dispatches"],
        "dispatchesPerSecond": round(reading["dispatches"] / reading["elapsed"], 3),
        "types": reading["types"],
        "writes": reading["writes"],
        "writesPerSecond": round(reading["writes"] / reading["elapsed"], 3),
        "bytes": reading["bytes"],
        "commitsPerSecond": round(reading["commits"] / reading["elapsed"], 2),
        "framesPerSecond": round(reading["frames"] / reading["elapsed"], 2),
        "isEditing": reading["isEditing"],
        "timerMedian": reading["timerMedian"],
        "timerMax": reading["timerMax"],
        "longTaskCount": len(tasks),
        "longTaskMax": round(max([t["duration"] for t in tasks], default=0), 1),
        "payloadBefore": before,
        "payloadAfter": after,
        "payloadUnchanged": before == after
    }


async def blur_round(page, stem, typed):
    """One click, an optional keystroke, one Tab, and the frame after it."""
    found = await page.evaluate(FIELD_TEXT, stem)
    if not found:
        return {"skipped": "the field was not found"}
    await page.mouse.click(found["x"], found["y"])
    await page.wait_for_timeout(500)
    if typed == "add":
        await page.keyboard.press("End")
        await page.keyboard.type("x", delay=0)
        await page.wait_for_timeout(150)
    elif typed == "remove":
        await page.keyboard.press("End")
        await page.keyboard.press("Backspace")
        await page.wait_for_timeout(150)
    await page.evaluate(RP.RESET)
    await page.evaluate(ARM)
    await page.keyboard.press("Tab")
    await page.wait_for_timeout(4000)
    reading = await page.evaluate(READ_BLUR)
    probe = await page.evaluate(RP.READ_PROBE)
    tasks = probe.pop("longTasks", [])
    return {
        "typed": typed,
        "before": found["text"],
        "gapMs": (round(reading["frameAt"] - reading["at"], 2)
                  if reading and reading.get("at") is not None
                  and reading.get("frameAt") is not None else None),
        "blockMs": (round(reading["taskEnd"] - reading["at"], 2)
                    if reading and reading.get("at") is not None
                    and reading.get("taskEnd") is not None else None),
        "sawBlur": bool(reading and reading.get("at") is not None),
        "dispatches": probe["dispatches"],
        "types": probe["types"],
        "writes": probe["writes"],
        "bytes": probe["bytes"],
        "longTaskMax": round(max([t["duration"] for t in tasks], default=0), 1),
        "after": (await page.evaluate(FIELD_TEXT, stem) or {}).get("text")
    }



# The control the blur reading needs, taken in the same page, the same browser
# and under the same machine load as the blur itself.
#
# `editing-performance.md` records the blur to paint gap as over one frame in
# every reading it has ever taken and names machine load as "the likeliest
# cause" without being able to prove it. Load is measurable from inside: if the
# next painted frame is a frame away from an ordinary task and fifty
# milliseconds away from a blur, the fifty are the blur's own work and not the
# machine's.
#
#   idle  a `requestAnimationFrame` asked for from a timer callback, which is
#         the page's own answer about how far the next frame is
#   link  a real Tab keystroke that moves focus from one link to the next, so
#         a keydown, a focus change and a rendering step, with no jaen field
#         anywhere in it
CONTROL = """({n}) => new Promise(resolve => {
  const out = {idle: [], link: [], focused: null, error: null}
  const idle = (left, done) => {
    if (left <= 0) return done()
    const started = performance.now()
    requestAnimationFrame(() => {
      out.idle.push(Number((performance.now() - started).toFixed(2)))
      setTimeout(() => idle(left - 1, done), 300)
    })
  }
  const links = Array.from(document.querySelectorAll('a[href]'))
    .filter(node => node.getBoundingClientRect().width > 0)
  try { if (links[0]) { links[0].focus(); out.focused = document.activeElement.tagName } } catch (error) { out.error = String(error) }
  const onKey = () => {
    const started = performance.now()
    requestAnimationFrame(() => {
      out.link.push(Number((performance.now() - started).toFixed(2)))
    })
  }
  document.addEventListener('keydown', onKey, true)
  window.__advControlDone = () => {
    document.removeEventListener('keydown', onKey, true)
    resolve(out)
  }
  idle(n, () => {})
})"""

READ_CONTROL = "() => window.__advControlDone()"


def percentile(values, share):
    if not values:
        return None
    ordered = sorted(values)
    index = min(len(ordered) - 1,
                max(0, int(round(share * (len(ordered) - 1)))))
    return ordered[index]


async def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--stem", default="Our fleet")
    parser.add_argument("--windows", type=int, default=3)
    parser.add_argument("--seconds", type=float, default=30.0)
    parser.add_argument("--rounds", type=int, default=10)
    parser.add_argument("--control", type=int, default=0)
    parser.add_argument("--out", default="")
    args = parser.parse_args()

    RP.load_env("tokens.env")
    token = os.environ.get("TAXI_TOKEN_ADMIN_BOOKLIMO", "")

    out = {"origin": ORIGIN, "startedAt": time.time(), "stem": args.stem}
    out["draftBefore"] = {k: v for k, v in
                          ((draft(token).get("data") or {}).get("draft") or {}).items()
                          if k != "delta"} if token else None
    out["fieldBefore"] = field_of(draft(token), "FleetTitle") if token else None

    from playwright.async_api import async_playwright
    async with async_playwright() as pw:
        browser, context = await RP.new_browser(pw)
        page = await context.new_page()
        out["signedIn"] = await RP.sign_in(page)
        if not out["signedIn"]:
            print(json.dumps(out, indent=2))
            return

        # ---- edit mode off, at rest ----
        await context.add_init_script(RP.CLEAR_EDITING_AT_BOOT)
        await page.goto(ORIGIN + "/", wait_until="domcontentloaded")
        await RP.wait_for_store(page)
        await page.reload(wait_until="domcontentloaded")
        await RP.wait_for_draft(page)
        await page.wait_for_timeout(4000)
        out["editOff"] = [await window_at_rest(page, args.seconds)
                          for _ in range(args.windows)]

        # ---- edit mode on, at rest ----
        await context.add_init_script(RP.SET_EDITING_AT_BOOT)
        await page.reload(wait_until="domcontentloaded")
        await RP.wait_for_draft(page)
        out["editable"] = await RP.wait_for_editable(page)
        out["fields"] = await page.locator('[contenteditable="true"]').count()
        await page.wait_for_timeout(4000)
        out["editOn"] = [await window_at_rest(page, args.seconds)
                         for _ in range(args.windows)]

        state = await page.evaluate(RP.READ_STATE)
        out["remoteAtRest"] = {k: v for k, v in
                               ((state or {}).get("remote") or {}).items()
                               if k in ("revision", "publishedRevision",
                                        "saveState", "connection")}

        # ---- the control, on the same page under the same load ----
        if args.control:
            # The in-page promise runs until it is told to resolve, so it is
            # started as a task and the Tab presses happen beside it.
            pending = asyncio.ensure_future(
                page.evaluate(CONTROL, {"n": args.rounds}))
            await page.wait_for_timeout(1500)
            for _ in range(args.rounds):
                await page.keyboard.press("Tab")
                await page.wait_for_timeout(400)
            await page.wait_for_timeout(1500)
            await page.evaluate(READ_CONTROL)
            out["control"] = await pending
            await page.keyboard.press("Escape")
            await page.wait_for_timeout(500)

        # ---- ten blurs with nothing typed ----
        out["blurUntyped"] = [await blur_round(page, args.stem, None)
                              for _ in range(args.rounds)]

        # ---- ten blurs each carrying a change, ending where it began ----
        typed = []
        for index in range(args.rounds):
            typed.append(await blur_round(
                page, args.stem, "add" if index % 2 == 0 else "remove"))
        out["blurTyped"] = typed

        await page.wait_for_timeout(6000)
        state = await page.evaluate(RP.READ_STATE)
        out["remoteAtEnd"] = {k: v for k, v in
                              ((state or {}).get("remote") or {}).items()
                              if k in ("revision", "publishedRevision",
                                       "saveState", "connection")}
        out["outboxAtEnd"] = len(((state or {}).get("remote") or {}).get("outbox") or [])
        out["fieldOnScreen"] = (await page.evaluate(FIELD_TEXT, args.stem) or {}).get("text")
        await browser.close()

    if token:
        answer = draft(token)
        out["draftAfter"] = {k: v for k, v in
                             ((answer.get("data") or {}).get("draft") or {}).items()
                             if k != "delta"}
        out["fieldAfter"] = field_of(answer, "FleetTitle")

    for name in ("idle", "link"):
        values = (out.get("control") or {}).get(name) or []
        out.setdefault("controlSummary", {})[name] = {
            "n": len(values), "values": values,
            "median": round(statistics.median(values), 2) if values else None,
            "p95": percentile(values, 0.95),
            "max": max(values) if values else None}

    for name in ("blurUntyped", "blurTyped"):
        gaps = [r["gapMs"] for r in out.get(name, []) if r.get("gapMs") is not None]
        out[name + "Summary"] = {
            "n": len(gaps), "gaps": gaps,
            "median": round(statistics.median(gaps), 2) if gaps else None,
            "p95": percentile(gaps, 0.95),
            "max": max(gaps) if gaps else None,
            "overOneFrame": len([g for g in gaps if g > 16.0])
        }
    out["endedAt"] = time.time()
    text = json.dumps(out, indent=2)
    if args.out:
        pathlib.Path(args.out).write_text(text)
    print(text)


if __name__ == "__main__":
    asyncio.run(main())
