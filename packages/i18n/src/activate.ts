import type { I18n } from '@lingui/core'
import type { Language } from './languages.ts'

/**
 * How a language's messages are fetched: one entry per catalogue file (a feature's), each a lazy import the bundler
 * turns into its own chunk, so a person downloads the language they read and nothing else.
 */
export type CatalogueLoaders = Readonly<
  Record<string, () => Promise<{ readonly messages: Record<string, unknown> }>>
>

/** Loads every catalogue of `language` and makes it the active one; the page's `lang` follows. */
export async function activateLanguage(input: {
  readonly i18n: I18n
  readonly language: Language
  readonly loaders: (language: Language) => readonly (() => ReturnType<CatalogueLoaders[string]>)[]
  readonly document?: { readonly documentElement: { lang: string } }
}): Promise<void> {
  const loaded = await Promise.all(input.loaders(input.language).map((load) => load()))
  const messages = Object.assign({}, ...loaded.map((catalogue) => catalogue.messages))
  input.i18n.load(input.language, messages)
  input.i18n.activate(input.language)
  if (input.document !== undefined) input.document.documentElement.lang = input.language
}
