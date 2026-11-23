import type { Target } from './target.ts'

/**
 * The security headers Traefik's `security-headers` middleware sets on the API's route of the beta host (vps
 * `traefik/dynamic/middlewares.yml`), so a path the Worker serves and a path the API serves answer with the same ones. Read off
 * `/api/health` on 2026-11-22; change both together.
 */
export const securityHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
} as const

/** The beta host is kept out of search on every path; the production build carries no robots header. */
const betaRobots = { 'X-Robots-Tag': 'noindex' } as const

/**
 * The `_headers` file of a build: one rule for every path. Workers static assets apply it to every file they serve,
 * the 404 page included, and never to a response made by Worker code; this Worker has none (docs/shipping.md, Site).
 */
export function headersFile(target: Target): string {
  const headers = target === 'beta' ? { ...securityHeaders, ...betaRobots } : securityHeaders
  const lines = Object.entries(headers).map(([name, value]) => `  ${name}: ${value}`)
  return ['/*', ...lines, ''].join('\n')
}
