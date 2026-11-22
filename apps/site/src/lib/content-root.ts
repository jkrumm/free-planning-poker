// The root the content loader reads (content.config.ts); the tests point it at test/fixtures/content.
export const contentRoot = process.env.FPP_SITE_CONTENT ?? './src/content'

// The pillar guide (/guide) is the same in every build, the fixture builds included, so it does not follow contentRoot.
export const pillarRoot = './src/content/pillar'
