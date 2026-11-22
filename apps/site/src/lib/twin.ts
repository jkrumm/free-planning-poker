/** A Markdown twin: the page's Markdown under a short block of title, address and updated date. */
export function twinMarkdown(page: {
  title: string
  address: string
  updated: Date
  body: string
}): string {
  const updated = page.updated.toISOString().slice(0, 10)
  return `# ${page.title}\n\nAddress: ${page.address}\nUpdated: ${updated}\n\n${page.body.trim()}\n`
}
