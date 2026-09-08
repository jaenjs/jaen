"""The blur to the next painted frame, bisected until the cause has a name.

`docs/architecture/editing-performance.md` has carried this gap as red since its
baseline: leaving a jaen field costs 50 to 70 ms to the next painted frame where
leaving a link costs 7, and the last session narrowed it to "not the store, not
the dispatches, not the machine, and not visible to the V8 profiler". A sampling
profiler that makes the gesture three times faster is not an instrument for this,
so this run uses two that do not perturb it:

* the **long animation frame** entries, which name the frame's own phases
  (script, style and layout, and the wait before rendering starts) rather than
  sampling the stack, and
* a **single variable changed at a time in the live DOM**, so the reading is a
  difference and not an inference.

The conditions, all on the same page, the same field, the same session:

| condition   | the one thing changed                                            |
| ----------- | ---------------------------------------------------------------- |
| `base`      | nothing, the gesture a person makes                              |
| `tab0`      | every `tabindex="1"` becomes `tabindex="0"`                      |
| `nospell`   | `spellcheck=false` on every editable                             |
| `blurcall`  | `activeElement.blur()`, so no next element is looked for at all  |
| `link`      | Tab from a link to the next link, the control                    |

`tab0` is the hypothesis this run was built to test. Every jaen field carries
`tabIndex={isEditing ? 1 : undefined}` from `HighlightTooltip`, and a positive
tabindex takes an element out of document order into a separate, earlier tab
cycle. Blink then has to walk the whole flat tree twice to answer "what is
next", once for the positive cycle and once for the fallback, and that walk is
C++ and therefore invisible to a JavaScript profiler.

Nothing is typed and nothing is written: a blur with the value unchanged returns
before it dispatches. The draft's revision is read before and after all the same.
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

# One round's instrument. The blur is witnessed at the document in the capture
# phase, which runs before any React listener, so `at` is the earliest instant
# the page could know the field is being left.
#
# Three readings come out of it and they answer different questions:
#   frameAt   the gap this file is about, blur to the next painted frame
#   taskEnd   a `setTimeout(0)`, an upper bound on the task the blur runs in
#   loaf      the frame's own phases, from the browser rather than from script
ARM = """() => {
  if (window.__bbListener) {
    document.removeEventListener('blur', window.__bbListener, true)
  }
  if (window.__bbObserver) {
    try { window.__bbObserver.disconnect() } catch (e) {}
  }
  window.__bb = {at: null, frameAt: null, taskEnd: null, loaf: [],
                 focusFrom: null, focusTo: null}
  window.__bbListener = event => {
    if (window.__bb.at !== null) return
    window.__bb.at = performance.now()
    const from = event.target
    window.__bb.focusFrom = from && from.tagName
      ? from.tagName + (from.id ? '#' + from.id : '')
      : String(from)
    setTimeout(() => { window.__bb.taskEnd = performance.now() }, 0)
    requestAnimationFrame(() => {
      window.__bb.frameAt = performance.now()
      const to = document.activeElement
      window.__bb.focusTo = to && to.tagName
        ? to.tagName + (to.id ? '#' + to.id : '')
        : String(to)
    })
  }
  document.addEventListener('blur', window.__bbListener, true)
  try {
    window.__bbObserver = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        const at = window.__bb.at
        if (at === null || entry.startTime + entry.duration < at - 5) continue
        window.__bb.loaf.push({
          start: Math.round(entry.startTime * 10) / 10,
          duration: Math.round(entry.duration * 10) / 10,
          renderStart: Math.round(entry.renderStart * 10) / 10,
          styleAndLayoutStart: Math.round(entry.styleAndLayoutStart * 10) / 10,
          blockingDuration: Math.round(entry.blockingDuration * 10) / 10,
          firstUIEventTimestamp: Math.round(entry.firstUIEventTimestamp * 10) / 10,
          scripts: (entry.scripts || []).map(s => ({
            invoker: s.invoker,
            invokerType: s.invokerType,
            duration: Math.round(s.duration * 10) / 10,
            forcedStyleAndLayoutDuration:
              Math.round(s.forcedStyleAndLayoutDuration * 10) / 10,
            source: (s.sourceURL || '').split('/').pop(),
            fn: s.sourceFunctionName
          }))
        })
      }
    })
    window.__bbObserver.observe({type: 'long-animation-frame', buffered: false})
  } catch (error) {
    window.__bb.loafError = String(error)
  }
  return true
}"""

READ = """() => window.__bb"""

# The single variable of each condition, applied to the page as it stands.
MUTATIONS = {
    "base": "() => ({changed: 0})",
    "tab0": """() => {
      const nodes = document.querySelectorAll('[tabindex="1"]')
      nodes.forEach(node => { node.setAttribute('tabindex', '0') })
      return {changed: nodes.length}
    }""",
    "nospell": """() => {
      const nodes = document.querySelectorAll('[contenteditable="true"]')
      nodes.forEach(node => { node.setAttribute('spellcheck', 'false') })
      document.body.spellcheck = false
      return {changed: nodes.length}
    }""",
    # Every rule whose subject is decided by `:has(.jaen-app)` is deleted from
    # the sheet. On a public page `.jaen-app` never exists, so not one computed
    # style changes; what changes is that html, body, #___gatsby and #momo stop
    # being "affected by :has()", which is the reason Chromium's own trace gives
    # for the whole-document style recalculation after every DOM change.
    "nohas": """() => {
      let removed = 0
      for (const sheet of Array.from(document.styleSheets)) {
        let rules
        try { rules = sheet.cssRules } catch (error) { continue }
        if (!rules) continue
        for (let index = rules.length - 1; index >= 0; index--) {
          const selector = rules[index].selectorText
          if (selector && selector.indexOf(':has(.jaen-app)') !== -1) {
            sheet.deleteRule(index)
            removed++
          }
        }
      }
      return {changed: removed}
    }""",
    # The narrower half of the same idea: only the rules whose subject is a
    # DESCENDANT of an element decided by `:has(.jaen-app)` are deleted, and the
    # ones whose subject is that element itself are left in place. If the gap
    # falls here as well, then what costs a whole-document recalculation is the
    # descendant combinator after the `:has()` and not the `:has()` itself, and
    # the repair is four selectors rather than eleven.
    "nohasdesc": r"""() => {
      let removed = 0
      const combinator = /:has\(\.jaen-app\)\s*[ >+~]/
      for (const sheet of Array.from(document.styleSheets)) {
        let rules
        try { rules = sheet.cssRules } catch (error) { continue }
        if (!rules) continue
        for (let index = rules.length - 1; index >= 0; index--) {
          const selector = rules[index].selectorText
          if (selector && selector.split(',').some(part => combinator.test(part))) {
            sheet.deleteRule(index)
            removed++
          }
        }
      }
      return {changed: removed}
    }""",
    # The narrowest cut of all, and the one the repair is written from: only
    # the four rules whose subject is a DESCENDANT of `html:has(.jaen-app)` go,
    # and the replacements that keep their effect are inserted in their place.
    # `user-select` is inherited, so `html:has(.jaen-app)` on its own already
    # gives body and every child of it `none`; what the four rules add is the
    # exceptions, and an exception can name itself instead of naming an
    # ancestor. Nothing else about the sheet changes, so a gap that falls here
    # is the descendant combinator and not the `:has()`.
    "patched": """() => {
      let removed = 0
      let sheet = null
      for (const candidate of Array.from(document.styleSheets)) {
        let rules
        try { rules = candidate.cssRules } catch (error) { continue }
        if (!rules) continue
        for (let index = rules.length - 1; index >= 0; index--) {
          const selector = rules[index].selectorText
          if (selector && selector.split(',').some(
                part => /^\\s*html:has\\(\\.jaen-app\\)\\s*[ >+~]/.test(part))) {
            candidate.deleteRule(index)
            removed++
            sheet = candidate
          }
        }
      }
      if (sheet) {
        sheet.insertRule(
          '[data-selectable]{-webkit-user-select:text;user-select:text}',
          sheet.cssRules.length)
        sheet.insertRule(
          '[data-selectable] :is(button,[role="button"],.chakra-badge)' +
          '{-webkit-user-select:none;user-select:none}', sheet.cssRules.length)
        sheet.insertRule(
          ':is(input,textarea,select,[contenteditable="true"])' +
          '{-webkit-user-select:text;user-select:text}', sheet.cssRules.length)
      }
      return {changed: removed}
    }""",
    # Only the two rules whose subject is decided by `#coco`/`#momo`. `#momo` is
    # jaen's own highlight tooltip and its children are replaced on every focus,
    # so it is the one `:has()` subject that a person editing keeps disturbing.
    "nomomo": """() => {
      let removed = []
      for (const sheet of Array.from(document.styleSheets)) {
        let rules
        try { rules = sheet.cssRules } catch (error) { continue }
        if (!rules) continue
        for (let index = rules.length - 1; index >= 0; index--) {
          const selector = rules[index].selectorText
          if (selector && /#(coco|momo):has\\(\\.jaen-app\\)/.test(selector)) {
            removed.push(selector)
            sheet.deleteRule(index)
          }
        }
      }
      return {changed: removed.length, selectors: removed}
    }""",
    # jaen's own half of the same finding. The highlighter's tooltip is an
    # `HStack` carrying `id="momo"`, which is also the id of the jaen frame's
    # header, and `#momo:has(.jaen-app)` in the app's stylesheet is written for
    # neither of them. Taking the id off the tooltip removes it from the
    # `:has()` subjects without touching the app's sheet at all.
    "noid": """() => {
      let removed = 0
      for (const node of Array.from(document.querySelectorAll('#momo'))) {
        if (node.closest('.jaen-highlight-tooltip') || node.closest('.jaen-highlight-frame')) {
          node.removeAttribute('id')
          removed++
        }
      }
      return {changed: removed}
    }""",
    "blurcall": "() => ({changed: 0})",
    "link": "() => ({changed: 0})"
}

COUNTS = """() => ({
  editable: document.querySelectorAll('[contenteditable="true"]').length,
  positiveTabIndex: document.querySelectorAll('[tabindex="1"]').length,
  elements: document.getElementsByTagName('*').length,
  focusable: document.querySelectorAll(
    'a[href],button,input,select,textarea,[tabindex],[contenteditable="true"]').length
})"""


async def one_round(page, condition):  # noqa: C901
    """One gesture, armed and read. Returns None when no blur happened."""
    if condition == "link":
        target = page.locator("a[href]").first
        if not await target.count():
            return None
        try:
            await target.focus(timeout=5000)
        except Exception:
            return None
    else:
        handle = await RP.first_written_field(page, timeout=5)
        if handle is None:
            return None
        try:
            await handle.click(timeout=5000)
        except Exception:
            return None
    await page.wait_for_timeout(400)
    # Re-applied every round: the tooltip is React's and a re-render puts back
    # what a round took off the DOM.
    await page.evaluate(MUTATIONS[condition])
    await page.evaluate(ARM)
    if condition == "blurcall":
        await page.evaluate("() => { document.activeElement && document.activeElement.blur() }")
    else:
        await page.keyboard.press("Tab")
    await page.wait_for_timeout(1200)
    reading = await page.evaluate(READ)
    await page.wait_for_timeout(400)
    if not reading or reading.get("at") is None:
        return None
    return {
        "gap": round(reading["frameAt"] - reading["at"], 2)
        if reading.get("frameAt") is not None else None,
        "block": round(reading["taskEnd"] - reading["at"], 2)
        if reading.get("taskEnd") is not None else None,
        "from": reading.get("focusFrom"),
        "to": reading.get("focusTo"),
        "loaf": reading.get("loaf") or []
    }


def summarise(rounds):
    gaps = [r["gap"] for r in rounds if r and r.get("gap") is not None]
    blocks = [r["block"] for r in rounds if r and r.get("block") is not None]
    return {
        "rounds": len(rounds),
        "gaps": gaps,
        "gapMedian": round(statistics.median(gaps), 2) if gaps else None,
        "gapMax": max(gaps) if gaps else None,
        "gapOverOneFrame": len([g for g in gaps if g > 16]),
        "blockMedian": round(statistics.median(blocks), 2) if blocks else None,
        "focusTo": sorted({r["to"] for r in rounds if r and r.get("to")}),
        "loaf": [r["loaf"] for r in rounds if r and r.get("loaf")]
    }


async def main():
    from playwright.async_api import async_playwright
    out = {"origin": ORIGIN, "live": RP.LIVE, "startedAt": time.time(),
           "conditions": {}}
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

        order = ["base", "nohas", "base", "nohas", "base"]
        seen = {}
        for condition in order:
            name = condition if condition not in seen else condition + "-again"
            seen[condition] = True
            await page.goto(ORIGIN + "/", wait_until="domcontentloaded")
            await RP.wait_for_draft(page)
            await RP.wait_for_editable(page)
            await page.wait_for_timeout(3000)
            before = await page.evaluate(COUNTS)
            applied = await page.evaluate(MUTATIONS[condition])
            rounds = []
            for _ in range(10):
                rounds.append(await one_round(page, condition))
            entry = summarise([r for r in rounds if r])
            entry["counts"] = before
            entry["applied"] = applied
            entry["state"] = await page.evaluate(RP.READ_STATE)
            out["conditions"][name] = entry
            print("%-12s median %s ms, over one frame %s of %s"
                  % (name, entry["gapMedian"], entry["gapOverOneFrame"],
                     len(entry["gaps"])), flush=True)
        await browser.close()
    site.stop()
    out["endedAt"] = time.time()
    target = HERE.parent / "adversarial" / (
        "blur-bisect.json" if RP.LIVE else "blur-bisect-local.json")
    target.write_text(json.dumps(out, indent=2))
    print("written", target)


if __name__ == "__main__":
    asyncio.run(main())
