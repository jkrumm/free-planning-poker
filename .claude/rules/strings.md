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

- **Everything a person reads comes from the message catalogue**: labels, buttons, toasts, errors, `aria-label`, `alt`, `title`, page titles. One catalogue is shared by the room app and the site and compiled at build time, so a screen ships only its messages and a person downloads only their language. The tool is Lingui 6 (`docs/v9/research/r24-i18n.md`; Paraglide JS lost its spike because a language cannot be its own chunk). The catalogue is `packages/i18n`: one file per feature directory and language, `packages/i18n/locales/<feature>/<language>.po` for each `apps/room/src/features/<feature>`. In a component, `const { t } = useLingui()` and `t` followed by a template literal; then `bun run i18n` extracts it into every language's file, and you fill `de.po`. `packages/i18n/AGENTS.md` has the steps.
- **English and German are complete in every change**: a new key gets both. Spanish, French and Chinese fall back to English until `v9-room-translations` fills them; from then on every change carries all five.
- Counts use ICU plurals in the message, never `count === 1 ?`. Numbers, dates and durations go through `Intl` with the person's locale.
- Layout uses logical properties (`margin-inline-start`, `inset-inline`, `text-align: start`), never left and right, so a right-to-left language is a catalogue and not a rewrite.
- A room URL never carries a language; the language is the person's stored choice, else the browser's, else English. The site keeps English at the root and other languages under a prefix (`/de/`), with no fallback: a page exists in a language only when it is translated whole.
- `packages/table` takes its strings from its caller as props or a messages object: it renders from fixtures and imports no catalogue runtime of its own.
- Telemetry names, log messages and test names are not visible strings and stay in English code.

## Why

`docs/v9/ARCHITECTURE.md`, Client ("Languages") and invariant 18; `docs/v9/UX.md`.

## The check

`make check-fast` fails on literal text between JSX tags (oxlint's `react/jsx-no-literals`, set for `apps/room/src/**/*.tsx`), on a literal `aria-label`, `placeholder`, `title` or `alt`, on a catalogue that extraction would change, and on an empty English or German translation (`packages/i18n/scripts/messages.ts`). A pseudo-locale with lengthened strings runs in the screenshot tests to catch clipped labels.
