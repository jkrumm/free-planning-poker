/**
 * The registry of Umami's events (docs/v9/ARCHITECTURE.md, Measurement): the names and the properties each carries.
 * A property is a boolean or one of a closed list of values, never a free string, so no vote value, display name, room
 * name, slug or access code can ride in one. An event from inside a room names its activity. Pure data; the browser
 * facade `track` sends them.
 */

/** The activities a room runs; a second one adds a value here and renames no event. */
export const ACTIVITIES = ['poker'] as const

/** The count of seats or votes in a round, as a bucket: a number would be an identifier of a small room. */
export const COUNT_BUCKETS = ['1', '2-4', '5-9', '10+'] as const

/** A property is a boolean, or an enum: the values it may take. */
export type Property = 'boolean' | readonly string[]

const ACTIVITY = ACTIVITIES

export const UMAMI = {
  landing_cta: { location: ['hero', 'header', 'footer'] },
  room_created: { activity: ACTIVITY },
  room_joined: { activity: ACTIVITY, seats: COUNT_BUCKETS },
  invite_copied: { activity: ACTIVITY },
  vote_cast: { activity: ACTIVITY },
  round_revealed: { activity: ACTIVITY, votes: COUNT_BUCKETS, consensus: 'boolean' },
  topic_decided: { activity: ACTIVITY, how: ['unanimous', 'settled'] },
  room_locked: { activity: ACTIVITY },
  summary_exported: { activity: ACTIVITY, format: ['copy', 'download'] },
  pwa_installed: {},
  embed_loaded: { host: ['jira', 'teams', 'zoom', 'meet', 'trello', 'other'] },
} as const satisfies Record<string, Record<string, Property>>

export type UmamiEvent = keyof typeof UMAMI

/** The event names as constants, so no other package writes one as a literal (`test/names.test.ts`). */
export const UMAMI_EVENT = {
  landingCta: 'landing_cta',
  roomCreated: 'room_created',
  roomJoined: 'room_joined',
  inviteCopied: 'invite_copied',
  voteCast: 'vote_cast',
  roundRevealed: 'round_revealed',
  topicDecided: 'topic_decided',
  roomLocked: 'room_locked',
  summaryExported: 'summary_exported',
  pwaInstalled: 'pwa_installed',
  embedLoaded: 'embed_loaded',
} as const satisfies Record<string, UmamiEvent>

/** The data of one event: every property it lists, with a value from its list. */
export type UmamiData<E extends UmamiEvent> = {
  readonly [K in keyof (typeof UMAMI)[E]]: (typeof UMAMI)[E][K] extends 'boolean'
    ? boolean
    : (typeof UMAMI)[E][K] extends readonly (infer V)[]
      ? V
      : never
}

/** The bucket of a count. */
export function bucketOf(count: number): (typeof COUNT_BUCKETS)[number] {
  if (count <= 1) return '1'
  if (count <= 4) return '2-4'
  if (count <= 9) return '5-9'
  return '10+'
}
