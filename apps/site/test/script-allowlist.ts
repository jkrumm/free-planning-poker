import type { AllowedScript } from './scripts.ts'

// The site ships no JavaScript of its own beyond what is listed here. An entry names a script or an emitted file and says
// why it must exist: the analytics script (v9-umami-events) and the landing demo island (v9-site-landing) are added by
// their rows.
export const allowlist: readonly AllowedScript[] = [
  {
    match: 'contact.html: <script type="module">',
    reason:
      'v9-site-legal: sends the contact form as JSON to POST /api/contact and shows the typed answer in place. Without it the form is a plain HTML form post. Astro inlines the bundle into the page (src/scripts/contact-form.ts); nothing else in the site may carry one.',
  },
]
