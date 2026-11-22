/**
 * The end-to-end suite (docs/v9/ARCHITECTURE.md, Testing): Playwright drives one browser context per seat against a
 * running stack, the image users self-host. Started by `make e2e` (the stack and the run, in a slot) or, in CI, by
 * `bun e2e/suite/run.ts`; `make e2e-beta` runs the tests tagged @smoke against another base URL. The bundled headless
 * shell, never an installed Chrome (rules/browser.md): a context per seat is a memory figure, and the shell is the
 * smaller build.
 */
import { defineConfig } from '@playwright/test'

const base = process.env['E2E_BASE_URL'] ?? ''
if (!/^https?:\/\/[^/]+\/?$/.test(base))
  throw new Error(
    'E2E_BASE_URL names no host: run make e2e (or make e2e-beta E2E_BASE_URL=<origin>)',
  )
// The suite creates rooms and takes seats: never against the production host (v1 runs there until the cutover).
if (/^https?:\/\/(www\.)?free-planning-poker\.com\/?$/.test(base))
  throw new Error('the end-to-end suite never runs against production')

const junit = process.env['FACTORY_JUNIT_DIR']
const ci = process.env['CI'] !== undefined

export default defineConfig({
  testDir: '.',
  testMatch: '*.e2e.ts',
  outputDir: './test-results',
  // Every test makes its own room, so tests share nothing but the stack. Workers are a memory figure: each holds one
  // browser, and a test holds one context per seat (rules/browser.md).
  fullyParallel: true,
  workers: Number(process.env['E2E_WORKERS'] ?? 2),
  // One retry exists to record a trace; failOnFlakyTests keeps a test that needed it red. No flake is tolerated.
  retries: ci ? 1 : 0,
  failOnFlakyTests: true,
  forbidOnly: true,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ci ? ['blob', { outputDir: './blob-report' }] : ['list'],
    ...(ci ? [['list'] as const] : []),
    ...(junit === undefined ? [] : [['junit', { outputFile: `${junit}/e2e.xml` }] as const]),
  ],
  use: {
    baseURL: base,
    headless: true,
    locale: 'en-US',
    timezoneId: 'UTC',
    colorScheme: 'light',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium' }],
})
