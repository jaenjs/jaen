"""The one combination nothing has measured: the storm at 390.

`tests/11-cms-frame.ipynb` drives the first click at 1440 and at 390, and it
drives the storm at 1440 only, because the storm section runs after the
viewport has been put back. A narrow screen is where the two panels and the two
triggers sit differently, which
`docs/architecture/editing-performance.md` names as something its reading does
not cover, so this run takes the two together: the store dispatched into in a
loop from the page, at 390x844, after a field was typed.

It reuses `frame-drawer.py` for the sign in, the edit mode, the gesture and the
open detection, so what is new here is the order and nothing about the
instrument. The field is set back and read back.
"""
import asyncio
import importlib.util
import json
import pathlib
import time

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("frame_drawer", HERE / "frame-drawer.py")
FD = importlib.util.module_from_spec(spec)
spec.loader.exec_module(FD)


async def main():
    from playwright.async_api import async_playwright
    report = {"origin": FD.ORIGIN, "live": FD.LIVE, "startedAt": time.time(),
              "viewport": "390x844"}
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=[])
        context = await browser.new_context(
            viewport={"width": 390, "height": 844}, ignore_https_errors=True,
            locale="de-AT", timezone_id="Europe/Vienna")
        await context.add_init_script(FD.PROBE)
        page = await context.new_page()
        report["signedIn"] = await FD.sign_in(page)
        if report["signedIn"]:
            report["editing"] = {"entered": await FD.editing_on(page)}
            await page.wait_for_timeout(4000)
            report["editing"]["editableFields"] = await page.locator(
                '[contenteditable="true"]').count()
            report["trigger"] = {
                "left": await page.evaluate(FD.TRIGGER_FACTS, FD.LEFT),
                "right": await page.evaluate(FD.TRIGGER_FACTS, FD.RIGHT)}

            target = await page.evaluate(FD.TYPE_TARGET, FD.FIELD_STEM)
            report["typed"] = {"target": target}
            original = None
            if target.get("x") is not None:
                original = target["text"]
                await page.mouse.click(target["x"], target["y"])
                await page.keyboard.press("End")
                await page.keyboard.type(FD.SUFFIX, delay=60)
                await page.keyboard.press("Tab")
                await page.wait_for_timeout(3000)
                report["typed"]["after"] = await FD.outbox(page)

            report["stormStart"] = await page.evaluate(FD.STORM_START, {"perFrame": 8})
            if report["stormStart"].get("started"):
                report["stormCost"] = await FD.storm_window(page, 5)
                report["firstClick"] = {
                    "left": await FD.first_click_rounds(page, FD.LEFT, "left", 10),
                    "right": await FD.first_click_rounds(page, FD.RIGHT, "right", 10)}
                await FD.shut_everything(page)
                report["stormStop"] = await page.evaluate(FD.STORM_STOP)
                await page.wait_for_timeout(2000)
            report["outboxAfterStorm"] = await FD.outbox(page)

            if original:
                back = None
                for candidate in (original + FD.SUFFIX, original):
                    found = await page.evaluate(FD.TYPE_TARGET, candidate)
                    if found.get("x") is not None and found["text"] != original:
                        back = (found, len(found["text"]) - len(original))
                        break
                report["setBack"] = {"found": back[0] if back else None,
                                     "remove": back[1] if back else 0}
                if back:
                    await page.mouse.click(back[0]["x"], back[0]["y"])
                    await page.keyboard.press("End")
                    for _ in range(back[1]):
                        await page.keyboard.press("Backspace")
                    await page.keyboard.press("Tab")
                    await page.wait_for_timeout(8000)
                report["setBack"]["readBack"] = await page.evaluate(
                    """() => Array.from(document.querySelectorAll('[contenteditable="true"]'))
                         .map(n => (n.innerText || '').trim())
                         .filter(t => t.startsWith('STEM'))""".replace(
                        "STEM", FD.FIELD_STEM))
                report["setBack"]["remoteAfter"] = await FD.outbox(page)
        await context.close()
        await browser.close()
    report["endedAt"] = time.time()
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
