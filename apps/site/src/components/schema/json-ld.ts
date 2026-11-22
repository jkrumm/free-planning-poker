/**
 * Serialises a typed schema.org object for a script of type application/ld+json. Every "<" becomes the JSON escape
 * \u003c, so no value can carry a closing script tag or a comment opener out of the block.
 */
export function jsonLd(data: object): string {
  return JSON.stringify(data).replaceAll('<', '\\u003c')
}
