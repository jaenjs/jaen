"""Adversarial verification of site wide discard on the live booklimo.at.

Two browsers, both real sign ins, both driven through the CMS's own controls
where the design says a person acts. Every reading beside the browsers is taken
with a credential of the run's own against the deployed agent, so what a screen
claims and what the object holds are two answers and never one.

Nothing here trusts a previous run: the baseline is read first, the fixture is
this run's own, and the site is read back from a third fresh context at the end.
"""
import asyncio, json, os, pathlib, re, sys, time, urllib.request

OUT = pathlib.Path(__file__).resolve().parent
ORIGIN = "https://booklimo.at"
AGENT = "https://jaen-agent.booklimo.at/graphql"
SITE = "booklimo.at"
PERSIST_KEY = "jaenjs-state"
DISCARDED_KEY = "jaenjs-state-discarded"
ITEM = "Alle unveröffentlichten Änderungen verwerfen"
USER_MENU = "Open user menu"
CONFIG = pathlib.Path(os.path.expanduser("~/.config/taxi-app"))

def load_env(name):
    p = CONFIG / name
    if not p.is_file(): return
    for line in p.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line: continue
        k, _, v = line.partition("=")
        k = k.strip().removeprefix("export ").strip(); v = v.strip().strip('"').strip("'")
        if k and v and not os.environ.get(k): os.environ[k] = v
load_env("humans.env"); load_env("tokens.env")

ADMIN_TOKEN = os.environ["TAXI_TOKEN_ADMIN_BOOKLIMO"]
CUSTOMER_TOKEN = os.environ["TAXI_TOKEN_CUSTOMER_BOOKLIMO"]
DRIVER_TOKEN = os.environ["TAXI_TOKEN_DRIVER_BOOKLIMO"]
LIMOSEN_TOKEN = os.environ["TAXI_TOKEN_ADMIN"]
A_LOGIN = os.environ["TAXI_HUMAN_ADMIN_BOOKLIMO_LOGIN"]; A_PASS = os.environ["TAXI_HUMAN_ADMIN_BOOKLIMO_PASSWORD"]
B_LOGIN = os.environ["TAXI_HUMAN_CUSTOMER_BOOKLIMO_LOGIN"]; B_PASS = os.environ["TAXI_HUMAN_CUSTOMER_BOOKLIMO_PASSWORD"]

report = {"startedAt": time.time(), "origin": ORIGIN, "site": SITE}
def save():
    (OUT / "verify-discard.json").write_text(json.dumps(report, default=str, ensure_ascii=False, indent=1))
def note(*a):
    print(*a, flush=True)

def gql(query, variables=None, token=None, url=AGENT):
    body = json.dumps({"query": query, "variables": variables or {}}).encode()
    r = urllib.request.Request(url, data=body, method="POST")
    r.add_header("content-type", "application/json"); r.add_header("user-agent", "jaen-discard-adversarial")
    if token: r.add_header("authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(r, timeout=90) as a:
            return {"status": a.status, **json.loads(a.read())}
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        try: parsed = json.loads(raw)
        except Exception: parsed = {"raw": raw}
        return {"status": e.code, **parsed}
    except Exception as e:
        return {"transportError": "%s: %s" % (type(e).__name__, e)}

DRAFT_Q = """query($s:String!){ draft(site:$s){ revision publishedRevision changed full
  discardedRevision discardedAt discardedBy discardedByName updatedAt updatedBy
  snapshotRevision snapshotBytes
  delta{ pages media removedMedia site widgets authors } } }"""
PREVIEW_Q = """query($s:String!){ discardPreview(site:$s){ revision publishedRevision canDiscard reason
  pages fields pagesAdded pagesRemoved mediaAdded mediaRemoved siteChanged widgetsChanged
  editors{sub name at} since publishedAt takenAt } }"""
DISCARDED_Q = """query($s:String!){ discardedDraft(site:$s){ site found revision takenAt bytes pages data } }"""
DISCARD_M = """mutation($s:String!,$at:Number){ discard(site:$s, atRevision:$at){ discarded revision previousRevision
  publishedRevision pages fields snapshotRevision snapshotBytes reason } }"""
SAVE_M = """mutation($s:String!,$c:[SaveChangesInput!]!,$b:Number){ save(site:$s, changes:$c, baseRevision:$b){
  revision rebased touched keys savedAt } }"""

def fields_of(answer):
    try: pages = answer["data"]["draft"]["delta"]["pages"] or {}
    except Exception: return {}
    out = {}
    for pid, page in pages.items():
        for name, node in ((page.get("jaenFields") or {}).get("IMA:TextField") or {}).items():
            out[name] = node.get("value")
    return out

def errors_of(answer):
    return [{"message": e.get("message"),
             "code": (e.get("extensions") or {}).get("code"),
             "statusCode": (e.get("extensions") or {}).get("statusCode"),
             "details": (e.get("extensions") or {}).get("details")} for e in (answer.get("errors") or [])]

# ---------------------------------------------------------------- browser bits
SET_EDITING = """(() => { try {
  const raw = localStorage.getItem('%s'); const s = raw ? JSON.parse(raw) : {}
  s.status = {...(s.status || {}), isEditing: true}
  localStorage.setItem('%s', JSON.stringify(s))
} catch (e) {} })()""" % (PERSIST_KEY, PERSIST_KEY)
HAS_SESSION = "() => { try { return Object.keys(sessionStorage).some(k => k.startsWith('oidc.user:')) } catch (e) { return false } }"
READ_STATE = "() => { try { const r = localStorage.getItem('%s'); return r ? JSON.parse(r) : null } catch (e) { return null } }" % PERSIST_KEY
READ_PARKED = "() => { try { return JSON.parse(localStorage.getItem('%s') || 'null') } catch (e) { return null } }" % DISCARDED_KEY
FIELD_TEXT = "(id) => { const n = document.getElementById(id); return n ? (n.innerText || '').trim() : null }"
FIELD_BOX = """(id) => { const n = document.getElementById(id); if (!n) return null
  n.scrollIntoView({block: 'center'}); const b = n.getBoundingClientRect()
  return {x: b.x + b.width / 2, y: b.y + b.height / 2, text: (n.innerText || '').trim()} }"""

async def sign_in(page, login, password):
    await page.goto(ORIGIN + "/login/", wait_until="domcontentloaded")
    await page.wait_for_url(re.compile(r"accounts\.netsnek\.com"), timeout=90000)
    await page.fill("#loginName", login, timeout=30000)
    await page.click("#submit-button")
    await page.fill("#password", password, timeout=30000)
    await page.click("#submit-button")
    for _ in range(60):
        await page.wait_for_timeout(1000)
        if page.url.startswith(ORIGIN): break
        for sel in ["button[name='skip']", "#skip-button", "button:has-text('Überspringen')"]:
            loc = page.locator(sel).first
            if await loc.count() and await loc.is_visible():
                await loc.click(); break
    if not page.url.startswith(ORIGIN): return False
    for _ in range(60):
        if await page.evaluate(HAS_SESSION): return True
        await page.wait_for_timeout(1000)
    return False

async def editing_on(page):
    await page.goto(ORIGIN + "/", wait_until="domcontentloaded")
    for _ in range(40):
        if await page.evaluate("() => localStorage.getItem('%s') !== null" % PERSIST_KEY): break
        await page.wait_for_timeout(1000)
    await page.context.add_init_script(SET_EDITING)
    await page.reload(wait_until="domcontentloaded")
    for _ in range(40):
        if await page.locator('[contenteditable="true"]').count(): return True
        await page.wait_for_timeout(1000)
    return False

async def type_into(page, field, suffix):
    box = await page.evaluate(FIELD_BOX, field)
    if not box: return {"field": field, "error": "not on this page"}
    await page.mouse.click(box["x"], box["y"])
    await page.keyboard.press("End")
    await page.keyboard.type(suffix, delay=50)
    await page.keyboard.press("Tab")
    await page.wait_for_timeout(3500)
    return {"field": field, "before": box["text"], "typed": suffix,
            "onScreen": await page.evaluate(FIELD_TEXT, field)}

async def browser_state(page):
    s = await page.evaluate(READ_STATE)
    r = (s or {}).get("remote", {}) or {}
    return {"outbox": len(r.get("outbox") or []), "outboxFields": [
                (c.get("change") or {}).get("fieldName") for c in (r.get("outbox") or [])],
            "revision": r.get("revision"), "publishedRevision": r.get("publishedRevision"),
            "discardedRevision": r.get("discardedRevision"), "saveState": r.get("saveState"),
            "connection": r.get("connection")}

async def toasts(page):
    return await page.evaluate("""() => Array.from(document.querySelectorAll('[data-scope="toast"], [role="status"], [role="alert"]'))
        .map(n => (n.innerText || '').trim()).filter(Boolean).slice(0, 8)""")

# ---------------------------------------------------------------------- the run
FIELDS_A = {"FleetTitle": " AAA-probe", "ServicesTitle": " AAA-probe"}
FIELD_B_SAVED = ("FaqSubtitle", " BBB-saved-probe")
FIELD_B_PARKED = ("AboutP1", " BBB-parked-probe")

async def main():
    from playwright.async_api import async_playwright

    # 0. the baseline, out of the object, before anything is typed
    base = gql(DRAFT_Q, {"s": SITE}, ADMIN_TOKEN)
    report["baseline"] = {"draft": {k: v for k, v in (base.get("data", {}).get("draft") or {}).items() if k != "delta"},
                          "fields": fields_of(base)}
    report["baselinePreview"] = gql(PREVIEW_Q, {"s": SITE}, ADMIN_TOKEN).get("data", {}).get("discardPreview")
    (OUT / "baseline-full.json").write_text(json.dumps(base, indent=1, sort_keys=True))
    note("baseline", report["baseline"]["draft"])
    save()

    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        ctxA = await browser.new_context(viewport={"width": 1440, "height": 900}, locale="de-AT", timezone_id="Europe/Vienna")
        ctxB = await browser.new_context(viewport={"width": 1280, "height": 900}, locale="de-AT", timezone_id="Europe/Vienna")
        pageA = await ctxA.new_page(); pageB = await ctxB.new_page()

        # B's saves are blocked from a chosen moment, so its outbox is real
        blocked = {"on": False, "aborted": 0, "seen": []}
        async def routeB(route):
            request = route.request
            body = request.post_data or ""
            if blocked["on"] and "mutation" in body and '"changes"' in body:
                blocked["aborted"] += 1
                blocked["seen"].append(body[:120])
                await route.abort("failed")
            else:
                await route.continue_()
        await ctxB.route("https://jaen-agent.booklimo.at/**", routeB)

        report["signedInA"] = await sign_in(pageA, A_LOGIN, A_PASS); note("signed in A", report["signedInA"]); save()
        report["signedInB"] = await sign_in(pageB, B_LOGIN, B_PASS); note("signed in B", report["signedInB"]); save()
        if not (report["signedInA"] and report["signedInB"]):
            report["error"] = "a sign in failed"; save(); return

        report["editingA"] = await editing_on(pageA)
        report["editingB"] = await editing_on(pageB)
        note("editing", report["editingA"], report["editingB"]); save()
        await pageA.wait_for_timeout(4000)

        # 1. A types two fixture edits
        report["typedA"] = [await type_into(pageA, f, s) for f, s in FIELDS_A.items()]
        note("typed A", report["typedA"]); save()

        # 2. B types one edit that reaches the object
        report["typedBSaved"] = await type_into(pageB, *FIELD_B_SAVED)
        await pageB.wait_for_timeout(3000)
        report["afterTyping"] = {"object": {k: v for k, v in (gql(DRAFT_Q, {"s": SITE}, ADMIN_TOKEN).get("data", {}).get("draft") or {}).items() if k != "delta"},
                                 "fields": fields_of(gql(DRAFT_Q, {"s": SITE}, ADMIN_TOKEN))}
        note("after typing", report["afterTyping"]["fields"]); save()

        # 3. B's saves are cut off, and B types again: that change stays in its outbox
        blocked["on"] = True
        report["typedBParked"] = await type_into(pageB, *FIELD_B_PARKED)
        await pageB.wait_for_timeout(6000)
        report["bBeforeDiscard"] = await browser_state(pageB)
        report["blockedSaves"] = blocked["aborted"]
        note("B before discard", report["bBeforeDiscard"], "aborted", blocked["aborted"]); save()

        dirty = gql(DRAFT_Q, {"s": SITE}, ADMIN_TOKEN)
        dirty_revision = (dirty.get("data", {}).get("draft") or {}).get("revision")
        report["dirty"] = {"revision": dirty_revision, "fields": fields_of(dirty)}

        # 4. a non-admin may not discard, and it is asked while there is something to discard
        refusals = {}
        for name, token in (("anonymous", None), ("krc:customer machine", CUSTOMER_TOKEN),
                            ("krc:driver machine", DRIVER_TOKEN), ("limosen admin", LIMOSEN_TOKEN)):
            refusals[name] = {
                "preview": errors_of(gql(PREVIEW_Q, {"s": SITE}, token)) or "ANSWERED",
                "discard": errors_of(gql(DISCARD_M, {"s": SITE, "at": None}, token)) or "ANSWERED",
                "statusPreview": gql(PREVIEW_Q, {"s": SITE}, token).get("status")}
        after_refusals = gql(DRAFT_Q, {"s": SITE}, ADMIN_TOKEN)
        report["refusals"] = refusals
        report["refusalsLeftDraft"] = {"revision": (after_refusals.get("data", {}).get("draft") or {}).get("revision"),
                                       "fields": fields_of(after_refusals)}
        note("refusals", json.dumps(refusals)[:400]); save()

        # 5. what the confirmation will say, asked of the agent first
        report["preview"] = gql(PREVIEW_Q, {"s": SITE}, ADMIN_TOKEN).get("data", {}).get("discardPreview")
        note("preview", report["preview"]); save()

        # 6. A discards, through the item in the frame's own menu
        await pageA.get_by_label(USER_MENU).first.click()
        await pageA.wait_for_timeout(1500)
        item = pageA.get_by_text(ITEM, exact=False).first
        report["menuItem"] = bool(await item.count()) and await item.is_visible()
        if not report["menuItem"]:
            report["menuTexts"] = await pageA.evaluate(
                """() => Array.from(document.querySelectorAll('[role="menuitem"], button, a')).map(n => (n.innerText||'').trim()).filter(Boolean).slice(0,60)""")
            report["error"] = "no discard item in the user menu"; save(); return
        await item.click(); await pageA.wait_for_timeout(2500)
        dialog = pageA.locator('[role="alertdialog"], [role="dialog"]').last
        report["confirmText"] = (await dialog.inner_text()) if await dialog.count() else None
        note("confirmation:", report["confirmText"]); save()
        confirm = pageA.get_by_role("button", name=re.compile("verwerfen", re.I)).last
        report["confirmButton"] = bool(await confirm.count())
        if not report["confirmButton"]:
            report["error"] = "no confirm button"; save(); return
        await confirm.click()
        await pageA.wait_for_timeout(7000)

        # 7. what the object holds afterwards, and what the two screens hold
        after = gql(DRAFT_Q, {"s": SITE}, ADMIN_TOKEN)
        report["after"] = {"draft": {k: v for k, v in (after.get("data", {}).get("draft") or {}).items() if k != "delta"},
                           "fields": fields_of(after)}
        (OUT / "after-full.json").write_text(json.dumps(after, indent=1, sort_keys=True))
        report["toastA"] = await toasts(pageA)
        report["aAfter"] = await browser_state(pageA)
        report["screenA"] = {f: await pageA.evaluate(FIELD_TEXT, f) for f in
                             list(FIELDS_A) + [FIELD_B_SAVED[0], FIELD_B_PARKED[0]]}
        note("after", report["after"]["fields"]); save()

        await pageB.wait_for_timeout(8000)
        report["toastB"] = await toasts(pageB)
        report["bAfter"] = await browser_state(pageB)
        report["parkedB"] = await pageB.evaluate(READ_PARKED)
        report["screenB"] = {f: await pageB.evaluate(FIELD_TEXT, f) for f in
                             list(FIELDS_A) + [FIELD_B_SAVED[0], FIELD_B_PARKED[0]]}
        note("B after", report["bAfter"], "parked", json.dumps(report["parkedB"])[:200]); save()

        try:
            # 8. the backstop, read back rather than believed
            backstop = gql(DISCARDED_Q, {"s": SITE}, ADMIN_TOKEN).get("data", {}).get("discardedDraft") or {}
            data = backstop.pop("data", None)
            report["backstop"] = backstop
            snap = {}
            pages = (data or {}).get("pages") or {}
            # the snapshot's own shape, which is the migration's: pages as a list
            nodes = list(pages.values()) if isinstance(pages, dict) else list(pages)
            for page in nodes:
                for name, node in ((page.get("jaenFields") or {}).get("IMA:TextField") or {}).items():
                    snap[name] = node.get("value")
            report["backstopFields"] = snap
            (OUT / "backstop.json").write_text(json.dumps(data, indent=1, ensure_ascii=False))
            note("backstop", backstop, snap); save()

            # 9. B's network comes back: nothing it held may return
            blocked["on"] = False
            await pageB.wait_for_timeout(20000)
            settle = gql(DRAFT_Q, {"s": SITE}, ADMIN_TOKEN)
            report["afterUnblock"] = {"revision": (settle.get("data", {}).get("draft") or {}).get("revision"),
                                      "fields": fields_of(settle), "b": await browser_state(pageB),
                                      "screenB": {f: await pageB.evaluate(FIELD_TEXT, f) for f in
                                                  [FIELD_B_PARKED[0], FIELD_B_SAVED[0]]}}
            note("after unblock", report["afterUnblock"]); save()

            # 10. a save from before the discard, refused with its own code
            stale = gql(SAVE_M, {"s": SITE, "b": dirty_revision, "c": [
                {"kind": "fieldWrite", "pageId": "JaenPage /", "fieldType": "IMA:TextField",
                 "fieldName": "FleetTitle", "value": "a save from before the discard",
                 "props": {"id": "FleetTitle"}}]}, ADMIN_TOKEN)
            report["staleSave"] = {"baseRevision": dirty_revision, "errors": errors_of(stale), "data": stale.get("data")}
            unmoved = gql(DRAFT_Q, {"s": SITE}, ADMIN_TOKEN)
            report["staleSave"]["draftAfter"] = {"revision": (unmoved.get("data", {}).get("draft") or {}).get("revision"),
                                                 "fields": fields_of(unmoved)}
            note("stale save", report["staleSave"]["errors"]); save()

        except Exception as error:
            report["tailError"] = "%s: %s" % (type(error).__name__, error); save()

        await ctxA.close(); await ctxB.close()

        # 11. a third fresh context, nothing of the two before it
        ctxC = await browser.new_context(viewport={"width": 1440, "height": 900}, locale="de-AT", timezone_id="Europe/Vienna")
        pageC = await ctxC.new_page()
        report["signedInC"] = await sign_in(pageC, A_LOGIN, A_PASS)
        if report["signedInC"]:
            await pageC.goto(ORIGIN + "/", wait_until="domcontentloaded")
            await pageC.wait_for_timeout(8000)
            report["screenC"] = {f: await pageC.evaluate(FIELD_TEXT, f) for f in
                                 list(FIELDS_A) + [FIELD_B_SAVED[0], FIELD_B_PARKED[0]]}
            report["cState"] = await browser_state(pageC)
            report["parkedC"] = await pageC.evaluate(READ_PARKED)
        note("fresh context", report.get("screenC")); save()
        await ctxC.close(); await browser.close()

    final = gql(DRAFT_Q, {"s": SITE}, ADMIN_TOKEN)
    report["final"] = {"draft": {k: v for k, v in (final.get("data", {}).get("draft") or {}).items() if k != "delta"},
                       "fields": fields_of(final)}
    (OUT / "final-full.json").write_text(json.dumps(final, indent=1, sort_keys=True))
    report["endedAt"] = time.time(); save()
    note("final", report["final"])

asyncio.run(main())
