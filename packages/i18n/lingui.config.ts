/**
 * The message catalogue's configuration (docs/v9/research/r24-i18n.md, rule strings.md). One catalogue file per
 * feature directory and language, all of them here, in the package the site reads later: a feature
 * `apps/room/src/features/<name>` writes `locales/<name>/<language>.po`, and `app` holds what lives outside a feature.
 */
import { defineConfig } from '@lingui/conf'
import { formatter } from '@lingui/format-po'
import { LANGUAGE_CODES, SOURCE_LANGUAGE } from './src/languages.ts'

const ROOM = '<rootDir>/../../apps/room/src'

export default defineConfig({
  sourceLocale: SOURCE_LANGUAGE,
  locales: [...LANGUAGE_CODES],
  // A language whose catalogue is still empty shows English (the row v9-room-translations fills them).
  fallbackLocales: { default: SOURCE_LANGUAGE },
  orderBy: 'messageId',
  // No line numbers: a catalogue file changes only when a message does, not when code above it moves.
  format: formatter({ lineNumbers: false }),
  catalogs: [
    { path: '<rootDir>/locales/{name}/{locale}', include: [`${ROOM}/features/{name}`] },
    { path: '<rootDir>/locales/app/{locale}', include: [ROOM], exclude: [`${ROOM}/features/`] },
  ],
})
