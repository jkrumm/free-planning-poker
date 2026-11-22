import { fileURLToPath } from 'node:url'

// The root the content loader reads (content.config.ts); the tests point it at test/fixtures/content.
export const contentRoot = process.env.FPP_SITE_CONTENT ?? './src/content'

// The pillar guide (/guide) is the same in every build, the fixture builds included, so it does not follow contentRoot.
// Absolute: the sitemap reads it from the repository root in the tests and from apps/site in a build.
export const pillarRoot = fileURLToPath(new URL('../content/pillar', import.meta.url))
