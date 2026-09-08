"""The registration storm at its root: dispatches counted where they are made.

`docs/architecture/editing-performance.md` names about forty-seven store
writes a second with edit mode on and nobody typing, and change 1 of that file
turned them into 3.2 coalesced writes without removing one dispatch. A write
counter can therefore no longer see the storm at all. This counts the
dispatches themselves.

**How the count is taken.** jaen's store is built with `devTools: true`, so
`configureStore` composes its enhancers through
`window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__` whenever that global exists. A
shim installed by `add_init_script`, before any script of the page, appends one
enhancer of its own INSIDE the middleware, so the dispatch it wraps is the one
that reaches the root reducer: every action, including the ones the recorder
middleware dispatches of its own. It counts by action type, keeps a histogram
of the `fieldName` of every `pages/field_register`, and stores the first stacks
so the effect that re-runs can be named. Nothing else about the store is
touched and no behaviour is changed.

Beside it: a wrapper around `localStorage.setItem` (the coalesced writes), a
long task `PerformanceObserver`, a `requestAnimationFrame` counter, and a 50 ms
`setTimeout` loop whose real firing interval says how busy the main thread is.

Everything runs on booklimo's own production build served under its own name,
signed in as the booklimo human admin, against the live agent. Nothing is
written to the draft unless a scenario says so, and a scenario that writes sets
the value back and reads it back.
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

ORIGIN = "https://booklimo.at"
SITE_DIR = os.environ.get(
    "JAEN_SITE_DIR", "/home/snekmin/git/limosen-v3/booklimo.at")
HTTP_PORT = int(os.environ.get("JAEN_HTTP_PORT", "9713"))
TLS_PORT = int(os.environ.get("JAEN_TLS_PORT", "9714"))
CONFIG = pathlib.Path(os.path.expanduser("~/.config/taxi-app"))
PERSIST_KEY = "jaenjs-state"


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


PROBE = r"""(() => {
  if (window.__jaenProbe) return
  const P = (window.__jaenProbe = {
    dispatches: 0,
    commits: 0,
    unmounts: 0,
    types: {},
    registerFields: {},
    stacks: [],
    writes: 0,
    bytes: 0,
    longTasks: [],
    frames: 0,
    timerSamples: [],
    store: null,
    error: null
  })

  // The devtools compose hook, which is the only seam jaen's store leaves open
  // from outside its own bundle. `configureStore({devTools: true})` calls this
  // with its config and expects a `compose` back; the enhancer appended here
  // is the innermost one, so it wraps the dispatch that reaches the reducer
  // rather than the one at the top of the middleware chain.
  try {
    window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ = function () {
      return function () {
        const funcs = Array.prototype.slice.call(arguments)
        const counter = function (createStore) {
          return function () {
            const store = createStore.apply(null, arguments)
            const dispatch = store.dispatch
            const counted = function (action) {
              const type = (action && action.type) || '?'
              P.dispatches++
              P.types[type] = (P.types[type] || 0) + 1
              if (type === 'pages/field_register') {
                const name = (action.payload && action.payload.fieldName) || '?'
                P.registerFields[name] = (P.registerFields[name] || 0) + 1
                if (P.stacks.length < 12) {
                  P.stacks.push({name: name, stack: new Error().stack})
                }
              }
              return dispatch(action)
            }
            // Mutated rather than copied: the middleware enhancer outside
            // this one reads `store.dispatch` off the object it is handed, so
            // a copy would be wrapped and the original would not.
            store.dispatch = counted
            // Exposed for reading the state, and only for that. This is the
            // INNERMOST store: `P.store.dispatch` goes straight to the
            // reducer, below the middleware chain, so an action dispatched
            // through it is never seen by the recorder, never reaches the
            // outbox and never becomes a save. A run of this file set a field
            // back through it and the object kept the typed value; see
            // `run_restore`.
            P.store = store
            return store
          }
        }
        const all = funcs.concat([counter])
        return all.reduce(function (a, b) {
          return function () {
            return a(b.apply(null, arguments))
          }
        })
      }
    }
  } catch (error) {
    P.error = String(error)
  }

  try {
    const setItem = localStorage.setItem.bind(localStorage)
    localStorage.setItem = function (key, value) {
      if (key === 'jaenjs-state') {
        P.writes++
        P.bytes += (value || '').length
      }
      return setItem(key, value)
    }
  } catch (error) {
    P.error = String(error)
  }

  try {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        P.longTasks.push({start: entry.startTime, duration: entry.duration})
        if (P.longTasks.length > 2000) P.longTasks.shift()
      }
    }).observe({entryTypes: ['longtask']})
  } catch (error) {
    P.error = String(error)
  }

  // Is the field's own element replaced, which is what a remount looks like
  // from outside React. `HighlightTooltip` puts the field's id on the wrapper
  // it renders, so `#FooterTagline` is that field and nothing else. The frame
  // loop is a floor: two replacements inside one frame read as one.
  P.watch = {}
  P.watched = ['FooterTagline', 'FooterRights', 'FleetTitle']
  const nodes = {}
  const tick = () => {
    P.frames++
    for (const id of P.watched) {
      const node = document.getElementById(id)
      if (node && nodes[id] !== node) {
        if (nodes[id] !== undefined) P.watch[id] = (P.watch[id] || 0) + 1
        nodes[id] = node
      }
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)

  // React's own commit counter, through the hook React looks for when it
  // boots. A stub that counts and does nothing else.
  if (!window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      renderers: new Map(),
      supportsFiber: true,
      inject: function () { return 1 },
      onCommitFiberRoot: function () { P.commits++ },
      onCommitFiberUnmount: function () { P.unmounts++ }
    }
  }

  // A 50 ms timer whose real interval is the main thread's own answer about
  // how busy it is. Nothing about the CMS reads it.
  let last = performance.now()
  setInterval(() => {
    const now = performance.now()
    P.timerSamples.push(now - last)
    if (P.timerSamples.length > 400) P.timerSamples.shift()
    last = now
  }, 50)
})()"""


SET_EDITING_AT_BOOT = """(() => {
  try {
    const raw = localStorage.getItem('%s')
    const state = raw ? JSON.parse(raw) : {}
    state.status = {...(state.status || {}), isEditing: true}
    localStorage.setItem('%s', JSON.stringify(state))
  } catch (error) {}
})()""" % (PERSIST_KEY, PERSIST_KEY)

CLEAR_EDITING_AT_BOOT = """(() => {
  try {
    const raw = localStorage.getItem('%s')
    const state = raw ? JSON.parse(raw) : {}
    state.status = {...(state.status || {}), isEditing: false}
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

RESET = """() => {
  const P = window.__jaenProbe
  if (!P) return false
  P.dispatches = 0
  P.types = {}
  P.registerFields = {}
  P.writes = 0
  P.bytes = 0
  P.longTasks.length = 0
  P.frames = 0
  P.commits = 0
  P.unmounts = 0
  P.stacks.length = 0
  for (const id of Object.keys(P.watch)) delete P.watch[id]
  P.timerSamples.length = 0
  P.at = performance.now()
  return true
}"""

READ_PROBE = """() => {
  const P = window.__jaenProbe
  if (!P) return null
  const elapsed = (performance.now() - (P.at || 0)) / 1000
  const samples = P.timerSamples.slice().sort((a, b) => a - b)
  return {
    elapsed: elapsed,
    dispatches: P.dispatches,
    commits: P.commits,
    unmounts: P.unmounts,
    replaced: P.watch,
    isEditing: (() => {
      try { return P.store.getState().status.isEditing } catch (e) { return null }
    })(),
    types: P.types,
    registerFields: P.registerFields,
    writes: P.writes,
    bytes: P.bytes,
    frames: P.frames,
    longTasks: P.longTasks.slice(),
    timerMedian: samples.length ? samples[Math.floor(samples.length / 2)] : null,
    timerMax: samples.length ? samples[samples.length - 1] : null,
    hasStore: Boolean(P.store),
    stacks: P.stacks.slice(),
    error: P.error
  }
}"""


# The deployed site instead of a local build. Set JAEN_LIVE=1 to read the same
# numbers off https://booklimo.at as it is served to a person: nothing is built
# or served here and the host resolver rule is dropped, so the browser resolves
# booklimo.at the way any browser does. Everything else about the run, the sign
# in, the probe and the scenarios, is identical.
LIVE = os.environ.get("JAEN_LIVE") == "1"


class Site:
    """booklimo's own production build, served under its own name.

    A no-op under JAEN_LIVE=1, where the deployed site is the subject.
    """

    def __init__(self):
        if LIVE:
            self.tmp = self.http = self.tls = None
            return
        self.tmp = pathlib.Path(tempfile.mkdtemp(prefix="jaen-register-"))
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
                urllib.request.urlopen(
                    "http://localhost:%d/" % HTTP_PORT, timeout=2).read()
                return
            except Exception:
                time.sleep(1)
        self.stop()
        raise RuntimeError("gatsby serve did not answer within ninety seconds")

    def stop(self):
        if LIVE:
            return
        for process in (self.http, self.tls):
            try:
                process.terminate()
                process.wait(timeout=10)
            except Exception:
                pass
        shutil.rmtree(self.tmp, ignore_errors=True)


async def new_browser(pw):
    args = [] if LIVE else [
        "--host-resolver-rules=MAP booklimo.at 127.0.0.1:%d" % TLS_PORT,
        "--ignore-certificate-errors"]
    browser = await pw.chromium.launch(args=args)
    context = await browser.new_context(viewport={"width": 1440, "height": 900},
                                        ignore_https_errors=True,
                                        locale="de-AT", timezone_id="Europe/Vienna")
    await context.add_init_script(PROBE)
    return browser, context


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


async def wait_for_store(page, timeout=40):
    for _ in range(timeout):
        if await page.evaluate("() => localStorage.getItem('%s') !== null" % PERSIST_KEY):
            return True
        await page.wait_for_timeout(1000)
    return False


async def wait_for_draft(page, timeout=60):
    for _ in range(timeout):
        state = await page.evaluate(READ_STATE)
        if state and state.get("remote", {}).get("revision") is not None:
            return state
        await page.wait_for_timeout(1000)
    return await page.evaluate(READ_STATE)


async def wait_for_editable(page, timeout=30):
    for _ in range(timeout):
        if await page.locator('[contenteditable="true"]').count():
            return True
        await page.wait_for_timeout(1000)
    return False


async def at_rest(page, seconds=5):
    """Nobody touches anything for `seconds`, and everything is counted."""
    await page.evaluate(RESET)
    await page.wait_for_timeout(int(seconds * 1000))
    reading = await page.evaluate(READ_PROBE)
    tasks = reading.pop("longTasks", [])
    reading["longTaskCount"] = len(tasks)
    reading["longTaskMax"] = max([t["duration"] for t in tasks], default=0)
    reading["longTaskTotal"] = sum(t["duration"] for t in tasks)
    reading["dispatchesPerSecond"] = round(
        reading["dispatches"] / reading["elapsed"], 2)
    reading["writesPerSecond"] = round(reading["writes"] / reading["elapsed"], 2)
    reading["framesPerSecond"] = round(reading["frames"] / reading["elapsed"], 2)
    reading["busyPerSecond"] = round(
        reading["longTaskTotal"] / 1000 / reading["elapsed"], 3)
    reading["commitsPerSecond"] = round(reading["commits"] / reading["elapsed"], 2)
    reading["types"] = dict(sorted(reading["types"].items(),
                                   key=lambda kv: -kv[1])[:12])
    reading["registerFields"] = dict(sorted(reading["registerFields"].items(),
                                            key=lambda kv: -kv[1])[:12])
    reading["stacks"] = [x["stack"] for x in reading.get("stacks", [])[:2]]
    return reading


# The blur, witnessed rather than assumed.
#
# The gap this reports is the one `docs/architecture/editing-performance.md`
# has reported since its baseline: from the `blur` event to the next painted
# frame. It is armed before the gesture and it records the instant the browser
# hands the event over, so a gesture that never produced a blur at all reads as
# `null` and is dropped rather than counted as a fast one. An earlier version
# of this file called `node.blur()` from script and could not tell those two
# apart.
#
# **Nothing is written.** The field is clicked and left with Tab without a
# keystroke in between, so `handleTextSave` finds the value unchanged and
# returns before it dispatches. That is the same blur path a person takes and
# it leaves the draft alone.
ARM_BLUR = """() => {
  window.__blur = {at: null, frameAt: null}
  document.addEventListener('blur', () => {
    if (window.__blur.at !== null) return
    window.__blur.at = performance.now()
    // The end of the task the blur runs in, which is the main-thread block a
    // blur costs: a `setTimeout(0)` cannot run until the current task and its
    // microtasks are done, so the instant it takes is the instant the browser
    // got the thread back.
    setTimeout(() => {
      window.__blur.taskEnd = performance.now()
    }, 0)
    requestAnimationFrame(() => {
      window.__blur.frameAt = performance.now()
    })
  }, true)
  return true
}"""

READ_BLUR = """() => window.__blur"""


async def first_written_field(page, timeout=30):
    """The first editable field that has something in it."""
    for _ in range(timeout):
        for candidate in await page.locator('[contenteditable="true"]').all():
            try:
                if (await candidate.inner_text()).strip():
                    return candidate
            except Exception:
                continue
        await page.wait_for_timeout(1000)
    return None


async def blur_gaps(page, rounds=8):
    """The blur to next painted frame gap, once per round, in milliseconds."""
    gaps = []
    blocks = []
    for _ in range(rounds):
        handle = await first_written_field(page, timeout=5)
        if handle is None:
            break
        try:
            await handle.click(timeout=5000)
        except Exception:
            continue
        await page.wait_for_timeout(400)
        await page.evaluate(ARM_BLUR)
        await page.keyboard.press("Tab")
        await page.wait_for_timeout(1200)
        reading = await page.evaluate(READ_BLUR)
        if reading and reading.get("at") is not None:
            if reading.get("frameAt") is not None:
                gaps.append(round(reading["frameAt"] - reading["at"], 2))
            if reading.get("taskEnd") is not None:
                blocks.append(round(reading["taskEnd"] - reading["at"], 2))
        await page.wait_for_timeout(600)
    return gaps, blocks


async def run(pw, args):
    site = Site()
    out = {"scenario": args.scenario, "site": SITE_DIR}
    try:
        browser, context = await new_browser(pw)
        page = await context.new_page()
        out["signedIn"] = await sign_in(page)
        if not out["signedIn"]:
            return out

        # Edit mode off, at rest.
        await context.add_init_script(CLEAR_EDITING_AT_BOOT)
        await page.goto(ORIGIN + "/", wait_until="domcontentloaded")
        await wait_for_store(page)
        await page.reload(wait_until="domcontentloaded")
        await wait_for_draft(page)
        await page.wait_for_timeout(3000)
        out["editOff"] = await at_rest(page, args.seconds)

        # Edit mode on, at rest.
        await context.add_init_script(SET_EDITING_AT_BOOT)
        await page.reload(wait_until="domcontentloaded")
        await wait_for_draft(page)
        out["editable"] = await wait_for_editable(page)
        out["fields"] = await page.locator('[contenteditable="true"]').count()
        await page.wait_for_timeout(3000)
        out["editOn"] = await at_rest(page, args.seconds)
        out["editOnAgain"] = await at_rest(page, args.seconds)

        probe = await page.evaluate(READ_PROBE)
        out["stacks"] = probe.get("stacks", [])
        out["probeError"] = probe.get("error")
        out["hasStore"] = probe.get("hasStore")

        # A blur, and the frame after it.
        await page.evaluate(RESET)
        out["blurToPaint"], out["blurBlock"] = await blur_gaps(page, rounds=8)
        after = await page.evaluate(READ_PROBE)
        out["blurDispatches"] = after["dispatches"]
        out["blurTypes"] = after["types"]

        # A click, and the longest long task in the second after it.
        #
        # The field itself is what is clicked, which is the editor's own
        # gesture and the one the CMS answers with the field highlighter. A
        # click at an arbitrary point on the page could follow a link, and a
        # navigation is not what is being timed.
        clicks = []
        handle = await first_written_field(page)
        for _ in range(6):
            if handle is None:
                break
            box = await handle.bounding_box()
            if not box:
                break
            await page.evaluate(RESET)
            await page.mouse.move(box["x"] + box["width"] / 2,
                                  box["y"] + box["height"] / 2)
            await page.mouse.down()
            await page.mouse.up()
            await page.wait_for_timeout(1000)
            reading = await page.evaluate(READ_PROBE)
            tasks = reading.get("longTasks", [])
            clicks.append(round(max([t["duration"] for t in tasks], default=0), 1))
            await page.keyboard.press("Tab")
            await page.wait_for_timeout(800)
        out["longestTaskAfterClick"] = clicks

        out["url"] = page.url
        state = await page.evaluate(READ_STATE)
        out["remote"] = {k: v for k, v in ((state or {}).get("remote") or {}).items()
                         if k in ("revision", "publishedRevision", "saveState",
                                  "active", "connection")}
        out["revision"] = (state or {}).get("remote", {}).get("revision")
        out["publishedRevision"] = (state or {}).get(
            "remote", {}).get("publishedRevision")
        out["outbox"] = len(((state or {}).get("remote", {}) or {}).get("outbox", []) or [])
        await browser.close()
    finally:
        site.stop()
    return out


FIND_WRITTEN = """(needle) => {
  const P = window.__jaenProbe
  const state = P && P.store ? P.store.getState() : null
  const nodes = (state && state.page && state.page.pages && state.page.pages.nodes) || {}
  for (const pageId of Object.keys(nodes)) {
    const fields = (nodes[pageId] || {}).jaenFields || {}
    for (const fieldType of Object.keys(fields)) {
      for (const fieldName of Object.keys(fields[fieldType] || {})) {
        const entry = fields[fieldType][fieldName]
        if (entry && typeof entry.value === 'string' && entry.value.indexOf(needle) !== -1) {
          return {pageId, fieldType, fieldName, value: entry.value}
        }
      }
    }
  }
  return null
}"""

PERSISTED_AT = """(ident) => {
  try {
    const state = JSON.parse(localStorage.getItem('jaenjs-state') || 'null')
    const entry = state?.page?.pages?.nodes?.[ident.pageId]
      ?.jaenFields?.[ident.fieldType]?.[ident.fieldName]
    return {
      value: entry && typeof entry.value !== 'undefined' ? entry.value : null,
      outbox: ((state || {}).remote || {}).outbox?.length ?? null
    }
  } catch (error) {
    return {value: null, outbox: null, error: String(error)}
  }
}"""

# Setting the field back through the store rather than through the keyboard.
#
# A contenteditable is cleared with a select-all that a browser is free to
# widen to the whole document, and a run that is here to prove nothing was
# left behind must not risk typing into the wrong place. The action is the
# very one a blur dispatches, with the value the run found in the DOM before
# it typed, so it goes through the same reducer, the same recorder and the
# same outbox.
RESTORE = """(ident) => {
  const P = window.__jaenProbe
  if (!P || !P.store) return false
  P.store.dispatch({
    type: 'pages/field_write',
    payload: {
      pageId: ident.pageId,
      fieldType: ident.fieldType,
      fieldName: ident.fieldName,
      value: ident.value,
      props: {}
    }
  })
  return true
}"""


async def run_edit(pw, args):
    """One real edit on the live draft, set back and read back.

    Nothing about the storm is measured here. It is the check that the
    registration guard did not break the path a person's edit takes: the store,
    `localStorage`, the outbox and the DOM.
    """
    site = Site()
    out = {"scenario": "edit"}
    try:
        browser, context = await new_browser(pw)
        page = await context.new_page()

        # What actually left the browser for the agent, and what came back.
        # An edit that is set back has to be set back everywhere it reached,
        # and the only way to know where it reached is to read the wire.
        traffic = []

        async def on_response(response):
            if "jaen-agent" not in response.url:
                return
            try:
                request = response.request
                sent = request.post_data or ""
                body = await response.text()
            except Exception as error:
                sent, body = "", "unreadable %s" % error
            traffic.append({
                "status": response.status,
                "sent": sent[:220],
                "got": body[:220]
            })

        page.on("response", lambda response: asyncio.ensure_future(on_response(response)))

        out["signedIn"] = await sign_in(page)
        if not out["signedIn"]:
            return out

        await context.add_init_script(SET_EDITING_AT_BOOT)
        await page.goto(ORIGIN + "/", wait_until="domcontentloaded")
        await wait_for_store(page)
        await page.reload(wait_until="domcontentloaded")
        await wait_for_draft(page)
        await wait_for_editable(page)
        await page.wait_for_timeout(3000)

        handle = await first_written_field(page)
        if handle is None:
            out["skipped"] = "no editable field carried a value"
            await browser.close()
            return out

        out["fieldId"] = await handle.get_attribute("id")
        original = await handle.inner_html()
        out["original"] = original[:120]

        needle = " storm-probe"
        await handle.click()
        await page.keyboard.press("End")
        await page.keyboard.type(needle, delay=40)
        await page.keyboard.press("Tab")
        await page.wait_for_timeout(2500)

        ident = await page.evaluate(FIND_WRITTEN, needle)
        out["written"] = ident
        if ident:
            out["persistedAfterEdit"] = await page.evaluate(PERSISTED_AT, ident)

            restored = dict(ident)
            restored["value"] = original
            out["restoreDispatched"] = await page.evaluate(RESTORE, restored)
            await page.wait_for_timeout(3000)
            out["persistedAfterRestore"] = await page.evaluate(PERSISTED_AT, ident)

        # Read back out of a browser whose storage was emptied, which is the
        # only reader that cannot be told what to say by this one.
        await page.evaluate("() => localStorage.clear()")
        await page.reload(wait_until="domcontentloaded")
        await page.wait_for_timeout(4000)
        if out.get("fieldId"):
            node = page.locator("#%s" % out["fieldId"]).first
            if await node.count():
                out["readBack"] = (await node.inner_html())[:120]
        out["readBackMatches"] = out.get("readBack") == out.get("original")
        out["agentTraffic"] = [entry for entry in traffic
                               if "save" in entry["sent"] or "publish" in entry["sent"]
                               or "errors" in entry["got"]][:8]
        out["agentCalls"] = len(traffic)

        await browser.close()
    finally:
        site.stop()
    return out


async def run_read_draft(pw, args):
    """What the object holds, read through a query the deployed agent accepts.

    Read only, and a workaround rather than a fix. This working tree's agent
    client asks a `Draft` for `discardedRevision`, `discardedAt`,
    `discardedBy`, `discardedByName` and `discarded`, which the deployed
    jaen-agent 4.0.0 does not have, so every draft read of every build made
    from this tree comes back `GRAPHQL_VALIDATION_FAILED` and the CMS never
    hydrates. Those five lines are taken out of the query on the wire here so
    the draft can be read back at all. Nothing is written.
    """
    site = Site()
    out = {"scenario": "readDraft"}
    drop = ("discardedRevision", "discardedAt", "discardedBy",
            "discardedByName", "discarded")
    try:
        browser, context = await new_browser(pw)
        page = await context.new_page()

        async def rewrite(route):
            request = route.request
            body = request.post_data
            if body and "JaenAgentDraft" in body:
                lines = [line for line in body.split("\\n")
                         if line.strip() not in drop]
                body = "\\n".join(lines)
                await route.continue_(post_data=body)
                return
            await route.continue_()

        await context.route("https://jaen-agent.booklimo.at/**", rewrite)

        out["signedIn"] = await sign_in(page)
        if not out["signedIn"]:
            return out

        await page.goto(ORIGIN + "/", wait_until="domcontentloaded")
        await wait_for_store(page)
        await page.reload(wait_until="domcontentloaded")
        state = await wait_for_draft(page)
        out["remote"] = {k: v for k, v in ((state or {}).get("remote") or {}).items()
                         if k in ("revision", "publishedRevision", "saveState")}
        out["outbox"] = len(((state or {}).get("remote") or {}).get("outbox") or [])
        nodes = (((state or {}).get("page") or {}).get("pages") or {}).get("nodes") or {}
        draft = {}
        for pageId, node in nodes.items():
            for fieldType, byName in ((node or {}).get("jaenFields") or {}).items():
                for fieldName, entry in (byName or {}).items():
                    if entry and entry.get("value") is not None:
                        draft["%s|%s|%s" % (pageId, fieldType, fieldName)] = str(
                            entry["value"])[:120]
        out["draftFields"] = draft
        await browser.close()
    finally:
        site.stop()
    return out


async def run_restore(pw, args):
    """Set one field of the live draft back, by typing, and read it back.

    The `edit` scenario set the field back through `P.store.dispatch`, and that
    reached the reducer and nothing else: the probe holds the INNERMOST store,
    below the middleware chain, so the recorder never saw the action, no change
    reached the outbox and no save left the browser. The object kept the typed
    value. This puts it back the way a person would, through the field, and
    reads the object afterwards.

    The draft query is rewritten on the wire the same way `readDraft` rewrites
    it, because a field cannot be corrected in a browser that never receives
    the value it is correcting.
    """
    site = Site()
    out = {"scenario": "restore", "field": args.field, "suffix": args.suffix}
    drop = ("discardedRevision", "discardedAt", "discardedBy",
            "discardedByName", "discarded")
    try:
        browser, context = await new_browser(pw)
        page = await context.new_page()

        async def rewrite(route):
            body = route.request.post_data
            if body and "JaenAgentDraft" in body:
                body = "\\n".join(line for line in body.split("\\n")
                                  if line.strip() not in drop)
                await route.continue_(post_data=body)
                return
            await route.continue_()

        await context.route("https://jaen-agent.booklimo.at/**", rewrite)

        out["signedIn"] = await sign_in(page)
        if not out["signedIn"]:
            return out

        await context.add_init_script(SET_EDITING_AT_BOOT)
        await page.goto(ORIGIN + "/", wait_until="domcontentloaded")
        await wait_for_store(page)
        await page.reload(wait_until="domcontentloaded")
        state = await wait_for_draft(page)
        out["revisionBefore"] = ((state or {}).get("remote") or {}).get("revision")
        await wait_for_editable(page)
        await page.wait_for_timeout(3000)

        node = page.locator("#%s" % args.field).first
        out["before"] = await node.inner_html()

        if not out["before"].endswith(args.suffix):
            out["skipped"] = "the field does not end in the suffix, nothing to undo"
            await browser.close()
            return out

        await node.click()
        await page.keyboard.press("End")
        for _ in range(len(args.suffix)):
            await page.keyboard.press("Backspace")
        await page.keyboard.press("Tab")

        for _ in range(20):
            await page.wait_for_timeout(1000)
            state = await page.evaluate(READ_STATE)
            remote = (state or {}).get("remote") or {}
            if not (remote.get("outbox") or []) and remote.get("saveState") in (
                    "saved", "idle"):
                break

        state = await page.evaluate(READ_STATE)
        remote = (state or {}).get("remote") or {}
        out["revisionAfter"] = remote.get("revision")
        out["saveState"] = remote.get("saveState")
        out["outbox"] = len(remote.get("outbox") or [])
        out["after"] = await node.inner_html()
        await browser.close()
    finally:
        site.stop()
    return out


async def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--scenario", default="storm")
    parser.add_argument("--seconds", type=float, default=5.0)
    parser.add_argument("--field", default="FleetTitle")
    parser.add_argument("--suffix", default=" storm-probe")
    args = parser.parse_args()
    from playwright.async_api import async_playwright
    async with async_playwright() as pw:
        runner = {"edit": run_edit, "readDraft": run_read_draft,
                  "restore": run_restore}.get(args.scenario, run)
        print(json.dumps(await runner(pw, args), indent=2))


if __name__ == "__main__":
    asyncio.run(main())
