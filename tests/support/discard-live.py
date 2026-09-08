"""Discard, driven from the CMS's own control on the deployed booklimo.at.

The verifier of the discard half of `tests/11-cms-frame.ipynb`. It prints one
JSON document on stdout and nothing else, so a notebook can judge it.

What it is for. `docs/architecture/draft-state.md`, "Three operations that
rewrite the shared draft", says what discard is: site wide, an admin's, behind
a confirmation that names what will go, restoring the state the last publish
wrote, pushing the invalidation to every editor. Everything about it had been
measured against the object and nothing in a browser. This drives the whole of
it through the item in the frame's user menu, which is also the half of the
owner's sentence that said the discard button had disappeared.

The gestures are the person's: the menu is opened, the item is clicked, the
confirmation is read and confirmed. The readings beside them are taken with a
credential of the run's own against the agent, so what the browser claims and
what the object holds are two answers and not one.

The fixture edit is set back by the discard itself, which is the point: the
field is read back out of the object afterwards and has to be the published
value.
"""
import asyncio
import json
import os
import pathlib
import re
import sys
import time
import urllib.request

ORIGIN = "https://booklimo.at"
AGENT = "https://jaen-agent.booklimo.at/graphql"
SITE = "booklimo.at"
CONFIG = pathlib.Path(os.path.expanduser("~/.config/taxi-app"))
PERSIST_KEY = "jaenjs-state"
FIELD_NAME = os.environ.get("JAEN_FIELD_NAME", "FleetTitle")
SUFFIX = os.environ.get("JAEN_SUFFIX", " discard probe")
# The German the account's language selects, which is what a person here reads.
ITEM = "Alle unveröffentlichten Änderungen verwerfen"
USER_MENU = "Open user menu"


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
load_env("tokens.env")
LOGIN = os.environ.get("TAXI_HUMAN_ADMIN_BOOKLIMO_LOGIN", "")
PASSWORD = os.environ.get("TAXI_HUMAN_ADMIN_BOOKLIMO_PASSWORD", "")
TOKEN = os.environ.get("TAXI_TOKEN_ADMIN_BOOKLIMO", "")


def agent(query, variables=None, token=None):
    """A reading of the object beside the browser's own, with its own credential."""
    body = json.dumps({"query": query, "variables": variables or {}}).encode()
    request = urllib.request.Request(AGENT, data=body, method="POST")
    request.add_header("content-type", "application/json")
    request.add_header("user-agent", "jaen-discard-probe")
    if token is None:
        token = TOKEN
    if token:
        request.add_header("authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(request, timeout=60) as answer:
            return json.loads(answer.read())
    except Exception as error:  # a refusal is an answer too
        return {"transportError": "%s: %s" % (type(error).__name__, error)}


DRAFT_Q = """query($site: String!) { draft(site: $site) {
  revision publishedRevision changed full
  discardedRevision discardedAt discardedBy discardedByName
  delta { pages }
} }"""

PREVIEW_Q = """query($site: String!) { discardPreview(site: $site) {
  revision publishedRevision canDiscard reason pages fields
  pagesAdded pagesRemoved mediaAdded mediaRemoved siteChanged widgetsChanged
  editors { sub name at } since publishedAt takenAt
} }"""

DISCARDED_Q = """query($site: String!) { discardedDraft(site: $site) {
  site found revision takenAt bytes pages data
} }"""

SAVE_M = """mutation($site: String!, $changes: [SaveChangesInput!]!, $base: Number) {
  save(site: $site, changes: $changes, baseRevision: $base) {
    revision rebased touched keys savedAt } }"""

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
  } catch (error) { return false }
}"""

READ_STATE = """() => {
  try {
    const raw = localStorage.getItem('%s')
    return raw ? JSON.parse(raw) : null
  } catch (error) { return null }
}""" % PERSIST_KEY

# The field by its own id, which is what the CMS puts on the editable node, so
# the reading does not depend on the text that happens to be in it.
FIELD_TEXT = """(id) => {
  const node = document.getElementById(id)
  return node ? (node.innerText || '').trim() : null
}"""

FIELD_BOX = """(id) => {
  const node = document.getElementById(id)
  if (!node) return null
  const box = node.getBoundingClientRect()
  return {x: box.x + box.width / 2, y: box.y + box.height / 2,
          text: (node.innerText || '').trim()}
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
    # reloading: the running page persists itself and would write its own
    # isEditing: false back. Measured by the deploy run of draft-state.md.
    await page.context.add_init_script(SET_EDITING_AT_BOOT)
    await page.reload(wait_until="domcontentloaded")
    for _ in range(40):
        if await page.locator('[contenteditable="true"]').count():
            return True
        await page.wait_for_timeout(1000)
    return False


async def browser_state(page):
    state = await page.evaluate(READ_STATE)
    remote = (state or {}).get("remote", {}) or {}
    return {"outbox": len(remote.get("outbox") or []),
            "revision": remote.get("revision"),
            "publishedRevision": remote.get("publishedRevision"),
            "saveState": remote.get("saveState"),
            "connection": remote.get("connection")}


def field_of(draft_answer, name=FIELD_NAME):
    """The field's value as the object holds it, out of a full draft read."""
    try:
        pages = draft_answer["data"]["draft"]["delta"]["pages"] or {}
    except Exception:
        return None
    for page in pages.values():
        fields = (page.get("jaenFields") or {}).get("IMA:TextField") or {}
        if name in fields:
            return fields[name].get("value")
    return None


async def run(page, report):
    report["editing"] = await editing_on(page)
    await page.wait_for_timeout(4000)

    # ---- 0. what the systems hold before anything is typed ----
    before = agent(DRAFT_Q, {"site": SITE})
    report["before"] = {
        "draft": before.get("data", {}).get("draft"),
        "field": field_of(before),
        "browser": await browser_state(page)
    }
    published_value = field_of(before)

    # ---- 1. the fixture edit, typed the way a person types ----
    box = await page.evaluate(FIELD_BOX, FIELD_NAME)
    report["typed"] = {"target": box}
    if not box:
        report["error"] = "the field %s is not on this page" % FIELD_NAME
        return
    await page.mouse.click(box["x"], box["y"])
    await page.keyboard.press("End")
    await page.keyboard.type(SUFFIX, delay=60)
    await page.keyboard.press("Tab")
    await page.wait_for_timeout(4000)
    typed = agent(DRAFT_Q, {"site": SITE})
    report["typed"]["object"] = {
        "draft": typed.get("data", {}).get("draft"),
        "field": field_of(typed)
    }
    report["typed"]["browser"] = await browser_state(page)
    dirty_revision = (typed.get("data", {}).get("draft") or {}).get("revision")

    # ---- 2. what the confirmation would say, asked of the agent ----
    report["preview"] = agent(PREVIEW_Q, {"site": SITE}).get("data", {}).get("discardPreview")

    # ---- 3. the item is in the menu, and it is clicked ----
    menu = page.get_by_label(USER_MENU).first
    await menu.click()
    await page.wait_for_timeout(1500)
    item = page.get_by_text(ITEM, exact=False).first
    report["menu"] = {"itemVisible": bool(await item.count()) and await item.is_visible()}
    if not report["menu"]["itemVisible"]:
        report["menu"]["texts"] = await page.evaluate(
            """() => Array.from(document.querySelectorAll('[role="menuitem"], button, a'))
                 .map(n => (n.innerText || '').trim()).filter(Boolean).slice(0, 60)""")
        report["error"] = "the discard item is not in the user menu"
        return
    await item.click()
    await page.wait_for_timeout(2500)

    # ---- 4. the confirmation, read and confirmed ----
    dialog = page.locator('[role="alertdialog"], [role="dialog"]').last
    report["confirm"] = {"text": (await dialog.inner_text()) if await dialog.count() else None}
    confirm = page.get_by_role("button", name=re.compile("verwerfen", re.I)).last
    report["confirm"]["buttonFound"] = bool(await confirm.count())
    if not report["confirm"]["buttonFound"]:
        report["error"] = "no confirm button in the discard dialog"
        return
    await confirm.click()

    # ---- 5. what the systems hold afterwards ----
    await page.wait_for_timeout(6000)
    after = agent(DRAFT_Q, {"site": SITE})
    report["after"] = {
        "draft": after.get("data", {}).get("draft"),
        "field": field_of(after),
        "browser": await browser_state(page),
        "onScreen": await page.evaluate(FIELD_TEXT, FIELD_NAME)
    }
    report["restored"] = (report["after"]["field"] == published_value)

    # The toast every editor is shown, this browser included.
    report["toast"] = await page.evaluate(
        """() => Array.from(document.querySelectorAll('[data-scope="toast"], [role="status"], [role="alert"]'))
             .map(n => (n.innerText || '').trim()).filter(Boolean).slice(0, 6)""")

    # ---- 6. the backstop, read back rather than believed ----
    backstop = agent(DISCARDED_Q, {"site": SITE}).get("data", {}).get("discardedDraft") or {}
    report["backstop"] = {k: v for k, v in backstop.items() if k != "data"}
    try:
        pages = (backstop.get("data") or {}).get("pages") or {}
        for pid, node in (pages.items() if isinstance(pages, dict) else []):
            fields = ((node.get("jaenFields") or {}).get("IMA:TextField") or {})
            if FIELD_NAME in fields:
                report["backstop"]["field"] = fields[FIELD_NAME].get("value")
    except Exception as error:
        report["backstop"]["readError"] = str(error)

    # ---- 7. the one write this store refuses ----
    stale = agent(SAVE_M, {
        "site": SITE,
        "changes": [{"kind": "fieldWrite", "pageId": "JaenPage /",
                     "fieldType": "IMA:TextField", "fieldName": FIELD_NAME,
                     "value": "a save from before the discard", "props": {"id": FIELD_NAME}}],
        "base": dirty_revision})
    report["staleSave"] = {
        "baseRevision": dirty_revision,
        # The invalidating revision travels under `details`, because Pylon's
        # ServiceError puts everything beyond the code and the status there,
        # and that is where the client reads it.
        "errors": [{"message": e.get("message"),
                    "statusCode": (e.get("extensions") or {}).get("statusCode"),
                    "code": (e.get("extensions") or {}).get("code"),
                    "details": (e.get("extensions") or {}).get("details")}
                   for e in stale.get("errors", [])],
        "data": stale.get("data")}
    unmoved = agent(DRAFT_Q, {"site": SITE})
    report["staleSave"]["draftAfter"] = unmoved.get("data", {}).get("draft", {})
    report["staleSave"]["fieldAfter"] = field_of(unmoved)


async def main():
    from playwright.async_api import async_playwright

    report = {"origin": ORIGIN, "site": SITE, "field": FIELD_NAME,
              "startedAt": time.time()}
    if not LOGIN or not PASSWORD:
        print(json.dumps({"error": "TAXI_HUMAN_ADMIN_BOOKLIMO_* not in the environment"}))
        return
    if not TOKEN:
        print(json.dumps({"error": "TAXI_TOKEN_ADMIN_BOOKLIMO not in the environment"}))
        return

    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        context = await browser.new_context(
            viewport={"width": 1440, "height": 900},
            locale="de-AT", timezone_id="Europe/Vienna")
        page = await context.new_page()
        report["signedIn"] = await sign_in(page)
        if report["signedIn"]:
            try:
                await run(page, report)
            except Exception as error:
                report["error"] = "%s: %s" % (type(error).__name__, error)
        await context.close()
        await browser.close()

    report["endedAt"] = time.time()
    print(json.dumps(report, default=str, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
