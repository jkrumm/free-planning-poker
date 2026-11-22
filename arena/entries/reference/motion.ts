/**
 * Every duration and easing of this entry, in one file. They are basalt-ui's motion tokens, which are zero under
 * reduced motion; the entry also drops the animation itself when the person asks for reduced motion.
 */
export const MOTION = {
  /** A card turning face up. */
  flip: { duration: 'var(--basalt-dur-base)', easing: 'var(--basalt-ease-enter)' },
  /** Between two cards turning; scaled down for a large room so 30 seats finish as fast as 6. */
  stagger: (seats: number) => `${Math.round(Math.min(40, 240 / Math.max(1, seats)))}ms`,
} as const
