import type { Command, Topic, View } from '@fpp/room-core/types'
import { parseTopicLines } from '@fpp/room-core/view'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { useState } from 'react'

const STATE = {
  queued: msg`queued`,
  active: msg`being estimated`,
  done: msg`done`,
  skipped: msg`skipped`,
} as const

/** The topic queue: paste a list to add, rename, move, remove, and pick what is estimated next. */
export function Topics(props: {
  readonly view: View
  readonly run: (command: Command) => Promise<void>
}) {
  const { t } = useLingui()
  const { view, run } = props
  const [paste, setPaste] = useState('')
  const round = view.activity.current
  const last = view.topics.length - 1

  return (
    <section aria-labelledby="topics-heading" data-testid="topic-queue">
      <h2 id="topics-heading">{t`Topics`}</h2>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          const topics = parseTopicLines(paste)
          if (topics.length === 0) return
          void run({ type: 'topic.add', payload: { topics } })
          setPaste('')
        }}
      >
        <label>
          {t`Paste topics, one per line`}
          <textarea
            data-testid="topic-paste"
            value={paste}
            rows={3}
            onChange={(event) => setPaste(event.currentTarget.value)}
          />
        </label>
        <button type="submit" data-testid="topic-add">
          {t`Add topics`}
        </button>
      </form>
      <ol>
        {view.topics.map((topic, index) => (
          <TopicRow
            key={topic.id}
            topic={topic}
            first={index === 0}
            last={index === last}
            index={index}
            round={round}
            run={run}
          />
        ))}
      </ol>
    </section>
  )
}

function TopicRow(props: {
  readonly topic: Topic
  readonly index: number
  readonly first: boolean
  readonly last: boolean
  readonly round: string
  readonly run: (command: Command) => Promise<void>
}) {
  const { t, i18n } = useLingui()
  const { topic, run } = props
  const [title, setTitle] = useState(topic.title ?? '')
  return (
    <li data-testid="topic" data-state={topic.state} data-topic={topic.id}>
      <span data-testid="topic-name">{topic.title ?? t`Untitled topic`}</span>{' '}
      <span data-testid="topic-state">{i18n._(STATE[topic.state])}</span>
      {topic.final === null ? null : (
        <>
          {' '}
          <span data-testid="topic-final" data-card={topic.final.label}>
            {topic.final.label}
          </span>
        </>
      )}
      <div>
        <label>
          {t`Title`}
          <input
            data-testid="topic-title"
            value={title}
            maxLength={200}
            onChange={(event) => setTitle(event.currentTarget.value)}
          />
        </label>
        <button
          type="button"
          data-testid="topic-rename"
          onClick={() =>
            void run({
              type: 'topic.update',
              payload: {
                topic: topic.id,
                title: title.trim() === '' ? null : title.trim(),
                url: topic.url,
                ref: topic.ref,
              },
            })
          }
        >
          {t`Rename`}
        </button>
        <button
          type="button"
          data-testid="topic-up"
          disabled={props.first}
          onClick={() =>
            void run({ type: 'topic.move', payload: { topic: topic.id, index: props.index - 1 } })
          }
        >
          {t`Move up`}
        </button>
        <button
          type="button"
          data-testid="topic-down"
          disabled={props.last}
          onClick={() =>
            void run({ type: 'topic.move', payload: { topic: topic.id, index: props.index + 1 } })
          }
        >
          {t`Move down`}
        </button>
        {topic.state === 'queued' ? (
          <button
            type="button"
            data-testid="topic-activate"
            onClick={() =>
              void run({ type: 'topic.next', payload: { round: props.round, to: topic.id } })
            }
          >
            {t`Estimate this next`}
          </button>
        ) : null}
        <button
          type="button"
          data-testid="topic-remove"
          onClick={() => void run({ type: 'topic.remove', payload: { topic: topic.id } })}
        >
          {t`Remove topic`}
        </button>
      </div>
    </li>
  )
}
