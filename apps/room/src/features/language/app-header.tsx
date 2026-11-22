import type { Language } from '@fpp/i18n'
import { useLingui } from '@lingui/react/macro'
import { Link } from '@tanstack/react-router'
import { useAppEnv } from '../../app-env.tsx'
import { LanguageSwitch } from './language-switch.tsx'

/** The one header of every page: the way home and the language, switched in place and remembered. */
export function AppHeader() {
  const env = useAppEnv()
  const { t, i18n } = useLingui()
  const change = (language: Language) => {
    env.store.prefs.set({ ...env.store.prefs.get(), language })
    void env.activate(language)
  }
  return (
    <header>
      <nav aria-label={t`Main`}>
        <Link to="/room" data-testid="home">
          {t`Free Planning Poker`}
        </Link>
      </nav>
      <LanguageSwitch language={i18n.locale as Language} onChange={change} />
    </header>
  )
}
