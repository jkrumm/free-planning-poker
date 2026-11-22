import { useLingui } from '@lingui/react/macro'
import { Link } from '@tanstack/react-router'

/** What an address the app has no page for shows. */
export function NotFound() {
  const { t } = useLingui()
  return (
    <main>
      <h1>{t`This page does not exist`}</h1>
      <p>
        <Link to="/room" data-testid="back-to-rooms">
          {t`Back to your rooms`}
        </Link>
      </p>
    </main>
  )
}
