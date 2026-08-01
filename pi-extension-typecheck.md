# pi extensions

Extensions live in `bridge/` as `.ts` files. pi loads them at runtime (no
ahead-of-time build), but they should still be type-checked after edits.

## Type-checking

There is **no local `package.json`, `node_modules`, or `tsconfig.json`** in this
directory. Extensions import types from the globally-installed pi package:

- entry module: `@earendil-works/pi-coding-agent`
- its types: `$(npm root -g)/@earendil-works/pi-coding-agent/dist/index.d.ts`
- `@types/node`: bundled in that package's `node_modules/@types`
- sub-packages (`@earendil-works/pi-ai`, `pi-tui`, `pi-agent-core`, `typebox`)
  live inside that package's `node_modules/` and resolve via their `package.json`
  `types` field.

Use the provided script, which resolves all of the above via `npm root -g`,
writes a throwaway `.tsconfig.check.json`, runs `tsc --noEmit`, then deletes it:

```bash
# check every extension
./typecheck.sh

# check a single file (faster, recommended while iterating on one extension)
./typecheck.sh bridge/btw.ts
```

Run it from the `pi/` directory (the script is `./typecheck.sh` there).

### Why a generated tsconfig instead of a committed one

`tsc`'s `paths` mapping can only be set inside a config file (CLI gives TS6064),
and the absolute path to the global pi package differs per machine. So the
tsconfig is generated at check time from `npm root -g` and is never committed
(`.tsconfig.check.json` is created and removed on each run).

### Compiler options in effect

- `strict: true`
- `skipLibCheck: true`
- `allowImportingTsExtensions: true` (extensions import sibling `.ts` files)
- `target`/`module`/`moduleResolution`: `es2022` / `nodenext` / `nodenext`
- `noUncheckedIndexedAccess` is **not** enabled (matches the pi codebase), so
  `ARR[i]` is `string`, not `string | undefined`. The `!` on indexed access in
  the example extensions is stylistic consistency, not a requirement.

### Prerequisites

- Node + npm
- pi installed globally: `npm i -g @earendil-works/pi-coding-agent`
- TypeScript is fetched on demand via `npx -p typescript@5` (no local install)

## Notes on individual extensions

- The other files under `bridge/` are upstream pi examples. Some reference
  APIs (`complete`, unparameterised `Model`, ...) that drift with the installed
  pi version and may report errors under `strict`. They are not part of this
  project's surface; when iterating, scope the check to the file you are editing.
