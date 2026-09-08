"""The browser half of tests/09-editing-latency.ipynb and 10-draft-persistence.ipynb.

Written by those notebooks, which is why it is not tracked: the notebook is its
source. It prints one JSON document on stdout and nothing else, so a notebook
can judge it.

It serves booklimo.at's own production build under its own origin, the way the
taxi suite's verifiers do: `gatsby serve` behind a socat TLS listener, and a
chromium told to resolve booklimo.at to it. The origin has to be the real one,
because the OIDC client, the agent and the storage gateway all check it.

Subcommands
  cost      the persistence path timed inside the browser engine, on a payload
            of booklimo's own size. No sign in, no network to the agent, no
            write anywhere.
  blur      the real CMS, signed in as the booklimo human admin, one field
            typed and left. It makes one commit through the live agent and
            sets the field back afterwards, reading the value back through a
            browser that was emptied first, so the proof is the repository's
            own answer and not this process's memory.
  safety    the browser-only scenarios of the plan's safety list: a reload, a
            hidden tab, an edit made offline, and a second editor.
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
HTTP_PORT = int(os.environ.get("JAEN_SITE_PORT", "9209"))
TLS_PORT = HTTP_PORT + 1
CONFIG = pathlib.Path(os.path.expanduser("~/.config/taxi-app"))
PERSIST_KEY = "jaenjs-state"
FIELD_NAME = os.environ.get("JAEN_FIELD_NAME", "FleetTitle")
HOME_PAGE = "JaenPage /"


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
        self.tmp = pathlib.Path(tempfile.mkdtemp(prefix="jaen-editing-"))
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


async def new_browser(pw, offline=False):
    browser = await pw.chromium.launch(args=[
        "--host-resolver-rules=MAP booklimo.at 127.0.0.1:%d" % TLS_PORT,
        "--ignore-certificate-errors"])
    context = await browser.new_context(viewport={"width": 1440, "height": 900},
                                        ignore_https_errors=True,
                                        locale="de-AT", timezone_id="Europe/Vienna")
    if offline:
        await context.set_offline(True)
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

        for selector in ["button[name='skip']", "#skip-button", "button:has-text('Überspringen')"]:
            locator = page.locator(selector).first
            if await locator.count() and await locator.is_visible():
                await locator.click()
                break

    if not page.url.startswith(ORIGIN):
        return False

    # Landing back on the origin is not being signed in. The provider drops the
    # browser on `/loading/?code=...` and the code is exchanged there: leaving
    # that page before the exchange finishes throws the code away and the CMS
    # comes up anonymous, which is how the agent answers AUTH_REQUIRED to every
    # poll while the site looks perfectly signed in. So the session itself is
    # what is waited for.
    for _ in range(40):
        if await page.evaluate(HAS_SESSION):
            return True
        await page.wait_for_timeout(1000)

    return False


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

FIELD_VALUE = """() => {
  try {
    const state = JSON.parse(localStorage.getItem('%s') || 'null')
    return state?.page?.pages?.nodes?.['%s']?.jaenFields?.['IMA:TextField']?.['%s']?.value ?? null
  } catch (error) {
    return null
  }
}""" % (PERSIST_KEY, HOME_PAGE, FIELD_NAME)

# The one field the draft holds.
#
# `FIELD_VALUE` above reads a fixed path, `JaenPage /` and `FleetTitle`, which is
# what the first build's draft happened to carry: the old agent's head was the
# whole replayed chain plus every edit made through it, so every field of the
# site was in it. The draft object starts EMPTY and holds only what is
# unpublished, so before this run writes anything there is no field in it at all
# and a fixed path answers null. That is the design working, not a fault, and it
# is why this reader exists: after one write the draft holds exactly one field
# and this names it.
DRAFT_FIELD = """() => {
  try {
    const state = JSON.parse(localStorage.getItem('KEY') || 'null')
    const nodes = state?.page?.pages?.nodes || {}
    for (const pageId of Object.keys(nodes)) {
      const fields = nodes[pageId]?.jaenFields || {}
      for (const fieldType of Object.keys(fields)) {
        for (const fieldName of Object.keys(fields[fieldType] || {})) {
          const entry = fields[fieldType][fieldName]
          if (entry && typeof entry.value !== 'undefined') {
            return {pageId, fieldType, fieldName, value: entry.value}
          }
        }
      }
    }
    return null
  } catch (error) {
    return null
  }
}""".replace('KEY', PERSIST_KEY)


def draft_field_at(ident):
    """The value of one named field of the draft, or null when it is not in it."""
    return """() => {
  try {
    const state = JSON.parse(localStorage.getItem('%s') || 'null')
    const entry = state?.page?.pages?.nodes?.['%s']?.jaenFields?.['%s']?.['%s']
    return entry && typeof entry.value !== 'undefined' ? entry.value : null
  } catch (error) {
    return null
  }
}""" % (PERSIST_KEY, ident["pageId"], ident["fieldType"], ident["fieldName"])


SET_EDITING = """() => {
  // `status.isEditing` is part of the persisted store, so this is the same
  // mechanism a reload uses to come back into edit mode. It is set here rather
  // than clicked in the frame's menu because a menu click is a second thing
  // that can fail and it is not what is being measured.
  const raw = localStorage.getItem('%s')
  const state = raw ? JSON.parse(raw) : {}
  state.status = {...(state.status || {}), isEditing: true}
  localStorage.setItem('%s', JSON.stringify(state))
  return true
}""" % (PERSIST_KEY, PERSIST_KEY)


# The same edit, as a script that runs before the page's own scripts.
#
# `SET_EDITING` above is evaluated inside a live page and is overwritten by
# the next dispatch of the store (see `enter_editing`). This one is handed to
# playwright's `add_init_script`, so it has already run when the store reads
# `localStorage` on boot.
SET_EDITING_AT_BOOT = """(() => {
  try {
    const raw = localStorage.getItem('%s')
    const state = raw ? JSON.parse(raw) : {}
    state.status = {...(state.status || {}), isEditing: true}
    localStorage.setItem('%s', JSON.stringify(state))
  } catch (error) {
    // A storage the browser refuses is a run that skips, not one that throws.
  }
})()""" % (PERSIST_KEY, PERSIST_KEY)


async def wait_for_store(page, timeout=40):
    """Wait until the store has written itself once, so it can be amended."""
    for _ in range(timeout):
        if await page.evaluate("() => localStorage.getItem('%s') !== null" % PERSIST_KEY):
            return True
        await page.wait_for_timeout(1000)
    return False


async def enter_editing(page):
    """Edit mode, and with it the fields a person can type into.

    `status.isEditing` is part of the persisted store, so putting it there and
    reloading is the same door a reload uses. What changed on 2026-09-08 is
    **when** it can be put there.

    Writing it into a live page does not survive any more. The store persists
    itself on every dispatch, and with the agent option back the poll dispatches
    every 1,500 ms, so the running page writes its own `isEditing: false` over
    the edit inside a second: measured five readings in five seconds, all false,
    without a reload in between. On a site with no agent nothing dispatches and
    the same edit survived, which is why this worked until the agent came back
    and why it then failed as "no editable field on the page" rather than as a
    fault anybody could read.

    So the flag goes in through an init script, which runs before any script of
    the page on every navigation and therefore before the store is created. It
    stays on the context for the rest of the run, which is what an editor with
    the CMS open has anyway.
    """
    await page.goto(ORIGIN + "/", wait_until="domcontentloaded")
    await wait_for_store(page)
    await page.context.add_init_script(SET_EDITING_AT_BOOT)
    await page.reload(wait_until="domcontentloaded")
    state = await wait_for_draft(page)
    await wait_for_editable(page)
    return await page.evaluate(READ_STATE) or state


async def wait_for_editable(page, timeout=30):
    """Wait until edit mode has produced fields, which is what it is for."""
    for _ in range(timeout):
        if await page.locator('[contenteditable="true"]').count():
            return True
        await page.wait_for_timeout(1000)
    return False


async def wait_for_draft(page, timeout=60):
    """Wait until the shared draft has been hydrated into this browser.

    `revision` and not `headSha`: since the redesign of 2026-09-08 the draft
    lives in one Durable Object per site whose revision is a monotonic counter,
    and a save is no longer a commit, so there is no sha for anything here to
    wait on. A site built without the `agent` option never gets one at all,
    which is what `has_agent` below is for.
    """
    for _ in range(timeout):
        state = await page.evaluate(READ_STATE)
        if state and state.get("remote", {}).get("revision") is not None:
            return state
        await page.wait_for_timeout(1000)
    return await page.evaluate(READ_STATE)


_CARRIES_AGENT = None


def carries_agent():
    """Whether the build this run serves carries the `agent` plugin option.

    It reads the built bundle and not the page, because there is nothing in the
    page to read: `__JAEN_AGENT__` is a webpack define, so it is substituted for
    its literal value at compile time and never exists as a runtime global. A
    `page.evaluate` that asks for `typeof __JAEN_AGENT__` runs its own script
    outside webpack and is therefore answered `undefined` on every build,
    including one that carries the option. That is what this function used to
    do, and it made ten checks of the two notebooks SKIP with "this build
    carries no agent option" against a build that carried one.

    So: the option's own shape in the bundle, `agent:{url:"…jaen-agent…"`, with
    the minifier's freedom about spaces allowed for. The transition of
    `docs/architecture/draft-state.md` removes the option and this then answers
    false, which is the rollback and the reason the guard exists at all.
    """
    global _CARRIES_AGENT
    if _CARRIES_AGENT is not None:
        return _CARRIES_AGENT

    marker = re.compile(r'agent\s*:\s*\{\s*url\s*:\s*"[^"]*jaen-agent')
    _CARRIES_AGENT = False
    public = pathlib.Path(SITE_DIR) / "public"
    for chunk in sorted(public.glob("*.js")):
        try:
            if marker.search(chunk.read_text(errors="ignore")):
                _CARRIES_AGENT = True
                break
        except OSError:
            continue
    return _CARRIES_AGENT


async def has_agent(page):
    """Kept for the call sites, which pass the page they are on."""
    return carries_agent()


async def wait_for_saved(page, timeout=60):
    for _ in range(timeout):
        state = await page.evaluate(READ_STATE)
        remote = (state or {}).get("remote", {})
        if remote.get("saveState") == "saved" and not remote.get("outbox"):
            return True
        await page.wait_for_timeout(1000)
    return False


async def editable_for(page, value):
    """The contenteditable that carries `value`, which is the field itself."""
    for _ in range(30):
        handles = await page.locator('[contenteditable="true"]').all()
        for handle in handles:
            text = (await handle.inner_text()).strip()
            if text == (value or "").strip():
                return handle
        await page.wait_for_timeout(1000)
    return None


# ---------------------------------------------------------------------------
# cost: the persistence path inside the browser engine
# ---------------------------------------------------------------------------

BENCH = """({payload, samples}) => {
  // The four steps of `persist-state.saveState` as it stands, run inside the
  // browser on a payload of booklimo's own size. `localStorage.setItem` is the
  // one leg node cannot measure honestly, which is the reason for this half.
  const state = JSON.parse(payload)
  const legs = {clone: [], walk: [], stringify: [], write: [], total: []}

  const removeLoadingAndError = obj => {
    const keysToRemove = ['isLoading', 'error']
    if (obj && typeof obj === 'object') {
      keysToRemove.forEach(key => { if (key in obj) delete obj[key] })
      Object.keys(obj).forEach(key => removeLoadingAndError(obj[key]))
    }
  }

  for (let i = 0; i < samples; i += 1) {
    const t0 = performance.now()
    const clone = JSON.parse(JSON.stringify(state))
    const t1 = performance.now()
    removeLoadingAndError(clone)
    const t2 = performance.now()
    const serial = JSON.stringify(clone)
    const t3 = performance.now()
    localStorage.setItem('jaen-editing-bench', serial)
    const t4 = performance.now()

    legs.clone.push(t1 - t0)
    legs.walk.push(t2 - t1)
    legs.stringify.push(t3 - t2)
    legs.write.push(t4 - t3)
    legs.total.push(t4 - t0)
  }

  // `performance.now()` is clamped to a tenth of a millisecond in this
  // browser, which is a quarter of what one of these legs costs, so the same
  // work is also timed in one batch and divided: the batch is the number to
  // read and the per-sample legs above are the shape of it.
  const batchStarted = performance.now()

  for (let i = 0; i < samples; i += 1) {
    const clone = JSON.parse(JSON.stringify(state))
    removeLoadingAndError(clone)
    localStorage.setItem('jaen-editing-bench', JSON.stringify(clone))
  }

  const batchMs = (performance.now() - batchStarted) / samples

  // The same work after change 1 of the plan: one `JSON.stringify` with a
  // replacer, then the write. Timed in a batch for the same clamping reason,
  // and twice, because the two changes are separable: `single` is change 1 on
  // a payload of the old size, `singleDrop` is change 1 and change 2 together,
  // which is what the CMS now writes.
  const replacer = drop => (key, value) => {
    if (key === 'isLoading' || key === 'error') return undefined
    if (drop && key === 'IMA:MEDIA_NODES') return undefined
    return value
  }

  const timeSingle = drop => {
    const started = performance.now()

    for (let i = 0; i < samples; i += 1) {
      localStorage.setItem('jaen-editing-bench', JSON.stringify(state, replacer(drop)))
    }

    return (performance.now() - started) / samples
  }

  const batchSingleMs = timeSingle(false)
  const batchSingleDropMs = timeSingle(true)

  const singleBytes = new TextEncoder().encode(JSON.stringify(state, replacer(false))).length
  const singleDropBytes = new TextEncoder().encode(JSON.stringify(state, replacer(true))).length

  localStorage.removeItem('jaen-editing-bench')

  const bytes = new TextEncoder().encode(JSON.stringify(state)).length

  return {legs, batchMs, batchSingleMs, batchSingleDropMs, singleBytes,
          singleDropBytes, bytes, userAgent: navigator.userAgent}
}"""


def stat(values):
    if not values:
        return {}
    ordered = sorted(values)
    return {
        "median": ordered[len(ordered) // 2],
        "p95": ordered[min(len(ordered) - 1, int(0.95 * (len(ordered) - 1)))],
        "min": ordered[0],
        "max": ordered[-1],
        "samples": len(ordered),
    }


async def run_cost(pw, args):
    payload = pathlib.Path(args["payload"]).read_text()
    samples = int(args.get("samples", 40))
    browser, context = await new_browser(pw)
    page = await context.new_page()
    await page.goto(ORIGIN + "/", wait_until="domcontentloaded")
    answer = await page.evaluate(BENCH, {"payload": payload, "samples": samples})
    await browser.close()

    legs = {name: stat(values) for name, values in answer["legs"].items()}

    return {
        "scenario": "cost",
        "bytes": answer["bytes"],
        "userAgent": answer["userAgent"],
        "legs": legs,
        "batchMs": answer["batchMs"],
        "batchSingleMs": answer["batchSingleMs"],
        "batchSingleDropMs": answer["batchSingleDropMs"],
        "singleBytes": answer["singleBytes"],
        "singleDropBytes": answer["singleDropBytes"],
        # One blur was four whole-store writes on the path as it stood, and is
        # one coalesced write after change 1: every dispatch a blur causes
        # falls into the same idle callback.
        "blurMs": {
            "median": legs["total"]["median"] * 4,
            "p95": legs["total"]["p95"] * 4,
            "batch": answer["batchMs"] * 4,
            "after": answer["batchSingleDropMs"],
        },
    }


# ---------------------------------------------------------------------------
# blur: the real CMS, one edit, set back
# ---------------------------------------------------------------------------

INSTRUMENT = """() => {
  window.__jaenProbe = {blurAt: null, frameAt: null, longTasks: [], writes: []}

  // Every localStorage write of the store, with its size and the instant, so
  // the persistence work can be found in the timeline whenever it lands.
  const setItem = Storage.prototype.setItem
  Storage.prototype.setItem = function (key, value) {
    const started = performance.now()
    const answer = setItem.call(this, key, value)
    window.__jaenProbe.writes.push({
      key,
      bytes: new TextEncoder().encode(String(value)).length,
      ms: performance.now() - started,
      at: started
    })
    return answer
  }

  try {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        window.__jaenProbe.longTasks.push({at: entry.startTime, ms: entry.duration})
      }
    }).observe({entryTypes: ['longtask']})
  } catch (error) {
    window.__jaenProbe.longTaskError = String(error)
  }

  document.addEventListener('blur', () => {
    if (window.__jaenProbe.blurAt !== null) return
    window.__jaenProbe.blurAt = performance.now()
    requestAnimationFrame(() => {
      window.__jaenProbe.frameAt = performance.now()
    })
  }, true)

  return true
}"""


async def type_and_leave(page, handle, text):
    await handle.click()
    await page.keyboard.press("End")
    await page.keyboard.type(text, delay=40)
    await page.evaluate(INSTRUMENT)
    # The blur itself: the gesture being measured.
    await page.keyboard.press("Tab")
    await page.wait_for_timeout(4000)
    return await page.evaluate("() => window.__jaenProbe")


async def run_blur(pw, args):
    browser, context = await new_browser(pw)
    page = await context.new_page()
    notes = []
    page.on("pageerror", lambda error: notes.append("pageerror: %s" % str(error)[:200]))
    page.on("console", lambda message: notes.append("console %s: %s" % (message.type, message.text[:200])))
    page.on("requestfailed", lambda request: notes.append("requestfailed: %s %s" % (request.url[:120], request.failure)))

    if not await sign_in(page):
        await browser.close()
        return {"scenario": "blur", "skipped": "the human admin did not sign in"}

    state = await enter_editing(page)

    if not await has_agent(page):
        await browser.close()
        return {"scenario": "blur",
                "skipped": "this build carries no agent option, so there is no "
                           "shared draft to drive; run localBlur instead"}

    if not state or state.get("remote", {}).get("revision") is None:
        await browser.close()
        return {"scenario": "blur", "skipped": "no draft arrived from the agent",
                "remote": (state or {}).get("remote"), "notes": notes[-25:]}

    await page.wait_for_timeout(3000)

    # The value this run starts from comes off the DOM and not out of the store.
    # The draft object holds what is unpublished and nothing else, so before this
    # run writes anything it is empty and the store carries no field at all: what
    # the person is looking at is the built page, which is the published chain.
    # The first non-empty editable is the field, the same way `localBlur` picks
    # one.
    handle = None

    for _ in range(30):
        for candidate in await page.locator('[contenteditable="true"]').all():
            text = (await candidate.inner_text()).strip()
            if text:
                handle = candidate
                break
        if handle is not None:
            break
        await page.wait_for_timeout(1000)

    if handle is None:
        await browser.close()
        return {"scenario": "blur", "skipped": "the field was not editable",
                "original": None, "notes": notes}

    original = (await handle.inner_text()).strip()

    marker = " probe"
    probe = await type_and_leave(page, handle, marker)
    # Which field it was is only knowable after the write, because the draft was
    # empty before it. Everything below reads that one field by name, so the run
    # does not depend on which field the theme renders first.
    ident = await page.evaluate(DRAFT_FIELD)
    written = ident["value"] if ident else None
    saved = await wait_for_saved(page)

    # Set back, and prove it by reading the value out of a browser that has no
    # memory of this run: the value it shows came from the agent.
    restored = None
    read_back = None
    handle = await editable_for(page, written)

    if handle is not None:
        await handle.click()
        await page.keyboard.press("Control+a")
        await page.keyboard.type(original or "", delay=30)
        await page.keyboard.press("Tab")
        await page.wait_for_timeout(2000)
        restored = await page.evaluate(draft_field_at(ident)) if ident else None
        await wait_for_saved(page)

    await page.evaluate("() => localStorage.removeItem('%s')" % PERSIST_KEY)
    await page.goto(ORIGIN + "/", wait_until="domcontentloaded")
    await wait_for_draft(page)
    read_back = await page.evaluate(draft_field_at(ident)) if ident else None

    await browser.close()

    blur_at = probe.get("blurAt")
    frame_at = probe.get("frameAt")
    after_blur = [entry for entry in probe.get("writes", [])
                  if blur_at is not None and entry["at"] >= blur_at]
    long_after = [entry for entry in probe.get("longTasks", [])
                  if blur_at is not None and entry["at"] >= blur_at]

    return {
        "scenario": "blur",
        "field": ident and {key: ident[key] for key in
                            ("pageId", "fieldType", "fieldName")},
        "original": original,
        "written": written,
        "restored": restored,
        "readBack": read_back,
        "saved": saved,
        "blurToFrameMs": (frame_at - blur_at) if (blur_at and frame_at) else None,
        "writesAfterBlur": after_blur,
        "bytesAfterBlur": sum(entry["bytes"] for entry in after_blur),
        "storeWritesAfterBlur": len([entry for entry in after_blur
                                     if entry["key"] == PERSIST_KEY]),
        "longTasksAfterBlur": long_after,
        "longestTaskMs": max([entry["ms"] for entry in long_after], default=0),
        "notes": notes[:10],
    }


# ---------------------------------------------------------------------------
# localBlur: the same blur, on a site that carries no agent
# ---------------------------------------------------------------------------


async def run_local_blur(pw, args):
    """One blur in the real CMS with `localStorage` as the only store.

    `blur` measures the same gesture against a live shared draft and skips on a
    site that carries no `agent` option, which since the transition of
    2026-09-08 is both of them. This one measures what is left, and what is left
    is exactly the browser side of `editing-performance.md`: the deferred single
    pass persist, the quiet window and the toolbar. That side does not depend on
    the agent at all, so it can still be measured on a person's own machine, and
    a number nobody can take any more is not an acceptance.

    Nothing leaves the browser. There is no agent to write to and no repository
    is touched, so unlike `blur` this makes no commit and needs no setting back
    beyond the field, which it does anyway and reads back out of a browser whose
    storage was emptied first.
    """
    # This scenario measures the rollback, so it needs a build that has no agent
    # option. On one that has it the CMS talks to the shared draft and every
    # assertion here would be measuring something else while claiming to measure
    # the escape. A run that cannot be taken says so.
    if carries_agent():
        return {"scenario": "localBlur",
                "skipped": "this build carries the agent option, and the escape "
                           "can only be measured on one that does not; the "
                           "rollback was measured on 2026-09-08 against the "
                           "build the transition left behind",
                "carriesAgent": True}

    browser, context = await new_browser(pw)
    page = await context.new_page()
    notes = []
    page.on("pageerror", lambda error: notes.append("pageerror: %s" % str(error)[:200]))
    page.on("requestfailed", lambda request: notes.append(
        "requestfailed: %s %s" % (request.url[:120], request.failure)))

    agent_requests = []
    page.on("request", lambda request: agent_requests.append(request.url)
            if "jaen-agent" in request.url or "/draft/" in request.url else None)

    if not await sign_in(page):
        await browser.close()
        return {"scenario": "localBlur", "skipped": "the human admin did not sign in"}

    agent_in_build = await has_agent(page)

    await enter_editing(page)
    await page.wait_for_timeout(3000)

    # Without an agent the store starts empty: it holds this browser's own
    # unpublished changes and nothing else, and the field's current value comes
    # out of the built page rather than out of `localStorage`. So the value this
    # run starts from is read off the DOM, which is also what the person sees.
    handle = None

    for _ in range(30):
        for candidate in await page.locator('[contenteditable="true"]').all():
            text = (await candidate.inner_text()).strip()
            if text:
                handle = candidate
                break
        if handle is not None:
            break
        await page.wait_for_timeout(1000)

    if handle is None:
        await browser.close()
        return {"scenario": "localBlur", "skipped": "no editable field on the page",
                "carriesAgent": agent_in_build, "notes": notes}

    original = (await handle.inner_text()).strip()

    probe = await type_and_leave(page, handle, " probe")
    written = await page.evaluate(FIELD_VALUE)

    # What the store says about itself. Without an agent `saveState` never
    # leaves `idle`, because nothing is ever sent, and that is the escape
    # working rather than a fault.
    state_after = await page.evaluate(READ_STATE)

    # The value out of `localStorage`, which without an agent is the only place
    # this edit exists at all.
    persisted = await page.evaluate(
        """(written) => {
          try {
            const raw = JSON.parse(localStorage.getItem('%s') || 'null')
            const nodes = raw && raw.page && raw.page.pages && raw.page.pages.nodes
            if (!nodes) return null
            // Which field it was is not known here, so the payload is searched
            // for the value that was typed: this asks whether the edit reached
            // storage at all, which is the whole question without an agent.
            for (const node of Object.values(nodes)) {
              for (const byType of Object.values(node.jaenFields || {})) {
                for (const field of Object.values(byType || {})) {
                  if (field && field.value === written) return field.value
                }
              }
            }
            return null
          } catch (error) {
            return 'error: ' + String(error)
          }
        }""" % PERSIST_KEY, written)

    # Set the field back, then read it out of a browser with no memory of the
    # run. Without an agent that read is the built site's own data, which is
    # what the value was before this run touched it.
    restored = None
    handle = await editable_for(page, written)

    if handle is not None:
        await handle.click()
        await page.keyboard.press("Control+a")
        await page.keyboard.type(original or "", delay=30)
        await page.keyboard.press("Tab")
        await page.wait_for_timeout(2000)
        restored = await page.evaluate(FIELD_VALUE)

    # Emptied and reloaded: without an agent there is no shared draft to read
    # back from, so what the page shows is the built site's own value, and that
    # is the thing this run must not have changed.
    await page.evaluate("() => localStorage.removeItem('%s')" % PERSIST_KEY)
    await page.goto(ORIGIN + "/", wait_until="domcontentloaded")
    await page.wait_for_timeout(3000)
    read_back = await page.evaluate(
        """(text) => {
          const nodes = Array.from(document.querySelectorAll('h1, h2, h3, p, span, div'))
          const found = nodes.find(node => node.textContent.trim() === text)
          return found ? found.textContent.trim() : null
        }""", original)

    await browser.close()

    blur_at = probe.get("blurAt")
    frame_at = probe.get("frameAt")
    after_blur = [entry for entry in probe.get("writes", [])
                  if blur_at is not None and entry["at"] >= blur_at]
    long_after = [entry for entry in probe.get("longTasks", [])
                  if blur_at is not None and entry["at"] >= blur_at]
    remote = (state_after or {}).get("remote", {})

    return {
        "scenario": "localBlur",
        "carriesAgent": agent_in_build,
        "agentRequests": agent_requests[:10],
        "original": original,
        "written": written,
        "persisted": persisted,
        "restored": restored,
        "readBack": read_back,
        "saveState": remote.get("saveState"),
        "outbox": len(remote.get("outbox") or []),
        "revision": remote.get("revision"),
        "blurToFrameMs": (frame_at - blur_at) if (blur_at and frame_at) else None,
        "writesAfterBlur": after_blur,
        "bytesAfterBlur": sum(entry["bytes"] for entry in after_blur),
        "storeWritesAfterBlur": len([entry for entry in after_blur
                                     if entry["key"] == PERSIST_KEY]),
        "longTasksAfterBlur": long_after,
        "longestTaskMs": max([entry["ms"] for entry in long_after], default=0),
        "notes": notes[:10],
    }


# ---------------------------------------------------------------------------
# safety: the browser-only scenarios
# ---------------------------------------------------------------------------

async def run_safety(pw, args):
    """A reload, a hidden tab, an edit made offline, and a second editor.

    Every one of them reads the value back rather than a flag, and the field is
    set back to what it was at the end.
    """
    out = {"scenario": "safety"}
    browser, context = await new_browser(pw)
    page = await context.new_page()

    if not await sign_in(page):
        await browser.close()
        return {"scenario": "safety", "skipped": "the human admin did not sign in"}

    state = await enter_editing(page)

    if not state or state.get("remote", {}).get("revision") is None:
        await browser.close()
        return {"scenario": "safety", "skipped": "no draft arrived from the agent",
                "remote": (state or {}).get("remote")}

    original = await page.evaluate(FIELD_VALUE)
    out["original"] = original
    await page.wait_for_timeout(3000)

    # 1. an edit, the tab hidden at once, and a reload
    handle = await editable_for(page, original)

    if handle is None:
        await browser.close()
        return dict(out, skipped="the field was not editable")

    typed = (original or "") + " hidden"
    await handle.click()
    await page.keyboard.press("Control+a")
    await page.keyboard.type(typed, delay=30)
    await page.keyboard.press("Tab")

    # The tab goes away with nothing waited out at all.
    #
    # This used to wait 700 ms, so that the field's own 500 ms debounce had
    # fired before the tab was hidden, and every hidden-tab and reload check
    # below was therefore taken outside the half second in which an edit was
    # lost. The adversarial run of 2026-09-08 measured that window on the live
    # site and found the loss there; `utils/on-leave.ts` closes it by flushing
    # the field's debounce before the store is written, and this is where that
    # is checked from now on. See the `losses` scenario for the whole table.
    await page.evaluate("""() => {
      Object.defineProperty(document, 'visibilityState', {get: () => 'hidden', configurable: true})
      document.dispatchEvent(new Event('visibilitychange'))
      window.dispatchEvent(new Event('pagehide'))
    }""")
    hidden_value = await page.evaluate(FIELD_VALUE)
    out["afterHidden"] = hidden_value

    await page.reload(wait_until="domcontentloaded")
    await page.wait_for_timeout(4000)
    out["afterReload"] = await page.evaluate(FIELD_VALUE)

    # 2. an edit made offline: it stays in the store and in the outbox, and it
    #    drains when the network is back.
    await wait_for_saved(page)
    await context.set_offline(True)
    handle = await editable_for(page, await page.evaluate(FIELD_VALUE))
    offline_typed = (original or "") + " offline"

    if handle is not None:
        await handle.click()
        await page.keyboard.press("Control+a")
        await page.keyboard.type(offline_typed, delay=30)
        await page.keyboard.press("Tab")
        await page.wait_for_timeout(3000)

    offline_state = await page.evaluate(READ_STATE)
    out["offline"] = {
        "value": await page.evaluate(FIELD_VALUE),
        "outbox": len((offline_state or {}).get("remote", {}).get("outbox", [])),
        "saveState": (offline_state or {}).get("remote", {}).get("saveState"),
    }

    await context.set_offline(False)
    await page.evaluate("() => window.dispatchEvent(new Event('online'))")
    drained = await wait_for_saved(page, timeout=40)
    out["offline"]["drained"] = drained
    out["offline"]["valueAfterDrain"] = await page.evaluate(FIELD_VALUE)

    # 3. a second editor reads it out of the repository
    second_browser, second_context = await new_browser(pw)
    second = await second_context.new_page()
    seen = None

    if await sign_in(second):
        await second.goto(ORIGIN + "/", wait_until="domcontentloaded")
        for _ in range(30):
            await second.wait_for_timeout(1000)
            seen = await second.evaluate(FIELD_VALUE)
            if seen == offline_typed:
                break

    out["secondEditorSees"] = seen
    await second_browser.close()

    # set back
    handle = await editable_for(page, await page.evaluate(FIELD_VALUE))

    if handle is not None:
        await handle.click()
        await page.keyboard.press("Control+a")
        await page.keyboard.type(original or "", delay=30)
        await page.keyboard.press("Tab")
        await page.wait_for_timeout(2000)
        await wait_for_saved(page)

    await page.evaluate("() => localStorage.removeItem('%s')" % PERSIST_KEY)
    await page.goto(ORIGIN + "/", wait_until="domcontentloaded")
    await wait_for_draft(page)
    out["readBack"] = await page.evaluate(FIELD_VALUE)

    await browser.close()
    return out


HIDE = """() => {
  Object.defineProperty(document, 'visibilityState', {get: () => 'hidden', configurable: true})
  document.dispatchEvent(new Event('visibilitychange'))
  window.dispatchEvent(new Event('pagehide'))
}"""

SHOW = """() => {
  Object.defineProperty(document, 'visibilityState', {get: () => 'visible', configurable: true})
  document.dispatchEvent(new Event('visibilitychange'))
}"""

OUTBOX = """() => {
  try {
    const s = JSON.parse(localStorage.getItem('%s') || 'null')
    return {outbox: (s?.remote?.outbox || []).length,
            saveState: s?.remote?.saveState ?? null,
            revision: s?.remote?.revision ?? null}
  } catch (error) {
    return null
  }
}""" % PERSIST_KEY


async def sign_in_again(page):
    """Sign in in a tab that has no `sessionStorage` of its own.

    A new tab is a new `sessionStorage`, which is where the OIDC session lives,
    so the CMS in it is anonymous however signed in the profile is. The
    provider still holds its own cookie, so `/login/` usually completes without
    a form and `sign_in`, which waits for the provider's page, times out on
    exactly that silent case.
    """
    await page.goto(ORIGIN + "/login/", wait_until="domcontentloaded")

    for _ in range(45):
        try:
            if await page.evaluate(HAS_SESSION):
                return True
        except Exception:
            # The provider redirects while this asks, and an execution context
            # destroyed by a navigation is the redirect and not a failure.
            pass

        if "accounts.netsnek.com" in page.url:
            try:
                return await sign_in(page)
            except Exception:
                return False

        await page.wait_for_timeout(1000)

    return False


async def run_losses(pw, args):
    """The tab going away inside the field's own debounce, which is where an
    edit used to be lost.

    The question is narrower than `safety`'s: not whether an edit that has
    reached the store survives, but whether it reaches the store at all when
    the tab goes away at once. Measured on the deployed booklimo.at on
    2026-09-08 and it did not, at 0 ms and at 300 ms after the blur and on a
    real `page.close()` with no blur at all. `packages/jaen/src/utils/on-leave.ts`
    and `TextField`'s input dispatch are the repair and this is its gate.

    Every reading is the value in `localStorage` at the instant the tab is
    hidden, which is what a browser that never comes back would have left
    behind, and the field is set back at the end.
    """
    out = {"scenario": "losses", "hides": [], "close": None}
    browser, context = await new_browser(pw)
    page = await context.new_page()

    if not await sign_in(page):
        await browser.close()
        return dict(out, skipped="the human admin did not sign in")

    state = await enter_editing(page)

    if not state or state.get("remote", {}).get("revision") is None:
        await browser.close()
        return dict(out, skipped="no draft arrived from the agent",
                    remote=(state or {}).get("remote"))

    original = await page.evaluate(FIELD_VALUE)
    out["original"] = original
    await page.wait_for_timeout(3000)

    on_screen = original

    # `blur` says whether the person left the field before the tab went. The
    # `False` row is the one nothing covered at all: a person who types a
    # sentence and closes the tab with the caret still in the field.
    for delay, blur in ((0, True), (300, True), (0, False)):
        typed = "%s l%d%s" % (original, delay, "" if blur else "n")
        handle = await editable_for(page, on_screen)

        if handle is None:
            await browser.close()
            return dict(out, skipped="the field carrying %r was not editable" % on_screen)

        await handle.click()
        await page.keyboard.press("Control+a")
        await page.keyboard.type(typed, delay=30)

        if blur:
            await page.keyboard.press("Tab")

        if delay:
            await page.wait_for_timeout(delay)

        await page.evaluate(HIDE)
        in_storage = await page.evaluate(FIELD_VALUE)
        when_hidden = await page.evaluate(OUTBOX)
        await page.evaluate(SHOW)
        await page.wait_for_timeout(3000)
        await wait_for_saved(page, timeout=30)

        out["hides"].append({
            "delayMs": delay, "blurred": blur, "typed": typed,
            "inStorageWhenHidden": in_storage,
            "stateWhenHidden": when_hidden,
            "lostAtHide": in_storage != typed,
            "afterDrain": await page.evaluate(FIELD_VALUE)})
        on_screen = typed

    # One real close of the tab, with no blur and nothing waited out. A second
    # tab of the same context reads the same localStorage, which is what a
    # browser that comes back would read.
    typed = "%s close" % original
    handle = await editable_for(page, on_screen)

    if handle is not None:
        await handle.click()
        await page.keyboard.press("Control+a")
        await page.keyboard.type(typed, delay=30)
        await page.close()

        page = await context.new_page()
        await page.goto(ORIGIN + "/", wait_until="domcontentloaded")
        await page.wait_for_timeout(3000)
        out["close"] = {
            "typed": typed,
            "inStorageAfterClose": await page.evaluate(FIELD_VALUE),
            "state": await page.evaluate(OUTBOX)}

        # A new tab has no sessionStorage of its own, so the CMS is signed out
        # in it and the outbox cannot drain until somebody signs in again.
        signed = await sign_in_again(page)
        out["close"]["signedInAgain"] = signed

        if signed:
            await enter_editing(page)
            await wait_for_saved(page, timeout=60)
            out["close"]["afterDrain"] = await page.evaluate(FIELD_VALUE)

    # set back, and read it out of a browser whose storage was emptied
    on_screen = await page.evaluate(FIELD_VALUE)
    handle = await editable_for(page, on_screen)

    if handle is not None:
        await handle.click()
        await page.keyboard.press("Control+a")
        await page.keyboard.type(original or "", delay=30)
        await page.keyboard.press("Tab")
        await page.wait_for_timeout(2500)
        await wait_for_saved(page)

    await page.evaluate("() => localStorage.removeItem('%s')" % PERSIST_KEY)
    await page.goto(ORIGIN + "/", wait_until="domcontentloaded")
    await wait_for_draft(page)
    out["readBack"] = await page.evaluate(FIELD_VALUE)

    await browser.close()
    return out


async def main():
    command = sys.argv[1] if len(sys.argv) > 1 else "cost"
    args = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}

    from playwright.async_api import async_playwright

    site = Site()

    try:
        async with async_playwright() as pw:
            if command == "cost":
                answer = await run_cost(pw, args)
            elif command == "blur":
                answer = await run_blur(pw, args)
            elif command == "localBlur":
                answer = await run_local_blur(pw, args)
            elif command == "safety":
                answer = await run_safety(pw, args)
            elif command == "losses":
                answer = await run_losses(pw, args)
            else:
                answer = {"error": "unknown command %s" % command}
    finally:
        site.stop()

    print(json.dumps(answer, indent=1))


if __name__ == "__main__":
    asyncio.run(main())
