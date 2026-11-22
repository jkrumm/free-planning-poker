import { type Language, activateLanguage } from '@fpp/i18n'
import { i18n } from '@lingui/core'

/** A lazy import per catalogue file, by path: what `import.meta.glob` returns, or a test's own. */
export type Catalogues = Readonly<
  Record<string, () => Promise<{ readonly messages: Record<string, unknown> }>>
>

/**
 * Activates a language on the one `i18n` instance. Each catalogue file (one per feature and language, in
 * `packages/i18n/locales`) is its own chunk, so a person downloads their language and no other.
 */
export const activatorOf =
  (catalogues: Catalogues) =>
  (language: Language): Promise<void> =>
    activateLanguage({
      i18n,
      language,
      loaders: (wanted) =>
        Object.entries(catalogues)
          .filter(([path]) => path.endsWith(`/${wanted}.po`))
          .map(([, load]) => load),
      document,
    })

export { i18n }
