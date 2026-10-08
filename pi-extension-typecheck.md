# pi extensions

Extensions live in `bridge/` as `.ts` files. pi loads them at runtime (no
ahead-of-time build), but they should still be type-checked after edits.

## Type-checking

There is **no local `package.json` or `tsconfig.json` in `bridge/`**; the types
come from the pi packages this project declares as dependencies:

- entry module: `@earendil-works/pi-coding-agent`
- `@earendil-works/pi-ai` (incl. the `pi-ai/compat` subpath used by `btw.ts`)
- `@earendil-works/pi-tui`, `@earendil-works/pi-agent-core`, `typebox`

All five packages resolve from the root `node_modules`; the committed
`tsconfig.bridge.json` wires `paths` for `@earendil-works/pi-tui`,
`@earendil-works/pi-agent-core` and `typebox` to their root `node_modules`
`.d.ts` files (the root package declares them as devDependencies, so those
copies track the version this project targets and `typebox` stays pinned to
whatever pi itself pulls in).

```bash
# check every extension (also runs as part of `pnpm typecheck`)
./typecheck.sh

# check a single file (faster, recommended while iterating on one extension)
./typecheck.sh bridge/btw.ts
```

### Why a committed config instead of a generated one

Earlier revisions generated a throwaway tsconfig from `npm root -g` and ran
`npx -p typescript@5 tsc`. That broke twice over: `paths` entries pointing at a
_directory_ no longer resolve under `moduleResolution: nodenext` (must point at
the actual `.d.ts`), `typebox`'s types live at `build/index.d.mts` (not
`dist/`), and `tsgo` (TypeScript 7 native preview) has removed `baseUrl`.
Pointing at the root `node_modules` copies removes the `npm root -g`
machine-specific path, so the config can simply be committed — and it works in
CI with no global install.

### Compiler options in effect

- `tsgo` (same compiler as `pnpm typecheck`; no local `tsc` install needed)
- `strict: true`
- `skipLibCheck: true`
- `allowImportingTsExtensions: true` (extensions import sibling `.ts` files)
- `target`/`module`/`moduleResolution`: `es2022` / `nodenext` / `nodenext`
- `noUncheckedIndexedAccess` is **not** enabled (matches the pi codebase), so
  `ARR[i]` is `string`, not `string | undefined`. The `!` on indexed access in
  the example extensions is stylistic consistency, not a requirement.

## Notes on individual extensions

- The other files under `bridge/` are upstream pi examples. Some reference
  APIs (`complete`, unparameterised `Model`, ...) that drift with the installed
  pi version and may report errors under `strict`. They are not part of this
  project's surface; when iterating, scope the check to the file you are editing.
