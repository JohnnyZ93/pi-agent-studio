---
description: Analyze a pi SDK upgrade
argument-hint: "<New Version>"
---

Analyze upgrading the pi SDK to version $@ and produce an upgrade report, execute the workflow:

1. Check `package.json` and `pi-mcp/package.json` for the currently declared versions of `@earendil-works/pi-ai` and `@earendil-works/pi-coding-agent`, then check `pnpm-lock.yaml` for the actually locked versions.
2. Locate the installed pi changelog (globally installed `@earendil-works/pi-coding-agent/CHANGELOG.md`) and read the entries for the target version and every intermediate version between the current locked version and $@.
3. Analyze breaking changes across all those versions. For each one, determine whether it affects this project by grepping the source (`src/`, `bridge/`, `pi-chat/src`, `pi-mcp/src`, `pi-settings/src`) for the renamed/removed/changed APIs, and state how any errors would be resolved after upgrading.
4. Analyze new features across those versions. For each one, determine whether it is usable directly in this project's TUI mode, webview/RPC mode, or via the bundled bridge extensions and whether any extension or config changes are required to adopt it.
5. Summarize the risk level, list concrete action items, and give the exact `pnpm up` command for the target version.

Don't update the pi SDK and don't make any code changes - only produce the analysis report!
