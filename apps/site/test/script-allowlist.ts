import type { AllowedScript } from './scripts.ts'

// The site ships no JavaScript of its own. An entry names a script or an emitted file and says why it must exist:
// the analytics script (v9-umami-events) and the landing demo island (v9-site-landing) are added by their rows.
export const allowlist: readonly AllowedScript[] = []
