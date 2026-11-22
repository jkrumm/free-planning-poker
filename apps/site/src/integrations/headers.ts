import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AstroIntegration } from 'astro'
import { headersFile } from '../lib/headers.ts'
import type { Target } from '../lib/target.ts'

/**
 * Writes the build's `_headers` at the root of the output, where Workers static assets read it. A file in `public`
 * would be the same for both targets; the beta one sets noindex and the production one does not.
 */
export function edgeHeaders(target: Target): AstroIntegration {
  return {
    name: 'fpp-edge-headers',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        await writeFile(join(fileURLToPath(dir), '_headers'), headersFile(target))
      },
    },
  }
}
