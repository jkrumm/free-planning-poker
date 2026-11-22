import { identity } from './identity.ts'

/** schema.org Article as a typed object. https://schema.org/Article, https://developers.google.com/search/docs/appearance/structured-data/article */

export type ArticleInput = {
  headline: string
  description: string
  /** Absolute address of the page. */
  url: string
  /** Absolute address of the page's social image. */
  image: string
  published: Date
  updated?: Date | undefined
}

export type ArticleData = {
  '@context': 'https://schema.org'
  '@type': 'Article'
  headline: string
  description: string
  mainEntityOfPage: string
  image: string[]
  datePublished: string
  dateModified: string
  author: { '@type': 'Person'; name: string }
  publisher: { '@type': 'Organization'; name: string; url: string }
}

export function article(input: ArticleInput): ArticleData {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.headline,
    description: input.description,
    mainEntityOfPage: input.url,
    image: [input.image],
    datePublished: input.published.toISOString(),
    // Never published later than modified: an article never updated was last modified when it was published.
    dateModified: (input.updated ?? input.published).toISOString(),
    author: { '@type': 'Person', name: identity.author },
    publisher: { '@type': 'Organization', name: identity.name, url: identity.origin },
  }
}
