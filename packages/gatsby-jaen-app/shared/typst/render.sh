#!/usr/bin/env bash
# Render a document with the local Typst binary, the way the notebook does.
#
#   render.sh <invoice|offer> <data.json> <out.pdf> [brand] [customer.json] [language]
#
# The template reads the JSON off sys.inputs, so the data may live
# anywhere; the fonts are the vendored ones only, the way the browser
# compiler bundles them, so a page that renders here renders there.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
kind="${1:?invoice or offer}"
data="${2:?data.json}"
out="${3:?out.pdf}"
brand="${4:-}"
customer="${5:-}"
language="${6:-}"
typst="${TYPST:-$HOME/.local/bin/typst}"
args=(compile --root "$here" --font-path "$here/fonts" --ignore-system-fonts --input "data=$(cat "$data")")
[ -n "$brand" ] && args+=(--input "brand=$brand")
[ -n "$customer" ] && args+=(--input "customer=$(cat "$customer")")
[ -n "$language" ] && args+=(--input "language=$language")
exec "$typst" "${args[@]}" "$here/templates/$kind.typ" "$out"
