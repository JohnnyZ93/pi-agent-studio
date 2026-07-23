---
description: Release new version
argument-hint: "<New Version>"
---

Release new version ($@), execute the workflow:

1. Review git commit records from last version.
2. Write CHANGELOG.md.
3. Update package.json to increase version.
4. Run `pnpm fmt` and `pnpm lint`, check no error.
5. Run git commit ($@)
