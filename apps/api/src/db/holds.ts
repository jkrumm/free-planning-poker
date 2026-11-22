/** How long an address stays held after the room's last visit, and the other periods of the namespace (Room model). */
export const NUMBER_HOLD = '3 months'
export const NAME_HOLD = '6 months'
/** How long the address a name replaces keeps leading to the room. */
export const REPLACED_ADDRESS_GRACE = '30 days'
/** A hold is pushed forward at most once per this period. */
export const HOLD_RENEWAL_STEP = '1 day'

/** A new room's number has this many digits (900,000 numbers at six). */
export const NUMBER_DIGITS = 6
/** Numbers drawn at once for a new room, and the draws before `POST /api/rooms` gives up with 503. */
export const NUMBER_CANDIDATES = 8
export const NUMBER_DRAWS = 3

/** A live snapshot expires this long after the room's last event (v1's rule). */
export const SNAPSHOT_TTL_MS = 6 * 60 * 60 * 1000

/** Estimating days older than this are deleted: the one scheduled deletion of the schema. */
export const VISITOR_DAY_RETENTION = '13 months'
