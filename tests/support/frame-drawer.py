"""The frame's two drawers, driven on a local production build of booklimo.at.

The verifier of `tests/11-cms-frame.ipynb`. It prints one JSON document on
stdout and nothing else, so the notebook can judge it.

What it is for. `docs/architecture/editing-performance.md`, "The drawer that
would not open", measured the cause of the owner's sentence: while a drawer
stands the page is inert, each 320px panel covers its own trigger, and 56 of
56 gestures aimed at a drawer button produced no pointer event on it at all.
This run drives the same gestures against the fix in
`packages/gatsby-plugin-jaen/src/components/JaenFrame/`.

It serves booklimo's own production build under its own origin, the way the
editing notebooks' harness does (`gatsby serve` behind a socat TLS listener and
a chromium told to resolve booklimo.at to it), because the OIDC client, the
agent and the storage gateway all check the origin. It signs in as the
booklimo human admin, turns edit mode on, and types into one field, which is
the state the owner reported the failure in.

Every gesture is `mouse.move`, `mouse.down`, `mouse.up` at the button's own
coordinates and never `locator.click()`, because playwright re-resolves and
retries a locator, which would hide exactly the failure this is measuring.

Modes
  frame   the whole run: the first click from a shut page at two widths, the
          gesture that goes from one drawer to the other, the drawer closed by
          its own button, an impatient burst, the storm dispatched into the
          store in a loop, and the same gestures after a field was typed. The
          field is set back and read back before the run ends.
"""
import asyncio
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request

SITE_DIR = os.environ.get("JAEN_SITE_BUILD", "/home/snekmin/git/limosen-v3/booklimo.at")
ORIGIN = "https://booklimo.at"
HTTP_PORT = int(os.environ.get("JAEN_SITE_PORT", "9231"))
TLS_PORT = HTTP_PORT + 1
CONFIG = pathlib.Path(os.path.expanduser("~/.config/taxi-app"))
PERSIST_KEY = "jaenjs-state"
LEFT = "Open main menu"
RIGHT = "Open user menu"
FIELD_STEM = os.environ.get("JAEN_FIELD_STEM", "Our fleet")
SUFFIX = " frame probe"


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


class Site:
    """booklimo's own production build, served under its own name."""

    def __init__(self):
        self.tmp = pathlib.Path(tempfile.mkdtemp(prefix="jaen-frame-"))
        subprocess.run(
            ["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "2",
             "-keyout", str(self.tmp / "key.pem"), "-out", str(self.tmp / "cert.pem"),
             "-subj", "/CN=booklimo.at", "-addext", "subjectAltName=DNS:booklimo.at"],
            check=True, capture_output=True)
        env = dict(os.environ, NODE_OPTIONS="--no-network-family-autoselection")
        self.http = subprocess.Popen(
            [str(pathlib.Path(SITE_DIR) / "node_modules" / ".bin" / "gatsby"),
             "serve", "-p", str(HTTP_PORT)],
            cwd=SITE_DIR, env=env,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self.tls = subprocess.Popen(
            ["socat", "OPENSSL-LISTEN:%d,reuseaddr,fork,cert=%s,key=%s,verify=0"
             % (TLS_PORT, self.tmp / "cert.pem", self.tmp / "key.pem"),
             "TCP:127.0.0.1:%d" % HTTP_PORT],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(90):
            try:
                urllib.request.urlopen("http://localhost:%d/" % HTTP_PORT, timeout=2).read()
                return
            except Exception:
                time.sleep(1)
        self.stop()
        raise RuntimeError("gatsby serve did not answer within ninety seconds")

    def stop(self):
        for process in (self.http, self.tls):
            try:
                process.terminate()
                process.wait(timeout=10)
            except Exception:
                pass
        shutil.rmtree(self.tmp, ignore_errors=True)


# Installed before any script of the page.
#
# Three things and nothing that touches the CMS. React's own commit counter and
# the fiber root, through the devtools hook React looks for when it boots (the
# root is how the redux store is found later, without a global of jaen's own).
# A counted wrapper around localStorage.setItem. And the identity of the two
# trigger nodes, watched every animation frame, which is the remount counter
# the earlier measurement used.
#
# The pointer listeners are the new part and they are deliberately two. One on
# `window` in the capture phase, registered here and therefore before any
# listener of the page, sees every gesture. One on `document`, which the
# frame's own router runs in front of, sees only the gestures the router let
# through. The difference between the two is the router doing its work.
PROBE = """(() => {
  const P = (window.__frameProbe = {
    commits: 0,
    root: null,
    writes: [],
    mounts: {left: 0, right: 0},
    inserted: {left: 0, right: 0},
    windowEvents: [],
    documentEvents: [],
    frames: 0
  })

  if (!window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      renderers: new Map(),
      supportsFiber: true,
      inject: function () { return 1 },
      onCommitFiberRoot: function (id, root) { P.commits++; P.root = root },
      onCommitFiberUnmount: function () {},
      onPostCommitFiberRoot: function () {},
      checkDCE: function () {}
    }
  }

  const setItem = Storage.prototype.setItem
  Storage.prototype.setItem = function (key, value) {
    const answer = setItem.call(this, key, value)
    P.writes.push({key: key, at: performance.now(), bytes: String(value).length})
    return answer
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
            if (node.matches(SEL[side]) || node.querySelector(SEL[side])) P.inserted[side]++
          }
        }
      }
    }).observe(header, {childList: true, subtree: true})
  }
  watchHeader()

  const note = (bucket, event) => {
    const target = event.target && event.target.closest
      ? event.target.closest(SEL.left + ',' + SEL.right)
      : null
    bucket.push({
      type: event.type,
      at: performance.now(),
      x: event.clientX,
      y: event.clientY,
      on: target ? target.getAttribute('aria-label') : null,
      tag: event.target && event.target.tagName ? event.target.tagName.toLowerCase() : null
    })
  }
  for (const type of ['pointerdown', 'click']) {
    window.addEventListener(type, e => note(P.windowEvents, e), true)
    document.addEventListener(type, e => note(P.documentEvents, e), true)
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

# What "open" means, read off the DOM and never off a state of ours.
#
# By the trigger's own `aria-controls` and not by geometry. The first cut of
# this read the two panels' x coordinates and called the one in the left half
# of the viewport the left drawer, which is true at 1440 and false at 390: the
# right panel is 320px wide on a 390px screen, so it stands at x 70 and reads
# as "left", and during its slide it crosses the middle, so one gesture was
# counted as an open and a close. The trigger now lives inside its own
# `Drawer.Root`, so Ark names the panel on the button that opens it, which is
# exact at every width. `data-state` is Ark's own, and it says `open` from the
# first frame of the enter animation, so "opened at" below is the start of the
# animation and not the end of it.
DRAWER_FOR = """(label) => {
  const trigger = document.querySelector('[aria-label="' + label + '"]')
  if (!trigger) return {found: false, reason: 'no trigger'}
  const id = trigger.getAttribute('aria-controls')
  if (!id) return {found: false, reason: 'no aria-controls'}
  const node = document.getElementById(id)
  if (!node) return {found: false, reason: 'not mounted'}
  const box = node.getBoundingClientRect()
  const state = node.getAttribute('data-state')
  return {found: state === 'open' && box.width > 0 && box.height > 0,
          state: state, x: Math.round(box.x), w: Math.round(box.width)}
}"""

# Every dialog Ark has open, whatever it belongs to, for the shut-everything
# guard and for the record of what stood.
DRAWERS = """() => Array.from(
  document.querySelectorAll('[data-scope="dialog"][data-part="content"]')
).filter(node => {
  const box = node.getBoundingClientRect()
  return box.width > 0 && box.height > 0 && node.getAttribute('data-state') === 'open'
}).map(node => ({id: node.id, state: node.getAttribute('data-state'),
                 x: Math.round(node.getBoundingClientRect().x)}))"""

IS_OPEN = "(label) => (DRAWER_FOR)(label).found".replace("DRAWER_FOR", DRAWER_FOR)

# Sampled every animation frame, so a drawer that opens and is thrown away a
# few milliseconds later is seen rather than missed by a poll.
WATCH_OPEN = """({ms, label}) => new Promise(resolve => {
  const started = performance.now()
  const samples = []
  let previous = null
  let openedAt = null
  const read = () => (DRAWER_FOR)(label).found
  const tick = () => {
    const now = read()
    if (now !== previous) {
      samples.push({at: Math.round(performance.now() - started), open: now})
      if (now && openedAt === null) openedAt = Math.round(performance.now() - started)
      previous = now
    }
    if (performance.now() - started < ms) requestAnimationFrame(tick)
    else resolve({samples: samples, openAtEnd: read(), openedAtMs: openedAt})
  }
  tick()
})""".replace("DRAWER_FOR", DRAWER_FOR)

TRIGGER_FACTS = """(label) => {
  const node = document.querySelector('[aria-label="' + label + '"]')
  if (!node) return null
  const box = node.getBoundingClientRect()
  return {
    tag: node.tagName.toLowerCase(),
    ariaHasPopup: node.getAttribute('aria-haspopup'),
    ariaExpanded: node.getAttribute('aria-expanded'),
    ariaControls: node.getAttribute('aria-controls'),
    dataScope: node.getAttribute('data-scope'),
    dataPart: node.getAttribute('data-part'),
    box: {x: Math.round(box.x), y: Math.round(box.y),
          w: Math.round(box.width), h: Math.round(box.height)}
  }
}"""

INERT_STATE = """({x, y}) => {
  const style = getComputedStyle(document.body)
  const root = document.getElementById('___gatsby')
  const top = document.elementFromPoint(x, y)
  return {
    bodyPointerEvents: style.pointerEvents,
    bodyOverflow: style.overflow,
    rootAriaHidden: root ? root.getAttribute('aria-hidden') : null,
    dialogNodes: document.querySelectorAll('[data-scope="dialog"][data-part="content"]').length,
    topAtTrigger: top ? top.tagName.toLowerCase() : null,
    topLabel: top ? (top.closest('[aria-label]') || {getAttribute: () => null}).getAttribute('aria-label') : null
  }
}"""

# The storm, dispatched into jaen's own store in a loop.
#
# The store is a module singleton (`packages/jaen/src/redux/index.tsx`) and is
# on no global, so it is taken off react-redux's Provider fiber through the
# devtools hook this probe installed before React booted. `pages/field_register`
# is the action the register storm actually dispatches, and it is the one the
# recorder in remote-state.ts does not translate into a change, so a loop of
# them reaches no agent and no draft: the run asserts that by reading the
# outbox before and after. The page id is synthetic and belongs to no page.
STORM_START = """({perFrame}) => {
  const P = window.__frameProbe
  if (!P) return {error: 'the probe is not installed'}
  if (window.__frameStorm) return {already: true}

  const diagnostic = {roots: 0, fibers: 0, withStore: [], stateKeys: null}
  const looksLikeTheStore = candidate => {
    if (!candidate || typeof candidate.dispatch !== 'function' ||
        typeof candidate.getState !== 'function') return false
    let state = null
    try { state = candidate.getState() } catch (error) { return false }
    if (!state) return false
    diagnostic.stateKeys = Object.keys(state)
    // The slice is named `pages` (so its actions read `pages/...`) and its key
    // in combineReducers is `page`. The first cut of this asked for
    // `state.pages` and rejected the real store 24 times over.
    return !!((state.page || state.pages) && state.status && state.remote)
  }

  let store = null
  const seen = new Set()
  const walk = fiber => {
    while (fiber && !store) {
      if (seen.has(fiber)) return
      seen.add(fiber)
      diagnostic.fibers++
      const props = fiber.memoizedProps
      if (props) {
        // react-redux's own Provider carries the store on `store`, and the
        // context provider it renders carries it on `value.store`. Both are
        // taken, because which of the two is in the tree is a version detail.
        const candidates = [props.store, props.value && props.value.store]
        for (const candidate of candidates) {
          if (candidate && typeof candidate.dispatch === 'function') {
            diagnostic.withStore.push(typeof fiber.type === 'string'
              ? fiber.type
              : (fiber.type && (fiber.type.displayName || fiber.type.name)) || 'anonymous')
          }
          if (looksLikeTheStore(candidate)) { store = candidate; return }
        }
      }
      walk(fiber.child)
      fiber = fiber.sibling
    }
  }
  const roots = []
  if (P.root) roots.push(P.root)
  for (const root of roots) {
    diagnostic.roots++
    walk(root.current)
    if (!store && root.current && root.current.alternate) walk(root.current.alternate)
  }

  // The module cache, as the second way in. A webpack 5 bundle exposes it as
  // `__webpack_require__.c` and the store is a module singleton
  // (packages/jaen/src/redux/index.tsx), so it is an export of one module.
  if (!store) {
    try {
      const key = Object.keys(window).find(k => k.startsWith('webpackChunk'))
      if (key) {
        let req = null
        window[key].push([['__jaen_frame_probe__'], {}, r => { req = r }])
        diagnostic.webpack = !!req && !!(req && req.c)
        if (req && req.c) {
          for (const id of Object.keys(req.c)) {
            let exports = null
            try { exports = req.c[id].exports } catch (error) { continue }
            if (!exports) continue
            if (looksLikeTheStore(exports.store)) { store = exports.store; break }
          }
        }
      }
    } catch (error) {
      diagnostic.webpackError = String(error)
    }
  }

  if (!store) return {error: 'the jaen store was not found', diagnostic: diagnostic}

  let n = 0
  const pageId = 'JaenPage /jaen-frame-storm-probe'
  const loop = () => {
    for (let i = 0; i < perFrame; i++) {
      n++
      store.dispatch({
        type: 'pages/field_register',
        payload: {pageId: pageId, fieldType: 'IMA:TextField',
                  fieldName: 'storm' + (n % 40), props: {n: n}}
      })
    }
    window.__frameStorm.handle = requestAnimationFrame(loop)
  }
  window.__frameStorm = {handle: 0, count: () => n, started: performance.now()}
  window.__frameStorm.handle = requestAnimationFrame(loop)
  return {started: true, diagnostic: diagnostic}
}"""

STORM_STOP = """() => {
  const S = window.__frameStorm
  if (!S) return {stopped: false}
  cancelAnimationFrame(S.handle)
  const answer = {stopped: true, dispatched: S.count(),
                  seconds: (performance.now() - S.started) / 1000}
  delete window.__frameStorm
  return answer
}"""

RESET_PROBE = """() => {
  const P = window.__frameProbe
  if (!P) return false
  P.writes.length = 0
  P.windowEvents.length = 0
  P.documentEvents.length = 0
  P.mounts.left = 0
  P.mounts.right = 0
  P.inserted.left = 0
  P.inserted.right = 0
  P.frames = 0
  P.commits = 0
  return true
}"""

READ_PROBE = """() => {
  const P = window.__frameProbe
  if (!P) return null
  return {commits: P.commits, frames: P.frames, writes: P.writes.length,
          mounts: {left: P.mounts.left, right: P.mounts.right},
          inserted: {left: P.inserted.left, right: P.inserted.right},
          windowEvents: P.windowEvents.slice(-12),
          documentEvents: P.documentEvents.slice(-12)}
}"""

TYPE_TARGET = """(value) => {
  const nodes = Array.from(document.querySelectorAll('[contenteditable="true"]'))
  const found = nodes.find(node => (node.innerText || '').trim() === value)
    || nodes.find(node => (node.innerText || '').trim().startsWith(value))
  if (!found) return {miss: nodes.map(n => (n.innerText || '').trim().slice(0, 40)).slice(0, 20)}
  const box = found.getBoundingClientRect()
  return {x: box.x + box.width / 2, y: box.y + box.height / 2, text: found.innerText.trim()}
}"""


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
        for selector in ["button[name='skip']", "#skip-button",
                         "button:has-text('Überspringen')"]:
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


async def editing_on(page):
    await page.goto(ORIGIN + "/", wait_until="domcontentloaded")
    for _ in range(40):
        if await page.evaluate("() => localStorage.getItem('%s') !== null" % PERSIST_KEY):
            break
        await page.wait_for_timeout(1000)
    # Through an init script and never by writing the persisted store and
    # reloading: the running page persists itself on every dispatch and would
    # write its own isEditing: false back within a second. Measured by the
    # deploy run of draft-state.md.
    await page.context.add_init_script(SET_EDITING_AT_BOOT)
    await page.reload(wait_until="domcontentloaded")
    for _ in range(40):
        if await page.locator('[contenteditable="true"]').count():
            return True
        await page.wait_for_timeout(1000)
    return False


async def trigger_box(page, label):
    locator = page.locator('[aria-label="%s"]' % label).first
    if not await locator.count():
        return None
    return await locator.bounding_box()


async def gesture(page, label, side, hold_ms=1400):
    """One mouse gesture at the button's own coordinates, and what followed."""
    box = await trigger_box(page, label)
    if box is None:
        return {"skipped": "the button has no box"}
    x = box["x"] + box["width"] / 2
    y = box["y"] + box["height"] / 2
    before = await page.evaluate(IS_OPEN, label)
    inert_before = await page.evaluate(INERT_STATE, {"x": x, "y": y})
    await page.evaluate(RESET_PROBE)
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.up()
    watched = await page.evaluate(WATCH_OPEN, {"ms": hold_ms, "label": label})
    probe = await page.evaluate(READ_PROBE)
    return {
        "at": {"x": round(x), "y": round(y)},
        "openBefore": before,
        "openedAtMs": watched["openedAtMs"],
        "openAtEnd": watched["openAtEnd"],
        "transitions": watched["samples"],
        "commits": probe["commits"],
        "mounts": probe["mounts"],
        "inserted": probe["inserted"],
        "windowSawPointerdown": any(e["type"] == "pointerdown" for e in probe["windowEvents"]),
        "documentSawPointerdown": any(e["type"] == "pointerdown" for e in probe["documentEvents"]),
        "inertBefore": inert_before
    }


async def shut_everything(page):
    for _ in range(4):
        state = await page.evaluate(DRAWERS)
        if not state:
            return True
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(700)
    return not await page.evaluate(DRAWERS)


async def first_click_rounds(page, label, side, rounds=10):
    """From a page with nothing open: one click, and does it stay open."""
    tries = []
    for _ in range(rounds):
        await shut_everything(page)
        await page.wait_for_timeout(350)
        answer = await gesture(page, label, side)
        # Still open a second and a half later, which is the "stays open" half.
        answer["stillOpen"] = await page.evaluate(IS_OPEN, label)
        tries.append(answer)
        await shut_everything(page)
    return {
        "label": label, "side": side, "rounds": len(tries),
        "openedOnFirstClick": len([t for t in tries if t.get("openAtEnd")]),
        "stayedOpen": len([t for t in tries if t.get("stillOpen")]),
        "startedShut": len([t for t in tries if t.get("openBefore") is False]),
        "openedAtMs": sorted([t["openedAtMs"] for t in tries if t.get("openedAtMs") is not None]),
        "attempts": tries
    }


async def cross_rounds(page, rounds=4):
    """With one drawer standing, one gesture on the other drawer's button."""
    pairs = []
    for index in range(rounds):
        first_label, first_side, second_label, second_side = (
            (LEFT, "left", RIGHT, "right") if index % 2 == 0
            else (RIGHT, "right", LEFT, "left"))
        await shut_everything(page)
        await page.wait_for_timeout(350)
        opened = await gesture(page, first_label, first_side)
        # Past the settle window, which is what a person's second reach is.
        await page.wait_for_timeout(900)
        switched = await gesture(page, second_label, second_side)
        pairs.append({
            "from": first_side, "to": second_side,
            "firstOpened": opened.get("openAtEnd"),
            "secondOpened": switched.get("openAtEnd"),
            "firstStillOpen": await page.evaluate(IS_OPEN, first_label),
            "windowSawPointerdown": switched.get("windowSawPointerdown"),
            "documentSawPointerdown": switched.get("documentSawPointerdown"),
            "inertBefore": switched.get("inertBefore")
        })
        await shut_everything(page)
    return {"rounds": len(pairs),
            "switchedOnOneClick": len([p for p in pairs
                                       if p["secondOpened"] and not p["firstStillOpen"]]),
            "pairs": pairs}


async def own_trigger_rounds(page, label, side, rounds=5):
    """The drawer closed by the button that opened it, which the panel covers."""
    tries = []
    for _ in range(rounds):
        await shut_everything(page)
        await page.wait_for_timeout(350)
        opened = await gesture(page, label, side)
        await page.wait_for_timeout(900)
        closed = await gesture(page, label, side)
        tries.append({"opened": opened.get("openAtEnd"),
                      "closedAfter": not closed.get("openAtEnd"),
                      "topAtTrigger": closed.get("inertBefore", {}).get("topAtTrigger")})
        await shut_everything(page)
    return {"rounds": len(tries),
            "closedByItsOwnButton": len([t for t in tries if t["opened"] and t["closedAfter"]]),
            "attempts": tries}


async def burst_rounds(page, label, side, clicks=4, gap_ms=100, rounds=3):
    """An impatient burst, and the click after it.

    What is asserted here is not the parity of the burst. The trigger is a
    toggle and a toggle toggles: a burst that runs past the settle window of
    `drawer-state.ts` opens and closes, which is what any menu button does and
    what `aria-expanded` on the button promises. The measurement below records
    the real span of the burst, taken from the page's own timestamps rather
    than from python's, because each playwright mouse call is a round trip to
    a main thread the storm keeps busy and the nominal gap is not the gap.

    What must be true is the owner's sentence turned around: after a burst the
    button still works on the very next click.
    """
    tries = []
    for _ in range(rounds):
        await shut_everything(page)
        await page.wait_for_timeout(350)
        box = await trigger_box(page, label)
        x = box["x"] + box["width"] / 2
        y = box["y"] + box["height"] / 2
        await page.evaluate(RESET_PROBE)
        await page.mouse.move(x, y)
        for index in range(clicks):
            await page.mouse.down()
            await page.mouse.up()
            if index < clicks - 1:
                await page.wait_for_timeout(gap_ms)
        watched = await page.evaluate(WATCH_OPEN, {"ms": 1500, "label": label})
        probe = await page.evaluate(READ_PROBE)
        downs = [e["at"] for e in probe["windowEvents"] if e["type"] == "pointerdown"]
        await shut_everything(page)
        await page.wait_for_timeout(900)
        recovery = await gesture(page, label, side)
        tries.append({
            "clicks": clicks, "gapMs": gap_ms,
            "pointerdownsSeen": len(downs),
            "realSpanMs": round(downs[-1] - downs[0]) if len(downs) > 1 else 0,
            "openAtEnd": watched["openAtEnd"],
            "transitions": watched["samples"],
            "nextClickOpened": recovery.get("openAtEnd")
        })
        await shut_everything(page)
    return {"rounds": len(tries),
            "openAtEnd": len([t for t in tries if t["openAtEnd"]]),
            "nextClickOpened": len([t for t in tries if t["nextClickOpened"]]),
            "attempts": tries}


async def storm_window(page, seconds=5):
    """What the artificial storm costs, so it can be held beside the real one."""
    await page.evaluate(RESET_PROBE)
    await page.wait_for_timeout(int(seconds * 1000))
    probe = await page.evaluate(READ_PROBE)
    return {"seconds": seconds,
            "commitsPerSecond": round(probe["commits"] / seconds, 1),
            "framesPerSecond": round(probe["frames"] / seconds, 1),
            "writesPerSecond": round(probe["writes"] / seconds, 1),
            "mounts": probe["mounts"], "inserted": probe["inserted"]}


async def outbox(page):
    state = await page.evaluate(READ_STATE)
    remote = (state or {}).get("remote", {}) or {}
    return {"outbox": len(remote.get("outbox") or []),
            "revision": remote.get("revision"),
            "publishedRevision": remote.get("publishedRevision"),
            "saveState": remote.get("saveState")}


async def run(page, report, only=None):
    # ---- 1. edit mode, and one field typed, which is the owner's state ----
    report["editing"] = {"entered": await editing_on(page)}
    await page.wait_for_timeout(4000)
    # Read after the frame is up. The first cut read this straight after the
    # sign in, when the page was still /loading and the header did not exist,
    # and both answers were null.
    report["trigger"] = {
        "left": await page.evaluate(TRIGGER_FACTS, LEFT),
        "right": await page.evaluate(TRIGGER_FACTS, RIGHT)
    }
    report["editing"]["editableFields"] = await page.locator('[contenteditable="true"]').count()
    report["editing"]["idle"] = await storm_window(page, 5)

    wanted = lambda name: only is None or only == name

    original = None
    target = (await page.evaluate(TYPE_TARGET, FIELD_STEM)) if wanted('type') or only is None else {}
    report["typed"] = {"target": target}
    if target.get("x") is not None:
        original = target["text"]
        report["typed"]["original"] = original
        await page.mouse.click(target["x"], target["y"])
        await page.keyboard.press("End")
        await page.keyboard.type(SUFFIX, delay=60)
        await page.keyboard.press("Tab")
        await page.wait_for_timeout(3000)
        report["typed"]["after"] = await outbox(page)

    # ---- 2. the first click, at 1440 and at 390, both drawers ----
    report["firstClick"] = {}
    for width, height in ((1440, 900), (390, 844)) if wanted('firstClick') else ():
        await page.set_viewport_size({"width": width, "height": height})
        await page.wait_for_timeout(1200)
        report["firstClick"]["%dx%d" % (width, height)] = {
            "left": await first_click_rounds(page, LEFT, "left", 10),
            "right": await first_click_rounds(page, RIGHT, "right", 10)
        }
    await page.set_viewport_size({"width": 1440, "height": 900})
    await page.wait_for_timeout(1200)

    # ---- 3. one drawer to the other, the button that opened it, a burst ----
    if wanted('cross'):
        report["cross"] = await cross_rounds(page, 4)
        report["ownTrigger"] = {
            "left": await own_trigger_rounds(page, LEFT, "left", 5),
            "right": await own_trigger_rounds(page, RIGHT, "right", 5)
        }
    if wanted('burst'):
        report["burst"] = {
            "left": await burst_rounds(page, LEFT, "left", 4, 100, 3),
            "right": await burst_rounds(page, RIGHT, "right", 4, 150, 3)
        }

    # ---- 4. the storm, dispatched into the store in a loop ----
    started = {}
    if wanted('storm'):
        before = await outbox(page)
        started = await page.evaluate(STORM_START, {"perFrame": 8})
        report["storm"] = {"start": started, "outboxBefore": before}
    if started.get("started"):
        report["storm"]["cost"] = await storm_window(page, 5)
        report["storm"]["firstClick"] = {
            "left": await first_click_rounds(page, LEFT, "left", 10),
            "right": await first_click_rounds(page, RIGHT, "right", 10)
        }
        # And it stays open while the storm runs, which is the state that a
        # re-render must not be able to throw away.
        await shut_everything(page)
        await page.wait_for_timeout(350)
        opened = await gesture(page, LEFT, "left")
        await page.evaluate(RESET_PROBE)
        await page.wait_for_timeout(5000)
        during = await page.evaluate(READ_PROBE)
        report["storm"]["survives"] = {
            "opened": opened.get("openAtEnd"),
            "openAfterFiveSeconds": await page.evaluate(IS_OPEN, LEFT),
            "commits": during["commits"],
            "mounts": during["mounts"],
            "inserted": during["inserted"]
        }
        await shut_everything(page)
        report["storm"]["stop"] = await page.evaluate(STORM_STOP)
        await page.wait_for_timeout(2000)
        report["storm"]["outboxAfter"] = await outbox(page)

    # ---- 5. set the field back, and read it back ----
    if original:
        back = None
        for candidate in (original + SUFFIX, original):
            found = await page.evaluate(TYPE_TARGET, candidate)
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
                 .filter(t => t.startsWith('STEM'))""".replace("STEM", FIELD_STEM))
        report["setBack"]["remoteAfter"] = await outbox(page)


async def main():
    from playwright.async_api import async_playwright

    only = sys.argv[1] if len(sys.argv) > 1 else None
    report = {"origin": ORIGIN, "siteDir": SITE_DIR, "only": only, "startedAt": time.time()}
    if not LOGIN or not PASSWORD:
        print(json.dumps({"error": "TAXI_HUMAN_ADMIN_BOOKLIMO_* not in the environment"}))
        return

    site = Site()
    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(args=[
                "--host-resolver-rules=MAP booklimo.at 127.0.0.1:%d" % TLS_PORT,
                "--ignore-certificate-errors"])
            context = await browser.new_context(
                viewport={"width": 1440, "height": 900}, ignore_https_errors=True,
                locale="de-AT", timezone_id="Europe/Vienna")
            await context.add_init_script(PROBE)
            page = await context.new_page()
            report["signedIn"] = await sign_in(page)
            if report["signedIn"]:
                try:
                    await run(page, report, only)
                except Exception as error:
                    report["error"] = "%s: %s" % (type(error).__name__, error)
            await context.close()
            await browser.close()
    finally:
        site.stop()

    report["endedAt"] = time.time()
    print(json.dumps(report, default=str))


if __name__ == "__main__":
    asyncio.run(main())
