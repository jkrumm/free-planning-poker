import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AstroIntegration } from 'astro'
import { renderSocialImage } from '../lib/social-image.ts'
import { siteOrigin } from '../lib/site.ts'
import { strings } from '../strings.en.ts'

const entities: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
}

/** The content of `<meta property="<property>" content="...">`, entities decoded. */
function metaProperty(html: string, property: string): string | undefined {
  const match = new RegExp(`<meta property="${property}" content="([^"]*)"`).exec(html)
  return match?.[1]?.replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => entities[entity] ?? entity)
}

/**
 * One social image per built page, written where the page's og:image names it, from the page's own og:title and
 * og:description: the page stays the one source of both. It runs at the end of the build and nothing runs at request
 * time. A page with no og:image is a bug of the layout, so it fails the build.
 */
export function socialImages(): AstroIntegration {
  return {
    name: 'fpp-social-images',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir)
        const files = await readdir(root, { recursive: true })
        let count = 0
        for (const rel of files.filter((file) => file.endsWith('.html'))) {
          const html = await readFile(join(root, rel), 'utf8')
          const image = metaProperty(html, 'og:image')
          const title = metaProperty(html, 'og:title')
          const description = metaProperty(html, 'og:description')
          if (image === undefined || title === undefined || description === undefined)
            throw new Error(`${rel}: no og:image, og:title or og:description`)
          const url = new URL(image)
          if (url.origin !== siteOrigin) throw new Error(`${rel}: og:image is not on ${siteOrigin}`)
          const target = join(root, url.pathname)
          await mkdir(dirname(target), { recursive: true })
          await writeFile(
            target,
            await renderSocialImage({ siteName: strings.siteName, title, description }),
          )
          count += 1
        }
        logger.info(`${count} social images`)
      },
    },
  }
}
