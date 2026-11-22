import { parseSlug } from '@fpp/room-core/types'
import { useLingui } from '@lingui/react/macro'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { useAppEnv } from '../../app-env.tsx'

/** `/room`: start a room, open one by its number or name, or go back to one this device has visited. */
export function LobbyPage() {
  const env = useAppEnv()
  const { t, i18n } = useLingui()
  const navigate = useNavigate()
  const [address, setAddress] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [recent, setRecent] = useState(() => env.store.recent.list())

  const join = (event: FormEvent) => {
    event.preventDefault()
    const slug = parseSlug(address.trim().toLowerCase())
    setInvalid(slug === undefined)
    if (slug !== undefined) void navigate({ to: '/room/$slug', params: { slug } })
  }

  return (
    <main>
      <h1>{t`Estimate together`}</h1>
      <p>{t`Open a room, share the link and estimate. No account needed.`}</p>
      <p>
        <Link to="/room/new" data-testid="start">
          {t`Start planning`}
        </Link>
      </p>
      <form onSubmit={join}>
        <label>
          {t`Room number or name`}
          <input
            data-testid="join-address"
            value={address}
            autoComplete="off"
            onChange={(event) => setAddress(event.currentTarget.value)}
          />
        </label>
        <button type="submit" data-testid="join">
          {t`Open room`}
        </button>
        {invalid ? (
          <p role="alert" data-testid="join-invalid">
            {t`That is not a room number or name. Check it and try again.`}
          </p>
        ) : null}
      </form>
      <h2>{t`Your rooms`}</h2>
      {recent.length === 0 ? (
        <p>{t`Rooms you open on this device show up here.`}</p>
      ) : (
        <ul data-testid="recent">
          {recent.map((room) => {
            const visited = i18n.date(room.visitedAt)
            return (
              <li key={room.slug} data-testid="recent-room" data-slug={room.slug}>
                <Link to="/room/$slug" params={{ slug: room.slug }}>
                  {room.name ?? room.slug}
                </Link>{' '}
                <span>{t`Last visit ${visited}`}</span>{' '}
                <button
                  type="button"
                  data-testid="recent-remove"
                  onClick={() => {
                    env.store.recent.remove(room.slug)
                    setRecent(env.store.recent.list())
                  }}
                >
                  {t`Remove from list`}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
