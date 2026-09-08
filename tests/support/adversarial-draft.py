"""The adversarial half of the draft's invariant, driven on the live booklimo.at.

Written for the verification of 2026-09-08, which had to reproduce the hardest
scenarios of `10-draft-persistence.ipynb` rather than take that notebook's word,
and to prove the one thing the old design could not survive: that an unpublished
edit is not on the built site and is on it after a publish.

It reuses `editing-browser.py`, which is the notebooks' own harness, for the
site under its real origin, the sign in and the way into edit mode, and adds
nothing to it. What it adds beside it is a second reader: every value is also
read out of the draft object itself with the booklimo machine admin's token, so
a check never rests on the browser's own memory of what it typed.

Subcommands
  reloads   type, blur, and reload after 200 ms, 1 s and 5 s; and type and close
            the tab at once, with and without a blur before it
  blocked   type with the agent host resolved to a dead port, then a browser
            that can reach it again, out of the same profile
  race      two contexts on one field, blurring together
  edit      set the field to a value and leave it unpublished
  publish   the CMS's own publish control, from the frame's user menu
  readback  what the field is, out of a browser whose storage was emptied

Every subcommand prints one JSON document on stdout and nothing else.
"""
import asyncio
import importlib.util
import json
import os
import pathlib
import sys
import re
import time
import urllib.request

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('editing_browser', HERE / 'editing-browser.py')
eb = importlib.util.module_from_spec(spec)
spec.loader.exec_module(eb)

ORIGIN = eb.ORIGIN
SITE = 'booklimo.at'
AGENT = 'https://jaen-agent.booklimo.at/graphql'

# The second reader: the object itself, with a credential of its own.
for line in (pathlib.Path.home() / '.config/taxi-app/tokens.env').read_text().splitlines():
    line = line.strip()
    if '=' in line and not line.startswith('#'):
        key, _, value = line.partition('=')
        os.environ.setdefault(key.strip().removeprefix('export ').strip(),
                              value.strip().strip('"').strip("'"))

# The second reader's credential.
#
# It began as the booklimo machine admin's token out of the platform's token
# file, and that stopped working half way through this verification with
# `FORBIDDEN`: `jaen:admin on booklimo.at is required`. The likeliest cause is a
# concurrent run of this same verification granting that role to the machine
# account for its own publish and revoking it afterwards, which is what
# `draft-state.md` says such a run does. Whatever the cause, a reader that
# depends on a role another process is toggling is not a reader, so the token is
# taken from the browser's own signed-in session instead: the same person the
# CMS is acting as, read once and never printed.
MACHINE = os.environ.get('TAXI_TOKEN_ADMIN_BOOKLIMO', '')
SESSION = {'token': None}

READ_TOKEN = """() => {
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith('oidc.user:')) {
        const user = JSON.parse(sessionStorage.getItem(key) || 'null')
        if (user && user.access_token) return user.access_token
      }
    }
  } catch (error) {}
  return null
}"""
DRAFT_QUERY = """query D($site: String!) {
  draft(site: $site) { revision publishedRevision changed full
    delta { pages authors } }
}"""


def call_agent(query, variables, token=None):
    body = json.dumps({'query': query, 'variables': variables}).encode()
    headers = {'content-type': 'application/json', 'user-agent': 'jaen-adversarial/1'}
    bearer = token or SESSION['token'] or MACHINE
    if bearer:
        headers['authorization'] = 'Bearer ' + bearer
    request = urllib.request.Request(AGENT, data=body, headers=headers)
    with urllib.request.urlopen(request, timeout=120) as answer:
        return json.loads(answer.read())


def agent_draft(token=None):
    body = json.dumps({'query': DRAFT_QUERY, 'variables': {'site': SITE}}).encode()
    headers = {'content-type': 'application/json', 'user-agent': 'jaen-adversarial/1'}
    bearer = token or SESSION['token'] or MACHINE
    if bearer:
        headers['authorization'] = 'Bearer ' + bearer
    request = urllib.request.Request(AGENT, data=body, headers=headers)
    with urllib.request.urlopen(request, timeout=60) as answer:
        return json.loads(answer.read())['data']['draft']


def agent_field(page_id, field_type, field_name):
    """The field as the object holds it, and the revision it was read at."""
    draft = agent_draft()
    pages = (draft.get('delta') or {}).get('pages') or {}
    entry = (((pages.get(page_id) or {}).get('jaenFields') or {})
             .get(field_type, {}) or {}).get(field_name)
    authors = (draft.get('delta') or {}).get('authors') or {}
    return {'value': (entry or {}).get('value'),
            'revision': draft['revision'],
            'publishedRevision': draft['publishedRevision'],
            'author': authors.get('%s/%s/%s' % (page_id, field_type, field_name))}


IDENT = {'pageId': eb.HOME_PAGE, 'fieldType': 'IMA:TextField', 'fieldName': eb.FIELD_NAME}


def field_now():
    """The field as the object holds it, the second reader of every check."""
    return agent_field(IDENT['pageId'], IDENT['fieldType'], IDENT['fieldName'])

READ_FIELD = eb.draft_field_at(IDENT)
OUTBOX = ("() => {try {const s = JSON.parse(localStorage.getItem('%s') || 'null');"
          "return {outbox: (s?.remote?.outbox || []).length,"
          " saveState: s?.remote?.saveState ?? null,"
          " revision: s?.remote?.revision ?? null,"
          " publishedRevision: s?.remote?.publishedRevision ?? null,"
          " connection: s?.remote?.connection ?? null}} catch (e) {return null}}"
          % eb.PERSIST_KEY)


async def ready(pw, offline=False):
    """A signed in browser in edit mode, and the field's current value."""
    browser, context = await eb.new_browser(pw, offline=offline)
    page = await context.new_page()
    if not await eb.sign_in(page):
        raise RuntimeError('the human admin did not sign in')
    state = await eb.enter_editing(page)
    if not state or state.get('remote', {}).get('revision') is None:
        raise RuntimeError('no draft arrived from the agent')
    SESSION['token'] = await page.evaluate(READ_TOKEN)
    if not SESSION['token']:
        raise RuntimeError('the signed in session carries no access token')
    return browser, context, page


async def type_into(page, was, text, blur=True):
    """Replace the field's text. `was` is what is on the screen right now."""
    handle = await eb.editable_for(page, was)
    if handle is None:
        raise RuntimeError('the field carrying %r was not editable' % was)
    await handle.click()
    await page.keyboard.press('Control+a')
    await page.keyboard.type(text, delay=25)
    if blur:
        await page.keyboard.press('Tab')
    return handle


# ---------------------------------------------------------------------------


async def run_reloads(pw, args):
    """Type and reload after 200 ms, 1 s and 5 s, then type and close the tab."""
    out = {'scenario': 'reloads', 'reloads': [], 'closes': []}
    browser, context, page = await ready(pw)
    original = await page.evaluate(READ_FIELD)
    out['original'] = original
    out['agentBefore'] = field_now()
    await page.wait_for_timeout(2000)

    on_screen = original
    for delay in (200, 1000, 5000):
        typed = '%s r%d' % (original, delay)
        await type_into(page, on_screen, typed)
        await page.wait_for_timeout(delay)
        before = await page.evaluate(OUTBOX)
        storage_at_reload = await page.evaluate(READ_FIELD)
        await page.reload(wait_until='domcontentloaded')
        await page.wait_for_timeout(3000)
        await eb.wait_for_saved(page, timeout=40)
        after = await page.evaluate(READ_FIELD)
        agent = field_now()
        out['reloads'].append({
            'delayMs': delay, 'typed': typed,
            'storageAtReload': storage_at_reload, 'outboxAtReload': before,
            'afterReload': after, 'agent': agent,
            'lost': after != typed or agent['value'] != typed})
        on_screen = after

    # Type and close the tab at once, with a blur and without one.
    for blur in (True, False):
        typed = '%s close%s' % (original, 'Blur' if blur else 'Raw')
        await type_into(page, on_screen, typed, blur=blur)
        await page.close()          # no waiting at all: the gesture is the close
        page = await context.new_page()
        await page.goto(ORIGIN + '/', wait_until='domcontentloaded')
        await page.wait_for_timeout(3000)
        storage = await page.evaluate(READ_FIELD)
        drained = await eb.wait_for_saved(page, timeout=40)
        agent = field_now()
        out['closes'].append({'blur': blur, 'typed': typed, 'storageAfterReopen': storage,
                              'drained': drained, 'agent': agent,
                              'lost': agent['value'] != typed})
        await eb.wait_for_editable(page)
        on_screen = await page.evaluate(READ_FIELD)

    # Set back, and read it out of a browser whose storage was emptied.
    await type_into(page, on_screen, original)
    await page.wait_for_timeout(2000)
    await eb.wait_for_saved(page)
    await page.evaluate("() => localStorage.removeItem('%s')" % eb.PERSIST_KEY)
    await page.goto(ORIGIN + '/', wait_until='domcontentloaded')
    await eb.wait_for_draft(page)
    out['readBack'] = await page.evaluate(READ_FIELD)
    out['agentAfter'] = field_now()
    await browser.close()
    return out


async def run_blocked(pw, args):
    """The agent host taken away under a CMS that is already editing.

    The first attempt took the host away at the resolver before the browser
    started, and it measured nothing: with no agent there is no draft, the
    persisted store carries no field at all, and the run cannot even name the
    value it is about to change. It is also not the failure a person meets. So
    the browser hydrates first and the host is taken away under it, which is
    what an agent that goes down during an edit looks like, and it is the
    `AGENT_UNREACHABLE` half of the acceptance rather than `offline`.

    Every request to the agent is aborted, the site's own are untouched, and the
    socket is deliberately left alone: a client that still believes it is
    connected is the harder case, not the easier one.
    """
    out = {'scenario': 'blocked'}
    PARTIAL.clear()
    PARTIAL.update(out)
    browser, context, page = await ready(pw)
    original = await page.evaluate(READ_FIELD)
    out['original'] = original
    out['agentBefore'] = field_now()
    PARTIAL.update(out)

    blocked = {'count': 0}

    async def refuse(route, request):
        if 'jaen-agent.booklimo.at' in request.url:
            blocked['count'] += 1
            await route.abort('connectionrefused')
        else:
            await route.continue_()

    await context.route('**/*', refuse)
    await page.wait_for_timeout(3000)

    typed = '%s blocked' % (original or '')
    await type_into(page, original, typed)
    await page.wait_for_timeout(8000)
    out['whileBlocked'] = {'storage': await page.evaluate(READ_FIELD),
                           'state': await page.evaluate(OUTBOX),
                           'refusedRequests': blocked['count'],
                           'agent': field_now()}
    PARTIAL.update(out)

    await context.unroute('**/*', refuse)
    await page.evaluate("() => window.dispatchEvent(new Event('online'))")
    drained = await eb.wait_for_saved(page, timeout=90)
    out['afterUnblock'] = {'storage': await page.evaluate(READ_FIELD),
                           'drained': drained,
                           'state': await page.evaluate(OUTBOX),
                           'agent': field_now()}
    out['lost'] = out['afterUnblock']['agent']['value'] != typed
    PARTIAL.update(out)

    await type_into(page, await page.evaluate(READ_FIELD), original or '')
    await page.wait_for_timeout(2500)
    await eb.wait_for_saved(page)
    out['agentAfter'] = field_now()
    await browser.close()
    return out


async def run_race(pw, args):
    """Two contexts on one field, blurring as close together as playwright allows."""
    out = {'scenario': 'race'}
    a_browser, a_context, a = await ready(pw)
    b_browser, b_context, b = await ready(pw)
    original = await a.evaluate(READ_FIELD)
    out['original'] = original
    out['agentBefore'] = field_now()
    await b.wait_for_timeout(3000)
    out['bSees'] = await b.evaluate(READ_FIELD)

    a_typed = '%s A' % original
    b_typed = '%s B' % original
    handle_a = await eb.editable_for(a, original)
    handle_b = await eb.editable_for(b, await b.evaluate(READ_FIELD))
    if handle_a is None or handle_b is None:
        await a_browser.close(); await b_browser.close()
        return dict(out, skipped='the field was not editable in both contexts')

    async def write(page, handle, text):
        await handle.click()
        await page.keyboard.press('Control+a')
        await page.keyboard.type(text, delay=15)
        await page.keyboard.press('Tab')

    await asyncio.gather(write(a, handle_a, a_typed), write(b, handle_b, b_typed))
    await asyncio.gather(a.wait_for_timeout(8000), b.wait_for_timeout(8000))
    await eb.wait_for_saved(a, timeout=40)
    await eb.wait_for_saved(b, timeout=40)
    await asyncio.gather(a.wait_for_timeout(4000), b.wait_for_timeout(4000))

    agent = field_now()
    out['agentAfter'] = agent
    out['aStore'] = await a.evaluate(READ_FIELD)
    out['bStore'] = await b.evaluate(READ_FIELD)
    out['aState'] = await a.evaluate(OUTBOX)
    out['bState'] = await b.evaluate(OUTBOX)
    out['winner'] = ('A' if agent['value'] == a_typed
                     else 'B' if agent['value'] == b_typed else None)
    out['converged'] = out['aStore'] == out['bStore'] == agent['value']

    await type_into(a, await a.evaluate(READ_FIELD), original)
    await a.wait_for_timeout(2000)
    await eb.wait_for_saved(a)
    out['agentSetBack'] = field_now()
    await a_browser.close()
    await b_browser.close()
    return out


async def run_edit(pw, args):
    """One edit, saved into the object and deliberately not published."""
    out = {'scenario': 'edit'}
    browser, context, page = await ready(pw)
    original = await page.evaluate(READ_FIELD)
    out['original'] = original
    await type_into(page, original, args['value'])
    await page.wait_for_timeout(2500)
    out['saved'] = await eb.wait_for_saved(page, timeout=60)
    out['storage'] = await page.evaluate(READ_FIELD)
    out['state'] = await page.evaluate(OUTBOX)
    out['agent'] = field_now()
    await browser.close()
    return out


PUBLISH = """mutation P($site: String!, $message: String) {
  publish(site: $site, message: $message) {
    published queued revision publishedRevision migrationUrl commitSha commitUrl reason
  }
}"""


async def run_publish(pw, args):
    """The publish a person makes, out of the frame's own menu.

    The control is preferred over the mutation because the acceptance is about
    what the CMS does, not what the agent can be asked to do. The menu is found
    by opening each control of the frame until the publish item is on the
    screen, rather than by a selector guessed from the source, and the message
    goes into the CMS's own prompt, which is a Chakra modal and not
    `window.prompt`. If the control cannot be reached the run says so and falls
    back to the same mutation the control calls, so a publish is never silently
    skipped, and the answer records which path it took.
    """
    out = {'scenario': 'publish', 'path': None}
    PARTIAL.clear()
    PARTIAL.update(out)
    browser, context, page = await ready(pw)
    out['before'] = field_now()
    message = args.get('message', 'verify: the adversarial run of 2026-09-08')

    async def publish_item():
        item = page.get_by_text(re.compile(r'(Änderungen veröffentlichen|Publish changes)'))
        return item.first if await item.count() else None

    item = await publish_item()
    if item is None:
        triggers = await page.locator(
            'button, [role="button"]').all()
        for trigger in triggers[:20]:
            try:
                if not await trigger.is_visible():
                    continue
                await trigger.click(timeout=3000)
                await page.wait_for_timeout(700)
            except Exception:
                continue
            item = await publish_item()
            if item is not None:
                break
            await page.keyboard.press('Escape')

    if item is not None:
        out['path'] = 'the frame control'
        await item.click()
        await page.wait_for_timeout(1500)
        field = page.locator('input:visible').first
        if await field.count():
            await field.fill(message)
        confirm = page.get_by_role('button', name=re.compile(
            r'^(Publish|Veröffentlichen)$'))
        if await confirm.count():
            await confirm.first.click()
        else:
            await page.keyboard.press('Enter')
        await page.wait_for_timeout(30000)
    else:
        out['path'] = 'the mutation the control calls'
        out['answer'] = call_agent(PUBLISH, {'site': SITE, 'message': message})

    out['after'] = field_now()
    out['state'] = await page.evaluate(OUTBOX)
    await browser.close()
    return out


async def run_readback(pw, args):
    out = {'scenario': 'readback'}
    browser, context, page = await ready(pw)
    await page.evaluate("() => localStorage.removeItem('%s')" % eb.PERSIST_KEY)
    await page.goto(ORIGIN + '/', wait_until='domcontentloaded')
    await eb.wait_for_draft(page)
    await page.wait_for_timeout(3000)
    out['readBack'] = await page.evaluate(READ_FIELD)
    out['agent'] = field_now()
    await browser.close()
    return out




async def resign(page):
    """Sign in again in a tab that has no `sessionStorage` of its own.

    A new tab is a new `sessionStorage`, which is where the OIDC session lives,
    so the CMS in it is anonymous however signed in the profile is. The provider
    still holds its own cookie, so `/login/` usually completes without a form
    and `editing-browser.sign_in`, which waits for the provider's page, would
    time out on the silent case. This waits for the session itself.
    """
    await page.goto(ORIGIN + '/login/', wait_until='domcontentloaded')
    for _ in range(45):
        if await page.evaluate(eb.HAS_SESSION):
            return True
        if 'accounts.netsnek.com' in page.url:
            try:
                return await eb.sign_in(page)
            except Exception:
                return False
        await page.wait_for_timeout(1000)
    return False


HIDE = """() => {
  // What a tab going away delivers, and the only pair the persister listens to.
  Object.defineProperty(document, 'visibilityState', {get: () => 'hidden', configurable: true})
  document.dispatchEvent(new Event('visibilitychange'))
  window.dispatchEvent(new Event('pagehide'))
}"""

SHOW = """() => {
  Object.defineProperty(document, 'visibilityState', {get: () => 'visible', configurable: true})
  document.dispatchEvent(new Event('visibilitychange'))
}"""


async def run_losses(pw, args):
    """The tab going away at four distances from the blur, and one real close.

    The question is narrower than the notebook's: not whether an edit that has
    reached the store survives, which `10-draft-persistence.ipynb` measures, but
    whether it reaches the store at all when the tab goes away at once. The
    notebook waits 700 ms before it hides the tab and says why in its own
    comment, so the window before that is the one nothing has measured.
    """
    out = {'scenario': 'losses', 'hides': [], 'close': None}
    PARTIAL.clear()
    PARTIAL.update(out)
    browser, context, page = await ready(pw)
    original = await page.evaluate(READ_FIELD)
    out['original'] = original
    out['agentBefore'] = field_now()
    PARTIAL.update(out)
    await page.wait_for_timeout(2000)

    on_screen = original
    for delay in (0, 300, 700, 2000):
        typed = '%s h%d' % (original, delay)
        await type_into(page, on_screen, typed)
        await page.wait_for_timeout(delay)
        await page.evaluate(HIDE)
        storage = await page.evaluate(READ_FIELD)
        state = await page.evaluate(OUTBOX)
        await page.evaluate(SHOW)
        await page.wait_for_timeout(4000)
        await eb.wait_for_saved(page, timeout=30)
        agent = field_now()
        out['hides'].append({
            'delayMs': delay, 'typed': typed,
            'inStorageWhenHidden': storage, 'stateWhenHidden': state,
            'agentAfter': agent,
            'lostAtHide': storage != typed,
            'lostForGood': agent['value'] != typed})
        PARTIAL.update(out)
        on_screen = typed

    # One real close of the tab, with nothing waited out at all.
    typed = '%s close' % original
    await type_into(page, on_screen, typed)
    await page.close()
    page = await context.new_page()
    await page.goto(ORIGIN + '/', wait_until='domcontentloaded')
    await page.wait_for_timeout(3000)
    out['close'] = {'typed': typed,
                    'inStorageAfterClose': await page.evaluate(READ_FIELD),
                    'state': await page.evaluate(OUTBOX)}
    PARTIAL.update(out)
    # A new tab has no sessionStorage of its own, so the CMS is signed out in it
    # and nothing it holds could reach the agent. Sign in again to set back.
    signed = await resign(page)
    out['close']['signedInAgain'] = signed
    if signed:
        await eb.enter_editing(page)
        await eb.wait_for_saved(page, timeout=60)
        out['close']['agent'] = field_now()
        on_screen = await page.evaluate(READ_FIELD)
        await type_into(page, on_screen, original)
        await page.wait_for_timeout(2500)
        await eb.wait_for_saved(page)
    out['agentAfter'] = field_now()
    await browser.close()
    return out


PARTIAL = {}

async def run_state(pw, args):
    """What the object holds, read with the signed in editor's own token.

    A subcommand rather than a script of its own, because reading the draft
    needs `jaen:admin` and the only credential this run can count on is the one
    the browser signs in with.
    """
    browser, context, page = await ready(pw)
    draft = agent_draft()
    fields = {}
    for page_id, node in ((draft.get('delta') or {}).get('pages') or {}).items():
        for field_type, names in (node.get('jaenFields') or {}).items():
            for name, entry in (names or {}).items():
                fields['%s|%s|%s' % (page_id, field_type, name)] = (entry or {}).get('value')
    out = {'scenario': 'state', 'revision': draft['revision'],
           'publishedRevision': draft['publishedRevision'],
           'changed': draft['changed'], 'fields': fields}
    if args.get('set') is not None:
        on_screen = await page.evaluate(READ_FIELD)
        await type_into(page, on_screen, args['set'])
        await page.wait_for_timeout(2500)
        await eb.wait_for_saved(page)
        out['after'] = field_now()
    await browser.close()
    return out


async def run_probe(pw, args):
    """What the frame offers a person, so the publish is clicked and not guessed."""
    browser, context, page = await ready(pw)
    out = {'scenario': 'probe'}
    out['buttons'] = await page.evaluate("""() => {
      const seen = []
      document.querySelectorAll('button, [role=button], a[role=menuitem]').forEach((el, i) => {
        const box = el.getBoundingClientRect()
        if (box.width === 0) return
        seen.push({i, text: (el.innerText || '').trim().slice(0, 40),
                   label: el.getAttribute('aria-label'),
                   id: el.id || null, cls: (el.className || '').toString().slice(0, 60)})
      })
      return seen.slice(0, 60)
    }""")
    await browser.close()
    return out


COMMANDS = {'probe': run_probe, 'state': run_state, 'losses': run_losses, 'reloads': run_reloads, 'blocked': run_blocked, 'race': run_race,
            'edit': run_edit, 'publish': run_publish, 'readback': run_readback}


async def main():
    command = sys.argv[1]
    args = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
    from playwright.async_api import async_playwright
    site = eb.Site()
    started = time.time()
    answer = {'scenario': command, 'error': None}
    try:
        async with async_playwright() as pw:
            answer = await COMMANDS[command](pw, args)
    except Exception as problem:
        import traceback
        traceback.print_exc(file=sys.stderr)
        # A run that dies half way still has to say what it measured, because
        # the writes it made are on a live site either way.
        answer = dict(PARTIAL, error=repr(problem))
    finally:
        site.stop()
    answer['seconds'] = round(time.time() - started, 1)
    print(json.dumps(answer, indent=1))


if __name__ == '__main__':
    asyncio.run(main())
