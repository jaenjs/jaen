"""One reading of the jaen agent, with a chosen credential. Prints JSON."""
import json, os, pathlib, sys, urllib.request

CONFIG = pathlib.Path(os.path.expanduser("~/.config/taxi-app"))
def load_env(name):
    p = CONFIG / name
    if not p.is_file(): return
    for line in p.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line: continue
        k, _, v = line.partition("=")
        k = k.strip().removeprefix("export ").strip()
        v = v.strip().strip('"').strip("'")
        if k and v and not os.environ.get(k): os.environ[k] = v
load_env("humans.env"); load_env("tokens.env")

AGENT = os.environ.get("AGENT_URL", "https://jaen-agent.booklimo.at/graphql")

def call(query, variables=None, token=None, agent=AGENT):
    body = json.dumps({"query": query, "variables": variables or {}}).encode()
    r = urllib.request.Request(agent, data=body, method="POST")
    r.add_header("content-type", "application/json")
    r.add_header("user-agent", "jaen-discard-verify")
    if token: r.add_header("authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(r, timeout=90) as a:
            return {"status": a.status, "body": json.loads(a.read())}
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        try: parsed = json.loads(raw)
        except Exception: parsed = raw
        return {"status": e.code, "body": parsed}
    except Exception as e:
        return {"transportError": "%s: %s" % (type(e).__name__, e)}
