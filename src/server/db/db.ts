import { env } from 'fpp/env';

import { drizzle } from 'drizzle-orm/mysql2';
import { type Pool, createPool } from 'mysql2/promise';

import * as schema from './schema';

/**
 * Cache the database connection in development. This avoids creating a new connection on every HMR
 * update.
 */
const globalForDb = globalThis as unknown as {
  conn: Pool | undefined;
};

const conn = globalForDb.conn ?? createPool({ uri: env.DATABASE_URL });
if (env.NEXT_PUBLIC_NODE_ENV !== 'production') globalForDb.conn = conn;

export default drizzle(conn, { schema, mode: 'default' });
