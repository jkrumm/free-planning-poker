import { strings } from '../../strings.en.ts'
import { siteOrigin } from '../../lib/site.ts'

/**
 * Who the site's structured data names. The author of an article is the person the imprint names (Johannes Krumm,
 * a private individual: the footer credits the same name), the publisher is the project as an Organization. The
 * Person has no url on purpose: the imprint publishes no address or e-mail and the site has no profile page.
 */
export const identity = {
  name: 'Free Planning Poker',
  alternateName: strings.siteName,
  origin: siteOrigin,
  description: strings.llms.summary,
  sameAs: ['https://github.com/jkrumm/free-planning-poker'],
  author: 'Johannes Krumm',
  license: 'https://www.gnu.org/licenses/agpl-3.0.html',
} as const
