import { canonicalPath } from './canonical.ts'

/** The size of every social image: the 1.91:1 card Facebook, LinkedIn, X and Slack show. */
export const socialImageSize = { width: 1200, height: 630 } as const

/**
 * The site path of the social image of a page: `/og/` plus the page's path, `/og/index.png` for the home page.
 * social-images.ts writes the file there at the end of the build; base.astro names it in og:image.
 */
export function socialImagePath(pathname: string): string {
  const path = canonicalPath(pathname)
  return `/og${path === '/' ? '/index' : path}.png`
}
