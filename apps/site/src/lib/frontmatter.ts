export type Frontmatter = { fields: Record<string, string>; body: string }

/** The top-level scalar fields of a file's leading --- block, and the text after it. Nested values are not read. */
export function parseFrontmatter(text: string): Frontmatter {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text)
  if (!match) return { fields: {}, body: text }
  const fields: Record<string, string> = {}
  for (const line of (match[1] ?? '').split(/\r?\n/)) {
    const field = /^([a-z]+):\s*(.*?)\s*$/.exec(line)
    if (field) fields[field[1] ?? ''] = (field[2] ?? '').replace(/^(['"])(.*)\1$/, '$2')
  }
  return { fields, body: text.slice(match[0].length) }
}
