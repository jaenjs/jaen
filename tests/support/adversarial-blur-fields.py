"""Whose blur is it: the same gesture on two different fields, interleaved.

`adversarial-blur-cause.py` measured five blurs at a median of 14.5 ms on the
first editable field of booklimo's home page in the same hour that
`adversarial-frame-rest.py` measured thirty blurs at a median of 53 to 58 ms on
`FleetTitle`, with the machine's own answer about frames unchanged between them.
Two readings that far apart on one page are either the field or the minute, and
the way to tell is to take them in one run, alternating, so the minute is the
same for both.

The blur is a Tab out of the field with nothing typed, which dispatches nothing
and writes nothing, so what is left is the CMS's own work on a focus change.
What receives focus afterwards is recorded, because a Tab that lands on another
editable field mounts a second field's highlighter and that is the obvious
candidate.
"""
import asyncio
import importlib.util
import json
import pathlib
import statistics
import time

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("register_probe", HERE / "register-probe.py")
RP = importlib.util.module_from_spec(spec)
spec.loader.exec_module(RP)

ARM = """() => {
  if (window.__advBlurListener) {
    document.removeEventListener('blur', window.__advBlurListener, true)
  }
  window.__advBlur = {at: null, frameAt: null, from: null}
  window.__advBlurListener = event => {
    if (window.__advBlur.at !== null) return
    const node = event.target
    window.__advBlur.from = node && node.closest ?
      ((node.closest('[id]') || {}).id || node.tagName) : null
    window.__advBlur.at = performance.now()
    requestAnimationFrame(() => { window.__advBlur.frameAt = performance.now() })
  }
  document.addEventListener('blur', window.__advBlurListener, true)
  return true
}"""

ACTIVE = """() => {
  const node = document.activeElement
  if (!node) return null
  return {tag: node.tagName, id: node.id || null,
          editable: node.getAttribute && node.getAttribute('contenteditable'),
          label: node.getAttribute && node.getAttribute('aria-label'),
          field: node.closest ? ((node.closest('[id]') || {}).id || null) : null}
}"""

FIELDS = """() => Array.from(document.querySelectorAll('[contenteditable="true"]'))
  .map((node, index) => {
    const box = node.getBoundingClientRect()
    return {index: index, id: (node.closest('[id]') || {}).id || null,
            text: (node.innerText || '').trim().slice(0, 40),
            x: box.x + box.width / 2, y: box.y + box.height / 2,
            top: box.top, height: box.height}
  })"""


async def one_blur(page, target):
    await page.evaluate("""(t) => window.scrollTo({top: Math.max(0, t), behavior: 'instant'})""",
                        target["absoluteTop"] - 300)
    await page.wait_for_timeout(400)
    fields = await page.evaluate(FIELDS)
    match = next((f for f in fields if f["id"] == target["id"]), None)
    if match is None or match["y"] < 0 or match["y"] > 850:
        return {"skipped": "the field is not on screen", "id": target["id"]}
    await page.mouse.click(match["x"], match["y"])
    await page.wait_for_timeout(500)
    focused = await page.evaluate(ACTIVE)
    await page.evaluate(RP.RESET)
    await page.evaluate(ARM)
    await page.keyboard.press("Tab")
    await page.wait_for_timeout(1500)
    reading = await page.evaluate("() => window.__advBlur")
    after = await page.evaluate(ACTIVE)
    probe = await page.evaluate(RP.READ_PROBE)
    tasks = probe.pop("longTasks", [])
    return {"id": target["id"], "text": match["text"],
            "focusedBefore": focused, "focusedAfter": after,
            "blurFrom": reading.get("from") if reading else None,
            "gapMs": (round(reading["frameAt"] - reading["at"], 2)
                      if reading and reading.get("at") is not None
                      and reading.get("frameAt") is not None else None),
            "dispatches": probe["dispatches"], "writes": probe["writes"],
            "longTaskMax": round(max([t["duration"] for t in tasks], default=0), 1)}


async def main():
    from playwright.async_api import async_playwright
    out = {"startedAt": time.time()}
    async with async_playwright() as pw:
        browser, context = await RP.new_browser(pw)
        page = await context.new_page()
        out["signedIn"] = await RP.sign_in(page)
        if not out["signedIn"]:
            print(json.dumps(out, indent=2))
            return
        await page.goto(RP.ORIGIN + "/", wait_until="domcontentloaded")
        await RP.wait_for_store(page)
        await context.add_init_script(RP.SET_EDITING_AT_BOOT)
        await page.reload(wait_until="domcontentloaded")
        await RP.wait_for_draft(page)
        await RP.wait_for_editable(page)
        await page.wait_for_timeout(4000)

        fields = await page.evaluate(FIELDS)
        for field in fields:
            field["absoluteTop"] = field["top"]
        out["fields"] = [{k: f[k] for k in ("index", "id", "text")} for f in fields[:8]]
        with_text = [f for f in fields if f["text"]]
        first = with_text[0]
        fleet = next((f for f in fields if (f["text"] or "").startswith("Our fleet")), None)
        scroll = await page.evaluate("() => window.scrollY")
        for field in fields:
            field["absoluteTop"] = field["top"] + scroll
        out["first"] = {k: first[k] for k in ("index", "id", "text")}
        out["fleet"] = {k: fleet[k] for k in ("index", "id", "text")} if fleet else None

        rounds = []
        for _ in range(6):
            for target in [f for f in (first, fleet) if f]:
                rounds.append(await one_blur(page, target))
        out["rounds"] = rounds
        await browser.close()
    for target in ("first", "fleet"):
        wanted = (out.get(target) or {}).get("id")
        gaps = [r["gapMs"] for r in out["rounds"]
                if r.get("id") == wanted and r.get("gapMs") is not None]
        out[target + "Summary"] = {
            "n": len(gaps), "gaps": gaps,
            "median": round(statistics.median(gaps), 2) if gaps else None,
            "max": max(gaps) if gaps else None}
    out["endedAt"] = time.time()
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
