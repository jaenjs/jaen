"""What the renderer is doing between the blur and the frame, from its own trace.

The long animation frame entries name the scripts of a frame and nothing else,
and after the highlighter was repaired they say the scripts are 14 ms while the
frame still takes 50 to 90 ms. The remainder is not JavaScript, so it is read
here out of Chromium's own timeline trace, which attributes Blink's phases
(event dispatch, style, layout, paint, commit) as well as the script calls.

A trace is heavier than a `PerformanceObserver` and lighter than the V8 sampling
profiler, and the gap is reported beside every run so a reading taken while the
instrument perturbs the subject can be recognised as one.
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

CATEGORIES = [
    "devtools.timeline",
    "disabled-by-default-devtools.timeline",
    "disabled-by-default-devtools.timeline.frame",
    "blink.user_timing",
    "latencyInfo",
    # Names the reason a style recalculation was scheduled and the nodes it
    # touched, which is the difference between "style is 17 ms" and "this
    # selector on this element is 17 ms".
    "disabled-by-default-devtools.timeline.invalidationTracking"
]

ARM = """() => {
  if (window.__btListener) {
    document.removeEventListener('blur', window.__btListener, true)
  }
  window.__bt = {at: null, frameAt: null, origin: performance.timeOrigin}
  window.__btListener = () => {
    if (window.__bt.at !== null) return
    window.__bt.at = performance.now()
    requestAnimationFrame(() => { window.__bt.frameAt = performance.now() })
  }
  document.addEventListener('blur', window.__btListener, true)
  return true
}"""


async def main():
    from playwright.async_api import async_playwright
    out = {"origin": ORIGIN, "live": RP.LIVE, "startedAt": time.time(), "rounds": []}
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

        client = await context.new_cdp_session(page)
        for index in range(6):
            control = index >= 4
            if control:
                target = page.locator("a[href]").first
                try:
                    await target.focus(timeout=5000)
                except Exception:
                    break
            else:
                handle = await RP.first_written_field(page, timeout=5)
                if handle is None:
                    break
                await handle.click(timeout=5000)
            await page.wait_for_timeout(400)
            await page.evaluate(ARM)
            events = []
            # One handler per round and removed with the round: registering
            # without removing made every event of round n appear n times.
            handler = lambda payload: events.extend(payload["value"])
            client.on("Tracing.dataCollected", handler)
            await client.send("Tracing.start", {
                "transferMode": "ReportEvents",
                "traceConfig": {"includedCategories": CATEGORIES}})
            await page.keyboard.press("Tab")
            await page.wait_for_timeout(400)
            done = asyncio.get_event_loop().create_future()
            client.once("Tracing.tracingComplete", lambda _: done.set_result(True))
            await client.send("Tracing.end")
            try:
                await asyncio.wait_for(done, timeout=30)
            except asyncio.TimeoutError:
                pass
            client.remove_listener("Tracing.dataCollected", handler)
            await page.wait_for_timeout(200)
            reading = await page.evaluate("() => window.__bt")
            gap = (round(reading["frameAt"] - reading["at"], 2)
                   if reading and reading.get("frameAt") is not None else None)
            # The trace's clock is microseconds since an arbitrary origin; the
            # blur is placed in it by the first EventDispatch of type blur.
            blur_us = None
            for event in events:
                if event.get("name") == "EventDispatch" and \
                        (event.get("args", {}).get("data", {}) or {}).get("type") == "blur":
                    blur_us = event["ts"]
                    break
            window = []
            if blur_us is not None:
                for event in events:
                    ts = event.get("ts")
                    if ts is None or not (blur_us - 2000 <= ts <= blur_us + 200000):
                        continue
                    if event.get("ph") not in ("X", "B", "I"):
                        continue
                    window.append({
                        "name": event.get("name"),
                        "at": round((ts - blur_us) / 1000.0, 2),
                        "ms": round(event.get("dur", 0) / 1000.0, 2),
                        "data": {k: v for k, v in
                                 (event.get("args", {}).get("data", {}) or {}).items()
                                 if k in ("type", "functionName", "url", "frame",
                                          "elementCount", "nodeCount", "reason",
                                          "nodeName", "invalidationSet",
                                          "selectorPart", "extraData",
                                          "changedClass", "changedAttribute",
                                          "changedId", "subtree")},
                        "args": {k: v for k, v in (event.get("args") or {}).items()
                                 if k in ("elementCount", "counters")}
                    })
            window.sort(key=lambda item: item["at"])
            out["rounds"].append({"gap": gap, "control": control,
                                  "events": window[:1200],
                                  "traced": len(events)})
            print("gap %s ms, %d events in window" % (gap, len(window)), flush=True)
            await page.wait_for_timeout(600)
        await browser.close()
    site.stop()
    gaps = [r["gap"] for r in out["rounds"] if r["gap"] is not None]
    out["gapMedian"] = round(statistics.median(gaps), 2) if gaps else None
    # The heaviest named phases across the runs, so the answer is a name.
    total = collections.Counter()
    for round_ in out["rounds"]:
        for event in round_["events"]:
            if 0 <= event["at"] <= 120:
                total[event["name"]] += event["ms"]
    out["msByPhase"] = total.most_common(25)
    out["endedAt"] = time.time()
    target = HERE.parent / "adversarial" / (
        "blur-trace.json" if RP.LIVE else "blur-trace-local.json")
    target.write_text(json.dumps(out, indent=2))
    print("median gap", out["gapMedian"])
    for name, ms in out["msByPhase"][:20]:
        print("  %-40s %8.1f ms" % (name, ms))
    print("written", target)


if __name__ == "__main__":
    asyncio.run(main())
