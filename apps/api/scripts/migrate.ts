// `bun run db:migrate`: applies the migrations of apps/api/drizzle to the database in DATABASE_URL, on the same
// driver the API uses. drizzle-kit's own migrate command would need a second Postgres driver package.
import { createDb, runMigrations } from '../src/db/client.ts'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set (apps/api/.env.tpl has the local value)')

const client = createDb({ url, max: 1 })
try {
  await runMigrations(client.db, new URL('../drizzle', import.meta.url).pathname)
  console.log('migrations applied')
} finally {
  await client.close()
}
