/**
 * The production adapters of the runtime's id, secret and telemetry ports. Telemetry stops at the port in this row: a
 * failure is written to stderr, without anything the room holds (invariant 11).
 */
import type { IdSource, RuntimeTelemetry, Secrets } from '@fpp/room-core/server'

export const systemIds: IdSource = {
  newId: () => Bun.randomUUIDv7(),
  bytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
}

export const systemSecrets: Secrets = {
  hash: (token) => new Bun.CryptoHasher('sha256').update(token).digest('hex'),
}

export const consoleTelemetry: RuntimeTelemetry = {
  failure: (error, { action }) => {
    console.error(`room runtime failure at ${action}`, error)
  },
  closed: () => {},
}
