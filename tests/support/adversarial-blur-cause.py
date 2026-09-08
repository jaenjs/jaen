"""Two things `editing-performance.md` leaves open, put to the deployed site.

**Is the storm's zero a property of the home page or of the CMS?** Every
reading of "0.0 dispatches a second at rest" in that file was taken on
booklimo's home page with edit mode on. The remount that used to drive the
storm came out of the site's own `FooterWithLocale`, which is built from the
locale prefix, so a second locale's page is the cheapest reading that could
tell a fixed loop from a page that happens not to have one. This takes the same
window on `/de/` and on `/imprint/`.

**What is the fifty to seventy milliseconds a blur costs?** That file has
carried the blur to the next painted frame as over one frame since its baseline
and its last word on the cause is "load is the likeliest cause and this run
cannot prove it". Load is measurable from inside and is measured beside this in
`adversarial-frame-rest.py`. What is measured here is the work itself: the V8
sampling profiler is run over a handful of real blurs through CDP and the self
time is added up per function, so the answer is a name and not an inference.

Nothing is typed. A blur with nothing to dispatch costs the same as one that
carries a change, which is itself one of the readings, so the profile is taken
over the gesture that writes nothing at all.
"""
import asyncio
import collections
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

ARM = """() => {
  if (window.__advBlurListener) {
    document.removeEventListener('blur', window.__advBlurListener, true)
  }
  window.__advBlur = {at: null, frameAt: null}
  window.__advBlurListener = () => {
    if (window.__advBlur.at !== null) return
    window.__advBlur.at = performance.now()
    requestAnimationFrame(() => { window.__advBlur.frameAt = performance.now() })
  }
  document.addEventListener('blur', window.__advBlurListener, true)
  return true
}"""


async def at_rest(page, seconds):
    await page.evaluate(RP.RESET)
    await page.wait_for_timeout(int(seconds * 1000))
    reading = await page.evaluate(RP.READ_PROBE)
    tasks = reading.pop("longTasks", [])
    return {"seconds": round(reading["elapsed"], 1),
            "dispatches": reading["dispatches"],
            "dispatchesPerSecond": round(reading["dispatches"] / reading["elapsed"], 3),
            "types": reading["types"],
            "registerFields": reading["registerFields"],
            "writes": reading["writes"],
            "writesPerSecond": round(reading["writes"] / reading["elapsed"], 3),
            "commitsPerSecond": round(reading["commits"] / reading["elapsed"], 2),
            "framesPerSecond": round(reading["frames"] / reading["elapsed"], 2),
            "isEditing": reading["isEditing"],
            "longTaskMax": round(max([t["duration"] for t in tasks], default=0), 1)}


def self_time(profile):
    """Milliseconds of self time per function, out of a V8 sampling profile."""
    nodes = {node["id"]: node for node in profile["nodes"]}
    hits = collections.Counter()
    deltas = profile.get("timeDeltas") or []
    samples = profile.get("samples") or []
    for index, node_id in enumerate(samples):
        hits[node_id] += deltas[index] if index < len(deltas) else 0
    per_frame = collections.Counter()
    for node_id, micros in hits.items():
        frame = nodes.get(node_id, {}).get("callFrame", {})
        name = frame.get("functionName") or "(anonymous)"
        url = (frame.get("url") or "").rsplit("/", 1)[-1]
        per_frame["%s  %s:%s" % (name, url, frame.get("lineNumber"))] += micros
    return [(key, round(value / 1000.0, 2))
            for key, value in per_frame.most_common(25)]


async def main():
    from playwright.async_api import async_playwright
    out = {"origin": ORIGIN, "startedAt": time.time()}
    async with async_playwright() as pw:
        browser, context = await RP.new_browser(pw)
        page = await context.new_page()
        out["signedIn"] = await RP.sign_in(page)
        if not out["signedIn"]:
            print(json.dumps(out, indent=2))
            return
        await page.goto(ORIGIN + "/", wait_until="domcontentloaded")
        await RP.wait_for_store(page)
        await context.add_init_script(RP.SET_EDITING_AT_BOOT)

        # ---- the same window on three pages ----
        out["pages"] = {}
        for path in ("/", "/de/", "/imprint/"):
            await page.goto(ORIGIN + path, wait_until="domcontentloaded")
            await RP.wait_for_draft(page)
            await RP.wait_for_editable(page)
            await page.wait_for_timeout(4000)
            out["pages"][path] = {
                "url": page.url,
                "editableFields": await page.locator('[contenteditable="true"]').count(),
                "window": await at_rest(page, 15)}

        # ---- the profile of a blur, on the home page ----
        await page.goto(ORIGIN + "/", wait_until="domcontentloaded")
        await RP.wait_for_draft(page)
        await RP.wait_for_editable(page)
        await page.wait_for_timeout(3000)
        client = await context.new_cdp_session(page)
        await client.send("Profiler.enable")
        await client.send("Profiler.setSamplingInterval", {"interval": 100})
        gaps = []
        profiles = []
        for _ in range(5):
            handle = await RP.first_written_field(page, timeout=5)
            if handle is None:
                break
            await handle.click(timeout=5000)
            await page.wait_for_timeout(500)
            await page.evaluate(ARM)
            await client.send("Profiler.start")
            await page.keyboard.press("Tab")
            await page.wait_for_timeout(500)
            answer = await client.send("Profiler.stop")
            reading = await page.evaluate("() => window.__advBlur")
            if reading and reading.get("at") is not None and reading.get("frameAt") is not None:
                gaps.append(round(reading["frameAt"] - reading["at"], 2))
            profiles.append(answer["profile"])
            await page.wait_for_timeout(800)
        out["profiledGaps"] = gaps
        out["profiledGapMedian"] = round(statistics.median(gaps), 2) if gaps else None

        merged = collections.Counter()
        for profile in profiles:
            for key, ms in self_time(profile):
                merged[key] += ms
        out["selfTimeMs"] = [[key, round(value, 2)] for key, value in merged.most_common(25)]
        out["profiles"] = len(profiles)
        await browser.close()
    out["endedAt"] = time.time()
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
