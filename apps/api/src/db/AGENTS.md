# apps/api/src/db

The Postgres schema `fpp` and its repositories: plain functions that take a `db` (a `Db` or a transaction, type `Executor`) and an explicit `now`, so a test needs no sleep. `v9-api-persistence` wraps them in Effect; nothing here imports Effect, Elysia or the environment.

- **Schema change:** edit `schema.ts`, then `bun run --filter @fpp/api db:generate`. `migrations.test.ts` (check-fast) fails on drift. Two lines of `0000_init.sql` are hand edits because drizzle cannot express them: `CREATE UNLOGGED TABLE room_snapshot` and `CREATE SCHEMA IF NOT EXISTS` (the migrator creates `fpp` for its journal first). A later migration is generated untouched.
- **Statements with `ON CONFLICT` are raw SQL** (`addresses.ts`, `rooms.ts`, `topics.ts`): the claim, the book and the snapshot write each decide in one statement, which is what the concurrency tests prove. Keep each one statement.
- **bun-sql returns a raw result as the row array, a bigint as a string and jsonb as text unless the column is selected through Drizzle.** Convert with `Number()` and `::text` plus `JSON.parse`, as `rooms.ts` does; pass an object, never `JSON.stringify(...)`, to a `::jsonb` parameter (a string is stored as a JSON string).
- **A write is fenced by epoch and owner** (invariant 12): a snapshot written by a process whose claim another process has since replaced changes no row and returns `lost`. An expired snapshot is not restored, but its epoch is never reset.
- **No statement deletes a room, a round or a vote**; `store.server.test.ts` reads these sources for it. The scheduled deletions are expired snapshots and `visitor_day` rows older than 13 months.
- Hold periods and the snapshot lifetime are the constants of `holds.ts`. Use nothing newer than PostgreSQL 16.
