import { env } from 'fpp/env';

import { type Db, createClient } from '@fpp/db/client';

// Cache the connection in development to avoid HMR recreating pools on every reload.
const globalForDb = globalThis as unknown as {
  db: Db | undefined;
};

const db = globalForDb.db ?? createClient(env.DATABASE_URL);
if (env.NEXT_PUBLIC_NODE_ENV !== 'production') globalForDb.db = db;

export default db;
