/**
 * The scorecard run (docs/v9/ARENA.md): Playwright drives one entry, named by ARENA_ENTRY, through the scenario matrix
 * in the built gallery (apps/arena/dist) and writes arena/scores/<entry>/. Started by `make arena-score ENTRY=<name>`,
 * which builds the gallery and the static checks first. One worker, so the frame timing is not shared with a second
 * page; the bundled headless shell, never an installed Chrome.
 */
import { defineConfig } from '@playwright/test'

const junit = process.env['FACTORY_JUNIT_DIR']

export default defineConfig({
  testDir: '.',
  testMatch: '*.e2e.ts',
  outputDir: '../../arena/scores/.playwright',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 240_000,
  forbidOnly: true,
  reporter:
    junit === undefined ? [['list']] : [['list'], ['junit', { outputFile: `${junit}/arena.xml` }]],
  globalSetup: './setup.ts',
  globalTeardown: './report.ts',
  use: {
    headless: true,
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'UTC',
    colorScheme: 'light',
  },
})
