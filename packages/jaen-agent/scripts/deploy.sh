#!/usr/bin/env bash
#
# Build the agent and deploy it, stamped with its version.
#
#   scripts/deploy.sh
#   scripts/deploy.sh --dry-run     print the commands, deploy nothing
#
# The stamp is what `query { version { agent commit builtAt } }` answers
# afterwards. A bare `wrangler deploy` leaves the three vars unset and the
# query answers nulls, which reads as "deployed without the script". So this
# is the one way to deploy.
#
# The taxi pylon's script with the database parts removed: there is no D1, no
# prisma and no migrations directory here, because the repository is the store.
#
# Bump the version in package.json before running this. The script does not do
# it for you, because the number is a decision and not a side effect.
#
set -euo pipefail

AGENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "$AGENT_DIR/../.." && pwd)"
cd "$AGENT_DIR"

# The one Cloudflare account the estate's Workers live in. Fixed here rather
# than read from a shell: the marketing site checkouts carry the same id next
# to a Pages token, and a Pages token is exactly what must not reach this
# deploy.
ACCOUNT_ID="92920a0740087f4d54d9201675220d43"
HOST="agent.jaen.netsnek.com"

DRY_RUN=0

usage() {
  cat <<'USAGE'
Usage: scripts/deploy.sh [--dry-run]

Builds with `pylon build` and deploys the Worker with AGENT_VERSION,
AGENT_COMMIT and AGENT_BUILT_AT stamped as vars, then reads the stamp back
off the deployed Worker.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help) usage; exit 0 ;;
    *)         echo "unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

# --------------------------------------------------------------------------
# The stamp
# --------------------------------------------------------------------------

VERSION="$(node -p 'require("./package.json").version')"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$ ]] \
  || { echo "package.json version '$VERSION' is not a semver" >&2; exit 1; }

COMMIT="$(git -C "$REPO_DIR" rev-parse --short HEAD)"
# Uncommitted changes under packages/jaen-agent would ship under a sha that
# does not carry them. The stamp says so, so it is visible on the wire rather
# than silently the same sha as a clean deploy.
if [[ -n "$(git -C "$REPO_DIR" status --porcelain -- packages/jaen-agent)" ]]; then
  COMMIT="${COMMIT}-dirty"
  echo "WARNING: packages/jaen-agent has uncommitted changes, stamping $COMMIT" >&2
fi

BUILT_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

printf 'deploy jaen-agent\n'
printf '   route     https://%s/graphql\n' "$HOST"
printf '   version   %s\n' "$VERSION"
printf '   commit    %s\n' "$COMMIT"
printf '   builtAt   %s\n' "$BUILT_AT"

# Prints the command before running it, so a transcript of a run is also a
# transcript a human can replay by hand.
run() {
  printf '   + %s\n' "$*"
  [[ "$DRY_RUN" -eq 1 ]] || "$@"
}

# Node's fetch dies on this machine's unreachable AAAA records, and wrangler is
# node. Without this every remote call hangs until it times out.
export NODE_OPTIONS="${NODE_OPTIONS:---no-network-family-autoselection}"
export PYLON_DISABLE_TELEMETRY=true

# --------------------------------------------------------------------------
# Build and deploy
# --------------------------------------------------------------------------

run npx pylon build

# env -u CLOUDFLARE_API_TOKEN: a token exported from one of the site checkouts
# is a Pages token of another scope, and wrangler prefers a token over its own
# login. Dropping it makes wrangler use the account login that has always
# deployed these Workers. The account id is pinned so the login cannot land in
# a different account either.
run env -u CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID="$ACCOUNT_ID" \
  npx wrangler deploy \
    --var "AGENT_VERSION:$VERSION" \
    --var "AGENT_COMMIT:$COMMIT" \
    --var "AGENT_BUILT_AT:$BUILT_AT"

# --------------------------------------------------------------------------
# Verify: the deployed Worker answers with the stamp it was given
# --------------------------------------------------------------------------

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "dry run complete, nothing was deployed"
  exit 0
fi

# The custom domain keeps answering from the previous version for a while
# after wrangler reports the upload (measured on the taxi Workers 2026-09-05:
# the old stamp for about twenty seconds), so the answer is asked for again, a
# few times, before it is called wrong.
echo "verify https://$HOST/graphql"
GOT=""
for attempt in 1 2 3 4 5 6; do
  ANSWER="$(curl -sS --max-time 30 "https://$HOST/graphql" \
    -H 'content-type: application/json' \
    -H 'user-agent: jaen-agent-deploy' \
    --data '{"query":"{ version { agent commit builtAt } }"}' || true)"
  printf '   %s\n' "$ANSWER"

  GOT="$(printf '%s' "$ANSWER" | node -e '
    let s = ""; process.stdin.on("data", d => s += d).on("end", () => {
      try { const v = JSON.parse(s).data.version; process.stdout.write([v.agent, v.commit].join(" ")) }
      catch { process.stdout.write("") }
    })')"

  [[ "$GOT" == "$VERSION $COMMIT" ]] && break
  [[ "$attempt" -lt 6 ]] && { echo "   not yet, waiting 10 s"; sleep 10; }
done

if [[ "$GOT" == "$VERSION $COMMIT" ]]; then
  echo "ok: $HOST serves jaen-agent $VERSION ($COMMIT)"
else
  echo "ERROR: $HOST does not answer with the stamp it was deployed with" >&2
  echo "       expected '$VERSION $COMMIT', got '${GOT:-nothing}'" >&2
  echo "       the deploy may still be propagating, or the Worker is an older build" >&2
  exit 1
fi
