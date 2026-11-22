// Every figure the page /privacy states, with where it comes from. A fact backed by a constant names the constant, and
// privacy-facts.test.ts reads that constant; a fact backed by a document keeps a quote that test finds in the document,
// so a change on either side fails a check instead of leaving the page wrong.

const holds = 'apps/api/src/db/holds.ts'
const architecture = 'docs/v9/ARCHITECTURE.md'

export type PrivacyFact = {
  /** The words the page prints. */
  words: string
  /** Where the figure is defined, as a path from the repository root. */
  file: string
  /** The name of the exported constant, when a constant holds the figure. */
  constant?: string
  /** What the constant holds, as the file spells it. */
  literal?: string
  /** A sentence of the document that states the figure, copied exactly. */
  quote?: string
  /** The section of the document, for the table in the pull request. */
  section?: string
}

export const privacyFacts = {
  numberHold: {
    words: 'three months',
    file: holds,
    constant: 'NUMBER_HOLD',
    literal: '3 months',
    section: 'ARCHITECTURE.md, Room model',
  },
  nameHold: {
    words: 'six months',
    file: holds,
    constant: 'NAME_HOLD',
    literal: '6 months',
    section: 'ARCHITECTURE.md, Room model',
  },
  snapshotTtl: {
    words: 'six hours',
    file: holds,
    constant: 'SNAPSHOT_TTL_MS',
    literal: '6 * 60 * 60 * 1000',
    section: 'ARCHITECTURE.md, Server (Expiry)',
  },
  visitorRetention: {
    words: '13 months',
    file: holds,
    constant: 'VISITOR_DAY_RETENTION',
    literal: '13 months',
    section: 'ARCHITECTURE.md, Data model (visitor_day)',
  },
  recentDropped: {
    words: 'six months',
    file: architecture,
    quote: 'an unpinned one dropped after six months without a visit',
    section: 'Client (storage keys)',
  },
  umamiSession: {
    words: 'monthly',
    file: architecture,
    quote: 'Umami keeps its session that rotates monthly',
    section: 'Measurement (Umami)',
  },
  errorSession: {
    words: 'one page load',
    file: architecture,
    quote: 'a session id that lives in memory for one page load',
    section: 'Measurement (browser telemetry)',
  },
  accessAttempts: {
    words: 'ten wrong attempts within a minute on one room, or five from one IP address',
    file: architecture,
    quote:
      'After ten wrong attempts within a minute on one room, or five from one IP address, further attempts are refused for a minute.',
    section: 'Room model (access)',
  },
} as const satisfies Record<string, PrivacyFact>
