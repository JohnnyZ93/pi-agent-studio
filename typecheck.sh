#!/usr/bin/env bash
# Type-check pi extensions against the globally-installed pi package types.
#
# There is no local package.json/tsconfig in this directory. Extensions import
# types from the globally-installed `@earendil-works/pi-coding-agent` (and its
# bundled sub-packages @earendil-works/pi-ai, pi-tui, pi-agent-core, typebox),
# so this script resolves them via `npm root -g`, generates a throwaway tsconfig
# wiring `paths` + `typeRoots` to those packages, and runs `tsc --noEmit`.
#
# Usage:
#   ./typecheck.sh                       # check all bridge/**/*.ts
#   ./typecheck.sh bridge/foo.ts     # check specific file(s)

set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
pkg="$(npm root -g)/@earendil-works/pi-coding-agent"

if [ ! -f "$pkg/dist/index.d.ts" ]; then
	echo "pi-coding-agent not found at $pkg" >&2
	echo "install it globally first: npm i -g @earendil-works/pi-coding-agent" >&2
	exit 1
fi

if [ "$#" -gt 0 ]; then
	files=("$@")
else
	shopt -s nullglob globstar
	files=("$here"/bridge/**/*.ts)
fi

if [ "${#files[@]}" -eq 0 ]; then
	echo "no .ts files to check" >&2
	exit 1
fi

# Build a JSON "files" array body (trailing commas are allowed in tsconfig).
json_files=""
for f in "${files[@]}"; do
	f="$(cd "$(dirname "$f")" && pwd)/$(basename "$f")"
	json_files+=$'    "'"$f"'",'
done
json_files+=$'\n'

cfg="$here/.tsconfig.check.json"
trap 'rm -f "$cfg"' EXIT

cat > "$cfg" <<EOF
{
  "compilerOptions": {
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "allowImportingTsExtensions": true,
    "target": "es2022",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "lib": ["es2022"],
    "typeRoots": ["$pkg/node_modules/@types"],
    "baseUrl": "$here",
    "paths": {
      "@earendil-works/pi-coding-agent": ["$pkg/dist/index.d.ts"],
      "@earendil-works/*": ["$pkg/node_modules/@earendil-works/*"],
      "typebox": ["$pkg/node_modules/typebox"]
    }
  },
  "files": [
$json_files  ]
}
EOF

npx --yes -p typescript@5 tsc -p "$cfg"
