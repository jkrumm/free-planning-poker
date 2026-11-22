import type { View } from '@fpp/room-core/types'
import { useLingui } from '@lingui/react/macro'
import { useAppEnv } from '../../app-env.tsx'

/** The invite link, with the password in its fragment for a locked room, and the password beside it to read out. */
export function Invite(props: { readonly view: View }) {
  const env = useAppEnv()
  const { t } = useLingui()
  const { slug, code } = props.view.room
  const fragment = code === null ? '' : `#${encodeURIComponent(code)}`
  return (
    <section aria-labelledby="invite-heading">
      <h2 id="invite-heading">{t`Invite`}</h2>
      <label>
        {t`Invite link`}
        <input
          data-testid="invite-link"
          readOnly
          value={`${env.origin}/room/${slug}${fragment}`}
          onFocus={(event) => event.currentTarget.select()}
        />
      </label>
      {code === null ? null : (
        <p>
          {t`Password`} <output data-testid="access-code">{code}</output>
        </p>
      )}
    </section>
  )
}
