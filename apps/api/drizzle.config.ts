import { defineConfig } from 'drizzle-kit'

// Used by `generate` and `check`, which need no database. `bun run db:migrate` is scripts/migrate.ts.
// drizzle-kit loads the config as a default export.
// oxlint-disable-next-line import/no-default-export
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  schemaFilter: ['fpp'],
  migrations: { schema: 'fpp', table: '__drizzle_migrations' },
})
