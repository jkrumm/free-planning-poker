# stats-rollups: the rollups and GET /api/stats

Row `v9-stats-rollups`, 2026-11-22. What the row left open, as decided. Contract: `docs/v9/ARCHITECTURE.md`, sections Data model and HTTP API.

## Metrics

Every metric is named in `apps/api/src/db/stat-metrics.ts` with its dimension and unit. The day is the UTC date; a value is a whole number in a double; a metric with several dimension values is sparse (no count, no row).

| Metric | Dimension | Unit | Counts |
|-|-|-|-|
| `rounds` | none | rounds | rounds revealed on the day; also the marker of a rolled day, written as 0 where none |
| `votes` | none | votes | votes in those rounds, special cards included |
| `rounds_consensus` | none | rounds | rounds in which every voter played the same estimate |
| `rounds_by_hour` | UTC hour, `00` to `23` | rounds | rounds revealed in `[hh:00, hh+1:00)`; the weekday comes from the day |
| `rooms_created` | none | rooms | rooms v9 created that day (`origin = 'v9'`) |
| `rooms_active` | none | rooms | distinct rooms with a round that day |
| `estimators` | none | devices | `visitor_day` rows of the day |
| `estimators_new` | none | devices | of those, devices with no earlier `visitor_day` row (13 months of memory) |
| `card_votes` | `<deck>/<label>` | votes | votes per card from the stored distributions; a custom deck is `custom/`, no label |
| `page_views`, `events` | route, event name | views, events | reserved for v9-importer's v1 rows; the job never writes or replaces them |

## Decisions

- **Day boundary and buckets.** A round belongs to the UTC day of `revealed_at`, an hour is half open. Changing either breaks the series, so it would be a new metric name.
- **Replace, not upsert.** A day's rows of the job's metrics are deleted and written again in one transaction; a dimension that is gone disappears. Rows of other owners stay.
- **Which days run.** A tick starts at the latest day with a `rounds` row (else the first day any source holds, else today) and rolls every day up to today. In steady state that is today every hour and yesterday once, on the first tick after midnight. After a stop it catches up. Days the importer filled are older than that start and stay as they are.
- **One runner.** Each day's transaction first takes `pg_try_advisory_xact_lock(1718775904, 1)`; a process that cannot returns at once and rolls nothing until its next tick. The lock lives and dies with the transaction, so a killed container releases it.
- **Indexes.** The migration adds `round(revealed_at)`, `room(created_at)` and `visitor_day(visitor, day)`: a day's rollup is a range scan, and "new estimator" is an index probe per device.
- **Custom decks.** Their labels are typed by people and the page is public, so only `custom/` (the votes) is rolled up.
- **Week over week.** Monday to Friday in UTC, the current week up to today against the previous week over as many days; from Saturday on all five. No public holidays. Today is the hourly rollup's, so on a Wednesday the current side is a little behind the previous side's finished day; the figure's `workingDays` and spans are in the answer so the page can say so.
- **Tables open right now** is the rooms the answering process runs (`runtime.stats().rooms`). One owner per room (invariant 12) means no room is counted twice across two containers; a room still on the old container is missed until it moves, and the old container answers 503 on health.
- **Cache.** In the process for 60 s (calls that arrive together share one read), `Cache-Control: public, max-age=60, stale-while-revalidate=300` on a 200, `no-store` on a 503. The rollups change hourly and the tables number is the only live part, so a minute costs nothing visible. While Postgres is away the last answer is served as it was.
- **Finding, not fixed here.** Drizzle's jsonb columns on Bun's driver store what they are given as a JSON string (`jsonb_typeof` is `string`): `round.deck` and `round.distribution` in production rows are double encoded. They read back correctly through Drizzle, so nothing broke; the rollup reads them through `unwrapped()`, which accepts both shapes.

## Measured

Answer time over 365 days of seeded rollups (28,835 rows: seven scalars, 24 hours and 48 cards a day), through `createApp` and `postgresStats` on a private Postgres 18 on the mini: see the pull request.
