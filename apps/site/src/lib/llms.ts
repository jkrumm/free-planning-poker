export type LinkedPage = { title: string; address: string; description: string }
export type LlmsSection = { heading: string; pages: LinkedPage[] }

/** llms.txt: the product in one line, then one section per group with every page's title, address and description. */
export function llmsTxt(summary: string, sections: LlmsSection[]): string {
  const lines = ['# Free Planning Poker', '', `> ${summary}`]
  for (const section of sections) {
    if (section.pages.length === 0) continue
    lines.push('', `## ${section.heading}`, '')
    for (const page of section.pages)
      lines.push(`- [${page.title}](${page.address}): ${page.description}`)
  }
  return `${lines.join('\n')}\n`
}
