import type { View } from '@fpp/room-core/types'
import { useLingui } from '@lingui/react/macro'
import { useState } from 'react'
import { useAppEnv } from '../../app-env.tsx'

type Outcome = 'saved' | 'invalid' | 'taken' | 'refused' | 'unavailable' | null

/**
 * The lock and the address, both over HTTP with the seat's secret: a typed or a generated password, unlocking,
 * and booking a name. The room's events bring every seat the result; nothing here edits the view.
 */
export function Access(props: { readonly view: View; readonly slug: string }) {
  const env = useAppEnv()
  const { t } = useLingui()
  const { access, slug } = props.view.room
  const [typed, setTyped] = useState('')
  const [signOut, setSignOut] = useState(false)
  const [booked, setBooked] = useState('')
  const [outcome, setOutcome] = useState<Outcome>(null)

  const call = async (path: 'access' | 'name', body: object): Promise<Outcome> => {
    const token = env.store.seat.get(props.slug)
    if (token === null) return 'refused'
    try {
      const response = await env.fetch(`${env.origin}/api/rooms/${slug}/${path}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      if (response.status === 200) return 'saved'
      if (response.status === 400) return 'invalid'
      if (response.status === 409) return 'taken'
      if (response.status === 403 || response.status === 404) return 'refused'
      return 'unavailable'
    } catch {
      return 'unavailable'
    }
  }
  const lock = async (code: string | undefined) =>
    setOutcome(
      await call('access', {
        access: 'locked',
        signOut,
        ...(code === undefined ? {} : { code }),
      }),
    )

  return (
    <section aria-labelledby="access-heading">
      <h2 id="access-heading">{t`Lock and address`}</h2>
      <p data-testid="access-state" data-access={access}>
        {access === 'locked'
          ? t`The room is locked.`
          : t`The room is open to anyone with the link.`}
      </p>
      <p>{t`Everyone at the table sees the password. It keeps strangers out; it is no secret among colleagues, so do not reuse one you use elsewhere.`}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (typed.trim() !== '') void lock(typed.trim())
        }}
      >
        <label>
          {t`Password`}
          <input
            data-testid="lock-code"
            value={typed}
            autoComplete="off"
            onChange={(event) => setTyped(event.currentTarget.value)}
          />
        </label>
        <button type="submit" data-testid="lock-typed">
          {t`Lock with this password`}
        </button>
      </form>
      <button type="button" data-testid="lock-generated" onClick={() => void lock(undefined)}>
        {t`Lock with a generated password`}
      </button>
      <label>
        <input
          type="checkbox"
          data-testid="sign-out"
          checked={signOut}
          onChange={(event) => setSignOut(event.currentTarget.checked)}
        />
        {t`Remove everyone who is seated now`}
      </label>
      {access === 'locked' ? (
        <button
          type="button"
          data-testid="unlock"
          onClick={async () => setOutcome(await call('access', { access: 'open', signOut: false }))}
        >
          {t`Unlock the room`}
        </button>
      ) : null}
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          if (booked.trim() === '') return
          const result = await call('name', { name: booked.trim() })
          setOutcome(result)
          if (result === 'saved') setBooked('')
        }}
      >
        <label>
          {t`Book a name for this room`}
          <input
            data-testid="book-name"
            value={booked}
            autoComplete="off"
            onChange={(event) => setBooked(event.currentTarget.value)}
          />
        </label>
        <button type="submit" data-testid="book-name-submit">
          {t`Book name`}
        </button>
      </form>
      <p data-testid="room-address">{t`Address ${slug}`}</p>
      {outcome === null ? null : (
        <p role="status" data-testid="access-outcome" data-outcome={outcome}>
          {outcome === 'saved'
            ? t`Saved.`
            : outcome === 'invalid'
              ? t`That is not allowed. Use letters, digits and hyphens.`
              : outcome === 'taken'
                ? t`That name is taken. Try another.`
                : outcome === 'refused'
                  ? t`Only players seated in this room can change this.`
                  : t`The room could not be reached. Try again.`}
        </p>
      )}
    </section>
  )
}
