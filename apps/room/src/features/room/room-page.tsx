import type { RoomClientState } from '@fpp/room-client'
import type { Command } from '@fpp/room-core/types'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { useEffect, useState, type FormEvent } from 'react'
import { useAppEnv } from '../../app-env.tsx'
import { Access } from './access.tsx'
import { Invite } from './invite.tsx'
import { MySeat } from './my-seat.tsx'
import { Round } from './round.tsx'
import { Seats } from './seats.tsx'
import { Settings } from './settings.tsx'
import { Topics } from './topics.tsx'
import { useRoom } from './use-room.ts'

const STATUS = {
  connecting: msg`Connecting to the room…`,
  locked: msg`This room is locked.`,
  'changed-hands': msg`This address now leads to a different room than the one you remember.`,
  live: msg`Connected.`,
  reconnecting: msg`Connection lost. Reconnecting…`,
  draining: msg`The server is restarting. Reconnecting…`,
  'reload-required': msg`This page is out of date. Reload it to continue.`,
  kicked: msg`You were removed from the room.`,
  gone: msg`You have no seat in this room.`,
} as const

/** `/room/<slug>`: a name first, on a device without one, then the room. */
export function RoomPage(props: { readonly slug: string }) {
  const env = useAppEnv()
  const [named, setNamed] = useState(() => env.store.profile.get() !== null)
  if (!named) {
    return (
      <JoinForm
        onJoin={(name) => {
          env.store.profile.set({ name, avatar: env.newAvatar() })
          setNamed(true)
        }}
      />
    )
  }
  return <Room slug={props.slug} />
}

function JoinForm(props: { readonly onJoin: (name: string) => void }) {
  const { t } = useLingui()
  const [name, setName] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (name.trim() !== '') props.onJoin(name.trim())
  }
  return (
    <main>
      <h1>{t`Join the room`}</h1>
      <form onSubmit={submit}>
        <label>
          {t`Your name`}
          <input
            data-testid="name-input"
            value={name}
            maxLength={32}
            autoComplete="nickname"
            required
            autoFocus
            onChange={(event) => setName(event.currentTarget.value)}
          />
        </label>
        <button type="submit" data-testid="join-room">
          {t`Take a seat`}
        </button>
      </form>
    </main>
  )
}

function Room(props: { readonly slug: string }) {
  const { t, i18n } = useLingui()
  const room = useRoom(props.slug)
  const { state } = room
  const [notice, setNotice] = useState<'offline' | 'refused' | null>(null)
  const name = state.view?.room.name
  useEffect(() => {
    document.title = name ?? props.slug
  }, [name, props.slug])

  const run = async (command: Command) => {
    const result = await room.send(command)
    setNotice(result.ok ? null : result.reason === 'offline' ? 'offline' : 'refused')
  }

  return (
    <main>
      <h1>{name ?? props.slug}</h1>
      <p role="status" data-testid="status" data-status={state.status}>
        {i18n._(STATUS[state.status])}
      </p>
      {notice === null ? null : (
        <p role="alert" data-testid="notice">
          {notice === 'offline'
            ? t`You are offline. Try again when the connection is back.`
            : t`The room did not accept that.`}
        </p>
      )}
      <Gate room={room} />
      {state.view === null ? null : <Table state={state} run={run} slug={props.slug} />}
    </main>
  )
}

/** What a status that waits for a person asks of them. */
function Gate(props: { readonly room: ReturnType<typeof useRoom> }) {
  const env = useAppEnv()
  const { t } = useLingui()
  const { state } = props.room
  const [code, setCode] = useState('')
  if (state.status === 'locked') {
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault()
          props.room.submitCode(code.trim())
        }}
      >
        <label>
          {t`Room password`}
          <input
            data-testid="code-input"
            value={code}
            autoComplete="off"
            onChange={(event) => setCode(event.currentTarget.value)}
          />
        </label>
        <button type="submit" data-testid="code-submit">
          {t`Enter room`}
        </button>
        {state.codeRefused ? (
          <p role="alert" data-testid="code-refused">
            {t`That password is not right.`}
          </p>
        ) : null}
      </form>
    )
  }
  if (state.status === 'changed-hands') {
    return (
      <button type="button" data-testid="accept-new-room" onClick={props.room.acceptNewRoom}>
        {t`Join the room at this address`}
      </button>
    )
  }
  if (state.status === 'kicked' || state.status === 'gone') {
    return (
      <button type="button" data-testid="rejoin" onClick={props.room.rejoin}>
        {t`Take a seat again`}
      </button>
    )
  }
  if (state.status === 'reload-required') {
    return (
      <button type="button" data-testid="reload" onClick={env.reload}>
        {t`Reload`}
      </button>
    )
  }
  return null
}

function Table(props: {
  readonly state: RoomClientState
  readonly run: (command: Command) => Promise<void>
  readonly slug: string
}) {
  const { view } = props.state
  if (view === null) return null
  return (
    <>
      <Invite view={view} />
      <Seats view={view} state={props.state} run={props.run} />
      <Round view={view} state={props.state} run={props.run} />
      <Topics view={view} run={props.run} />
      <MySeat view={view} run={props.run} />
      <Settings view={view} run={props.run} />
      <Access view={view} slug={props.slug} />
    </>
  )
}
