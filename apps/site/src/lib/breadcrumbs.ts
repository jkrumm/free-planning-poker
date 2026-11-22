import { canonicalPath } from './canonical.ts'
import { strings } from '../strings.en.ts'

export type Crumb = { name: string; path: string }

/**
 * The trail of a page: Home, the section of a collection entry, the page itself. The home page has none. A path with
 * a second segment must start with a section (the only nested pages there are): another nesting needs a name for its
 * parent, so the build fails here and not with a crumb that links nowhere. Deeper entry ids skip the levels between,
 * because only the section has an index page.
 */
export function breadcrumbs(pathname: string, pageName: string): Crumb[] {
  const path = canonicalPath(pathname)
  if (path === '/') return []
  const [first = '', ...rest] = path.split('/').filter(Boolean)
  const trail: Crumb[] = [{ name: strings.breadcrumbHome, path: '/' }]
  if (rest.length > 0) {
    const name = (strings.sectionNames as Record<string, string | undefined>)[first]
    if (name === undefined) throw new Error(`${path}: no section named ${first} for its breadcrumb`)
    trail.push({ name, path: `/${first}` })
  }
  // A section's index page carries the section's name, the same one its entries' trails give it.
  const sectionName =
    rest.length === 0
      ? (strings.sectionNames as Record<string, string | undefined>)[first]
      : undefined
  trail.push({ name: sectionName ?? pageName, path })
  return trail
}
