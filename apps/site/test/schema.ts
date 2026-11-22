import { visibleText } from './output.ts'

/**
 * The properties each type must carry, as this site writes it. Sources, read 2026-11-22:
 * - Google Search Central: Organization (no property required), Article (none required; headline, image, datePublished,
 *   dateModified and author recommended), BreadcrumbList (itemListElement; each ListItem position, name and item, at
 *   least two items), Site names (WebSite: name and url required, alternateName recommended), Software app
 *   (name and offers.price required, applicationCategory and operatingSystem recommended).
 * - schema.org: FAQPage (mainEntity of Question with name and acceptedAnswer of type Answer with text), DefinedTerm,
 *   DefinedTermSet.
 * Where Google asks for more than we emit, the table lists what we always emit: Google's SoftwareApplication also wants
 * an aggregateRating or a review, which is left out on purpose until real ratings exist.
 */
export const requiredProperties: Record<string, string[]> = {
  Organization: ['name', 'url'],
  WebSite: ['name', 'url'],
  SoftwareApplication: ['name', 'applicationCategory', 'operatingSystem', 'offers.price'],
  Article: ['headline', 'image', 'datePublished', 'dateModified', 'author.name', 'publisher.name'],
  BreadcrumbList: ['itemListElement'],
  FAQPage: ['mainEntity'],
  DefinedTerm: ['name', 'description', 'url', 'inDefinedTermSet'],
  DefinedTermSet: ['name', 'description', 'url', 'hasDefinedTerm'],
}

type Json = { [key: string]: unknown }

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function valueAt(data: Json, path: string): unknown {
  let current: unknown = data
  for (const key of path.split('.')) {
    if (!isObject(current)) return undefined
    current = current[key]
  }
  return current
}

const filled = (value: unknown) =>
  value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0)

/** Every JSON-LD block of a page, parsed; a block that is not JSON throws. */
export function jsonLdBlocks(html: string): Json[] {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  return blocks.map((block) => {
    const data: unknown = JSON.parse(block[1] ?? '')
    if (!isObject(data)) throw new Error('a JSON-LD block is not an object')
    return data
  })
}

export function typesOf(blocks: Json[]): string[] {
  return blocks.map((block) => String(block['@type']))
}

const squash = (text: string) => text.replace(/\s+/g, ' ').trim()

/** What is wrong with the structured data of one built page. */
export function schemaProblems(html: string): string[] {
  const problems: string[] = []
  const visible = squash(visibleText(html))
  for (const block of jsonLdBlocks(html)) {
    const type = String(block['@type'])
    if (block['@context'] !== 'https://schema.org') problems.push(`${type}: no schema.org context`)
    const required = requiredProperties[type]
    if (required === undefined) {
      problems.push(`${type}: a type the table does not know`)
      continue
    }
    for (const path of required)
      if (!filled(valueAt(block, path))) problems.push(`${type}: no ${path}`)
    if (type === 'BreadcrumbList') problems.push(...breadcrumbProblems(block))
    if (type === 'FAQPage') problems.push(...faqProblems(block, visible))
  }
  return problems
}

function breadcrumbProblems(block: Json): string[] {
  const items = Array.isArray(block.itemListElement) ? block.itemListElement : []
  const problems = items.length < 2 ? ['BreadcrumbList: fewer than two items'] : []
  items.forEach((item, index) => {
    const data = isObject(item) ? item : {}
    for (const key of ['name', 'item'])
      if (!filled(data[key])) problems.push(`BreadcrumbList: item ${index + 1} has no ${key}`)
    if (data.position !== index + 1)
      problems.push(`BreadcrumbList: item ${index + 1} has position ${String(data.position)}`)
  })
  return problems
}

/** Every question and its answer in a FAQPage must be on the page as text: the markup may repeat, never add. */
function faqProblems(block: Json, visible: string): string[] {
  const questions = Array.isArray(block.mainEntity) ? block.mainEntity : []
  const problems: string[] = []
  for (const item of questions) {
    const data = isObject(item) ? item : {}
    if (data['@type'] !== 'Question') problems.push('FAQPage: an entry that is not a Question')
    const name = String(data.name ?? '')
    const answer = String(valueAt(data, 'acceptedAnswer.text') ?? '')
    if (!filled(name) || !filled(answer))
      problems.push('FAQPage: a question without a name or an answer')
    if (!visible.includes(squash(name)))
      problems.push(`FAQPage: the question "${name}" is not on the page`)
    if (!visible.includes(squash(answer)))
      problems.push(`FAQPage: the answer to "${name}" is not on the page`)
  }
  return problems
}
