// The contact form's contract with POST /api/contact. The limits are v1's (apps/web contact.router.ts at origin/v1):
// the page prints them as HTML attributes and contact.site.test.ts holds them against v1's numbers.

export const contactEndpoint = '/api/contact'

export const contactLimits = {
  name: { max: 50 },
  email: { max: 70 },
  subject: { min: 3, max: 100 },
  message: { max: 800 },
} as const

export type ContactPayload = { name?: string; email: string; subject: string; message?: string }

/** What a submit says: the route's typed answers (v9-api-contact: 400 per field, 429, 503, 502) as four outcomes. */
export type ContactAnswer = 'sent' | 'invalid' | 'busy' | 'unavailable'

/** `status` is undefined when the request never got an answer (offline, blocked, no route yet). */
export function answerFor(status: number | undefined): ContactAnswer {
  if (status === undefined) return 'unavailable'
  if (status >= 200 && status < 300) return 'sent'
  if (status === 400 || status === 422) return 'invalid'
  if (status === 429) return 'busy'
  return 'unavailable'
}

/** The JSON body: trimmed, and an empty optional field left out, as v1's form did. */
export function contactPayload(data: FormData): ContactPayload {
  const field = (key: string) => {
    const value = data.get(key)
    return typeof value === 'string' ? value.trim() : ''
  }
  const name = field('name')
  const message = field('message')
  return {
    ...(name === '' ? {} : { name }),
    email: field('email'),
    subject: field('subject'),
    ...(message === '' ? {} : { message }),
  }
}
