import { BEFORE_SEND_GLOBAL, UMAMI_SCRIPT_SRC } from '@fpp/telemetry/umami-script'
import type { AllowedScript } from './scripts.ts'

// The site ships no JavaScript of its own beyond what is listed here. An entry names a script or an emitted file and says
// why it must exist: the landing demo island (v9-site-landing) is added by its row. An inline script is matched by its
// text, a script with a src by its tag.
export const allowlist: readonly AllowedScript[] = [
  {
    match: 'contact.html: <script type="module">',
    reason:
      'v9-site-legal: sends the contact form as JSON to POST /api/contact and shows the typed answer in place. Without it the form is a plain HTML form post. Astro inlines the bundle into the page (src/scripts/contact-form.ts); nothing else in the site may carry one.',
  },
  {
    match: `.html: <script>window.${BEFORE_SEND_GLOBAL}=function`,
    reason:
      'v9-umami-events: defines the hook Umami calls before every send. It rewrites a room path to /room/:slug and drops query strings, fragments and a room title, so no room name or access code reaches analytics (ARCHITECTURE.md, Measurement). Defined inline because the tracker reads it from window when it loads; the text is beforeSend in packages/telemetry. On every page, and only in a build that has a website id.',
  },
  {
    match: `.html: <script defer src="${UMAMI_SCRIPT_SRC}" data-website-id=`,
    reason:
      "v9-umami-events: Umami's cookieless tracker from our own origin, deferred, no cookie and no banner (invariant 10, the owner's ruling of 2026-11-19). It sends page views, and the room's events only from the room app. On every page, and only in a build that has a website id.",
  },
]
