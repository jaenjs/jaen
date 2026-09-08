"""The gate is on the role, not on the account.

The human customer of booklimo carries jaen:admin at the start of this run, left
there by an earlier session. So it is asked to discard with its own browser
token while it holds the role, the role is then taken off its existing
authorization through idm.booklimo.at, and it is asked again. Nothing here
prints a credential.
"""
import asyncio, json, os, pathlib, re, time, urllib.request
import agent_read as ag  # the same reading helper, so the agent is spoken to one way

OUT = pathlib.Path(__file__).resolve().parent
ORIGIN = "https://booklimo.at"
IDM = "https://idm.booklimo.at/graphql"
AUTH_ID = "389619073622742619"          # the customer's own, read from the directory
SITE = "booklimo.at"
KRC_PAT = pathlib.Path(os.path.expanduser("~/.config/taxi-app/krcpat-prod.txt")).read_text().strip()
B_LOGIN = os.environ["TAXI_HUMAN_CUSTOMER_BOOKLIMO_LOGIN"]; B_PASS = os.environ["TAXI_HUMAN_CUSTOMER_BOOKLIMO_PASSWORD"]
ADMIN_TOKEN = os.environ["TAXI_TOKEN_ADMIN_BOOKLIMO"]

PREVIEW_Q = """query($s:String!){ discardPreview(site:$s){ revision publishedRevision canDiscard reason pages fields } }"""
DISCARD_M = """mutation($s:String!){ discard(site:$s){ discarded revision reason } }"""
DRAFT_Q = """query($s:String!){ draft(site:$s){ revision publishedRevision discardedRevision } }"""
AUTH_Q = """query($id:String!){ authorization(id:$id){ id userId userName roleKeys state } }"""
AUTH_M = """mutation($id:String!,$k:[String!]!){ updateAuthorization(args:{input:{authorizationId:$id, roleKeys:$k}}){ ok message authorizationId } }"""

def errs(a):
    return [{"message": e.get("message"), "code": (e.get("extensions") or {}).get("code"),
             "statusCode": (e.get("extensions") or {}).get("statusCode")} for e in (a.get("errors") or [])]

report = {"startedAt": time.time()}
def save(): (OUT / "revoke-test2.json").write_text(json.dumps(report, indent=1, ensure_ascii=False, default=str))

READ_TOKEN = """() => { try {
  const key = Object.keys(sessionStorage).find(k => k.startsWith('oidc.user:'))
  if (!key) return null
  return JSON.parse(sessionStorage.getItem(key)).access_token || null
} catch (e) { return null } }"""

async def main():
    from playwright.async_api import async_playwright
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        ctx = await browser.new_context(viewport={"width": 1280, "height": 900}, locale="de-AT")
        page = await ctx.new_page()
        await page.goto(ORIGIN + "/login/", wait_until="domcontentloaded")
        await page.wait_for_url(re.compile(r"accounts\.netsnek\.com"), timeout=90000)
        await page.fill("#loginName", B_LOGIN, timeout=30000); await page.click("#submit-button")
        await page.fill("#password", B_PASS, timeout=30000); await page.click("#submit-button")
        for _ in range(60):
            await page.wait_for_timeout(1000)
            if page.url.startswith(ORIGIN): break
            for sel in ["button[name='skip']", "#skip-button", "button:has-text('Überspringen')"]:
                loc = page.locator(sel).first
                if await loc.count() and await loc.is_visible(): await loc.click(); break
        token = None
        for _ in range(60):
            token = await page.evaluate(READ_TOKEN)
            if token: break
            await page.wait_for_timeout(1000)
        await ctx.close(); await browser.close()

    report["gotCustomerToken"] = bool(token); save()
    if not token: return

    # 1. with the role, which is the state an earlier run left behind
    report["roleBefore"] = ag.call(AUTH_Q, {"id": AUTH_ID}, KRC_PAT, agent=IDM)["body"].get("data")
    report["previewWithRole"] = ag.call(PREVIEW_Q, {"s": SITE}, token)["body"]
    save()

    # 2. the role is taken off the authorization that was already there
    report["revoke"] = ag.call(AUTH_M, {"id": AUTH_ID, "k": ["krc:customer"]}, KRC_PAT, agent=IDM)["body"]
    time.sleep(3)
    report["roleAfter"] = ag.call(AUTH_Q, {"id": AUTH_ID}, KRC_PAT, agent=IDM)["body"].get("data")
    save()

    # 3. past the agent's sixty second introspection cache, the same token, twice
    before = ag.call(DRAFT_Q, {"s": SITE}, ADMIN_TOKEN)["body"]["data"]["draft"]
    time.sleep(75)
    p = ag.call(PREVIEW_Q, {"s": SITE}, token)["body"]
    roles = (((report.get("roleAfter") or {}).get("authorization")) or {}).get("roleKeys")
    if roles == ["krc:customer"]:
        d = ag.call(DISCARD_M, {"s": SITE}, token)["body"]
    else:
        d = {"skipped": "the role is still there, so no discard is attempted", "roles": roles}
    after = ag.call(DRAFT_Q, {"s": SITE}, ADMIN_TOKEN)["body"]["data"]["draft"]
    report["previewAfterRevoke"] = {"errors": errs(p), "data": p.get("data")}
    report["discardAfterRevoke"] = {"errors": errs(d), "data": d.get("data")}
    report["draftAroundIt"] = {"before": before, "after": after}
    report["endedAt"] = time.time(); save()
    print(json.dumps({k: report[k] for k in ("roleBefore", "previewWithRole", "roleAfter",
                                             "previewAfterRevoke", "discardAfterRevoke", "draftAroundIt")},
                     indent=1, ensure_ascii=False))

asyncio.run(main())
