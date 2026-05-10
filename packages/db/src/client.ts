import { drizzle } from 'drizzle-orm/mysql2';
import { createPool } from 'mysql2/promise';
import * as schema from './schema';

export type Db = ReturnType<typeof createClient>;

export function createClient(url: string) {
  const pool = createPool({ uri: url });
  return drizzle(pool, { schema, mode: 'default' });
}
