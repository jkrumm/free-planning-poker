/**
 * The languages of the room (docs/v9/ARCHITECTURE.md, Client, "Languages"): one constant, five entries. English is the
 * source of every message. `complete` marks the languages a change must translate whole and the message check
 * enforces; the others are registered with empty catalogues that fall back to English until `v9-room-translations`.
 */
export const LANGUAGES = [
  { code: 'en', name: 'English', complete: true },
  { code: 'de', name: 'Deutsch', complete: true },
  { code: 'es', name: 'Español', complete: false },
  { code: 'fr', name: 'Français', complete: false },
  { code: 'zh', name: '简体中文', complete: false },
] as const

export type Language = (typeof LANGUAGES)[number]['code']

export const LANGUAGE_CODES = LANGUAGES.map((language) => language.code)

export const SOURCE_LANGUAGE: Language = 'en'

/** The language a tag names (`de`, `de-AT`, `zh-Hans-CN`), or undefined. */
export function languageOf(tag: string | null | undefined): Language | undefined {
  if (tag === null || tag === undefined) return undefined
  const primary = tag.toLowerCase().split(/[-_]/)[0]
  return LANGUAGES.find((language) => language.code === primary)?.code
}

/**
 * The language to show: the stored choice, else the first of the browser's languages we have, else English
 * (docs/v9/UX.md, Languages). A room URL never carries it.
 */
export function pickLanguage(input: {
  readonly stored: string | null
  readonly browser: readonly string[]
}): Language {
  const stored = languageOf(input.stored)
  if (stored !== undefined) return stored
  for (const tag of input.browser) {
    const found = languageOf(tag)
    if (found !== undefined) return found
  }
  return SOURCE_LANGUAGE
}
