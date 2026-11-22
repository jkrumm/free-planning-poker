import { canonicalOf, metaOf, propertyOf, titleOf } from './output.ts'

const origin = 'https://free-planning-poker.com'

/**
 * What is wrong with the head of one built page; an empty list is a page that can be found and shared. `hasImage`
 * says whether a file exists in the output at a site path. Every page, the 404 page and a draft on beta included, has
 * a title, a description, a canonical link and a social image that exists: that is the row's contract.
 */
export function headProblems(html: string, hasImage: (path: string) => boolean): string[] {
  const problems: string[] = []
  const need = (ok: boolean, what: string) => {
    if (!ok) problems.push(what)
  }
  need((titleOf(html) ?? '').trim() !== '', 'no title')
  need((metaOf(html, 'description') ?? '').trim() !== '', 'no meta description')
  const canonical = canonicalOf(html)
  need(canonical?.startsWith(origin) === true, 'no canonical link on the production origin')
  need(propertyOf(html, 'og:title') !== undefined, 'no og:title')
  need((propertyOf(html, 'og:description') ?? '') !== '', 'no og:description')
  need(propertyOf(html, 'og:url') === canonical, 'og:url is not the canonical link')
  need(['website', 'article'].includes(propertyOf(html, 'og:type') ?? ''), 'no og:type')
  need(propertyOf(html, 'og:image:width') === '1200', 'og:image:width is not 1200')
  need(propertyOf(html, 'og:image:height') === '630', 'og:image:height is not 630')
  need(
    metaOf(html, 'twitter:card') === 'summary_large_image',
    'no twitter:card summary_large_image',
  )
  const image = propertyOf(html, 'og:image')
  if (image === undefined || !image.startsWith(origin + '/')) {
    problems.push('no og:image on the production origin')
  } else {
    need(hasImage(new URL(image).pathname), `og:image ${image} is not in the output`)
  }
  return problems
}
