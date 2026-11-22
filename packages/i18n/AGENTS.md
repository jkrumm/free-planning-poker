# packages/i18n

The languages and the message catalogues, in a package of their own so the site reads them too (rule `strings.md`). The tool is Lingui 6: Paraglide JS lost the spike of `v9-room-plain` because every message function holds all its languages, so a language cannot be its own chunk and the entry grows with each (`docs/v9/research/r24-i18n.md`; the byte table is in that pull request).

## Where things are

| Path | Holds |
|-|-|
| `src/languages.ts` | `LANGUAGES` (five entries; `complete` marks English and German), `pickLanguage` (stored choice, then the browser's, then English) |
| `src/activate.ts` | loads a language's catalogue files and activates it on an `i18n` instance |
| `lingui.config.ts` | the catalogues: `locales/<feature>/<language>.po` for each `apps/room/src/features/<feature>`, `locales/app` for the rest |
| `locales/` | the catalogue files, committed; English is the source, German is complete, Spanish, French and Chinese stay empty and show English until `v9-room-translations` |
| `scripts/messages.ts` | the message check, run by `make check-fast` |

## Adding a message

1. Write it in the component: `const { t } = useLingui()` (from `@lingui/react/macro`), then ``t`Reveal cards` ``; a count is `plural(n, { one: '# vote', other: '# votes' })` from `@lingui/core/macro`; a message outside a component is ``msg`...` `` read with `i18n._(descriptor)`.
2. `bun run i18n` (extract, with `--clean`): it writes the new message into every language's file of that feature.
3. Fill `msgstr` in `de.po`. The message check fails on an empty German or English translation and on a catalogue that extraction would change.

A feature directory a row creates gets its own catalogue files at the next extraction; no configuration changes. Numbers, dates and durations go through `Intl` (`i18n.date`, `i18n.number`) with the active language.

## Rules

- `.oxfmtrc.json` keeps `packages/i18n/locales` out of oxfmt; the `.po` files are written by Lingui only, apart from a translation typed into `msgstr`.
- `lingui compile` is not run: the Vite plugin compiles each `.po` into its own chunk at build time (`import.meta.glob` in `apps/room/src/main.tsx`), and the Bun preload does the same for tests.
