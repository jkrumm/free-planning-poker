/**
 * Every duration and easing of this entry, in one file. The timings are basalt-ui's motion tokens; the stylesheet
 * reads them as custom properties from `motionVars`. Under reduced motion the table turns every transition and
 * animation off, so the end state shows at once.
 */
const TIMING = {
  flip: { duration: 'var(--basalt-dur-slow)', easing: 'var(--basalt-ease-enter)' },
  gather: { duration: 'var(--basalt-dur-slow)', easing: 'var(--basalt-ease)' },
  bar: { duration: 'var(--basalt-dur-base)', easing: 'var(--basalt-ease-enter)' },
  rise: { duration: 'var(--basalt-dur-slow)', easing: 'var(--basalt-ease-exit)' },
  lift: { duration: 'var(--basalt-dur-fast)', easing: 'var(--basalt-ease)' },
} as const

/**
 * The delay between two cards turning, in ms: at most 40, and short enough that every card has turned within
 * 600 ms, so 30 seats finish the reveal, the gather and the bars inside 1.6 s.
 */
const stagger = (seats: number): number => Math.min(40, Math.round(600 / Math.max(1, seats)))

export function motionVars(seats: number): Record<string, string> {
  const vars: Record<string, string> = {
    '--seats': String(seats),
    '--stagger': `${stagger(seats)}ms`,
    '--turned': `calc((var(--seats) - 1) * var(--stagger) + ${TIMING.flip.duration})`,
  }
  for (const [name, timing] of Object.entries(TIMING)) {
    vars[`--${name}-duration`] = timing.duration
    vars[`--${name}-easing`] = timing.easing
  }
  return vars
}
