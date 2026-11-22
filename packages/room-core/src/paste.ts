/**
 * Turns pasted text into topics, one per line (docs/v9/UX.md, Decks and facilitation: Topics). A line may start with
 * a ticket key ("SHOP-123 Checkout redesign"), hold a tracker link, or be plain text. A key fills the reference's key;
 * a link of Jira, Linear, GitHub, GitLab or Azure DevOps also fills its source and site. Pure: no request is made.
 */
import { LIMITS } from './protocol/names.ts'
import type { TopicInput } from './protocol/types.ts'
import { parseTopicRef, type TopicRef, type TrackerSource } from './values.ts'

const TITLE_MAX = 300
const URL_MAX = 2048

const BULLET = /^(?:[-*•]|\d{1,3}[.)]|\[[ xX]?\])\s+/
const LINK = /https?:\/\/[^\s<>"']+/i
const KEY = /^([A-Z][A-Z0-9_]{0,15}-\d{1,9})(?![\w-])/
const EDGES = /^[\s:|–—-]+|[\s:|–—.,;-]+$/g

const clip = (text: string, max: number) => [...text].slice(0, max).join('')

const ref = (
  source: TrackerSource | null,
  parts: { id?: string; key?: string; site?: string },
): TopicRef | null =>
  parseTopicRef({
    source,
    id: parts.id ?? null,
    key: parts.key ?? null,
    site: parts.site ?? null,
  }) ?? null

/** The tracker reference a link carries, when it is an issue of a tracker this parser knows. */
export function refFromUrl(link: string): TopicRef | null {
  let url: URL
  try {
    url = new URL(link)
  } catch {
    return null
  }
  const host = url.hostname.toLowerCase()
  const path = url.pathname.split('/').filter((part) => part.length > 0)

  if (host.endsWith('.atlassian.net')) {
    const browse = path[0] === 'browse' ? path[1] : undefined
    const key = browse ?? url.searchParams.get('selectedIssue') ?? undefined
    if (key !== undefined && KEY.test(key)) return ref('jira', { key, site: host })
    return null
  }
  if (host === 'linear.app') {
    const [workspace, kind, key] = path
    if (workspace !== undefined && kind === 'issue' && key !== undefined)
      return ref('linear', { key: key.toUpperCase(), site: workspace })
    return null
  }
  if (host === 'github.com') {
    const [owner, repo, kind, number] = path
    if (
      owner !== undefined &&
      repo !== undefined &&
      (kind === 'issues' || kind === 'pull') &&
      number !== undefined &&
      /^\d+$/.test(number)
    )
      return ref('github', { key: `${owner}/${repo}#${number}`, site: host })
    return null
  }
  if (host === 'gitlab.com' || host.startsWith('gitlab.')) {
    const dash = path.indexOf('-')
    const kind = path[dash + 1]
    const number = path[dash + 2]
    if (
      dash > 0 &&
      (kind === 'issues' || kind === 'work_items' || kind === 'merge_requests') &&
      number !== undefined &&
      /^\d+$/.test(number)
    ) {
      const mark = kind === 'merge_requests' ? '!' : '#'
      return ref('gitlab', { key: `${path.slice(0, dash).join('/')}${mark}${number}`, site: host })
    }
    return null
  }
  const workItem = path.indexOf('_workitems')
  if (workItem !== -1 && (host === 'dev.azure.com' || host.endsWith('.visualstudio.com'))) {
    const id = path.at(-1)
    if (id === undefined || !/^\d+$/.test(id) || path[workItem + 1] !== 'edit') return null
    const site = host === 'dev.azure.com' ? `${host}/${path[0] ?? ''}` : host
    return ref('azure-devops', { id, key: id, site })
  }
  return null
}

/** One line as a topic; `undefined` for a line with nothing on it. */
export function parseTopicLine(line: string): TopicInput | undefined {
  const text = line.trim().replace(BULLET, '').trim()
  if (text.length === 0) return undefined

  const link = LINK.exec(text)?.[0].replace(/[.,;)]+$/, '')
  if (link !== undefined) {
    const found = refFromUrl(link)
    let rest = text.replace(link, ' ').replace(/\s+/g, ' ').replace(EDGES, '')
    const key = found?.key ?? null
    if (key !== null && rest.startsWith(key)) rest = rest.slice(key.length).replace(EDGES, '')
    const title = rest.length > 0 ? rest : (key ?? link)
    return {
      title: clip(title, TITLE_MAX),
      url: link.length <= URL_MAX ? link : null,
      ref: found,
    }
  }

  const key = KEY.exec(text)?.[1]
  if (key !== undefined) {
    const rest = text.slice(key.length).replace(EDGES, '')
    return {
      title: clip(rest.length > 0 ? rest : key, TITLE_MAX),
      url: null,
      ref: ref(null, { key }),
    }
  }

  return { title: clip(text, TITLE_MAX), url: null, ref: null }
}

/** Every non-empty line as a topic, at most as many as a queue holds. */
export function parseTopicLines(text: string): TopicInput[] {
  return text
    .split(/\r?\n/)
    .map(parseTopicLine)
    .filter((topic): topic is TopicInput => topic !== undefined)
    .slice(0, LIMITS.openTopics)
}
