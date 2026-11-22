import { answerFor, contactEndpoint, contactPayload } from '../lib/contact.ts'

// Sends the contact form as JSON and shows the answer. The page's messages ride in the status element's data attributes
// (sending, sent, invalid, busy, unavailable), so this file holds no visible string. Without it the form posts as a plain form.
const form = document.querySelector<HTMLFormElement>('form[data-contact]')
const status = document.querySelector<HTMLElement>('[data-contact-status]')
const submit = form?.querySelector<HTMLButtonElement>('button[type="submit"]')

if (form && status && submit) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    submit.disabled = true
    status.textContent = status.dataset.sending ?? ''
    let code: number | undefined
    try {
      const response = await fetch(contactEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(contactPayload(new FormData(form))),
      })
      code = response.status
    } catch {
      code = undefined
    }
    const answer = answerFor(code)
    status.textContent = status.dataset[answer] ?? ''
    if (answer === 'sent') form.reset()
    else submit.disabled = false
  })
}
