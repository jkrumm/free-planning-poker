import { LANGUAGES, type Language } from '@fpp/i18n'
import { useLingui } from '@lingui/react/macro'

export function LanguageSwitch(props: {
  readonly language: Language
  readonly onChange: (language: Language) => void
}) {
  const { t } = useLingui()
  return (
    <label>
      {t`Language`}
      <select
        data-testid="language"
        value={props.language}
        onChange={(event) => props.onChange(event.currentTarget.value as Language)}
      >
        {LANGUAGES.map((language) => (
          <option key={language.code} value={language.code}>
            {language.name}
          </option>
        ))}
      </select>
    </label>
  )
}
