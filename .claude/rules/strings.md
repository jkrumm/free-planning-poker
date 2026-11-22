---
paths:
  - "apps/room/**"
  - "apps/site/**"
  - "apps/arena/**"
  - "packages/table/**"
  - "packages/i18n/**"
---

# Visible strings and languages

9.0.0 ships the room in English, German, Spanish, French and Simplified Chinese, so a string written into a component is a second pass over every screen later (invariant 18).

## The rule

- **Everything a person reads comes from the message catalogue**: labels, buttons, toasts, errors, `aria-label`, `alt`, `title`, page titles. One catalogue is shared by the room app and the site and compiled at build time, so a screen ships only its messages. It is Paraglide JS if its spike in `v9-room-plain` holds the bundle budget, Lingui 6 otherwise (`docs/v9/research/r24-i18n.md`). `v9-room-plain` creates it as a package of its own (`packages/i18n` or the name the tool wants, with its `boundaries.toml` entry) and writes its path, the layout of message files (one per feature directory where the tool allows it, beside `apps/room/src/features/<feature>/`) and the command that adds a message into this rule.
- **English and German are complete in every change**: a new key gets both. Spanish, French and Chinese fall back to English until `v9-room-translations` fills them; from then on every change carries all five.
- Counts use ICU plurals in the message, never `count === 1 ?`. Numbers, dates and durations go through `Intl` with the person's locale.
- Layout uses logical properties (`margin-inline-start`, `inset-inline`, `text-align: start`), never left and right, so a right-to-left language is a catalogue and not a rewrite.
- A room URL never carries a language; the language is the person's stored choice, else the browser's, else English. The site keeps English at the root and other languages under a prefix (`/de/`), with no fallback: a page exists in a language only when it is translated whole.
- `packages/table` takes its strings from its caller as props or a messages object: it renders from fixtures and imports no catalogue runtime of its own.
- Telemetry names, log messages and test names are not visible strings and stay in English code.

## Why

`docs/v9/ARCHITECTURE.md`, Client ("Languages") and invariant 18; `docs/v9/UX.md`.

## The check

The message check fails on literal text in JSX and on a key missing in a shipped language (from `v9-room-plain` on). A pseudo-locale with lengthened strings runs in the screenshot tests to catch clipped labels.
