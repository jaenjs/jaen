"""The drawer that will not open: a measurement, on the live booklimo.at.

Owner, 2026-09-08, on the live CMS: "der discard button in jaen ist jetzt
verschwunden, und nach dem Bearbeiten lassen sich das Hamburger-Menue nicht
mehr oeffnen, also beide Drawer. Erst nach vielen Versuchen gehen sie
irgendwann wieder auf."

This changes no behaviour. It signs in as the booklimo human admin on the real
booklimo.at, clicks the two drawer buttons with the mouse at their own
coordinates, and reports four things per attempt:

  * how many times the drawer button's DOM node was replaced (a remount),
  * how many times the store was written per second,
  * the long tasks around the click, from PerformanceObserver and from the
    CDP performance domain,
  * whether the drawer opened, and whether it stayed open.

Hypothesis A (the main thread is saturated) predicts long tasks and a late but
eventual open. Hypothesis B (the drawer is remounted and its useDisclosure
state thrown away) predicts a mount count that climbs while edit mode is on.
A third is measured beside them without being asked for: that the click never
becomes a click at all, because the node under the pointer is replaced between
the mousedown and the mouseup.

It prints one JSON document on stdout and nothing else.
"""
import asyncio
import json
import os
import pathlib
import re
import sys
import time

ORIGIN = "https://booklimo.at"
CONFIG = pathlib.Path(os.path.expanduser("~/.config/taxi-app"))
PERSIST_KEY = "jaenjs-state"
LEFT = "Open main menu"
RIGHT = "Open user menu"


def load_env(name):
    path = CONFIG / name
    if not path.is_file():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip().removeprefix("export ").strip()
        value = value.strip().strip('"').strip("'")
        if key and value and not os.environ.get(key):
            os.environ[key] = value


load_env("humans.env")
LOGIN = os.environ.get("TAXI_HUMAN_ADMIN_BOOKLIMO_LOGIN", "")
PASSWORD = os.environ.get("TAXI_HUMAN_ADMIN_BOOKLIMO_PASSWORD", "")

# Installed before any script of the page, on every navigation.
#
# Three probes and nothing that touches the CMS: a counted wrapper around
# `localStorage.setItem`, a long task observer, and a requestAnimationFrame
# loop that watches the identity of the two drawer buttons. The rAF loop is the
# mount counter: React remounting DrawerLeft produces a NEW DOM node for the
# same button, so a node that is not the node of the previous frame is a
# remount. It cannot see two remounts inside one frame, which makes it a floor
# and never a ceiling, and the MutationObserver beside it counts every
# insertion of a button node into the header so the floor has a witness.
PROBE = """(() => {
  const P = (window.__drawerProbe = {
    commits: 0,
    unmounts: 0,
    unmountedTypes: {},
    unmountedWhere: {},
    writes: [],
    longTasks: [],
    mounts: {left: 0, right: 0},
    mountAt: {left: [], right: []},
    inserted: {left: 0, right: 0},
    events: [],
    frames: 0,
    longTaskError: null
  })

  // React's own commit counter, through the devtools hook React looks for
  // when it boots. It is a stub that counts and does nothing else, installed
  // before any script of the page, so it measures the render storm rather than
  // the persistence path: since change 1 of editing-performance.md the store's
  // writes are coalesced into one idle callback and a write counter can no
  // longer see how often React is asked to work.
  if (!window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      renderers: new Map(),
      supportsFiber: true,
      inject: function () { return 1 },
      onCommitFiberRoot: function () { P.commits++ },
      onCommitFiberUnmount: function (id, fiber) {
        P.unmounts++
        // What is being torn down, by the fiber's own type. A host element is
        // its tag name; a component is minified in a production build, so its
        // displayName is kept when the bundle carried one and the tag is
        // `?` otherwise. It is a histogram and not a trace: what is wanted is
        // which subtree churns, not which instance.
        try {
          const type = fiber && fiber.type
          let name = '?'
          if (typeof type === 'string') name = type
          else if (type && (type.displayName || type.name)) name = type.displayName || type.name
          else if (type && type.$$typeof) name = 'exotic'
          else if (fiber && fiber.tag === 6) name = '#text'
          P.unmountedTypes[name] = (P.unmountedTypes[name] || 0) + 1
          const node = fiber && fiber.stateNode
          if (node && node.nodeType === 1) {
            const where = node.closest('[data-scope="dialog"]')
              ? 'drawer'
              : node.closest('#momo')
                ? 'header'
                : document.body.contains(node)
                  ? 'page'
                  : 'detached'
            P.unmountedWhere[where] = (P.unmountedWhere[where] || 0) + 1
          }
        } catch (error) {}
      },
      onPostCommitFiberRoot: function () {},
      checkDCE: function () {}
    }
  }

  const setItem = Storage.prototype.setItem
  Storage.prototype.setItem = function (key, value) {
    const at = performance.now()
    const answer = setItem.call(this, key, value)
    P.writes.push({key: key, at: at, bytes: String(value).length})
    return answer
  }

  try {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        P.longTasks.push({at: entry.startTime, ms: entry.duration})
      }
    }).observe({entryTypes: ['longtask']})
  } catch (error) {
    P.longTaskError = String(error)
  }

  const SEL = {left: '[aria-label="LEFT"]', right: '[aria-label="RIGHT"]'}
  const last = {left: null, right: null}

  const tick = () => {
    P.frames++
    for (const side of ['left', 'right']) {
      const node = document.querySelector(SEL[side])
      if (node && node !== last[side]) {
        last[side] = node
        P.mounts[side]++
        P.mountAt[side].push(performance.now())
      }
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)

  const watchHeader = () => {
    const header = document.querySelector('#momo')
    if (!header) return setTimeout(watchHeader, 200)
    new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType !== 1) continue
          for (const side of ['left', 'right']) {
            if (node.matches(SEL[side]) || node.querySelector(SEL[side])) {
              P.inserted[side]++
            }
          }
        }
      }
    }).observe(header, {childList: true, subtree: true})
  }
  watchHeader()

  for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click']) {
    document.addEventListener(
      type,
      event => {
        const target = event.target && event.target.closest
          ? event.target.closest(SEL.left + ',' + SEL.right)
          : null
        P.events.push({
          type: type,
          at: performance.now(),
          on: target ? target.getAttribute('aria-label') : null
        })
      },
      true
    )
  }
})()""".replace("LEFT", LEFT).replace("RIGHT", RIGHT)

SET_EDITING_AT_BOOT = """(() => {
  try {
    const raw = localStorage.getItem('%s')
    const state = raw ? JSON.parse(raw) : {}
    state.status = {...(state.status || {}), isEditing: true}
    localStorage.setItem('%s', JSON.stringify(state))
  } catch (error) {}
})()""" % (PERSIST_KEY, PERSIST_KEY)

HAS_SESSION = """() => {
  try {
    return Object.keys(sessionStorage).some(key => key.startsWith('oidc.user:'))
  } catch (error) {
    return false
  }
}"""

READ_STATE = """() => {
  try {
    const raw = localStorage.getItem('%s')
    return raw ? JSON.parse(raw) : null
  } catch (error) {
    return null
  }
}""" % PERSIST_KEY

# What "open" means, read off the DOM rather than off any state of ours.
#
# Only the drawer: `[data-scope="dialog"][data-part="content"]` is what Ark's
# dialog machine renders, and the site's cookie banner is a plain
# `role="dialog"` with none of those attributes. The first cut of this counted
# the banner as an open drawer, which would have made every attempt look
# successful. The side comes off the x coordinate, because the left drawer is
# placed at the start of the viewport and the right one at its end.
DRAWERS = """() => Array.from(
  document.querySelectorAll('[data-scope="dialog"][data-part="content"]')
).filter(node => {
  const box = node.getBoundingClientRect()
  return box.width > 0 && box.height > 0
}).map(node => {
  const box = node.getBoundingClientRect()
  return {
    side: box.x < window.innerWidth / 2 ? 'left' : 'right',
    state: node.getAttribute('data-state'),
    width: Math.round(box.width),
    text: (node.innerText || '').slice(0, 40).replace(/\\s+/g, ' ')
  }
})"""

OPEN_STATE = """() => ({drawers: (DRAWERS)(), all: Array.from(
  document.querySelectorAll('[role="dialog"]')
).map(n => ({role: n.getAttribute('role'), scope: n.getAttribute('data-scope'),
             part: n.getAttribute('data-part'), state: n.getAttribute('data-state'),
             text: (n.innerText || '').slice(0, 30).replace(/\\s+/g, ' ')}))})""".replace(
    "DRAWERS", DRAWERS)

# Open and closed after a click, sampled every animation frame for as long as
# the caller asks, so a drawer that opens and is thrown away milliseconds later
# is seen rather than missed by a poll that arrives after it has gone.
WATCH_OPEN = """({ms, side}) => new Promise(resolve => {
  const started = performance.now()
  const samples = []
  let previous = null
  const read = () => (DRAWERS)().some(drawer => drawer.side === side)
  const tick = () => {
    const now = read()
    if (now !== previous) {
      samples.push({at: Math.round(performance.now() - started), open: now})
      previous = now
    }
    if (performance.now() - started < ms) {
      requestAnimationFrame(tick)
    } else {
      resolve({samples: samples, openAtEnd: now})
    }
  }
  tick()
})""".replace("DRAWERS", DRAWERS)


async def sign_in(page):
    await page.goto(ORIGIN + "/login/", wait_until="domcontentloaded")
    await page.wait_for_url(re.compile(r"accounts\.netsnek\.com"), timeout=60000)
    await page.fill("#loginName", LOGIN, timeout=20000)
    await page.click("#submit-button")
    await page.fill("#password", PASSWORD, timeout=20000)
    await page.click("#submit-button")
    for _ in range(40):
        await page.wait_for_timeout(1000)
        if page.url.startswith(ORIGIN):
            break
        for selector in ["button[name='skip']", "#skip-button", "button:has-text('Überspringen')"]:
            locator = page.locator(selector).first
            if await locator.count() and await locator.is_visible():
                await locator.click()
                break
    if not page.url.startswith(ORIGIN):
        return False
    for _ in range(40):
        if await page.evaluate(HAS_SESSION):
            return True
        await page.wait_for_timeout(1000)
    return False


async def reset_probe(page):
    await page.evaluate("""() => {
      const P = window.__drawerProbe
      if (!P) return false
      P.writes.length = 0
      P.longTasks.length = 0
      P.events.length = 0
      P.mounts.left = 0
      P.mounts.right = 0
      P.mountAt.left.length = 0
      P.mountAt.right.length = 0
      P.inserted.left = 0
      P.inserted.right = 0
      P.frames = 0
      P.commits = 0
      P.unmounts = 0
      for (const key of Object.keys(P.unmountedTypes)) delete P.unmountedTypes[key]
      for (const key of Object.keys(P.unmountedWhere)) delete P.unmountedWhere[key]
      return true
    }""")


async def read_probe(page):
    return await page.evaluate("""() => {
      const P = window.__drawerProbe
      if (!P) return null
      return {
        writes: P.writes.length,
        writeBytes: P.writes.reduce((sum, w) => sum + w.bytes, 0),
        stateWrites: P.writes.filter(w => w.key === 'KEY').length,
        longTasks: P.longTasks.slice(),
        mounts: {left: P.mounts.left, right: P.mounts.right},
        inserted: {left: P.inserted.left, right: P.inserted.right},
        events: P.events.slice(),
        frames: P.frames,
        commits: P.commits,
        unmounts: P.unmounts,
        unmountedTypes: Object.fromEntries(
          Object.entries(P.unmountedTypes).sort((a, b) => b[1] - a[1]).slice(0, 14)
        ),
        unmountedWhere: Object.assign({}, P.unmountedWhere),
        longTaskError: P.longTaskError
      }
    }""".replace("KEY", PERSIST_KEY))


async def metrics(cdp):
    answer = await cdp.send("Performance.getMetrics")
    return {entry["name"]: entry["value"] for entry in answer["metrics"]}


def metric_delta(before, after, names):
    return {name: round(after.get(name, 0) - before.get(name, 0), 4) for name in names}


METRICS = ["TaskDuration", "ScriptDuration", "LayoutDuration", "RecalcStyleDuration",
           "LayoutCount", "RecalcStyleCount", "Nodes", "JSEventListeners",
           "JSHeapUsedSize", "JSHeapTotalSize"]


async def idle_writes(page, cdp, seconds=5):
    """The registration storm, counted, with nobody touching anything."""
    await reset_probe(page)
    before = await metrics(cdp)
    await page.wait_for_timeout(int(seconds * 1000))
    after = await metrics(cdp)
    probe = await read_probe(page)
    probe["cdp"] = metric_delta(before, after, METRICS)
    probe["mainThreadBusy"] = round(probe["cdp"]["TaskDuration"] / seconds, 3)
    probe["seconds"] = seconds
    probe["writesPerSecond"] = round(probe["writes"] / seconds, 1)
    probe["stateWritesPerSecond"] = round(probe["stateWrites"] / seconds, 1)
    probe["mountsPerSecond"] = {
        "left": round(probe["mounts"]["left"] / seconds, 1),
        "right": round(probe["mounts"]["right"] / seconds, 1)
    }
    probe["framesPerSecond"] = round(probe["frames"] / seconds, 1)
    probe["commitsPerSecond"] = round(probe["commits"] / seconds, 1)
    probe["longestLongTaskMs"] = round(max([t["ms"] for t in probe["longTasks"]], default=0), 1)
    probe["longTaskCount"] = len(probe["longTasks"])
    del probe["longTasks"]
    del probe["events"]
    return probe


async def click_until_open(page, cdp, label, side, attempts=12, hold_ms=2000):
    """Click the drawer button with the mouse, at its own coordinates.

    Not `locator.click()`: playwright re-resolves and retries a locator whose
    node went away, which is exactly the failure this run is trying to see. A
    mouse down and up at a point is what a person does.
    """
    locator = page.locator('[aria-label="%s"]' % label).first
    tries = []
    settled = None
    for index in range(1, attempts + 1):
        box = await locator.bounding_box()
        if box is None:
            tries.append({"attempt": index, "skipped": "no box"})
            await page.wait_for_timeout(500)
            continue
        x = box["x"] + box["width"] / 2
        y = box["y"] + box["height"] / 2

        open_before = await page.evaluate(
            "(side) => (DRAWERS)().some(d => d.side === side)".replace("DRAWERS", DRAWERS), side)
        await reset_probe(page)
        before = await metrics(cdp)
        await page.mouse.move(x, y)
        await page.mouse.down()
        await page.mouse.up()
        watched = await page.evaluate(WATCH_OPEN, {"ms": hold_ms, "side": side})
        after = await metrics(cdp)
        probe = await read_probe(page)

        opened = any(sample["open"] for sample in watched["samples"])
        tries.append({
            "attempt": index,
            "opened": opened,
            "openAtEnd": watched["openAtEnd"],
            "transitions": watched["samples"],
            "mounts": probe["mounts"],
            "inserted": probe["inserted"],
            "storeWrites": probe["stateWrites"],
            "longTasks": probe["longTasks"],
            "longestLongTaskMs": round(max([t["ms"] for t in probe["longTasks"]], default=0), 1),
            "events": [e["type"] for e in probe["events"] if e["on"] == label],
            "cdp": metric_delta(before, after, METRICS)
        })

        if watched["openAtEnd"]:
            settled = index
            state = await page.evaluate(OPEN_STATE)
            tries[-1]["openState"] = state
            # Put it back the way it was found.
            await page.keyboard.press("Escape")
            await page.wait_for_timeout(600)
            break

        await page.wait_for_timeout(700)

    return {"label": label, "side": side, "clicksUntilItStayedOpen": settled, "attempts": tries}


async def open_drawer(page, label, side, tries=6):
    """Open one drawer with the mouse and wait for it, without measuring."""
    locator = page.locator('[aria-label="%s"]' % label).first
    reader = "(side) => (DRAWERS)().some(d => d.side === side)".replace("DRAWERS", DRAWERS)
    for _ in range(tries):
        if await page.evaluate(reader, side):
            return True
        box = await locator.bounding_box()
        if box is None:
            await page.wait_for_timeout(500)
            continue
        await page.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
        await page.wait_for_timeout(900)
    return await page.evaluate(reader, side)


async def burst(page, cdp, label, side, clicks, gap_ms, watch_ms=6000):
    """Several clicks in a row, the way a person clicks a control that does
    not seem to answer.

    The button is `onToggle`, so the parity of the clicks decides the end
    state, and a paint that arrives after the person has already clicked again
    is indistinguishable from a control that did nothing. This is the only
    shape of the owner's sentence a two second wait after one click cannot see.
    """
    locator = page.locator('[aria-label="%s"]' % label).first
    box = await locator.bounding_box()
    if box is None:
        return {"clicks": clicks, "skipped": "the button has no box"}
    x = box["x"] + box["width"] / 2
    y = box["y"] + box["height"] / 2

    await reset_probe(page)
    before = await metrics(cdp)
    watching = asyncio.create_task(
        page.evaluate(WATCH_OPEN, {"ms": watch_ms, "side": side}))
    await asyncio.sleep(0.05)
    for _ in range(clicks):
        await page.mouse.move(x, y)
        await page.mouse.down()
        await page.mouse.up()
        await asyncio.sleep(gap_ms / 1000)
    watched = await watching
    after = await metrics(cdp)
    probe = await read_probe(page)

    answer = {
        "clicks": clicks,
        "gapMs": gap_ms,
        "transitions": watched["samples"],
        "openAtEnd": watched["openAtEnd"],
        "clicksSeen": len([e for e in probe["events"] if e["type"] == "click" and e["on"] == label]),
        "mounts": probe["mounts"],
        "commits": probe["commits"],
        "longestLongTaskMs": round(max([t["ms"] for t in probe["longTasks"]], default=0), 1),
        "cdp": metric_delta(before, after, METRICS)
    }
    if watched["openAtEnd"]:
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(900)
    return answer


async def cycle_drawer(page, cdp, label, side, cycles=10, hold_ms=2000):
    """Open and close the drawer over and over, and report every cycle.

    The owner's sentence is "erst nach vielen Versuchen gehen sie irgendwann
    wieder auf", so one successful open is not an answer. Each cycle is one
    mouse gesture at the button's own coordinates, two seconds of watching, and
    an Escape when it opened.
    """
    locator = page.locator('[aria-label="%s"]' % label).first
    tries = []
    for index in range(1, cycles + 1):
        box = await locator.bounding_box()
        if box is None:
            tries.append({"cycle": index, "skipped": "the button has no box"})
            await page.wait_for_timeout(500)
            continue
        x = box["x"] + box["width"] / 2
        y = box["y"] + box["height"] / 2

        open_before = await page.evaluate(
            "(side) => (DRAWERS)().some(d => d.side === side)".replace("DRAWERS", DRAWERS), side)
        await reset_probe(page)
        before = await metrics(cdp)
        await page.mouse.move(x, y)
        await page.mouse.down()
        await page.mouse.up()
        watched = await page.evaluate(WATCH_OPEN, {"ms": hold_ms, "side": side})
        after = await metrics(cdp)
        probe = await read_probe(page)

        tries.append({
            "cycle": index,
            "openBefore": open_before,
            "opened": any(sample["open"] for sample in watched["samples"]),
            "openAtEnd": watched["openAtEnd"],
            "transitions": watched["samples"],
            "mounts": probe["mounts"],
            "inserted": probe["inserted"],
            "storeWrites": probe["stateWrites"],
            "commits": probe["commits"],
            "unmounts": probe["unmounts"],
            "longTasks": len(probe["longTasks"]),
            "longestLongTaskMs": round(max([t["ms"] for t in probe["longTasks"]], default=0), 1),
            "events": [e["type"] for e in probe["events"] if e["on"] == label],
            "cdp": metric_delta(before, after, METRICS)
        })

        if watched["openAtEnd"]:
            await page.keyboard.press("Escape")
            await page.wait_for_timeout(900)
            tries[-1]["closedByEscape"] = not await page.evaluate(
                "(side) => (DRAWERS)().some(d => d.side === side)".replace("DRAWERS", DRAWERS), side)
        else:
            await page.wait_for_timeout(700)

    # A cycle counts as an open only when the drawer was shut before the click.
    real = [t for t in tries if t.get("openAtEnd") and not t.get("openBefore")]
    return {"label": label, "side": side, "cycles": len(tries),
            "openedFromShut": len(real),
            "startedAlreadyOpen": len([t for t in tries if t.get("openBefore")]),
            "failed": len([t for t in tries if not t.get("openAtEnd")]),
            "attempts": tries}


TYPE_TARGET = """(value) => {
  const nodes = Array.from(document.querySelectorAll('[contenteditable="true"]'))
  const found = nodes.find(node => (node.innerText || '').trim() === value)
    || nodes.find(node => (node.innerText || '').trim().startsWith(value))
  if (!found) {
    return {miss: nodes.map(n => (n.innerText || '').trim().slice(0, 40)).slice(0, 20)}
  }
  const box = found.getBoundingClientRect()
  return {x: box.x + box.width / 2, y: box.y + box.height / 2, text: found.innerText.trim()}
}"""


async def editing_on(page):
    await page.goto(ORIGIN + "/", wait_until="domcontentloaded")
    for _ in range(40):
        if await page.evaluate("() => localStorage.getItem('%s') !== null" % PERSIST_KEY):
            break
        await page.wait_for_timeout(1000)
    await page.context.add_init_script(SET_EDITING_AT_BOOT)
    await page.reload(wait_until="domcontentloaded")
    for _ in range(40):
        if await page.locator('[contenteditable="true"]').count():
            return True
        await page.wait_for_timeout(1000)
    return False


# What the page looks like to a pointer, read after every gesture.
#
# Hypothesis C, which neither A nor B names: the drawer opens and closes
# normally, and what a person clicks is a leftover of the last close. Zag's
# dialog puts the document under a dismissable layer and Chakra locks the
# scroll while one is open, so an exit that is interrupted can leave the body
# inert, a backdrop mounted over the header, or an `aria-hidden` on the app
# root. Every one of those is invisible and swallows the next click.
INERT_STATE = """({x, y}) => {
  const body = document.body
  const style = getComputedStyle(body)
  const top = document.elementFromPoint(x, y)
  const describe = node => node ? {
    tag: node.tagName.toLowerCase(),
    label: node.getAttribute('aria-label'),
    scope: node.getAttribute('data-scope'),
    part: node.getAttribute('data-part'),
    state: node.getAttribute('data-state'),
    pointerEvents: getComputedStyle(node).pointerEvents
  } : null
  const inside = node => {
    // Is the node under the pointer the drawer button, or inside it?
    let cursor = node
    while (cursor) {
      if (cursor.getAttribute && cursor.getAttribute('aria-label') === 'LABEL') return true
      cursor = cursor.parentElement
    }
    return false
  }
  const root = document.getElementById('___gatsby')
  return {
    bodyPointerEvents: style.pointerEvents,
    bodyOverflow: style.overflow,
    bodyPaddingRight: style.paddingRight,
    bodyInlineStyle: body.getAttribute('style'),
    bodyDataScrollLocked: body.getAttribute('data-scroll-locked'),
    rootAriaHidden: root ? root.getAttribute('aria-hidden') : null,
    dialogNodes: document.querySelectorAll('[data-scope="dialog"][data-part="content"]').length,
    backdrops: document.querySelectorAll('[data-scope="dialog"][data-part="backdrop"]').length,
    positioners: document.querySelectorAll('[data-scope="dialog"][data-part="positioner"]').length,
    hiddenAttrs: document.querySelectorAll('[aria-hidden="true"]').length,
    topAtButton: describe(top),
    pointerReachesButton: inside(top)
  }
}"""


async def gesture(page, cdp, label, side, hold_ms=1500):
    """One mouse gesture at the button's own coordinates, and what followed."""
    locator = page.locator('[aria-label="%s"]' % label).first
    box = await locator.bounding_box()
    if box is None:
        return {"skipped": "the button has no box"}
    x = box["x"] + box["width"] / 2
    y = box["y"] + box["height"] / 2
    reader = "(side) => (DRAWERS)().some(d => d.side === side)".replace("DRAWERS", DRAWERS)
    before_open = await page.evaluate(reader, side)
    inert_before = await page.evaluate(INERT_STATE.replace("LABEL", label), {"x": x, "y": y})
    await reset_probe(page)
    metrics_before = await metrics(cdp)
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.up()
    watched = await page.evaluate(WATCH_OPEN, {"ms": hold_ms, "side": side})
    metrics_after = await metrics(cdp)
    probe = await read_probe(page)
    inert_after = await page.evaluate(INERT_STATE.replace("LABEL", label), {"x": x, "y": y})
    return {
        "openBefore": before_open,
        "openAtEnd": watched["openAtEnd"],
        "transitions": watched["samples"],
        "events": [e["type"] for e in probe["events"] if e["on"] == label],
        "mounts": probe["mounts"],
        "inserted": probe["inserted"],
        "commits": probe["commits"],
        "unmounts": probe["unmounts"],
        "longestLongTaskMs": round(max([t["ms"] for t in probe["longTasks"]], default=0), 1),
        "cdp": metric_delta(metrics_before, metrics_after, METRICS),
        "inertBefore": inert_before,
        "inertAfter": inert_after
    }


async def click_backdrop(page, side, hold_ms=1200):
    """Close the drawer the way a person does, by clicking beside it."""
    x = 1200 if side == "left" else 200
    await page.mouse.move(x, 500)
    await page.mouse.down()
    await page.mouse.up()
    await page.wait_for_timeout(hold_ms)


async def toggle_rounds(page, cdp, label, side, rounds, gap_ms, close_by="trigger",
                        rescue=10):
    """Open and close with the button itself, which is what a person does.

    Every cycle measured before this one closed the drawer with Escape, so the
    close-by-click path had never been driven at all. If a gesture leaves the
    drawer shut, it keeps clicking up to `rescue` times and reports how many it
    took, which is the owner's "erst nach vielen Versuchen".
    """
    out = []
    for index in range(1, rounds + 1):
        opening = await gesture(page, cdp, label, side)
        record = {"round": index, "opening": opening, "rescue": None}
        if not opening.get("openAtEnd"):
            tries = []
            for extra in range(1, rescue + 1):
                await page.wait_for_timeout(gap_ms)
                again = await gesture(page, cdp, label, side)
                tries.append(again)
                if again.get("openAtEnd"):
                    break
            record["rescue"] = {"clicks": len(tries), "opened": tries[-1].get("openAtEnd"),
                                "attempts": tries}
        await page.wait_for_timeout(gap_ms)
        if close_by == "backdrop":
            await click_backdrop(page, side)
            record["closing"] = {"by": "backdrop"}
        else:
            record["closing"] = await gesture(page, cdp, label, side)
            record["closing"]["by"] = "trigger"
        await page.wait_for_timeout(gap_ms)
        reader = "(side) => (DRAWERS)().some(d => d.side === side)".replace("DRAWERS", DRAWERS)
        record["shutAfterClose"] = not await page.evaluate(reader, side)
        out.append(record)
    opened = len([r for r in out if r["opening"].get("openAtEnd")])
    rescued = len([r for r in out if r.get("rescue")])
    return {
        "label": label, "side": side, "rounds": len(out), "gapMs": gap_ms,
        "closeBy": close_by,
        "openedFirstClick": opened,
        "neededMoreThanOne": rescued,
        "clicksWhenItNeededMore": [r["rescue"]["clicks"] + 1 for r in out if r.get("rescue")],
        "stillShutAfterRescue": len([r for r in out if r.get("rescue") and not r["rescue"]["opened"]]),
        "closedByItsOwnButton": len([r for r in out if r.get("shutAfterClose")]),
        "attempts": out
    }


# The inert window, sampled from inside the page.
#
# While a Chakra v3 dialog is open, Zag puts `pointer-events: none` on the
# body and `aria-hidden` on the app root, and takes them off when it closes.
# This records that pair every 50 ms, with `performance.now()` beside it, so a
# cleanup that is starved by the storm shows up as a page that is still inert
# after the drawer has gone, and the gaps between samples show the starvation
# itself.
SAMPLE_INERT = """({ms, label}) => new Promise(resolve => {
  const root = document.getElementById('___gatsby')
  const started = performance.now()
  const samples = []
  const inside = node => {
    let cursor = node
    while (cursor) {
      if (cursor.getAttribute && cursor.getAttribute('aria-label') === label) return true
      cursor = cursor.parentElement
    }
    return false
  }
  const button = document.querySelector('[aria-label="' + label + '"]')
  const tick = () => {
    const at = Math.round(performance.now() - started)
    let reaches = null
    if (button) {
      const box = button.getBoundingClientRect()
      reaches = inside(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2))
    }
    samples.push({
      at,
      body: getComputedStyle(document.body).pointerEvents,
      hidden: root ? root.getAttribute('aria-hidden') : null,
      dialogs: document.querySelectorAll('[data-scope="dialog"][data-part="content"]').length,
      reaches
    })
    if (at < ms) {
      setTimeout(tick, 50)
    } else {
      resolve(samples)
    }
  }
  tick()
})"""


def inert_summary(samples):
    """When the page became clickable again, and how starved the sampler was."""
    clickable = next((s["at"] for s in samples if s["body"] != "none" and s["reaches"]), None)
    dialogs_gone = next((s["at"] for s in samples if s["dialogs"] == 0), None)
    gaps = [b["at"] - a["at"] for a, b in zip(samples, samples[1:])]
    return {
        "samples": len(samples),
        "inertUntilMs": clickable,
        "dialogsGoneAtMs": dialogs_gone,
        "inertAfterTheDrawerWentMs": (None if clickable is None or dialogs_gone is None
                                      else clickable - dialogs_gone),
        "longestGapMs": max(gaps, default=0),
        "medianGapMs": sorted(gaps)[len(gaps) // 2] if gaps else None,
        "first": samples[0] if samples else None,
        "last": samples[-1] if samples else None,
        "trace": [s for i, s in enumerate(samples) if i < 40 or s["at"] % 500 == 0][:60]
    }


async def open_close_recover(page, cdp, label, side, rounds, close_by="backdrop", watch_ms=6000):
    """Open the drawer, close it the way a person does, and time the recovery."""
    out = []
    for index in range(1, rounds + 1):
        opened = await gesture(page, cdp, label, side, hold_ms=800)
        if not opened.get("openAtEnd"):
            out.append({"round": index, "opened": False, "opening": opened})
            await page.wait_for_timeout(800)
            continue
        if close_by == "escape":
            await page.keyboard.press("Escape")
        elif close_by == "closeButton":
            button = page.locator('[data-scope="dialog"][data-part="close-trigger"]').first
            if await button.count():
                await button.click(force=True)
        else:
            x = 1200 if side == "left" else 200
            await page.mouse.move(x, 500)
            await page.mouse.down()
            await page.mouse.up()
        samples = await page.evaluate(SAMPLE_INERT, {"ms": watch_ms, "label": label})
        after = await gesture(page, cdp, label, side, hold_ms=800)
        out.append({"round": index, "opened": True, "closeBy": close_by,
                    "recovery": inert_summary(samples),
                    "reopened": after.get("openAtEnd"),
                    "reopenEvents": after.get("events")})
        if after.get("openAtEnd"):
            await page.keyboard.press("Escape")
            await page.wait_for_timeout(700)
    return out


GEOMETRY = """({open_label, other_label}) => {
  const box = node => {
    if (!node) return null
    const r = node.getBoundingClientRect()
    return {x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height)}
  }
  const button = document.querySelector('[aria-label="' + open_label + '"]')
  const other = document.querySelector('[aria-label="' + other_label + '"]')
  const content = document.querySelector('[data-scope="dialog"][data-part="content"]')
  const overlap = (a, b) => (a && b) ? !(a.x + a.w <= b.x || b.x + b.w <= a.x ||
                                         a.y + a.h <= b.y || b.y + b.h <= a.y) : null
  const trigger = box(button)
  const panel = box(content)
  return {
    trigger, panel, otherTrigger: box(other),
    panelCoversItsOwnTrigger: overlap(trigger, panel),
    panelCoversTheOtherTrigger: overlap(box(other), panel)
  }
}"""


async def click_until_it_opens(page, cdp, label, side, tries=6):
    """Click one drawer button over and over, and count what it took."""
    attempts = []
    for index in range(1, tries + 1):
        attempt = await gesture(page, cdp, label, side, hold_ms=900)
        attempts.append({
            "click": index,
            "openBefore": attempt.get("openBefore"),
            "openAtEnd": attempt.get("openAtEnd"),
            "events": attempt.get("events"),
            "reachedTheButton": attempt.get("inertBefore", {}).get("pointerReachesButton"),
            "bodyPointerEvents": attempt.get("inertBefore", {}).get("bodyPointerEvents"),
            "dialogsBefore": attempt.get("inertBefore", {}).get("dialogNodes"),
            "dialogsAfter": attempt.get("inertAfter", {}).get("dialogNodes")
        })
        if attempt.get("openAtEnd"):
            break
        await page.wait_for_timeout(500)
    return {"label": label, "clicks": len(attempts),
            "opened": attempts[-1]["openAtEnd"] if attempts else None,
            "attempts": attempts}


async def swallow(page, cdp, first_label, first_side, second_label, second_side):
    """Open one drawer, then try to reach the other one's button."""
    out = {}
    await page.keyboard.press("Escape")
    await page.wait_for_timeout(700)
    out["opened"] = await open_drawer(page, first_label, first_side)
    out["geometry"] = await page.evaluate(
        GEOMETRY, {"open_label": first_label, "other_label": second_label})
    out["clickTheOtherButton"] = await click_until_it_opens(page, cdp, second_label, second_side)
    out["clickItsOwnButton"] = None
    await page.keyboard.press("Escape")
    await page.wait_for_timeout(900)
    out["shutAfterEscape"] = not await page.evaluate(
        "(side) => (DRAWERS)().some(d => d.side === side)".replace("DRAWERS", DRAWERS), second_side)
    return out


async def main():
    from playwright.async_api import async_playwright

    mode = sys.argv[1] if len(sys.argv) > 1 else "both"
    report = {"mode": mode, "origin": ORIGIN, "startedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}

    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        context = await browser.new_context(viewport={"width": 1440, "height": 900},
                                            locale="de-AT", timezone_id="Europe/Vienna")
        await context.add_init_script(PROBE)
        page = await context.new_page()
        notes = []
        page.on("pageerror", lambda error: notes.append("pageerror: %s" % str(error)[:200]))
        page.on("requestfailed", lambda request: notes.append("requestfailed: %s" % request.url[:120]))
        cdp = await context.new_cdp_session(page)
        await cdp.send("Performance.enable")

        if not await sign_in(page):
            print(json.dumps({"skipped": "the booklimo human admin did not sign in"}))
            await browser.close()
            return

        await page.goto(ORIGIN + "/", wait_until="domcontentloaded")
        await page.wait_for_timeout(4000)
        state = await page.evaluate(READ_STATE)
        report["remote"] = (state or {}).get("remote", {}).get("revision")
        report["isEditingAtStart"] = (state or {}).get("status", {}).get("isEditing")

        # ---- the control: edit mode off ----
        try:
            if mode in ("control", "both"):
                control = {"idle": await idle_writes(page, cdp, 5)}
                control["left"] = await cycle_drawer(page, cdp, LEFT, "left", cycles=6)
                await page.wait_for_timeout(800)
                control["right"] = await cycle_drawer(page, cdp, RIGHT, "right", cycles=6)
                report["control"] = control

            # ---- edit mode on ----
            if mode in ("editing", "both"):
                entered = await editing_on(page)
                await page.wait_for_timeout(4000)
                editing = {"editableFields": await page.locator('[contenteditable="true"]').count(),
                           "entered": entered}
                editing["idle"] = await idle_writes(page, cdp, 5)
                editing["left"] = await cycle_drawer(page, cdp, LEFT, "left", cycles=8)
                await page.wait_for_timeout(800)
                editing["right"] = await cycle_drawer(page, cdp, RIGHT, "right", cycles=8)
                report["editing"] = editing

            # ---- a minute of edit mode, which is what "after editing" is ----
            #
            # Every reading above is taken in the first seconds of edit mode.
            # The owner's sentence is about a CMS that has been open and
            # edited in, so this one leaves edit mode running and reads the
            # live node count, the heap and the frame rate every five seconds,
            # with a drawer opened at the start, in the middle and at the end.
            if mode in ("soak",):
                entered = await editing_on(page)
                await page.wait_for_timeout(3000)
                soak = {"entered": entered,
                        "editableFields": await page.locator('[contenteditable="true"]').count(),
                        "samples": [], "drawer": {}}
                count = """() => ({
                  elements: document.getElementsByTagName('*').length,
                  editable: document.querySelectorAll('[contenteditable="true"]').length,
                  listeners: 0
                })"""
                soak["drawer"]["at0s"] = await cycle_drawer(page, cdp, LEFT, "left", cycles=2)
                started = time.time()
                for step in range(13):
                    at = round(time.time() - started)
                    probe = await idle_writes(page, cdp, 5)
                    dom = await page.evaluate(count)
                    soak["samples"].append({
                        "atSeconds": at,
                        "elements": dom["elements"],
                        "editable": dom["editable"],
                        "commitsPerSecond": probe["commitsPerSecond"],
                        "framesPerSecond": probe["framesPerSecond"],
                        "writesPerSecond": probe["writesPerSecond"],
                        "mainThreadBusy": probe["mainThreadBusy"],
                        "longestLongTaskMs": probe["longestLongTaskMs"],
                        "mounts": probe["mounts"],
                        "nodesDelta": probe["cdp"]["Nodes"],
                        "heapUsedMB": round(probe["cdp"]["JSHeapUsedSize"] / 1e6, 1)
                    })
                    if step == 5:
                        soak["drawer"]["at30s"] = await cycle_drawer(page, cdp, LEFT, "left", cycles=2)
                soak["drawer"]["at70s"] = await cycle_drawer(page, cdp, LEFT, "left", cycles=3)
                soak["drawer"]["right70s"] = await cycle_drawer(page, cdp, RIGHT, "right", cycles=3)
                report["soak"] = soak

            # ---- clicked the way an impatient person clicks ----
            if mode in ("burst",):
                bursts = {"control": {}, "editing": {}}
                for clicks in (1, 2, 3, 4):
                    bursts["control"][str(clicks)] = await burst(
                        page, cdp, LEFT, "left", clicks, 150)
                bursts["controlIdle"] = await idle_writes(page, cdp, 3)

                entered = await editing_on(page)
                await page.wait_for_timeout(4000)
                bursts["entered"] = entered
                bursts["editableFields"] = await page.locator('[contenteditable="true"]').count()
                bursts["editingIdle"] = await idle_writes(page, cdp, 5)
                for clicks in (1, 2, 3, 4, 5):
                    bursts["editing"][str(clicks)] = await burst(
                        page, cdp, LEFT, "left", clicks, 150)
                bursts["editingFast"] = {}
                for clicks in (2, 3, 4):
                    bursts["editingFast"][str(clicks)] = await burst(
                        page, cdp, LEFT, "left", clicks, 60)
                report["burst"] = bursts

            # ---- edit mode the way a person turns it on ----
            #
            # Every run above put `status.isEditing` into the store through an
            # init script, which is the notebooks' own door and is not the
            # owner's. His is the user drawer, whose "Bearbeitung starten" is
            # the entry this file's slice registers, and the drawer closes
            # itself on the click. So the sequence that produced his sentence
            # is: open the right drawer, turn editing on from inside it, edit,
            # and then try to open a drawer again.
            if mode in ("realistic",):
                real = {}
                await page.goto(ORIGIN + "/", wait_until="domcontentloaded")
                await page.wait_for_timeout(5000)
                real["before"] = await cycle_drawer(page, cdp, RIGHT, "right", cycles=1)

                opened = await open_drawer(page, RIGHT, "right")
                real["userDrawerOpened"] = opened
                item = page.get_by_text("Bearbeitung starten", exact=True).first
                real["editItem"] = await item.count()
                if await item.count():
                    await item.click()
                    await page.wait_for_timeout(4000)
                real["editableFields"] = await page.locator('[contenteditable="true"]').count()
                real["idle"] = await idle_writes(page, cdp, 5)
                real["left"] = await cycle_drawer(page, cdp, LEFT, "left", cycles=8)
                await page.wait_for_timeout(800)
                real["right"] = await cycle_drawer(page, cdp, RIGHT, "right", cycles=8)

                # and out of edit mode again, the same way.
                if await open_drawer(page, RIGHT, "right"):
                    stop = page.get_by_text("Bearbeitung beenden", exact=True).first
                    if await stop.count():
                        await stop.click()
                        await page.wait_for_timeout(3000)
                real["editableFieldsAfter"] = await page.locator('[contenteditable="true"]').count()
                report["realistic"] = real

            # ---- the same click on a slower machine ----
            #
            # Not an emulation of the owner's MacBook, which is faster than
            # this throttle makes anything: it is the one knob that tells
            # hypothesis A from hypothesis B. If the drawer is late or lost
            # because the main thread is saturated, giving the main thread less
            # of a machine makes it worse in proportion. If it is lost because
            # something throws its state away, the throttle changes nothing
            # about how often that happens.
            if mode in ("throttle",):
                entered = await editing_on(page)
                await page.wait_for_timeout(4000)
                throttled = {"entered": entered,
                             "editableFields": await page.locator('[contenteditable="true"]').count(),
                             "rates": {}}
                for rate in (1, 4, 8, 20):
                    await cdp.send("Emulation.setCPUThrottlingRate", {"rate": rate})
                    await page.wait_for_timeout(2000)
                    at = {"idle": await idle_writes(page, cdp, 5)}
                    at["left"] = await cycle_drawer(page, cdp, LEFT, "left", cycles=6, hold_ms=3000)
                    at["right"] = await cycle_drawer(page, cdp, RIGHT, "right", cycles=4, hold_ms=3000)
                    throttled["rates"][str(rate)] = at
                await cdp.send("Emulation.setCPUThrottlingRate", {"rate": 1})
                report["throttle"] = throttled

            # ---- after a real edit, which is the owner's own sentence ----
            if mode in ("afterEdit",):
                entered = await editing_on(page)
                await page.wait_for_timeout(4000)
                after = {"entered": entered,
                         "editableFields": await page.locator('[contenteditable="true"]').count()}
                after["idle"] = await idle_writes(page, cdp, 5)

                stem = os.environ.get("JAEN_FIELD_STEM", "Our fleet")
                suffix = " drawer probe"
                target = await page.evaluate(TYPE_TARGET, stem)
                after["target"] = target
                if target.get("x") is not None:
                    original = target["text"]
                    after["original"] = original
                    await page.mouse.click(target["x"], target["y"])
                    await page.keyboard.press("End")
                    await page.keyboard.type(suffix, delay=60)

                    # 1. the caret is still in the field and nothing has blurred,
                    #    which is the moment a person reaches for the hamburger.
                    after["caretInField"] = await cycle_drawer(page, cdp, LEFT, "left", cycles=6)

                    await page.keyboard.press("Tab")
                    await page.wait_for_timeout(3000)
                    after["afterBlurLeft"] = await cycle_drawer(page, cdp, LEFT, "left", cycles=8)
                    await page.wait_for_timeout(800)
                    after["afterBlurRight"] = await cycle_drawer(page, cdp, RIGHT, "right", cycles=8)

                    # 2. typing and clicking at the same time, which is the storm
                    #    at its loudest.
                    typed = await page.evaluate(TYPE_TARGET, original)
                    if typed.get("x") is not None:
                        await page.mouse.click(typed["x"], typed["y"])
                        await page.keyboard.press("End")
                        typing = asyncio.create_task(page.keyboard.type("abcdefghijklmnopqrst", delay=250))
                        after["whileTyping"] = await cycle_drawer(page, cdp, LEFT, "left", cycles=5, hold_ms=1200)
                        await typing
                        await page.wait_for_timeout(2000)

                    # Set it back, and read it back.
                    back = None
                    for candidate in (original + suffix + "abcdefghijklmnopqrst",
                                      original + suffix, original):
                        found = await page.evaluate(TYPE_TARGET, candidate)
                        if found.get("x") is not None and found["text"] != original:
                            back = (found, len(found["text"]) - len(original))
                            break
                    after["setBack"] = {"found": back[0] if back else None,
                                        "remove": back[1] if back else 0}
                    if back:
                        await page.mouse.click(back[0]["x"], back[0]["y"])
                        await page.keyboard.press("End")
                        for _ in range(back[1]):
                            await page.keyboard.press("Backspace")
                        await page.keyboard.press("Tab")
                        await page.wait_for_timeout(8000)
                    after["readBack"] = await page.evaluate(
                        """() => Array.from(document.querySelectorAll('[contenteditable="true"]'))
                             .map(n => (n.innerText || '').trim())
                             .filter(t => t.startsWith('STEM'))""".replace("STEM", stem))
                    state = await page.evaluate(READ_STATE)
                    after["remoteAfter"] = {k: (state or {}).get("remote", {}).get(k)
                                            for k in ("revision", "publishedRevision", "saveState", "outbox")}
                report["afterEdit"] = after


            # ---- closed with the button, not with Escape ----
            #
            # Every cycle above closed the drawer with Escape, so the path a
            # person actually takes, clicking the same button again, had never
            # been driven. This mode drives it, at a person's pace and at a
            # pace that interrupts the exit animation, and reads what the page
            # looks like to a pointer after every gesture, which is what a
            # leftover backdrop or an inert body would show.
            if mode in ("inert",):
                out = {}
                await page.goto(ORIGIN + "/", wait_until="domcontentloaded")
                await page.wait_for_timeout(5000)
                out["controlLeft"] = await toggle_rounds(page, cdp, LEFT, "left", 4, 500)
                out["controlIdle"] = await idle_writes(page, cdp, 3)

                entered = await editing_on(page)
                await page.wait_for_timeout(4000)
                out["entered"] = entered
                out["editableFields"] = await page.locator('[contenteditable="true"]').count()
                out["editingIdle"] = await idle_writes(page, cdp, 5)
                out["editingLeftSlow"] = await toggle_rounds(page, cdp, LEFT, "left", 8, 500)
                out["editingLeftFast"] = await toggle_rounds(page, cdp, LEFT, "left", 8, 120)
                out["editingRightSlow"] = await toggle_rounds(page, cdp, RIGHT, "right", 6, 500)
                out["editingLeftBackdrop"] = await toggle_rounds(
                    page, cdp, LEFT, "left", 6, 400, close_by="backdrop")
                await cdp.send("Emulation.setCPUThrottlingRate", {"rate": 6})
                await page.wait_for_timeout(2000)
                out["editingLeftThrottled"] = await toggle_rounds(page, cdp, LEFT, "left", 6, 400)
                await cdp.send("Emulation.setCPUThrottlingRate", {"rate": 1})
                report["inert"] = out


            # ---- the moment the owner names: right after editing is turned on ----
            #
            # "Bearbeitung starten" sits inside the user drawer, so the act
            # that starts the storm is also the act that closes a dialog. If
            # the dialog's cleanup is starved, the page stays inert with no
            # drawer on it, which is a CMS that answers no click at all.
            if mode in ("after",):
                out = {}
                await page.goto(ORIGIN + "/", wait_until="domcontentloaded")
                await page.wait_for_timeout(5000)
                out["controlRecovery"] = await open_close_recover(page, cdp, LEFT, "left", 3)
                out["controlIdle"] = await idle_writes(page, cdp, 3)

                # the owner's own door into edit mode
                opened = await open_drawer(page, RIGHT, "right")
                out["userDrawerOpened"] = opened
                item = page.get_by_text("Bearbeitung starten", exact=True).first
                out["editItem"] = await item.count()
                if await item.count():
                    await item.click()
                    out["afterStart"] = inert_summary(
                        await page.evaluate(SAMPLE_INERT, {"ms": 15000, "label": LEFT}))
                await page.wait_for_timeout(2000)
                out["editableFields"] = await page.locator('[contenteditable="true"]').count()
                out["editingIdle"] = await idle_writes(page, cdp, 5)
                out["editingRecoveryBackdrop"] = await open_close_recover(
                    page, cdp, LEFT, "left", 4)
                out["editingRecoveryEscape"] = await open_close_recover(
                    page, cdp, LEFT, "left", 3, close_by="escape")
                out["editingRecoveryCloseButton"] = await open_close_recover(
                    page, cdp, LEFT, "left", 3, close_by="closeButton")
                out["editingRecoveryRight"] = await open_close_recover(
                    page, cdp, RIGHT, "right", 3)

                # and the way out of edit mode, which closes a drawer as well
                if await open_drawer(page, RIGHT, "right"):
                    stop = page.get_by_text("Bearbeitung beenden", exact=True).first
                    out["stopItem"] = await stop.count()
                    if await stop.count():
                        await stop.click()
                        out["afterStop"] = inert_summary(
                            await page.evaluate(SAMPLE_INERT, {"ms": 10000, "label": LEFT}))
                out["editableFieldsAfter"] = await page.locator('[contenteditable="true"]').count()
                report["after"] = out


            # ---- one drawer open, the other one's button clicked ----
            #
            # Hypothesis A says the click is late, hypothesis B says the state
            # is thrown away. This measures the third thing: whether the click
            # arrives at all while a drawer stands, with edit mode off as the
            # control, because a cause that is there without the storm is not
            # the storm's.
            if mode in ("swallow",):
                out = {}
                await page.goto(ORIGIN + "/", wait_until="domcontentloaded")
                await page.wait_for_timeout(5000)
                out["controlLeftThenRight"] = await swallow(page, cdp, LEFT, "left", RIGHT, "right")
                out["controlRightThenLeft"] = await swallow(page, cdp, RIGHT, "right", LEFT, "left")
                out["controlLeftThenLeft"] = await swallow(page, cdp, LEFT, "left", LEFT, "left")

                entered = await editing_on(page)
                await page.wait_for_timeout(4000)
                out["entered"] = entered
                out["editableFields"] = await page.locator('[contenteditable="true"]').count()
                out["editingLeftThenRight"] = await swallow(page, cdp, LEFT, "left", RIGHT, "right")
                out["editingRightThenLeft"] = await swallow(page, cdp, RIGHT, "right", LEFT, "left")
                out["editingLeftThenLeft"] = await swallow(page, cdp, LEFT, "left", LEFT, "left")
                out["editingRightThenRight"] = await swallow(page, cdp, RIGHT, "right", RIGHT, "right")
                report["swallow"] = out

        except Exception as error:
            # A run that dies still hands over what it measured and what it
            # left standing on the live draft, which is the thing that has to
            # be set back.
            report["failed"] = "%s: %s" % (type(error).__name__, error)

        report["notes"] = notes[-20:]
        print(json.dumps(report, indent=1))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
