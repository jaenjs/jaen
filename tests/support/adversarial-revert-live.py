"""Adversarially verify the revert gate on the live booklimo.at.

The invariant this file is pointed at is the one of
`docs/architecture/draft-state.md`: an edit a person made is never lost, and an
unpublished edit never reaches a built site. The gate shipped 2026-09-09 was
measured twice per scenario. This run asks the same questions with a larger
denominator, with a second **browser** rather than a machine account, and with
every value read back from somewhere other than the screen it was typed on.

Scenarios, each a sub-command:

  forced20   the race the reproduce phase found, forced twenty times in one
             long lived session, failing on a single revert
  two        a person typing in browser A while a second **browser** signed in
             as a second human writes a different field, and neither reverts
  focused    typing with the caret still in the field while a read lands, and
             the visible text has to be the person's own
  plain      five fields in turn, each left, then a reload, and all five stand
  readback   a third fresh context, signed in and knowing nothing of the runs,
             beside a read of the object with a credential of this run's own

Nothing is published and nothing is discarded. Every field this run writes is
restored by `draft-guard.py`, which goes through the agent's own `save` and
reads each value back out of the object rather than off a screen.
"""
import argparse
import asyncio
import datetime
import importlib.util
import json
import os
import pathlib
import re
import time

os.environ.setdefault("JAEN_LIVE", "1")

HERE = pathlib.Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("revert_probe", HERE / "revert-probe.py")
RP2 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(RP2)
RP = RP2.RP

ORIGIN = RP.ORIGIN
SITE = RP2.SITE
FIELD = "FaqSubtitle"          # the field under test, published text, machine written
OTHER = "ServicesSubtitle"     # the second editor's field, the same
STEM = "Short answers about booking"
OTHER_STEM = "Get a quick overview"

OUT_DIR = pathlib.Path("/home/snekmin/git/limosen-v3/jaen/tests/adversarial-revert")


# --------------------------------------------------------------- instrument

INSTRUMENT = r"""(() => {
  if (window.__adv) return
  const R = (window.__adv = {
    calls: [], rows: [], warns: [], holdNextOp: null, held: null,
    field: 'FaqSubtitle', subscribed: false, error: null
  })
  const now = () => Number(performance.now().toFixed(1))
  const stamp = () => new Date().toISOString()

  const clientRevision = () => {
    try {
      const s = window.__jaenProbe.store.getState()
      return {revision: s.remote.revision, publishedRevision: s.remote.publishedRevision,
              applied: s.remote.appliedRevision, staleAnswers: s.remote.staleAnswers,
              outbox: s.remote.outbox.length, saveState: s.remote.saveState,
              connection: s.remote.connection}
    } catch (e) { return null }
  }
  const valueOf = (nodes, name) => {
    for (const node of Object.values(nodes || {})) {
      const groups = (node && node.jaenFields) || {}
      for (const fields of Object.values(groups)) {
        const entry = fields && fields[name]
        if (entry && typeof entry.value === 'string') return entry.value
      }
    }
    return null
  }
  const storeValue = name => {
    try {
      const s = window.__jaenProbe.store.getState()
      return valueOf(s.page.pages.nodes, name || R.field)
    } catch (e) { return null }
  }
  const domValue = name => {
    try {
      const wrapper = document.getElementById(name || R.field)
      if (!wrapper) return null
      const editable = wrapper.matches('[contenteditable]') ? wrapper
        : wrapper.querySelector('[contenteditable]')
      return ((editable || wrapper).innerHTML || '').trim()
    } catch (e) { return null }
  }
  R.storeValue = storeValue
  R.domValue = domValue

  const answerValue = body => {
    try { return valueOf(body.data.draft.delta.pages, R.field) } catch (e) { return undefined }
  }
  const opOf = query => { const m = /JaenAgent(\w+)/.exec(query || ''); return m ? m[1] : '?' }

  const realFetch = window.fetch.bind(window)
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || String(input)
    if (!/jaen-agent\./.test(url) || !init || init.method !== 'POST') return realFetch(input, init)
    let body = null
    try { body = JSON.parse(init.body) } catch (e) {}
    const op = opOf(body && body.query)
    const call = {op: op, sentAt: now(), sentIso: stamp(),
      sinceRevision: body && body.variables ? body.variables.sinceRevision : undefined,
      baseRevision: body && body.variables ? body.variables.baseRevision : undefined,
      changeValues: body && body.variables && body.variables.changes
        ? body.variables.changes.map(c => c.fieldName + '=' + String(c.value).slice(0, 120)) : undefined,
      clientAtSend: clientRevision(), held: false}
    R.calls.push(call)
    const answer = await realFetch(input, init)
    call.answeredAt = now(); call.answeredIso = stamp(); call.status = answer.status
    const text = await answer.text()
    let parsed = null
    try { parsed = JSON.parse(text) } catch (e) {}
    if (parsed && parsed.data && parsed.data.draft) {
      const d = parsed.data.draft
      call.answer = {revision: d.revision, changed: d.changed, full: d.full,
                     fieldValue: answerValue(parsed)}
    } else if (parsed && parsed.data && parsed.data.save) {
      call.answer = {revision: parsed.data.save.revision, rebased: parsed.data.save.rebased,
                     keys: parsed.data.save.keys}
    } else if (parsed && parsed.errors) {
      call.answer = {errors: parsed.errors.map(e => e.message)}
    }
    if (op === R.holdNextOp && !R.held) {
      R.holdNextOp = null; call.held = true
      await new Promise(resolve => { R.held = resolve })
      call.deliveredAt = now(); call.deliveredIso = stamp()
      call.heldMs = Number((call.deliveredAt - call.answeredAt).toFixed(1))
      call.clientAtDelivery = clientRevision()
    } else { call.deliveredAt = call.answeredAt }
    return new Response(text, {status: answer.status, statusText: answer.statusText,
                               headers: answer.headers})
  }
  R.release = () => {
    if (!R.held) return false
    const resolve = R.held; R.held = null; resolve(); return true
  }

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
    return {at: now(), iso: stamp(), client: c, store: storeValue(), dom: domValue(),
            actions: since, types: types}
  }
  const push = () => {
    const row = rowOf()
    const last = R.rows[R.rows.length - 1]
    if (last && last.store === row.store && last.dom === row.dom &&
        JSON.stringify(last.client) === JSON.stringify(row.client)) return
    lastTypes = row.types
    delete row.types
    R.rows.push(row)
    if (R.rows.length > 8000) R.rows.shift()
  }
  R.arm = () => {
    if (R.subscribed) return true
    try { window.__jaenProbe.store.subscribe(push); R.subscribed = true; push(); return true }
    catch (e) { R.error = String(e); return false }
  }
  R.sample = push
  const warn = console.warn.bind(console)
  console.warn = function () {
    try { R.warns.push({at: now(), iso: stamp(),
      text: Array.prototype.map.call(arguments, String).join(' ')}) } catch (e) {}
    return warn.apply(null, arguments)
  }
})()"""

ARM = "() => window.__adv.arm()"
SAMPLE = "() => { window.__adv.sample(); return true }"
HOLD = "(op) => { window.__adv.holdNextOp = op; return true }"
IS_HELD = "() => Boolean(window.__adv.held)"
RELEASE = "() => window.__adv.release()"
RESET_LOG = "() => { window.__adv.calls.length = 0; window.__adv.rows.length = 0; window.__adv.warns.length = 0; return true }"
READ = "() => ({calls: window.__adv.calls, rows: window.__adv.rows, warns: window.__adv.warns, error: window.__adv.error})"
SET_FIELD = "(name) => { window.__adv.field = name; return name }"
STATE = """() => { try {
  const s = window.__jaenProbe.store.getState()
  return {revision: s.remote.revision, publishedRevision: s.remote.publishedRevision,
          applied: s.remote.appliedRevision, staleAnswers: s.remote.staleAnswers,
          outbox: s.remote.outbox.length, saveState: s.remote.saveState,
          connection: s.remote.connection, isEditing: s.status.isEditing}
} catch (e) { return {error: String(e)} } }"""
VALUES = """(names) => {
  const out = {}
  for (const n of names) out[n] = {store: window.__adv.storeValue(n), dom: window.__adv.domValue(n)}
  return out
}"""
FOCUSED = """() => { const a = document.activeElement
  return a ? {tag: a.tagName, editable: a.getAttribute('contenteditable'),
              id: (a.closest('[id]') || {}).id || null} : null }"""

# The caret is placed at the end of the field's own contents through the
# Selection API and never with `End`, because `End` in a contenteditable that
# wraps goes to the end of the visual line: that is what corrupted `AboutP2` on
# 2026-09-08 (`editing-performance.md`, "The live draft, and what this run had
# to put back").
CARET_END = """(name) => {
  const wrapper = document.getElementById(name)
  if (!wrapper) return null
  const editable = wrapper.matches('[contenteditable]') ? wrapper
    : wrapper.querySelector('[contenteditable]')
  if (!editable) return null
  editable.focus()
  const range = document.createRange()
  range.selectNodeContents(editable)
  range.collapse(false)
  const selection = window.getSelection()
  selection.removeAllRanges()
  selection.addRange(range)
  const box = editable.getBoundingClientRect()
  return {id: name, html: editable.innerHTML, x: box.x, y: box.y}
}"""


# ------------------------------------------------------------------ helpers

async def sign_in_as(page, login, password):
    await page.goto(ORIGIN + "/login/", wait_until="domcontentloaded")
    await page.wait_for_url(re.compile(r"accounts\.netsnek\.com"), timeout=90000)
    await page.fill("#loginName", login, timeout=30000)
    await page.click("#submit-button")
    await page.fill("#password", password, timeout=30000)
    await page.click("#submit-button")
    for _ in range(60):
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
    for _ in range(60):
        if await page.evaluate(RP.HAS_SESSION):
            return True
        await page.wait_for_timeout(1000)
    return False


async def open_cms(pw, login, password, out, key="A", instrument=True):
    browser, context = await RP.new_browser(pw)
    if instrument:
        await context.add_init_script(INSTRUMENT)
    page = await context.new_page()
    out[key + ".signedIn"] = await sign_in_as(page, login, password)
    if not out[key + ".signedIn"]:
        return browser, context, page
    await context.add_init_script(RP.SET_EDITING_AT_BOOT)
    await page.goto(ORIGIN + "/", wait_until="domcontentloaded")
    await RP.wait_for_store(page)
    await page.reload(wait_until="domcontentloaded")
    out[key + ".draftSeen"] = bool(await RP.wait_for_draft(page))
    out[key + ".editable"] = await RP.wait_for_editable(page)
    await page.wait_for_timeout(3000)
    if instrument:
        out[key + ".armed"] = await page.evaluate(ARM)
    out[key + ".stateAtStart"] = await page.evaluate(STATE)
    return browser, context, page


async def type_at_end(page, field, text, blur=True, settle=1200):
    found = await page.evaluate(CARET_END, field)
    if not found:
        return None
    await page.keyboard.type(text, delay=40)
    await page.wait_for_timeout(settle)
    if blur:
        await page.keyboard.press("Tab")
        await page.wait_for_timeout(500)
    return found


async def wait_for_save(page, from_index, timeout=25.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        calls = await page.evaluate("() => window.__adv.calls")
        for call in calls[from_index:]:
            if call.get("op") == "Save" and (call.get("answer") or {}).get("revision"):
                return call
        await page.wait_for_timeout(200)
    return None


def object_fields(token):
    return RP2.draft_fields(RP2.draft(token))


def now_iso():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def write(out, name):
    """Never with the credential in it: this file lands in the repository."""
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / name
    body = {k: v for k, v in out.items() if k != "token"}
    path.write_text(json.dumps(body, indent=1, ensure_ascii=False, default=str))


# ---------------------------------------------------------------- forced20

async def forced20(pw, args, out):
    """The race the reproduce phase found, forced N times in one session.

    Each round: the next `draft` answer is armed to be held, the second editor
    moves the object so a frame causes that read, the answer the object made
    **before** the keystroke is parked, the person types and leaves, the save
    lands, and only then is the stale answer released. A single round in which
    the store, the screen or the object loses the typed text is a FAIL.
    """
    token = out["token"]
    browser, context, page = await open_cms(pw, RP.LOGIN, RP.PASSWORD, out)
    if not out.get("A.signedIn"):
        await browser.close()
        return
    await page.evaluate(SET_FIELD, FIELD)
    await page.evaluate(RESET_LOG)
    await page.evaluate(SAMPLE)

    baseline = object_fields(token).get(FIELD)
    out["baseline"] = baseline
    out["objectAtStart"] = {k: v for k, v in (RP2.draft(token) or {}).items() if k != "delta"}
    expected = baseline
    other_expected = object_fields(token).get(OTHER)
    rounds = []

    for index in range(args.rounds):
        round_out = {"round": index, "startedAt": now_iso()}
        before_calls = await page.evaluate("() => window.__adv.calls.length")
        state_before = await page.evaluate(STATE)
        round_out["stateBefore"] = state_before

        round_out["holdArmed"] = await page.evaluate(HOLD, "Draft")

        marker_other = " o%d" % index
        other_expected = (other_expected or "") + marker_other
        answer = RP2.write_field(token, OTHER, other_expected)
        round_out["secondEditor"] = (answer.get("data") or {}).get("save")

        held = False
        for _ in range(80):
            held = await page.evaluate(IS_HELD)
            if held:
                break
            await page.wait_for_timeout(500)
        round_out["answerHeld"] = held
        if not held:
            round_out["fail"] = "no draft answer could be held in forty seconds"
            rounds.append(round_out)
            break

        marker = " a%d" % index
        expected = expected + marker
        round_out["typed"] = marker
        await type_at_end(page, FIELD, marker, blur=True)
        save = await wait_for_save(page, before_calls)
        round_out["save"] = save and save.get("answer")
        round_out["stateAfterSave"] = await page.evaluate(STATE)

        round_out["released"] = await page.evaluate(RELEASE)
        await page.wait_for_timeout(args.after * 1000)
        await page.evaluate(SAMPLE)
        state_after = await page.evaluate(STATE)
        values = await page.evaluate(VALUES, [FIELD])
        round_out["stateAfterRelease"] = state_after
        round_out["store"] = values[FIELD]["store"]
        round_out["dom"] = values[FIELD]["dom"]
        round_out["object"] = object_fields(token).get(FIELD)
        round_out["expected"] = expected

        round_out["storeOk"] = round_out["store"] == expected
        round_out["objectOk"] = round_out["object"] == expected
        round_out["domCarriesMarker"] = bool(round_out["dom"] and marker.strip() in round_out["dom"])
        round_out["appliedWentBackwards"] = (
            state_after.get("applied") is not None and state_before.get("applied") is not None
            and state_after["applied"] < state_before["applied"])
        round_out["staleAnswersDelta"] = (
            (state_after.get("staleAnswers") or 0) - (state_before.get("staleAnswers") or 0))
        round_out["ok"] = (round_out["storeOk"] and round_out["objectOk"]
                           and round_out["domCarriesMarker"]
                           and not round_out["appliedWentBackwards"])
        rounds.append(round_out)
        print("round %d ok=%s store=%s object=%s stale+%s"
              % (index, round_out["ok"], round_out["storeOk"], round_out["objectOk"],
                 round_out["staleAnswersDelta"]))
        write(out | {"rounds": rounds}, args.out)
        if not round_out["ok"] and args.stop_on_fail:
            break

    out["rounds"] = rounds
    log = await page.evaluate(READ)
    out["warns"] = log["warns"]
    out["summary"] = RP2.summarise(log["rows"], baseline)
    out["rowCount"] = len(log["rows"])
    out["callCount"] = len(log["calls"])
    # the calls are large; only the held ones and the saves are kept
    out["calls"] = [c for c in log["calls"] if c.get("held") or c.get("op") == "Save"]
    out["roundsOk"] = sum(1 for r in rounds if r.get("ok"))
    out["roundsRun"] = len(rounds)
    out["revertsByHydrate"] = out["summary"]["byHydrate"]
    out["hydratesThatMovedTheField"] = out["summary"]["hydratesThatMovedTheField"]
    out["verdict"] = ("PASS" if out["roundsOk"] == args.rounds
                      and not out["summary"]["byHydrate"] else "FAIL")
    await browser.close()


# --------------------------------------------------------------------- two

async def two_browsers(pw, args, out):
    """Two browsers, two humans, two fields, and neither may revert."""
    token = out["token"]
    login_b = os.environ["TAXI_HUMAN_CUSTOMER_BOOKLIMO_LOGIN"]
    password_b = os.environ["TAXI_HUMAN_CUSTOMER_BOOKLIMO_PASSWORD"]

    browser_a, context_a, page_a = await open_cms(pw, RP.LOGIN, RP.PASSWORD, out, "A")
    browser_b, context_b, page_b = await open_cms(pw, login_b, password_b, out, "B")
    if not (out.get("A.signedIn") and out.get("B.signedIn")):
        await browser_a.close()
        await browser_b.close()
        return
    await page_a.evaluate(SET_FIELD, FIELD)
    await page_b.evaluate(SET_FIELD, OTHER)
    await page_a.evaluate(RESET_LOG)
    await page_b.evaluate(RESET_LOG)

    before = object_fields(token)
    out["baseline"] = {FIELD: before.get(FIELD), OTHER: before.get(OTHER)}
    expected_a = before.get(FIELD)
    expected_b = before.get(OTHER)

    rounds = []
    for index in range(args.rounds):
        marker_a = " A%d" % index
        marker_b = " B%d" % index
        expected_a += marker_a
        expected_b += marker_b
        # A types and leaves, and B types into its own field inside A's quiet
        # window, so the two saves overlap the way two people do.
        await page_a.evaluate(CARET_END, FIELD)
        await page_a.keyboard.type(marker_a, delay=40)
        await page_b.evaluate(CARET_END, OTHER)
        await page_b.keyboard.type(marker_b, delay=40)
        await page_a.keyboard.press("Tab")
        await page_b.keyboard.press("Tab")
        await page_a.wait_for_timeout(args.after * 1000)
        await page_a.evaluate(SAMPLE)
        await page_b.evaluate(SAMPLE)
        values_a = await page_a.evaluate(VALUES, [FIELD, OTHER])
        values_b = await page_b.evaluate(VALUES, [FIELD, OTHER])
        obj = object_fields(token)
        row = {"round": index,
               "expected": {FIELD: expected_a, OTHER: expected_b},
               "A": values_a, "B": values_b,
               "object": {FIELD: obj.get(FIELD), OTHER: obj.get(OTHER)},
               "stateA": await page_a.evaluate(STATE),
               "stateB": await page_b.evaluate(STATE)}
        row["aKeptItsOwn"] = values_a[FIELD]["store"] == expected_a
        row["bKeptItsOwn"] = values_b[OTHER]["store"] == expected_b
        row["objectHasBoth"] = (obj.get(FIELD) == expected_a and obj.get(OTHER) == expected_b)
        row["ok"] = row["aKeptItsOwn"] and row["bKeptItsOwn"] and row["objectHasBoth"]
        rounds.append(row)
        print("round %d ok=%s A=%s B=%s object=%s"
              % (index, row["ok"], row["aKeptItsOwn"], row["bKeptItsOwn"], row["objectHasBoth"]))
        write(out | {"rounds": rounds}, args.out)

    # and each browser has to end up seeing the other's field too
    await page_a.wait_for_timeout(8000)
    await page_a.evaluate(SAMPLE)
    await page_b.evaluate(SAMPLE)
    out["convergedA"] = await page_a.evaluate(VALUES, [FIELD, OTHER])
    out["convergedB"] = await page_b.evaluate(VALUES, [FIELD, OTHER])
    out["object"] = {k: object_fields(token).get(k) for k in (FIELD, OTHER)}
    out["expected"] = {FIELD: expected_a, OTHER: expected_b}
    out["rounds"] = rounds

    log_a = await page_a.evaluate(READ)
    log_b = await page_b.evaluate(READ)
    out["summaryA"] = RP2.summarise(log_a["rows"], out["baseline"][FIELD])
    out["summaryB"] = RP2.summarise(log_b["rows"], out["baseline"][OTHER])
    out["warnsA"] = log_a["warns"]
    out["warnsB"] = log_b["warns"]
    out["verdict"] = ("PASS" if all(r["ok"] for r in rounds)
                      and not out["summaryA"]["byHydrate"]
                      and not out["summaryB"]["byHydrate"]
                      and out["convergedA"][OTHER]["store"] == expected_b
                      and out["convergedB"][FIELD]["store"] == expected_a else "FAIL")
    await browser_a.close()
    await browser_b.close()


# ----------------------------------------------------------------- focused

async def focused(pw, args, out):
    """The caret stays in the field while a read lands, and the text is theirs."""
    token = out["token"]
    browser, context, page = await open_cms(pw, RP.LOGIN, RP.PASSWORD, out)
    if not out.get("A.signedIn"):
        await browser.close()
        return
    await page.evaluate(SET_FIELD, FIELD)
    await page.evaluate(RESET_LOG)

    baseline = object_fields(token).get(FIELD)
    out["baseline"] = baseline
    rounds = []
    expected_other = object_fields(token).get(OTHER)

    for index in range(args.rounds):
        marker = " c%d" % index
        row = {"round": index, "marker": marker}
        await page.evaluate(CARET_END, FIELD)
        await page.keyboard.type(marker, delay=60)
        row["focusedBefore"] = await page.evaluate(FOCUSED)
        await page.wait_for_timeout(200)

        # a read of this browser's is made to land while the caret is in the
        # field: the second editor writes the very field the person is in
        # (`same`), or another field (`other`), and the poll the frame causes
        # hydrates under their hands either way.
        if args.same:
            current = object_fields(token).get(FIELD) or baseline
            row["otherWrote"] = current + " OTHER"
            row["otherAnswer"] = (RP2.write_field(token, FIELD, row["otherWrote"])
                                  .get("data") or {}).get("save")
        else:
            expected_other = (expected_other or "") + (" o%d" % index)
            row["otherWrote"] = expected_other
            row["otherAnswer"] = (RP2.write_field(token, OTHER, expected_other)
                                  .get("data") or {}).get("save")

        await page.wait_for_timeout(args.after * 1000)
        await page.evaluate(SAMPLE)
        row["focusedAfter"] = await page.evaluate(FOCUSED)
        values = await page.evaluate(VALUES, [FIELD])
        row["domWhileFocused"] = values[FIELD]["dom"]
        row["storeWhileFocused"] = values[FIELD]["store"]
        row["visibleIsMine"] = bool(row["domWhileFocused"]
                                    and marker.strip() in row["domWhileFocused"]
                                    and "OTHER" not in row["domWhileFocused"])
        row["caretStillInField"] = (row["focusedAfter"] or {}).get("id") == FIELD

        # the next keystrokes have to land at the end and not at the front
        await page.keyboard.type("ZZ", delay=60)
        await page.wait_for_timeout(1500)
        after = await page.evaluate(VALUES, [FIELD])
        row["domAfterKeystroke"] = after[FIELD]["dom"]
        row["keystrokesAtTheEnd"] = bool(row["domAfterKeystroke"]
                                         and row["domAfterKeystroke"].rstrip().endswith("ZZ"))
        await page.keyboard.press("Tab")
        await page.wait_for_timeout(5000)
        row["objectAfter"] = object_fields(token).get(FIELD)
        row["storeAfterBlur"] = (await page.evaluate(VALUES, [FIELD]))[FIELD]["store"]
        row["ok"] = row["visibleIsMine"] and row["caretStillInField"] and row["keystrokesAtTheEnd"]
        rounds.append(row)
        print("round %d ok=%s visibleIsMine=%s caret=%s tail=%s"
              % (index, row["ok"], row["visibleIsMine"], row["caretStillInField"],
                 row["keystrokesAtTheEnd"]))
        write(out | {"rounds": rounds}, args.out)

    out["rounds"] = rounds
    log = await page.evaluate(READ)
    out["summary"] = RP2.summarise(log["rows"], baseline)
    out["warns"] = log["warns"]
    out["verdict"] = "PASS" if all(r["ok"] for r in rounds) else "FAIL"
    await browser.close()


# ------------------------------------------------------------------- plain

PLAIN_FIELDS = ["FaqSubtitle", "ServicesSubtitle", "ServicesTitle",
                "FeedbackBoxText", "FaqTitle"]


async def plain(pw, args, out):
    """The path a person actually walks: five fields, each left, then a reload."""
    token = out["token"]
    browser, context, page = await open_cms(pw, RP.LOGIN, RP.PASSWORD, out)
    if not out.get("A.signedIn"):
        await browser.close()
        return
    await page.evaluate(RESET_LOG)

    before = object_fields(token)
    out["objectBefore"] = {k: before.get(k) for k in PLAIN_FIELDS}
    on_screen = await page.evaluate(VALUES, PLAIN_FIELDS)
    out["onScreenBefore"] = on_screen

    expected = {}
    typed = {}
    for index, field in enumerate(PLAIN_FIELDS):
        marker = " p%d" % index
        base = before.get(field)
        if base is None:
            # a field the draft has never carried: its value on the screen is
            # the published one, which is what the CMS is editing.
            base = (on_screen[field]["store"] if on_screen[field]["store"] is not None
                    else on_screen[field]["dom"])
        expected[field] = (base or "") + marker
        typed[field] = marker
        found = await type_at_end(page, field, marker, blur=True, settle=800)
        if not found:
            out["missingField"] = field
    out["typed"] = typed
    out["expectedAfterTyping"] = expected

    await page.wait_for_timeout(6000)
    out["stateBeforeReload"] = await page.evaluate(STATE)
    out["storeBeforeReload"] = await page.evaluate(VALUES, PLAIN_FIELDS)
    out["objectBeforeReload"] = {k: object_fields(token).get(k) for k in PLAIN_FIELDS}

    await page.reload(wait_until="domcontentloaded")
    await RP.wait_for_draft(page)
    await RP.wait_for_editable(page)
    await page.wait_for_timeout(6000)
    out["stateAfterReload"] = await page.evaluate(STATE)
    after = await page.evaluate(VALUES, PLAIN_FIELDS)
    out["storeAfterReload"] = after
    out["objectAfterReload"] = {k: object_fields(token).get(k) for k in PLAIN_FIELDS}

    standing = {}
    for field in PLAIN_FIELDS:
        standing[field] = {
            "expected": expected[field],
            "storeAfterReload": after[field]["store"],
            "domAfterReload": after[field]["dom"],
            "object": out["objectAfterReload"][field],
            "storeOk": after[field]["store"] == expected[field],
            "objectOk": out["objectAfterReload"][field] == expected[field],
            "domCarriesMarker": bool(after[field]["dom"]
                                     and typed[field].strip() in after[field]["dom"])}
        standing[field]["ok"] = (standing[field]["storeOk"] and standing[field]["objectOk"]
                                 and standing[field]["domCarriesMarker"])
    out["standing"] = standing
    out["verdict"] = "PASS" if all(v["ok"] for v in standing.values()) else "FAIL"
    log = await page.evaluate(READ)
    out["warns"] = log["warns"]
    await browser.close()


# ---------------------------------------------------------------- readback

async def readback(pw, args, out):
    """A third fresh context, and the object with a credential of this run's own."""
    token = out["token"]
    wanted = json.loads(pathlib.Path(args.expect).read_text()) if args.expect else {}
    browser, context, page = await open_cms(pw, RP.LOGIN, RP.PASSWORD, out, "C")
    if not out.get("C.signedIn"):
        await browser.close()
        return
    await page.wait_for_timeout(6000)
    names = sorted(set(list(wanted) + PLAIN_FIELDS + [FIELD, OTHER]))
    out["fromThirdContext"] = await page.evaluate(VALUES, names)
    out["stateOfThirdContext"] = await page.evaluate(STATE)
    out["fromTheObject"] = object_fields(token)
    out["objectMeta"] = {k: v for k, v in (RP2.draft(token) or {}).items() if k != "delta"}
    if wanted:
        agree = {}
        for name, value in wanted.items():
            screen = (out["fromThirdContext"].get(name) or {}).get("store")
            obj = out["fromTheObject"].get(name)
            agree[name] = {"wanted": value, "thirdContext": screen, "object": obj,
                           "ok": screen == value and obj == value}
        out["agree"] = agree
        out["verdict"] = "PASS" if all(v["ok"] for v in agree.values()) else "FAIL"
    await browser.close()


SCENARIOS = {"forced20": forced20, "two": two_browsers, "focused": focused,
             "plain": plain, "readback": readback}


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("scenario", choices=sorted(SCENARIOS))
    parser.add_argument("--rounds", type=int, default=20)
    parser.add_argument("--after", type=int, default=5)
    parser.add_argument("--same", type=int, default=1)
    parser.add_argument("--expect", default="")
    parser.add_argument("--stop-on-fail", dest="stop_on_fail", type=int, default=0)
    parser.add_argument("--out", default="")
    args = parser.parse_args()
    args.out = args.out or (args.scenario + ".json")

    token = RP2.load_tokens()
    out = {"scenario": args.scenario, "origin": ORIGIN, "site": SITE,
           "field": FIELD, "otherField": OTHER, "rounds_asked": args.rounds,
           "startedAt": now_iso(), "token": token}
    out["objectBefore"] = {k: v for k, v in (RP2.draft(token) or {}).items() if k != "delta"}

    site = RP.Site()
    from playwright.async_api import async_playwright
    try:
        async with async_playwright() as pw:
            await SCENARIOS[args.scenario](pw, args, out)
    finally:
        site.stop()

    out["objectAfter"] = {k: v for k, v in (RP2.draft(token) or {}).items() if k != "delta"}
    out["draftFieldsAfter"] = object_fields(token)
    out["endedAt"] = now_iso()
    out.pop("token", None)
    write(out, args.out)
    print("verdict:", out.get("verdict"))


if __name__ == "__main__":
    asyncio.run(main())
