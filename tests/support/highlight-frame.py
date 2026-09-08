"""The highlighter still does its job after it stopped rebuilding itself.

`packages/jaen/src/contexts/field-highlighter.tsx` used to create the frame, the
tooltip's container and a `ResizeObserver` inside every focus and throw them away
in the blur that followed. It keeps them now and moves them. That is a speed
change on the surface and a behaviour change underneath, so the behaviour is
read off the page rather than argued:

* nothing focused, no frame standing
* a field focused, the frame over that field's own rectangle to the pixel, and
  the tooltip carrying that field's actions
* the next field focused, the frame moved and the actions swapped
* focus gone, the frame hidden again
* a page navigated to and back, the frame not left standing at the old
  coordinates
* the tooltip's own buttons still the topmost element at their centre, which is
  what a person needs for a tune to be clickable at all

Nothing is typed and nothing is written. The draft's revision is read before and
after.
"""
import asyncio
import importlib.util
import json
import pathlib
import time

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("register_probe", HERE / "register-probe.py")
RP = importlib.util.module_from_spec(spec)
spec.loader.exec_module(RP)

ORIGIN = RP.ORIGIN

FRAME = """() => {
  const frame = document.querySelector('.jaen-highlight-frame')
  if (!frame) return {present: false}
  const style = getComputedStyle(frame)
  const rect = frame.getBoundingClientRect()
  const tooltip = frame.querySelector('.jaen-highlight-tooltip')
  const buttons = tooltip
    ? Array.from(tooltip.querySelectorAll('button')).map(button => {
        const box = button.getBoundingClientRect()
        const middle = document.elementFromPoint(
          box.left + box.width / 2, box.top + box.height / 2)
        return {
          label: (button.getAttribute('aria-label') || button.textContent || '').trim(),
          width: Math.round(box.width),
          height: Math.round(box.height),
          topmost: !!middle && (middle === button || button.contains(middle))
        }
      })
    : []
  return {
    present: true,
    display: style.display,
    visible: style.display !== 'none' && rect.width > 0,
    top: Math.round(parseFloat(frame.style.top || '0')),
    left: Math.round(parseFloat(frame.style.left || '0')),
    width: Math.round(parseFloat(frame.style.width || '0')),
    height: Math.round(parseFloat(frame.style.height || '0')),
    frames: document.querySelectorAll('.jaen-highlight-frame').length,
    tooltips: document.querySelectorAll('.jaen-highlight-tooltip').length,
    buttons,
    authorChips: tooltip
      ? tooltip.querySelectorAll('[data-jaen-field-author]').length : 0
  }
}"""

FIELD_BOX = """(id) => {
  const node = document.getElementById(id)
  if (!node) return null
  const rect = node.getBoundingClientRect()
  return {
    top: Math.round(rect.top + (window.pageYOffset || 0)),
    left: Math.round(rect.left + (window.pageXOffset || 0)),
    width: Math.round(rect.width),
    height: Math.round(rect.height)
  }
}"""

# The field's own element carries the id: `HighlightTooltip` puts
# `jaenField.id || jaenField.name` on the wrapper and the wrapper is what
# `contentEditable` is spread onto. Only fields that are on the screen and have
# something in them are taken, so a hidden tab's panel is never clicked.
EDITABLE_IDS = """() => Array.from(
  document.querySelectorAll('[contenteditable="true"]')
).filter(node => node.id && (node.textContent || '').trim() &&
                 node.getBoundingClientRect().width > 0 &&
                 node.getBoundingClientRect().height > 0)
 .map(node => node.id)"""


def near(a, b, slack=2):
    return a is not None and b is not None and abs(a - b) <= slack


async def main():
    from playwright.async_api import async_playwright
    out = {"origin": ORIGIN, "live": RP.LIVE, "startedAt": time.time(), "checks": []}

    def check(name, ok, detail):
        out["checks"].append({"name": name, "pass": bool(ok), "detail": detail})
        print(("PASS " if ok else "FAIL ") + name, json.dumps(detail)[:200], flush=True)

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
        out["revisionBefore"] = (await page.evaluate(RP.READ_STATE))["remote"]["revision"]

        before = await page.evaluate(FRAME)
        check("nothing focused, no frame standing",
              not before["present"] or not before["visible"], before)

        ids = await page.evaluate(EDITABLE_IDS)
        out["fieldIds"] = ids[:4]
        first, second = (ids + [None, None])[:2]

        for label, ident in (("first", first), ("second", second)):
            if ident is None:
                continue
            await page.locator('[id="%s"]' % ident).first.click()
            await page.wait_for_timeout(700)
            frame = await page.evaluate(FRAME)
            box = await page.evaluate(FIELD_BOX, ident)
            placed = (frame.get("visible") and box is not None
                      and near(frame["top"], box["top"])
                      and near(frame["left"], box["left"])
                      and near(frame["width"], box["width"])
                      and near(frame["height"], box["height"]))
            check("the %s field focused, the frame over its own rectangle" % label,
                  placed, {"frame": {k: frame.get(k) for k in
                                     ("visible", "top", "left", "width", "height",
                                      "frames", "tooltips")}, "field": box, "id": ident})
            check("the %s field's tooltip carries its actions" % label,
                  len(frame["buttons"]) >= 2 and all(b["topmost"] for b in frame["buttons"]),
                  frame["buttons"])
            check("exactly one frame and one tooltip container stand",
                  frame.get("frames") == 1 and frame.get("tooltips") == 1,
                  {"frames": frame.get("frames"), "tooltips": frame.get("tooltips"),
                   "field": label})

        # Focus away from every field, onto the page's first link.
        await page.locator("a[href]").first.focus()
        await page.wait_for_timeout(700)
        gone = await page.evaluate(FRAME)
        check("focus off every field, the frame hidden",
              not gone["present"] or not gone["visible"], gone)

        # A navigation with a field focused must not leave the frame standing.
        if first:
            await page.locator('[id="%s"]' % first).first.click()
            await page.wait_for_timeout(500)
        await page.goto(ORIGIN + "/imprint/", wait_until="domcontentloaded")
        await RP.wait_for_editable(page)
        await page.wait_for_timeout(2500)
        after_nav = await page.evaluate(FRAME)
        check("after a navigation the frame is not left standing",
              not after_nav["present"] or not after_nav["visible"], after_nav)

        ids2 = await page.evaluate(EDITABLE_IDS)
        if ids2:
            await page.locator('[id="%s"]' % ids2[0]).first.click()
            await page.wait_for_timeout(700)
            frame = await page.evaluate(FRAME)
            box = await page.evaluate(FIELD_BOX, ids2[0])
            check("and it works again on the new page",
                  frame.get("visible") and box is not None
                  and near(frame["top"], box["top"]) and near(frame["left"], box["left"]),
                  {"frame": {k: frame.get(k) for k in ("visible", "top", "left")},
                   "field": box, "id": ids2[0]})

        await page.goto(ORIGIN + "/", wait_until="domcontentloaded")
        await RP.wait_for_draft(page)
        await page.wait_for_timeout(2000)
        out["revisionAfter"] = (await page.evaluate(RP.READ_STATE))["remote"]["revision"]
        check("nothing was written",
              out["revisionBefore"] == out["revisionAfter"],
              {"before": out["revisionBefore"], "after": out["revisionAfter"]})
        await browser.close()
    site.stop()
    out["endedAt"] = time.time()
    out["passed"] = len([c for c in out["checks"] if c["pass"]])
    out["failed"] = len([c for c in out["checks"] if not c["pass"]])
    target = HERE.parent / "adversarial" / (
        "highlight-frame.json" if RP.LIVE else "highlight-frame-local.json")
    target.write_text(json.dumps(out, indent=2))
    print("%d pass %d fail -> %s" % (out["passed"], out["failed"], target))


if __name__ == "__main__":
    asyncio.run(main())
