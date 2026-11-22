import {
  BUILT_IN_DECK_IDS,
  DECKS,
  type Command,
  type TimerSeconds,
  type View,
} from '@fpp/room-core/types'
import { msg, plural } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { useState } from 'react'

const DECK_NAMES = {
  fibonacci: msg`Fibonacci`,
  'modified-fibonacci': msg`Modified Fibonacci`,
  't-shirt': msg`T-shirt sizes`,
  'powers-of-two': msg`Powers of two`,
  custom: msg`Custom`,
} as const

const TIMERS: readonly TimerSeconds[] = [0, 30, 60, 120]
const COUNTDOWNS = [0, 1, 3, 5, 10] as const

/** The room's settings: deck, auto reveal and its countdown, the round timer, the room's title. */
export function Settings(props: {
  readonly view: View
  readonly run: (command: Command) => Promise<void>
}) {
  const { t, i18n } = useLingui()
  const { settings } = props.view.room
  const [title, setTitle] = useState(props.view.room.name)
  const set = (payload: Extract<Command, { type: 'room.setSettings' }>['payload']) =>
    void props.run({ type: 'room.setSettings', payload })
  const countdowns = COUNTDOWNS.includes(settings.revealCountdown as 0)
    ? COUNTDOWNS
    : [...COUNTDOWNS, settings.revealCountdown]

  return (
    <section aria-labelledby="settings-heading">
      <h2 id="settings-heading">{t`Settings`}</h2>
      <label>
        {t`Deck`}
        <select
          data-testid="setting-deck"
          value={settings.deck.id}
          onChange={(event) => {
            const id = event.currentTarget.value
            const deck = BUILT_IN_DECK_IDS.find((candidate) => candidate === id)
            if (deck !== undefined) set({ deck: DECKS[deck] })
          }}
        >
          {settings.deck.id === 'custom' ? (
            <option value="custom">{i18n._(DECK_NAMES.custom)}</option>
          ) : null}
          {BUILT_IN_DECK_IDS.map((id) => (
            <option key={id} value={id}>
              {i18n._(DECK_NAMES[id])}
            </option>
          ))}
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          data-testid="auto-reveal"
          checked={settings.autoReveal}
          onChange={(event) => set({ autoReveal: event.currentTarget.checked })}
        />
        {t`Reveal automatically when everyone has voted`}
      </label>
      <label>
        {t`Wait before an automatic reveal`}
        <select
          data-testid="setting-countdown"
          value={settings.revealCountdown}
          onChange={(event) => set({ revealCountdown: Number(event.currentTarget.value) })}
        >
          {countdowns.map((seconds) => (
            <option key={seconds} value={seconds}>
              {plural(seconds, { one: '# second', other: '# seconds' })}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t`Round timer`}
        <select
          data-testid="setting-timer"
          value={settings.timer}
          onChange={(event) => set({ timer: Number(event.currentTarget.value) as TimerSeconds })}
        >
          {TIMERS.map((seconds) => (
            <option key={seconds} value={seconds}>
              {seconds === 0 ? t`Off` : plural(seconds, { one: '# second', other: '# seconds' })}
            </option>
          ))}
        </select>
      </label>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (title.trim() !== '')
            void props.run({ type: 'room.setTitle', payload: { name: title.trim() } })
        }}
      >
        <label>
          {t`Room title`}
          <input
            data-testid="room-title"
            value={title}
            maxLength={60}
            onChange={(event) => setTitle(event.currentTarget.value)}
          />
        </label>
        <button type="submit" data-testid="room-title-save">
          {t`Save title`}
        </button>
      </form>
    </section>
  )
}
