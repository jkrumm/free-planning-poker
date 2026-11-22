import { useLingui } from '@lingui/react/macro'
import { Link } from '@tanstack/react-router'
import { useEffect } from 'react'

/** What an address the app has no page for shows. */
export function NotFound() {
  const { t } = useLingui()
  const title = t`This page does not exist`
  useEffect(() => {
    document.title = title
  }, [title])
  return (
    <main>
      <h1>{title}</h1>
      <p>
        <Link to="/room" data-testid="back-to-rooms">
          {t`Back to your rooms`}
        </Link>
      </p>
    </main>
  )
}
