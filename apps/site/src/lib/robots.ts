import { siteOrigin } from './site.ts'

// The crawlers the policy names: search, user-triggered and training crawlers of the assistants and the search
// engines (docs/v9/STRATEGY.md, Rulings of gate 1). Each token's source and the date it was read (2026-11-22) sit above
// it; re-read the vendor's page when this list changes. A crawler not named here falls to the catch-all group.
export const crawlers = [
  // OpenAI, search: developers.openai.com/api/docs/bots (listed 2026-10-10)
  'OAI-SearchBot',
  // OpenAI, user-triggered: the same page
  'ChatGPT-User',
  // OpenAI, training: the same page
  'GPTBot',
  // Anthropic, search: support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler
  'Claude-SearchBot',
  // Anthropic, user-triggered: the same article
  'Claude-User',
  // Anthropic, training: the same article
  'ClaudeBot',
  // Perplexity, search: docs.perplexity.ai/docs/resources/perplexity-crawlers
  'PerplexityBot',
  // Perplexity, user-triggered: the same page
  'Perplexity-User',
  // Google, search: developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers
  'Googlebot',
  // Google, training and grounding (Gemini): the same page, anchor #google-extended
  'Google-Extended',
  // Apple, search: support.apple.com/en-us/119829 (published 2026-09-04)
  'Applebot',
  // Apple, training: the same page
  'Applebot-Extended',
  // Microsoft Bing, search: www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0
  'bingbot',
] as const

const blocked = ['/room', '/_room/', '/api/']

const group = (agent: string) =>
  [`User-agent: ${agent}`, 'Allow: /', ...blocked.map((path) => `Disallow: ${path}`)].join('\n')

export function robotsTxt(): string {
  return `${[...crawlers, '*'].map(group).join('\n\n')}\n\nSitemap: ${siteOrigin}/sitemap-index.xml\n`
}
