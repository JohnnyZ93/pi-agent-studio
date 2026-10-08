#!/usr/bin/env bash
# Type-check the pi bridge extensions (`bridge/**/*.ts`).
#
# Bridge files import types from the pi packages this project declares as
# dependencies (`@earendil-works/pi-coding-agent`, `pi-ai`, `pi-tui`,
# `pi-agent-core`, `typebox`). There is no local package.json for bridge/, so
# the committed `tsconfig.bridge.json` resolves the sub-packages that are not
# hoisted to the root `node_modules` (pi-tui, pi-agent-core, typebox) via
# `paths` to the root `node_modules` (the root package declares them as
# devDependencies). `pi-coding-agent` / `pi-ai` resolve from the root
# `node_modules` normally (including the `pi-ai/compat` subpath).
#
# Uses tsgo (the same TypeScript native preview compiler as `pnpm typecheck`):
# no `npx`, no globally installed `tsc`, no `npm root -g` needed.
#
# Usage:
#   ./typecheck.sh                 # check all bridge/**/*.ts
#   ./typecheck.sh bridge/foo.ts   # check specific file(s)

set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cfg="$here/tsconfig.bridge.json"

if [ ! -f "$cfg" ]; then
	echo "missing $cfg" >&2
	exit 1
fi

tsgo="$here/node_modules/.bin/tsgo"
if [ ! -x "$tsgo" ]; then
	tsgo="tsgo"
fi

if [ "$#" -eq 0 ]; then
	exec "$tsgo" --noEmit -p "$cfg"
fi

tmp="$here/.tsconfig.bridge-check.json"
files_json=""
for f in "$@"; do
	f="$(cd "$(dirname "$f")" && pwd)/$(basename "$f")"
	files_json+=$'\n    "'"$f"'"',
done
files_json="${files_json%,}"

cat > "$tmp" <<EOF
{
  "extends": "$cfg",
  "files": [$files_json
  ]
}
EOF
trap 'rm -f "$tmp"' EXIT
"$tsgo" --noEmit -p "$tmp"
