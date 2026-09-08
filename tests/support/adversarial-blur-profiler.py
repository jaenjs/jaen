"""The observer effect, put to the test, because it decides what the number is.

`adversarial-blur-cause.py` measured five blurs at a median of 14.5 ms with the
V8 sampling profiler running over each one, in the same hour that three runs of
ten blurs without it measured medians of 53 to 58 ms on the same field of the
same page. If the profiler is what moves the number, then the one instrument
that could name the work also destroys the reading, and that is worth knowing
before anybody profiles this again.

So the two are interleaved in one run: ten blurs with `Profiler.start` and
`Profiler.stop` around them and ten without, alternating, same field, same
minute, same browser. Nothing is typed, so no dispatch and no write is involved
in either.
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
  window.__advBlur = {at: null, frameAt: null}
  window.__advBlurListener = () => {
    if (window.__advBlur.at !== null) return
    window.__advBlur.at = performance.now()
    requestAnimationFrame(() => { window.__advBlur.frameAt = performance.now() })
  }
  document.addEventListener('blur', window.__advBlurListener, true)
  return true
}"""


async def one(page, client, profiled):
    handle = await RP.first_written_field(page, timeout=5)
    if handle is None:
        return {"skipped": "no field"}
    await handle.click(timeout=5000)
    await page.wait_for_timeout(500)
    await page.evaluate(RP.RESET)
    await page.evaluate(ARM)
    if profiled:
        await client.send("Profiler.start")
    await page.keyboard.press("Tab")
    await page.wait_for_timeout(1200)
    if profiled:
        await client.send("Profiler.stop")
    reading = await page.evaluate("() => window.__advBlur")
    probe = await page.evaluate(RP.READ_PROBE)
    tasks = probe.pop("longTasks", [])
    return {"profiled": profiled,
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
        client = await context.new_cdp_session(page)
        await client.send("Profiler.enable")
        await client.send("Profiler.setSamplingInterval", {"interval": 100})
        rounds = []
        for index in range(20):
            rounds.append(await one(page, client, index % 2 == 0))
        out["rounds"] = rounds
        await browser.close()
    for profiled in (True, False):
        gaps = [r["gapMs"] for r in out["rounds"]
                if r.get("profiled") is profiled and r.get("gapMs") is not None]
        out[("profiled" if profiled else "plain") + "Summary"] = {
            "n": len(gaps), "gaps": gaps,
            "median": round(statistics.median(gaps), 2) if gaps else None,
            "max": max(gaps) if gaps else None,
            "overOneFrame": len([g for g in gaps if g > 16.0])}
    out["endedAt"] = time.time()
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
