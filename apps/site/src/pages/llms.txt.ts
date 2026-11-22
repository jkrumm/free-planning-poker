import { sectionEntries, sections } from '../lib/entries.ts'
import { type LlmsSection, llmsTxt } from '../lib/llms.ts'
import { siteOrigin } from '../lib/site.ts'
import { strings } from '../strings.en.ts'
import { guideTwin } from '../twins/guide.ts'

// The index for assistants: the product in one line, then the pillar and every content page this build shows.
export async function GET(): Promise<Response> {
  const groups: LlmsSection[] = [
    {
      heading: strings.llms.startHeading,
      pages: [
        {
          title: guideTwin.title,
          address: `${siteOrigin}/guide`,
          description: guideTwin.description,
        },
      ],
    },
  ]
  for (const section of sections) {
    const entries = await sectionEntries(section)
    groups.push({
      heading: strings.llms.sections[section],
      pages: entries.map((entry) => ({
        title: entry.data.title,
        address: `${siteOrigin}/${section}/${entry.id}`,
        description: entry.data.description,
      })),
    })
  }
  return new Response(llmsTxt(strings.llms.summary, groups), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
