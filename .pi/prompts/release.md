---
description: Release new version
argument-hint: "<New Version>"
---

Release new version ($@), execute the workflow:

1. Review git commit records from last version.
2. Write CHANGELOG.md.
3. Update package.json to increase version.
4. Write about newly added features to English and Chinese README.md as needed.
5. Run `pnpm fmt` and `pnpm lint`, check no error.
6. Run git commit ($@)

Don't copy the commit record exactly, focus on newly added important features and fixed major bugs!
