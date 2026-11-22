import { useLingui } from '@lingui/react/macro'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useAppEnv } from '../../app-env.tsx'

/** `/room/new`: creates a room and replaces its own address with the room's, so Back does not create another. */
export function NewRoomPage() {
  const env = useAppEnv()
  const { t } = useLingui()
  const navigate = useNavigate()
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const started = useRef(-1)
  const title = t`Creating your room…`
  useEffect(() => {
    document.title = title
  }, [title])

  useEffect(() => {
    // One request per attempt, whatever the development double mount does.
    if (started.current === attempt) return
    started.current = attempt
    void (async () => {
      try {
        const response = await env.fetch(`${env.origin}/api/rooms`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        })
        const body = (await response.json()) as { slug?: unknown }
        if (response.status !== 201 || typeof body.slug !== 'string') throw new Error('no room')
        void navigate({ to: '/room/$slug', params: { slug: body.slug }, replace: true })
      } catch {
        setFailed(true)
      }
    })()
  }, [attempt, env, navigate])

  return (
    <main>
      {failed ? (
        <>
          <p role="alert" data-testid="new-failed">
            {t`The room could not be created. Check your connection and try again.`}
          </p>
          <button
            type="button"
            data-testid="new-retry"
            onClick={() => {
              setFailed(false)
              setAttempt((current) => current + 1)
            }}
          >
            {t`Try again`}
          </button>
        </>
      ) : (
        <p role="status" data-testid="new-creating">
          {t`Creating your room…`}
        </p>
      )}
    </main>
  )
}
