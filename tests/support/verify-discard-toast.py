"""Is the second editor told, in words, or only reverted under its hands?

The two runs before this one read the second browser's toasts fifteen seconds
after the discard, which is past the life of a toast, so the absence proved
nothing. Here the second browser is watched from before the discard until well
after it, every four hundred milliseconds.

The second browser is a second context of the booklimo human admin and not the
human customer, because this run had already revoked the customer's jaen:admin
and a browser that may not read the draft is not an editor. What is measured is
a browser, which is what the promise is about.
"""
import asyncio, json, os, pathlib, re, time
import importlib.util
spec = importlib.util.spec_from_file_location("ag", str(pathlib.Path(__file__).resolve().parent / "agent_read.py"))
ag = importlib.util.module_from_spec(spec); spec.loader.exec_module(ag)

OUT = pathlib.Path(__file__).resolve().parent
ORIGIN = "https://booklimo.at"; SITE = "booklimo.at"
PERSIST_KEY = "jaenjs-state"; ITEM = "Alle unveröffentlichten Änderungen verwerfen"; USER_MENU = "Open user menu"
LOGIN = os.environ["TAXI_HUMAN_ADMIN_BOOKLIMO_LOGIN"]; PASS = os.environ["TAXI_HUMAN_ADMIN_BOOKLIMO_PASSWORD"]
TOKEN = os.environ["TAXI_TOKEN_ADMIN_BOOKLIMO"]
FIELD = "ServicesSubtitle"; SUFFIX = " CCC-probe"

SET_EDITING = """(() => { try { const r = localStorage.getItem('%s'); const s = r ? JSON.parse(r) : {}
  s.status = {...(s.status || {}), isEditing: true}; localStorage.setItem('%s', JSON.stringify(s)) } catch (e) {} })()""" % (PERSIST_KEY, PERSIST_KEY)
HAS_SESSION = "() => { try { return Object.keys(sessionStorage).some(k => k.startsWith('oidc.user:')) } catch (e) { return false } }"
TOASTS = """() => Array.from(document.querySelectorAll('[data-scope="toast"], [role="status"], [role="alert"]')).map(n => (n.innerText || '').trim()).filter(Boolean)"""
FIELD_BOX = """(id) => { const n = document.getElementById(id); if (!n) return null; n.scrollIntoView({block:'center'})
  const b = n.getBoundingClientRect(); return {x: b.x + b.width/2, y: b.y + b.height/2, text: (n.innerText||'').trim()} }"""
STATE = "() => { try { const r = localStorage.getItem('%s'); return r ? JSON.parse(r).remote : null } catch (e) { return null } }" % PERSIST_KEY

report = {"startedAt": time.time(), "field": FIELD}
def save(): (OUT / "verify-toast.json").write_text(json.dumps(report, indent=1, ensure_ascii=False, default=str))

async def sign_in(page):
    await page.goto(ORIGIN + "/login/", wait_until="domcontentloaded")
    await page.wait_for_url(re.compile(r"accounts\.netsnek\.com"), timeout=90000)
    await page.fill("#loginName", LOGIN, timeout=30000); await page.click("#submit-button")
    await page.fill("#password", PASS, timeout=30000); await page.click("#submit-button")
    for _ in range(60):
        await page.wait_for_timeout(1000)
        if page.url.startswith(ORIGIN): break
        for sel in ["button[name='skip']", "#skip-button", "button:has-text('Überspringen')"]:
            loc = page.locator(sel).first
            if await loc.count() and await loc.is_visible(): await loc.click(); break
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

async def watch(page, seconds, seen):
    end = time.time() + seconds
    while time.time() < end:
        try:
            for text in await page.evaluate(TOASTS):
                if text and text not in [s["text"] for s in seen]:
                    seen.append({"at": time.time(), "text": text})
        except Exception:
            pass
        await page.wait_for_timeout(400)

async def main():
    from playwright.async_api import async_playwright
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        ctxA = await browser.new_context(viewport={"width": 1440, "height": 900}, locale="de-AT", timezone_id="Europe/Vienna")
        ctxB = await browser.new_context(viewport={"width": 1280, "height": 900}, locale="de-AT", timezone_id="Europe/Vienna")
        pageA = await ctxA.new_page(); pageB = await ctxB.new_page()
        report["signedIn"] = [await sign_in(pageA), await sign_in(pageB)]
        report["editing"] = [await editing_on(pageA), await editing_on(pageB)]
        save()
        await pageA.wait_for_timeout(4000)

        box = await pageA.evaluate(FIELD_BOX, FIELD)
        report["typed"] = {"before": box and box["text"]}
        await pageA.mouse.click(box["x"], box["y"]); await pageA.keyboard.press("End")
        await pageA.keyboard.type(SUFFIX, delay=50); await pageA.keyboard.press("Tab")
        await pageA.wait_for_timeout(4000)
        report["preview"] = ag.call("""query($s:String!){ discardPreview(site:$s){ revision canDiscard pages fields editors{name} } }""",
                                    {"s": SITE}, TOKEN)["body"].get("data")
        save()

        seen = []
        watcher = asyncio.create_task(watch(pageB, 40, seen))
        await pageA.get_by_label(USER_MENU).first.click(); await pageA.wait_for_timeout(1500)
        item = pageA.get_by_text(ITEM, exact=False).first
        report["menuItem"] = bool(await item.count()) and await item.is_visible()
        await item.click(); await pageA.wait_for_timeout(2000)
        confirm = pageA.get_by_role("button", name=re.compile("verwerfen", re.I)).last
        discard_at = time.time()
        await confirm.click()
        report["discardAt"] = discard_at
        await watcher
        report["toastsB"] = [{"afterSeconds": round(s["at"] - discard_at, 2), "text": s["text"]} for s in seen]
        report["bState"] = await pageB.evaluate(STATE)
        report["objectAfter"] = ag.call("""query($s:String!){ draft(site:$s){ revision publishedRevision discardedRevision delta{ pages } } }""",
                                        {"s": SITE}, TOKEN)["body"].get("data")
        save()
        print(json.dumps({"preview": report["preview"], "toastsB": report["toastsB"],
                          "bRevision": (report["bState"] or {}).get("revision"),
                          "bDiscarded": (report["bState"] or {}).get("discardedRevision"),
                          "bOutbox": len((report["bState"] or {}).get("outbox") or [])}, indent=1, ensure_ascii=False))
        await ctxA.close(); await ctxB.close(); await browser.close()
    report["endedAt"] = time.time(); save()

asyncio.run(main())
