"""A field sometimes reverts: the instrument, and the three mechanisms put to it.

Owner, 2026-09-08, on the live CMS: "when editing a field it sometimes resets
it to the version it had before." `docs/architecture/draft-state.md`, section
"A field sometimes reverts", names one mechanism to prove or refute and two
more to measure rather than assume. This file measures all three on the
deployed `https://booklimo.at`, signed in as the booklimo human admin, against
the deployed `jaen-agent`. It changes no behaviour of jaen.

**What is instrumented.** One init script, installed before any script of the
page, wraps `window.fetch` and logs every call to the agent host: the operation,
the `sinceRevision` or `baseRevision` it carried, the revision the client had
reached when it was sent, the instant the network answered, the instant the
answer was handed to the client, and the value the answer carries for the field
under test. Beside it a subscription to jaen's own store (through the innermost
store `register-probe.py` exposes) records every distinct state of
`remote.revision`, `remote.publishedRevision`, `remote.outbox.length`,
`remote.saveState`, the store's value for the field, the value the browser
paints, and which redux actions ran since the row before it. Nothing is
inferred: a revert is a row in which the store's value goes back to a value it
held before, with the answer that carried it named beside it.

**How the race is forced rather than waited for.** `holdNextOp` parks the
*answer* of the next call of one named operation, after the network has produced it,
until the run releases it. The bytes are the object's own and they were
genuinely produced before the save, which is exactly the shape the design names:
"a read that the object answered before that save was applied, and that arrives
after it succeeded". Nothing about the request is rewritten.

**The second writer** is the booklimo machine admin, `taxi-test-admin-krc-api`,
writing through the agent's own `save` mutation with a credential of the run's
own. It is a second editor as far as the object is concerned (a different sub,
its own base revision), and it avoids granting `jaen:admin` to a second human on
a real identity server for the length of a run, which a run of 2026-09-08 left
behind for eight hours.

**What is written on the live site.** Two fields, both of which the machine test
account wrote last and both of which currently hold the site's published text:
`FaqSubtitle` is the field under test and `ServicesSubtitle` is the second
editor's. Both are set back at the end and read back out of the object. The
owner's own unpublished edits of this evening (`FleetTitle`, `AboutP1`,
`AboutP2`, `AboutP3`) are read and never written, and the whole draft as it
stood is kept in `tests/revert/draft-before-203.json`. Nothing is published and
nothing is discarded.
"""
import argparse
import asyncio
import datetime
import importlib.util
import json
import os
import pathlib
import time
import urllib.request

# The deployed site is the subject of every scenario in this file, so the
# switch `register-probe.py` reads is set before it is imported rather than
# left to the caller: a run of this file that silently measured a local build
# would answer a different question.
os.environ.setdefault("JAEN_LIVE", "1")

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location(
    "register_probe", HERE / "register-probe.py")
RP = importlib.util.module_from_spec(spec)
spec.loader.exec_module(RP)

ORIGIN = RP.ORIGIN
AGENT = "https://jaen-agent.booklimo.at/graphql"
SITE = "booklimo.at"
PAGE_ID = "JaenPage /"
FIELD_TYPE = "IMA:TextField"

# The field under test and the second editor's field. Both were last written by
# the booklimo machine test account and both hold the site's published text, so
# neither is anybody's unpublished work. See the module docstring.
FIELD = "FaqSubtitle"
OTHER_FIELD = "ServicesSubtitle"


# ---------------------------------------------------------------- the agent

def load_tokens():
    RP.load_env("tokens.env")
    return os.environ.get("TAXI_TOKEN_ADMIN_BOOKLIMO", "")


def agent(query, variables, token):
    body = json.dumps({"query": query, "variables": variables}).encode()
    request = urllib.request.Request(
        AGENT, data=body,
        headers={"content-type": "application/json",
                 "authorization": "Bearer " + token,
                 "user-agent": "revert-probe/1"})
    with urllib.request.urlopen(request, timeout=60) as answer:
        return json.loads(answer.read())


DRAFT_QUERY = ("query($s:String!){draft(site:$s){revision publishedRevision "
               "discardedRevision updatedAt updatedBy full changed "
               "delta{pages authors}}}")


def draft(token):
    return (agent(DRAFT_QUERY, {"s": SITE}, token).get("data") or {}).get("draft")


def draft_fields(answer):
    out = {}
    for node in ((answer or {}).get("delta") or {}).get("pages", {}).values():
        for fields in ((node or {}).get("jaenFields") or {}).values():
            for name, entry in fields.items():
                if isinstance(entry.get("value"), str):
                    out[name] = entry["value"]
    return out


def write_field(token, name, value, base=None):
    """The second editor's write, and the run's own set-back."""
    at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    return agent(
        "mutation($s:String!,$c:[SaveChangesInput!]!,$b:Number){"
        "save(site:$s,changes:$c,baseRevision:$b){revision rebased keys "
        "savedAt overwrote{field}}}",
        {"s": SITE,
         "c": [{"kind": "fieldWrite", "pageId": PAGE_ID,
                "fieldType": FIELD_TYPE, "fieldName": name,
                "value": value, "at": at}],
         "b": base},
        token)


# ------------------------------------------------------------- the browser

# Installed before any script of the page, beside `register-probe.py`'s own
# probe. It never changes what is sent, only when an answer is handed over.
INSTRUMENT = r"""(() => {
  if (window.__revert) return
  const R = (window.__revert = {
    calls: [],
    rows: [],
    warns: [],
    holdNextOp: null,
    held: null,
    heldOp: null,
    releaseAt: null,
    field: '%s',
    subscribed: false,
    error: null
  })

  const now = () => Number(performance.now().toFixed(1))
  const stamp = () => new Date().toISOString()

  const clientRevision = () => {
    try {
      const s = window.__jaenProbe.store.getState()
      return {revision: s.remote.revision,
              publishedRevision: s.remote.publishedRevision,
              // The applied mark and the refusal counter of the fix of
              // 2026-09-08 in the evening. Undefined on a build from before
              // it, which is how a run says which client it drove.
              applied: s.remote.appliedRevision,
              staleAnswers: s.remote.staleAnswers,
              outbox: s.remote.outbox.length,
              saveState: s.remote.saveState}
    } catch (error) { return null }
  }

  const storeValue = () => {
    try {
      const s = window.__jaenProbe.store.getState()
      const nodes = s.page.pages.nodes || {}
      for (const node of Object.values(nodes)) {
        const groups = (node && node.jaenFields) || {}
        for (const fields of Object.values(groups)) {
          const entry = fields && fields[R.field]
          if (entry && typeof entry.value === 'string') return entry.value
        }
      }
      return null
    } catch (error) { return null }
  }

  const domValue = () => {
    try {
      const wrapper = document.getElementById(R.field)
      if (!wrapper) return null
      const editable = wrapper.matches('[contenteditable]')
        ? wrapper : wrapper.querySelector('[contenteditable]')
      return ((editable || wrapper).innerHTML || '').trim()
    } catch (error) { return null }
  }

  // The value the answer of a `draft` call carries for the field under test,
  // read out of the answer's own bytes rather than out of the store.
  const answerValue = body => {
    try {
      const d = body.data.draft
      const pages = (d.delta && d.delta.pages) || {}
      for (const node of Object.values(pages)) {
        const groups = (node && node.jaenFields) || {}
        for (const fields of Object.values(groups)) {
          const entry = fields && fields[R.field]
          if (entry && typeof entry.value === 'string') return entry.value
        }
      }
      return null
    } catch (error) { return undefined }
  }

  const opOf = query => {
    const m = /JaenAgent(\w+)/.exec(query || '')
    return m ? m[1] : '?'
  }

  const realFetch = window.fetch.bind(window)
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input
      : (input && input.url) || String(input)
    if (!/jaen-agent\./.test(url) || !init || init.method !== 'POST') {
      return realFetch(input, init)
    }
    let body = null
    try { body = JSON.parse(init.body) } catch (error) {}
    const op = opOf(body && body.query)
    const call = {
      op: op,
      sentAt: now(),
      sentIso: stamp(),
      sinceRevision: body && body.variables ? body.variables.sinceRevision : undefined,
      baseRevision: body && body.variables ? body.variables.baseRevision : undefined,
      changes: body && body.variables && body.variables.changes
        ? body.variables.changes.length : undefined,
      changeValues: body && body.variables && body.variables.changes
        ? body.variables.changes.map(c => c.fieldName + '=' + String(c.value).slice(0, 90))
        : undefined,
      clientAtSend: clientRevision(),
      held: false
    }
    R.calls.push(call)

    const answer = await realFetch(input, init)
    call.answeredAt = now()
    call.answeredIso = stamp()
    call.status = answer.status
    const text = await answer.text()
    let parsed = null
    try { parsed = JSON.parse(text) } catch (error) {}
    if (parsed && parsed.data && parsed.data.draft) {
      const d = parsed.data.draft
      call.answer = {revision: d.revision, publishedRevision: d.publishedRevision,
                     changed: d.changed, full: d.full,
                     discardedRevision: d.discardedRevision,
                     fieldValue: answerValue(parsed)}
    } else if (parsed && parsed.data && parsed.data.save) {
      call.answer = {revision: parsed.data.save.revision,
                     rebased: parsed.data.save.rebased,
                     keys: parsed.data.save.keys}
    } else if (parsed && parsed.errors) {
      call.answer = {errors: parsed.errors.map(e => e.message)}
    }

    if (op === R.holdNextOp && !R.held) {
      R.holdNextOp = null
      R.heldOp = op
      call.held = true
      await new Promise(resolve => { R.held = resolve })
      call.deliveredAt = now()
      call.deliveredIso = stamp()
      call.heldMs = Number((call.deliveredAt - call.answeredAt).toFixed(1))
      call.clientAtDelivery = clientRevision()
    } else {
      call.deliveredAt = call.answeredAt
    }

    return new Response(text, {status: answer.status,
                               statusText: answer.statusText,
                               headers: answer.headers})
  }

  R.release = () => {
    if (!R.held) return false
    const resolve = R.held
    R.held = null
    R.releaseAt = now()
    resolve()
    return true
  }

  // Every distinct state of the things this question is about, with the redux
  // actions that ran since the row before it.
  let lastTypes = {}
  const rowOf = () => {
    const c = clientRevision()
    const P = window.__jaenProbe
    const types = P ? Object.assign({}, P.types) : {}
    const since = {}
    for (const key of Object.keys(types)) {
      const delta = types[key] - (lastTypes[key] || 0)
      if (delta > 0) since[key] = delta
    }
    return {at: now(), iso: stamp(), client: c,
            store: storeValue(), dom: domValue(), actions: since,
            types: types}
  }
  const push = () => {
    const row = rowOf()
    const last = R.rows[R.rows.length - 1]
    if (last && last.store === row.store && last.dom === row.dom &&
        JSON.stringify(last.client) === JSON.stringify(row.client)) {
      return
    }
    lastTypes = row.types
    delete row.types
    R.rows.push(row)
    if (R.rows.length > 4000) R.rows.shift()
  }

  R.arm = () => {
    if (R.subscribed) return true
    try {
      window.__jaenProbe.store.subscribe(push)
      R.subscribed = true
      push()
      return true
    } catch (error) { R.error = String(error); return false }
  }
  R.sample = push

  const warn = console.warn.bind(console)
  console.warn = function () {
    try {
      R.warns.push({at: now(), iso: stamp(),
                    text: Array.prototype.map.call(arguments, String).join(' ')})
    } catch (error) {}
    return warn.apply(null, arguments)
  }
})()""" % FIELD


READ = "() => ({calls: window.__revert.calls, rows: window.__revert.rows, warns: window.__revert.warns, error: window.__revert.error})"
ARM = "() => window.__revert.arm()"
SAMPLE = "() => { window.__revert.sample(); return true }"
HOLD = "(op) => { window.__revert.holdNextOp = op; return true }"
IS_HELD = "() => Boolean(window.__revert.held)"
RELEASE = "() => window.__revert.release()"
RESET_LOG = "() => { window.__revert.calls.length = 0; window.__revert.rows.length = 0; window.__revert.warns.length = 0; return true }"

FIND = """(stem) => {
  const nodes = Array.from(document.querySelectorAll('[contenteditable="true"]'))
  for (const node of nodes) {
    const text = (node.innerText || '').trim()
    if (text.startsWith(stem)) {
      const box = node.getBoundingClientRect()
      return {text: text, html: node.innerHTML,
              x: box.x + box.width / 2, y: box.y + box.height / 2}
    }
  }
  return null
}"""

STATE = """() => {
  try {
    const s = window.__jaenProbe.store.getState()
    return {revision: s.remote.revision, publishedRevision: s.remote.publishedRevision,
            applied: s.remote.appliedRevision, staleAnswers: s.remote.staleAnswers,
            outbox: s.remote.outbox.length, saveState: s.remote.saveState,
            connection: s.remote.connection, isEditing: s.status.isEditing}
  } catch (error) { return {error: String(error)} }
}"""

FOCUSED = """() => {
  const a = document.activeElement
  return a ? {tag: a.tagName, editable: a.getAttribute('contenteditable'),
              id: (a.closest('[id]') || {}).id || null} : null
}"""


async def open_cms(pw, out):
    browser, context = await RP.new_browser(pw)
    await context.add_init_script(INSTRUMENT)
    page = await context.new_page()
    out["signedIn"] = await RP.sign_in(page)
    if not out["signedIn"]:
        return browser, context, page
    await context.add_init_script(RP.SET_EDITING_AT_BOOT)
    await page.goto(ORIGIN + "/", wait_until="domcontentloaded")
    await RP.wait_for_store(page)
    await page.reload(wait_until="domcontentloaded")
    out["draftSeen"] = bool(await RP.wait_for_draft(page))
    out["editable"] = await RP.wait_for_editable(page)
    await page.wait_for_timeout(3000)
    out["armed"] = await page.evaluate(ARM)
    out["stateAtStart"] = await page.evaluate(STATE)
    return browser, context, page


async def type_into(page, stem, text, blur=True, settle=1200):
    """A person's own gesture: click into the field, type at its end, leave."""
    found = await page.evaluate(FIND, stem)
    if not found:
        return None
    await page.mouse.click(found["x"], found["y"])
    await page.wait_for_timeout(400)
    await page.keyboard.press("End")
    await page.keyboard.type(text, delay=40)
    await page.wait_for_timeout(settle)
    if blur:
        await page.keyboard.press("Tab")
        await page.wait_for_timeout(400)
    return found


async def wait_for_save(page, from_index, timeout=20.0):
    """Until a `save` call has been answered past `from_index`."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        calls = await page.evaluate("() => window.__revert.calls")
        for call in calls[from_index:]:
            if call.get("op") == "Save" and call.get("answer", {}).get("revision"):
                return call
        await page.wait_for_timeout(200)
    return None


async def call_count(page):
    return await page.evaluate("() => window.__revert.calls.length")


def summarise(rows, baseline):
    """Every row in which the store's value went back to a value it had before.

    A revert is only this design's failure when a hydrate is what wrote it. A
    person who types a character and takes it away again also returns the field
    to a value it held, so the rows are split by the action that ran: a revert
    carrying `pages/hydrateFromRemote` came from the outside and one carrying
    `pages/field_write` is the person's own hand.
    """
    reverts = []
    seen = []
    for index, row in enumerate(rows):
        value = row.get("store")
        if value is None:
            continue
        actions = row.get("actions") or {}
        if seen and value != seen[-1] and value in seen[:-1]:
            reverts.append({"index": index, "at": row["iso"],
                            "from": seen[-1], "to": value,
                            "byHydrate": "pages/hydrateFromRemote" in actions,
                            "client": row.get("client"),
                            "actions": actions})
        if not seen or value != seen[-1]:
            seen.append(value)
    hydrates = [r for r in rows if "pages/hydrateFromRemote" in (r.get("actions") or {})]
    # A hydrate that changed the store's value at all, whether or not the value
    # it wrote had been seen before: what an editor sees is the value moving
    # under them and not the value's history.
    moved = []
    for index, row in enumerate(rows):
        if "pages/hydrateFromRemote" not in (row.get("actions") or {}):
            continue
        previous = None
        for earlier in reversed(rows[:index]):
            if earlier.get("store") is not None:
                previous = earlier["store"]
                break
        if previous is not None and row.get("store") != previous:
            moved.append({"at": row["iso"], "from": previous,
                          "to": row.get("store"),
                          "client": row.get("client")})
    return {"distinctValues": seen, "reverts": reverts,
            "byHydrate": [r for r in reverts if r["byHydrate"]],
            "hydrates": len(hydrates), "hydratesThatMovedTheField": moved,
            "revertedToBaseline": [r for r in reverts if r["to"] == baseline]}


# ------------------------------------------------------------- scenario B

async def forced(pw, args, out):
    """The mechanism the design names, forced with a delayed answer alone.

    1. the client is at revision R and the field holds V0
    2. the next `draft` answer is armed to be held
    3. the second editor writes another field, so the object goes to R+1 and
       the socket pushes a frame; the poll that frame causes is answered by the
       object with the page as it stands at R+1, which still holds V0, and that
       answer is held
    4. a person types V1 into the field and leaves it; the save reaches the
       object at R+2 and `saveSucceeded` empties the outbox
    5. the held answer is released

    The question is what the store and the screen hold afterwards.
    """
    token = out["token"]
    browser, context, page = await open_cms(pw, out)
    if not out.get("signedIn"):
        await browser.close()
        return

    stem = args.stem
    base = await page.evaluate(FIND, stem)
    out["fieldAtStart"] = base and base["html"]
    await page.evaluate(RESET_LOG)
    await page.evaluate(SAMPLE)

    out["objectAtStart"] = {k: v for k, v in (draft(token) or {}).items()
                            if k != "delta"}

    # 2. arm
    out["holdArmed"] = await page.evaluate(HOLD, "Draft")

    # 3. the second editor moves the object
    other_before = draft_fields(draft(token)).get(OTHER_FIELD)
    out["otherFieldBefore"] = other_before
    marker = " r%d" % int(time.time() % 100000)
    out["secondEditorWrite"] = write_field(
        token, OTHER_FIELD, (other_before or "") + marker)
    out["secondEditorMarker"] = marker

    # wait for the poll the socket frame causes to be caught
    held = False
    for _ in range(60):
        held = await page.evaluate(IS_HELD)
        if held:
            break
        await page.wait_for_timeout(500)
    out["answerHeld"] = held
    out["stateWhileHeld"] = await page.evaluate(STATE)
    if not held:
        out["calls"] = (await page.evaluate(READ))["calls"]
        await browser.close()
        return

    # 4. the person types and leaves
    before_calls = await call_count(page)
    typed = args.marker
    await type_into(page, stem, typed, blur=not args.focused)
    save = await wait_for_save(page, before_calls, timeout=25)
    out["saveAnswer"] = save
    await page.wait_for_timeout(500)
    out["stateAfterSave"] = await page.evaluate(STATE)
    out["storeAfterSave"] = await page.evaluate(
        "() => { const R = window.__revert; R.sample(); const r = R.rows[R.rows.length-1]; return {store: r.store, dom: r.dom} }")
    out["objectAfterSave"] = draft_fields(draft(token)).get(FIELD)

    # 5. release
    out["released"] = await page.evaluate(RELEASE)
    await page.wait_for_timeout(args.after * 1000)
    await page.evaluate(SAMPLE)
    out["stateAfterRelease"] = await page.evaluate(STATE)
    out["storeAfterRelease"] = await page.evaluate(
        "() => { const R = window.__revert; R.sample(); const r = R.rows[R.rows.length-1]; return {store: r.store, dom: r.dom} }")
    out["onScreenAfterRelease"] = (await page.evaluate(FIND, stem) or {}).get("html")
    out["objectAfterRelease"] = draft_fields(draft(token)).get(FIELD)
    out["focusedAfterRelease"] = await page.evaluate(FOCUSED)

    # and again past the socket's own safety poll, to say whether it heals
    if args.settle:
        await page.wait_for_timeout(args.settle * 1000)
        await page.evaluate(SAMPLE)
        out["stateAfterSettle"] = await page.evaluate(STATE)
        out["storeAfterSettle"] = await page.evaluate(
            "() => { const R = window.__revert; R.sample(); const r = R.rows[R.rows.length-1]; return {store: r.store, dom: r.dom} }")
        out["onScreenAfterSettle"] = (await page.evaluate(FIND, stem) or {}).get("html")
        out["objectAfterSettle"] = draft_fields(draft(token)).get(FIELD)

    log = await page.evaluate(READ)
    out.update(log)
    out["summary"] = summarise(log["rows"], out["fieldAtStart"])
    await browser.close()


# ------------------------------------------------------------- scenario C

async def focused_hydrate(pw, args, out):
    """A hydrate that lands while the caret is in the field.

    No answer is held. The second editor writes **the field under test**, the
    frame arrives, the poll reads it and hydrates while a person is typing into
    that very field with the caret still in it. What is asked is whether the
    text under their hands is replaced and where the caret ends up.
    """
    token = out["token"]
    browser, context, page = await open_cms(pw, out)
    if not out.get("signedIn"):
        await browser.close()
        return

    stem = args.stem
    base = await page.evaluate(FIND, stem)
    out["fieldAtStart"] = base and base["html"]
    await page.evaluate(RESET_LOG)

    found = await page.evaluate(FIND, stem)
    await page.mouse.click(found["x"], found["y"])
    await page.wait_for_timeout(400)
    await page.keyboard.press("End")
    await page.keyboard.type(args.marker, delay=60)
    out["focusedBefore"] = await page.evaluate(FOCUSED)
    await page.wait_for_timeout(200)

    # the other editor writes the same field, from outside this browser
    value = draft_fields(draft(token)).get(FIELD) or out["fieldAtStart"]
    out["otherWrote"] = value + " OTHER"
    out["otherAnswer"] = write_field(token, FIELD, out["otherWrote"])

    await page.wait_for_timeout(args.after * 1000)
    await page.evaluate(SAMPLE)
    out["focusedAfter"] = await page.evaluate(FOCUSED)
    out["onScreenAfter"] = (await page.evaluate(FIND, stem) or {}).get("html")
    out["stateAfter"] = await page.evaluate(STATE)

    # and one more keystroke, to see where it lands
    await page.keyboard.type("ZZ", delay=60)
    await page.wait_for_timeout(1500)
    out["onScreenAfterKeystroke"] = (await page.evaluate(FIND, stem) or {}).get("html")
    await page.keyboard.press("Tab")
    await page.wait_for_timeout(4000)
    out["objectAfter"] = draft_fields(draft(token)).get(FIELD)

    log = await page.evaluate(READ)
    out.update(log)
    out["summary"] = summarise(log["rows"], out["fieldAtStart"])
    await browser.close()


# ------------------------------------------------------------- scenario D

async def socket_in_flight(pw, args, out):
    """A socket frame that arrives while this browser's own save is in flight.

    `poll()` returns at once when `inFlight` is set, and the frame carries no
    content, so nothing re-asks unless the save came back `rebased`. What is
    measured is how long the other editor's change takes to appear.
    """
    token = out["token"]
    browser, context, page = await open_cms(pw, out)
    if not out.get("signedIn"):
        await browser.close()
        return

    stem = args.stem
    other_stem = args.otherStem
    out["fieldAtStart"] = (await page.evaluate(FIND, stem) or {}).get("html")
    out["otherAtStart"] = (await page.evaluate(FIND, other_stem) or {}).get("html")
    await page.evaluate(RESET_LOG)

    # type, then time the second editor's write to land inside the save
    found = await page.evaluate(FIND, stem)
    await page.mouse.click(found["x"], found["y"])
    await page.wait_for_timeout(400)
    await page.keyboard.press("End")
    await page.keyboard.type(args.marker, delay=40)
    await page.keyboard.press("Tab")

    # the flusher waits out its quiet window (1000 ms by default) after the
    # last recorded change, so the save leaves at about 1.5 s after the blur
    await page.wait_for_timeout(args.delay)
    other_before = draft_fields(draft(token)).get(OTHER_FIELD)
    started = time.time()
    out["secondEditorAnswer"] = write_field(
        token, OTHER_FIELD, (other_before or "") + " D")
    out["secondEditorAt"] = time.time() - started

    seen_at = None
    for _ in range(int(args.watch * 2)):
        await page.wait_for_timeout(500)
        await page.evaluate(SAMPLE)
        html = (await page.evaluate(FIND, other_stem) or {}).get("html") or ""
        if html.rstrip().endswith("D"):
            seen_at = time.time() - started
            break
    out["otherSeenAfterSeconds"] = seen_at
    out["otherOnScreen"] = (await page.evaluate(FIND, other_stem) or {}).get("html")
    out["stateAfter"] = await page.evaluate(STATE)

    log = await page.evaluate(READ)
    out.update(log)
    await browser.close()


# ------------------------------------------------------------- scenario A

async def natural(pw, args, out):
    """No forcing at all: a person edits while a second editor writes.

    This is the reading for "how often it happens without forcing". A round is
    one gesture of a person, a character added or taken away again, and the
    second editor writes its own field on its own cadence in between. Every
    distinct value the store held is recorded, so a revert is read off the rows
    rather than looked for.
    """
    token = out["token"]
    browser, context, page = await open_cms(pw, out)
    if not out.get("signedIn"):
        await browser.close()
        return

    stem = args.stem
    out["fieldAtStart"] = (await page.evaluate(FIND, stem) or {}).get("html")
    await page.evaluate(RESET_LOG)
    baseline = out["fieldAtStart"]
    other_before = draft_fields(draft(token)).get(OTHER_FIELD)
    out["otherFieldBefore"] = other_before

    rounds = []
    for index in range(args.rounds):
        # the second editor, out of step with the person on purpose
        if args.second:
            try:
                target = FIELD if args.sameField else OTHER_FIELD
                current = draft_fields(draft(token)).get(target) or ""
                answer = write_field(
                    token, target,
                    (current if args.sameField else (other_before or ""))
                    + (" n%d" % index))
                rounds.append({"round": index, "second": answer.get("data", {}).get("save")})
            except Exception as error:
                rounds.append({"round": index, "secondError": str(error)})
        await type_into(page, stem, "x" if index % 2 == 0 else "", blur=True,
                        settle=args.settle_ms)
        if index % 2 == 1:
            found = await page.evaluate(FIND, stem)
            if found:
                await page.mouse.click(found["x"], found["y"])
                await page.wait_for_timeout(300)
                await page.keyboard.press("End")
                await page.keyboard.press("Backspace")
                await page.wait_for_timeout(args.settle_ms)
                await page.keyboard.press("Tab")
        await page.wait_for_timeout(args.gap)
        await page.evaluate(SAMPLE)
        rounds[-1] if rounds else None
    out["rounds"] = rounds
    await page.wait_for_timeout(5000)
    await page.evaluate(SAMPLE)
    out["stateAtEnd"] = await page.evaluate(STATE)
    out["onScreenAtEnd"] = (await page.evaluate(FIND, stem) or {}).get("html")
    out["objectAtEnd"] = draft_fields(draft(token)).get(FIELD)

    log = await page.evaluate(READ)
    out.update(log)
    out["summary"] = summarise(log["rows"], baseline)
    await browser.close()


async def save_in_flight(pw, args, out):
    """A socket frame that arrives while this browser's own save is in flight.

    The window is a hundred milliseconds wide on a good connection, so it is
    made rather than waited for: the *save's* answer is held, the second editor
    writes while it is held, and the frame the object pushes therefore arrives
    with `inFlight` set. `poll()` returns at once when `inFlight` is set, so
    nothing reads the change the frame is about. What is asked is how long the
    other editor's value takes to appear afterwards, and whether the
    `rebased: true` the held save comes back with rescues it: `flush()` calls
    `void poll()` inside its own `try`, and `inFlight` is only cleared in the
    `finally` after it, so that call is answered by the same early return.
    """
    token = out["token"]
    browser, context, page = await open_cms(pw, out)
    if not out.get("signedIn"):
        await browser.close()
        return

    stem, other_stem = args.stem, args.otherStem
    out["fieldAtStart"] = (await page.evaluate(FIND, stem) or {}).get("html")
    out["otherAtStart"] = (await page.evaluate(FIND, other_stem) or {}).get("html")
    await page.evaluate(RESET_LOG)

    out["holdArmed"] = await page.evaluate(HOLD, "Save")
    await type_into(page, stem, args.marker, blur=True)

    held = False
    for _ in range(60):
        held = await page.evaluate(IS_HELD)
        if held:
            break
        await page.wait_for_timeout(200)
    out["saveHeld"] = held
    if not held:
        out.update(await page.evaluate(READ))
        await browser.close()
        return

    # the second editor writes while this browser's save is out
    other_before = draft_fields(draft(token)).get(OTHER_FIELD)
    started = time.time()
    out["secondEditorAnswer"] = write_field(
        token, OTHER_FIELD, (other_before or "") + " D")
    out["stateWhileSaveHeld"] = await page.evaluate(STATE)
    await page.wait_for_timeout(1500)
    out["released"] = await page.evaluate(RELEASE)

    seen_at = None
    for _ in range(int(args.watch * 2)):
        await page.wait_for_timeout(500)
        await page.evaluate(SAMPLE)
        html = (await page.evaluate(FIND, other_stem) or {}).get("html") or ""
        if html.rstrip().endswith(" D"):
            seen_at = round(time.time() - started, 2)
            break
    out["otherSeenAfterSeconds"] = seen_at
    out["otherOnScreen"] = (await page.evaluate(FIND, other_stem) or {}).get("html")
    out["stateAfter"] = await page.evaluate(STATE)
    out.update(await page.evaluate(READ))
    await browser.close()


SCENARIOS = {"forced": forced, "focused": focused_hydrate,
             "socket": socket_in_flight, "saveflight": save_in_flight,
             "natural": natural}


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("scenario", choices=sorted(SCENARIOS))
    parser.add_argument("--stem", default="Short answers about booking")
    parser.add_argument("--otherStem", default="Get a quick overview")
    parser.add_argument("--marker", default=" AAA")
    parser.add_argument("--after", type=int, default=6,
                        help="seconds to watch after the release")
    parser.add_argument("--settle", type=int, default=0,
                        help="further seconds, past the socket safety poll")
    parser.add_argument("--rounds", type=int, default=8)
    parser.add_argument("--gap", type=int, default=1500)
    parser.add_argument("--settle-ms", dest="settle_ms", type=int, default=1200)
    parser.add_argument("--delay", type=int, default=1400)
    parser.add_argument("--watch", type=float, default=45.0)
    parser.add_argument("--second", type=int, default=1)
    parser.add_argument("--sameField", type=int, default=0,
                        help="the second editor writes the field under test")
    parser.add_argument("--focused", type=int, default=0)
    parser.add_argument("--out", default="")
    parser.add_argument("--restore", type=int, default=0,
                        help="set every field this run wrote back to the value "
                             "it had before it, and read it back")
    args = parser.parse_args()

    token = load_tokens()
    out = {"scenario": args.scenario, "origin": ORIGIN, "site": SITE,
           "field": FIELD, "otherField": OTHER_FIELD,
           "startedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
           "token": token}
    out["objectBefore"] = {k: v for k, v in (draft(token) or {}).items()
                           if k != "delta"}
    out["draftFieldsBefore"] = draft_fields(draft(token))

    # The subject is the deployed site under JAEN_LIVE=1, which is what the
    # reproduce phase drove, and this site's own production build served under
    # its own name otherwise. The second is what a gate wants: the build in the
    # checkout, against the live agent and the live object, so what is measured
    # is the code that is about to be shipped rather than the code that is.
    site = RP.Site()

    from playwright.async_api import async_playwright
    try:
        async with async_playwright() as pw:
            await SCENARIOS[args.scenario](pw, args, out)
    finally:
        site.stop()

    out["servedFrom"] = "the deployed site" if RP.LIVE else "a local production build"

    # Every edit this run made on a live draft is set back and read back. The
    # values are the ones read out of the object before anything was typed, so
    # a field the run never touched is written all the same and is a no-op by
    # value: the object is single threaded and the read-back is the proof, not
    # the write.
    if args.restore:
        restored = {}
        before = out.get("draftFieldsBefore") or {}
        for name in (FIELD, OTHER_FIELD):
            if name not in before:
                continue
            answer = write_field(token, name, before[name])
            restored[name] = {"wroteRevision": (answer.get("data") or {})
                              .get("save", {}).get("revision"),
                              "wanted": before[name]}
        readback = draft_fields(draft(token))
        for name, entry in restored.items():
            entry["readBack"] = readback.get(name)
            entry["ok"] = readback.get(name) == entry["wanted"]
        out["restored"] = restored

    out["draftFieldsAfter"] = draft_fields(draft(token))
    out["objectAfter"] = {k: v for k, v in (draft(token) or {}).items()
                          if k != "delta"}
    out["endedAt"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    out.pop("token", None)
    text = json.dumps(out, indent=1)
    if args.out:
        pathlib.Path(args.out).write_text(text)
        print("written", args.out, len(text), "bytes")
    else:
        print(text)


if __name__ == "__main__":
    asyncio.run(main())
