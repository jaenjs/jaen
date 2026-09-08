"""The gate's own gesture, ten times: a blur that carries a change.

`tests/09-editing-latency.ipynb` decides its browser acceptance on ONE blur,
taken right after six characters were typed into a live field, and it read
139.9 ms on the build that carries the repair of
`docs/architecture/editing-performance.md` while ten blurs with nothing typed
read a median of 11 to 14 ms on the same build. One reading cannot tell a
regression from a sample, so this takes the same gesture ten times.

The rounds alternate: five add one character and five take it away again, so the
run ends at the value it found. The value is read back at the end out of the
draft and printed beside the value found at the start, and the run refuses to
type at all if it cannot select the field's own contents.

Nothing but that one field is touched. The draft's revision is recorded before
and after, and it moves, because typing into a live field is what this measures.
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

ORIGIN = RP.ORIGIN
FIELD = "FleetTitle"

ARM = """() => {
  if (window.__btpListener) {
    document.removeEventListener('blur', window.__btpListener, true)
  }
  if (window.__btpObserver) {
    try { window.__btpObserver.disconnect() } catch (error) {}
  }
  window.__btp = {at: null, frameAt: null, taskEnd: null, loaf: [], writes: []}
  const setItem = window.__btpSetItem || Storage.prototype.setItem
  window.__btpSetItem = setItem
  Storage.prototype.setItem = function (key, value) {
    const started = performance.now()
    const answer = setItem.call(this, key, value)
    if (window.__btp) {
      window.__btp.writes.push({at: Math.round(started * 10) / 10,
                                ms: Math.round((performance.now() - started) * 10) / 10,
                                bytes: String(value).length})
    }
    return answer
  }
  try {
    window.__btpObserver = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (window.__btp.at === null) continue
        window.__btp.loaf.push({
          start: Math.round(entry.startTime * 10) / 10,
          duration: Math.round(entry.duration * 10) / 10,
          renderStart: Math.round(entry.renderStart * 10) / 10,
          scripts: (entry.scripts || []).map(script => ({
            invoker: script.invoker,
            duration: Math.round(script.duration * 10) / 10,
            forced: Math.round(script.forcedStyleAndLayoutDuration * 10) / 10,
            source: (script.sourceURL || '').split('/').pop()
          }))
        })
      }
    })
    window.__btpObserver.observe({type: 'long-animation-frame', buffered: false})
  } catch (error) {
    window.__btp.loafError = String(error)
  }
  window.__btpListener = () => {
    if (window.__btp.at !== null) return
    window.__btp.at = performance.now()
    setTimeout(() => { window.__btp.taskEnd = performance.now() }, 0)
    requestAnimationFrame(() => { window.__btp.frameAt = performance.now() })
  }
  document.addEventListener('blur', window.__btpListener, true)
  return true
}"""

CARET_END = """(id) => {
  const node = document.getElementById(id)
  if (!node) return false
  node.focus()
  const range = document.createRange()
  range.selectNodeContents(node)
  range.collapse(false)
  const selection = window.getSelection()
  selection.removeAllRanges()
  selection.addRange(range)
  return true
}"""

VALUE = """(id) => {
  const P = window.__jaenProbe
  const s = P && P.store ? P.store.getState() : null
  const f = s?.page?.pages?.nodes?.['JaenPage /']?.jaenFields?.['IMA:TextField']?.[id]
  const node = document.getElementById(id)
  return {store: f ? f.value : null,
          dom: node ? (node.innerText || '').trim() : null,
          revision: s?.remote?.revision,
          publishedRevision: s?.remote?.publishedRevision,
          outbox: (s?.remote?.outbox || []).length}
}"""


async def settle(page, seconds=20):
    for _ in range(seconds):
        await page.wait_for_timeout(1000)
        state = await page.evaluate(RP.READ_STATE)
        remote = (state or {}).get("remote") or {}
        if not (remote.get("outbox") or []) and remote.get("saveState") in ("saved", "idle"):
            return True
    return False


async def main():
    from playwright.async_api import async_playwright
    out = {"origin": ORIGIN, "live": RP.LIVE, "field": FIELD,
           "startedAt": time.time(), "rounds": []}
    site = RP.Site()
    async with async_playwright() as pw:
        browser, context = await RP.new_browser(pw)
        page = await context.new_page()
        out["signedIn"] = await RP.sign_in(page)
        if not out["signedIn"]:
            site.stop()
            print(json.dumps(out, indent=2))
            return
        await page.goto(ORIGIN + "/", wait_until="domcontentloaded")
        await RP.wait_for_store(page)
        await context.add_init_script(RP.SET_EDITING_AT_BOOT)
        await page.goto(ORIGIN + "/", wait_until="domcontentloaded")
        await RP.wait_for_draft(page)
        await RP.wait_for_editable(page)
        await page.wait_for_timeout(3000)

        out["found"] = await page.evaluate(VALUE, FIELD)
        print("found:", json.dumps(out["found"])[:200], flush=True)
        if out["found"]["dom"] is None:
            await browser.close(); site.stop()
            print("the field is not on the page"); return

        for index in range(10):
            adding = index % 2 == 0
            await page.locator('[id="%s"]' % FIELD).first.click()
            await page.wait_for_timeout(500)
            if not await page.evaluate(CARET_END, FIELD):
                break
            if adding:
                await page.keyboard.type("x", delay=40)
            else:
                await page.keyboard.press("Backspace")
            await page.evaluate(ARM)
            await page.evaluate(RP.RESET)
            await page.keyboard.press("Tab")
            await page.wait_for_timeout(1500)
            counted = await page.evaluate(RP.READ_PROBE)
            reading = await page.evaluate("() => window.__btp")
            gap = (round(reading["frameAt"] - reading["at"], 2)
                   if reading and reading.get("frameAt") is not None else None)
            block = (round(reading["taskEnd"] - reading["at"], 2)
                     if reading and reading.get("taskEnd") is not None else None)
            await settle(page, 20)
            value = await page.evaluate(VALUE, FIELD)
            out["rounds"].append({
                "adding": adding, "gap": gap, "block": block,
                "dom": value["dom"], "revision": value["revision"],
                "dispatches": counted.get("dispatches"),
                "types": counted.get("types"),
                "commits": counted.get("commits"),
                "storeWrites": len(reading.get("writes") or []),
                "storeBytes": sum(w["bytes"] for w in (reading.get("writes") or [])),
                "loaf": reading.get("loaf") or []})
            print("%s gap %s ms, block %s, %s dispatches, %s commits, %s writes"
                  % ("add   " if adding else "remove", gap, block,
                     counted.get("dispatches"), counted.get("commits"),
                     len(reading.get("writes") or [])), flush=True)

        await settle(page, 30)
        out["left"] = await page.evaluate(VALUE, FIELD)
        await browser.close()

        # A browser with no memory of the run, which is what proves the set-back.
        browser2, context2 = await RP.new_browser(pw)
        page2 = await context2.new_page()
        await RP.sign_in(page2)
        await context2.add_init_script(RP.SET_EDITING_AT_BOOT)
        await page2.goto(ORIGIN + "/", wait_until="domcontentloaded")
        await RP.wait_for_draft(page2)
        await page2.wait_for_timeout(6000)
        out["readBack"] = await page2.evaluate(VALUE, FIELD)
        await browser2.close()
    site.stop()
    gaps = [r["gap"] for r in out["rounds"] if r["gap"] is not None]
    out["gapMedian"] = round(statistics.median(gaps), 2) if gaps else None
    out["gapMax"] = max(gaps) if gaps else None
    out["overOneFrame"] = len([g for g in gaps if g > 16])
    out["setBack"] = (out.get("readBack") or {}).get("store") == (out["found"] or {}).get("store")
    out["endedAt"] = time.time()
    target = HERE.parent / "adversarial" / (
        "blur-typed.json" if RP.LIVE else "blur-typed-local.json")
    target.write_text(json.dumps(out, indent=2))
    print("median %s ms, max %s, over one frame %s of %s, set back %s"
          % (out["gapMedian"], out["gapMax"], out["overOneFrame"], len(gaps), out["setBack"]))
    print("found  ", repr((out["found"] or {}).get("store"))[:120])
    print("read back", repr((out.get("readBack") or {}).get("store"))[:120])
    print("written", target)


if __name__ == "__main__":
    asyncio.run(main())
