/** The production adapters of the runtime's id and secret ports. */
import type { IdSource, Secrets } from '@fpp/room-core/server'

export const systemIds: IdSource = {
  newId: () => Bun.randomUUIDv7(),
  bytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
}

export const systemSecrets: Secrets = {
  hash: (token) => new Bun.CryptoHasher('sha256').update(token).digest('hex'),
}
