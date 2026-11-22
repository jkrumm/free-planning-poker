---
paths:
  - "apps/room/**"
  - "apps/site/**"
  - "apps/arena/**"
  - "packages/table/**"
---

# basalt-ui

basalt-ui is the owner's design system, and v9 is the first consumer built on basalt-ui 3 from nothing, so what this repo finds missing flows back into basalt-ui instead of piling up here.

## The rule

- **basalt-ui 3.x is installed by `v9-ui-foundation`, once npm serves it.** Until then no row installs a prerelease or a local build: stage 1 builds what has no look.
- **A gap is fixed upstream, never patched here.** A missing component, token or lint seam becomes a factory Issue in basalt-ui with a minimal reproduction from this repo: `factory issue new` with the repo basalt-ui (the `factory` skill has the filing contract). Then either defer the row until the release that carries it (`factory issue defer`), or build behind a named seam with the Issue's number in a comment, which a later row deletes. Never copy a basalt component into this repo to change it.
- **No local overrides.** basalt's lint, format and tsconfig presets are used as shipped; a waiver names its reason and the upstream Issue on the same line.
- **Its agent layer is used.** The rules, the skills and the design reviewer basalt-ui ships are installed with it; a row for the interface runs the reviewer before it asks for review. A basalt rule that is wrong for a game surface is changed in basalt-ui.
- **Every interface row reports** what it filed upstream, in one line of its pull request, even "nothing".
- basalt covers the chrome (dialogs, sheets, menus, forms, toasts, settings, insights, charts). The game surface in `packages/table` is bespoke and passes basalt's `primitive-bypass` lint through the seam the arena row establishes. Colours come from basalt tokens through the game tokens (felt, card face, card back, glow); no colour literal in a component.
- Preferences go through basalt-ui's `persisted`; no global store library.

## Why

`docs/v9/ENGINEERING.md`, Working with basalt-ui, which also lists what v9 needs from 3.x and the basalt-ui Issues already filed (2525, 2529 to 2532): check that list before filing a duplicate.

## The check

basalt's own lint presets and its design reviewer, once installed. Filing upstream has no script: the pull request template's line for it is the check.
