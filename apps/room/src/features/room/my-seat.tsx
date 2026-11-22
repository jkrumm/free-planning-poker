import type { Command, View } from '@fpp/room-core/types'
import { ownSeat } from '@fpp/room-core/view'
import { useLingui } from '@lingui/react/macro'
import { useState } from 'react'
import { useAppEnv } from '../../app-env.tsx'

/** What a person does with their own seat: rename, become a spectator or a player, leave. */
export function MySeat(props: {
  readonly view: View
  readonly run: (command: Command) => Promise<void>
}) {
  const env = useAppEnv()
  const { t } = useLingui()
  const me = ownSeat(props.view)
  const [name, setName] = useState(me?.name ?? '')
  if (me === undefined) return null
  const next = me.role === 'player' ? 'spectator' : 'player'
  return (
    <section aria-labelledby="my-seat-heading">
      <h2 id="my-seat-heading">{t`Your seat`}</h2>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          const trimmed = name.trim()
          if (trimmed === '') return
          const profile = env.store.profile.get()
          if (profile !== null) env.store.profile.set({ ...profile, name: trimmed })
          void props.run({ type: 'seat.rename', payload: { name: trimmed } })
        }}
      >
        <label>
          {t`Your name`}
          <input
            data-testid="rename-input"
            value={name}
            maxLength={32}
            autoComplete="nickname"
            onChange={(event) => setName(event.currentTarget.value)}
          />
        </label>
        <button type="submit" data-testid="rename">
          {t`Change name`}
        </button>
      </form>
      <button
        type="button"
        data-testid="role-toggle"
        onClick={() =>
          void props.run({ type: 'seat.setRole', payload: { seat: me.index, role: next } })
        }
      >
        {me.role === 'player' ? t`Become a spectator` : t`Become a player`}
      </button>
      <button
        type="button"
        data-testid="leave"
        onClick={() => void props.run({ type: 'seat.leave', payload: {} })}
      >
        {t`Leave the room`}
      </button>
    </section>
  )
}
