export type Target = 'beta' | 'production'

/** Only the word beta names the beta build; unset or anything else is production, so a forgotten flag hides drafts. */
export function resolveTarget(value: string | undefined): Target {
  return value === 'beta' ? 'beta' : 'production'
}

/** The target of this build, from the one variable the build sets (apps/site/AGENTS.md, The draft rule). */
export const target: Target = resolveTarget(process.env.FPP_SITE_TARGET)
