# Engine for the statistics pages

Research run of 2026-11-18 (`agw research`, depth standard). Run status: partial. Citations grounded against fetched pages: 8/9. A citation ties a claim to a page; it is not proof. Treat everything under "Not verified" as a lead, and re-check a version number before pinning it.

## Bottom line

- **Recommendation:** plain Postgres. Keep daily rollup tables (written by the Bun service or a scheduled Bun job) and a few materialised views for the distributions. Read them through Bun's built-in `Bun.SQL` client and cache the public stats responses at the HTTP layer. Retire the Python service at cutover. Use DuckDB once, offline, to import the existing Parquet history, not as a runtime dependency.
- **DuckDB embedded in Bun:** workable for scripts and tooling. Not the runtime I would put behind public pages: the Node Neo client's own roadmap lists unfinished areas, and the only Bun-specific claim I found is a third-party FAQ that calls Bun suitable for scripts and local tooling.
- **pg_duckdb:** not now. The latest release, v1.2.0 (3 Nov 2026), is marked Experimental by its maintainers because of unresolved serious issues.
- **ClickHouse:** the best analytics engine of the set, but it is the observability cluster. Sharing it couples product stats to the observability stack for a data volume Postgres handles easily. Keep it as the escape hatch if volume grows by orders of magnitude.
- **Python FastAPI:** keep only until cutover. It is the one extra runtime the rewrite removes.

## Sizing (arithmetic, not a benchmark)

A few million rows at roughly 100 bytes each is a few hundred MB of raw events. Daily rollups per room, per vote-value and per page are orders of magnitude smaller. At this size, the chart latency problem is solved by precomputing the aggregates, not by changing engines. I did not benchmark Postgres or DuckDB against this workload, so treat any latency claim here as an estimate until measured.

## Options compared

| Option | State in Nov 2026 (verified) | Verdict |
|---|---|---|
| Postgres rollups and materialised views | PostgreSQL 18.7 was released 12 Nov 2026, with 19 RC 2 out. `REFRESH MATERIALIZED VIEW CONCURRENTLY` avoids blocking readers, but needs a unique index covering all rows and a populated view. Only one refresh can run per view at a time. | **Recommended** |
| DuckDB embedded in Bun (`@duckdb/node-api`) | Latest stable is 2.0.0, the DuckDB 2.0 LTS line. The npm `latest` tag shows `2.0.0-r.1`. The old `duckdb` npm package is deprecated and has no 1.5 release. | Possible for ETL and scripts; not the public serving path |
| pg_duckdb | v1.2.0, released 3 Nov 2026 (changelog dates it 2 Nov). It bundles DuckDB v2.0.0 and is MIT-licensed, built with Hydra and MotherDuck. The release says it is 'Experimental … not ready for production use because there is a number of user-reported serious issues that are still unresolved'. | Not now |
| ClickHouse | Latest release v26.8.40.7-lts, published 18 Nov 2026. It already runs for observability. | Escape hatch, not the product's store |
| Keep Python FastAPI | Works today. Adds a second language, runtime, container and deploy path to a Bun monorepo. | Retire at cutover |

### Postgres rollups and materialised views

- Store raw events in one table, partitioned by month if you expect long retention. Partitioning is hard to add later.
- Keep one daily rollup table per chart family: estimations by value, votes by room size, room counts and page views. Each row is a small aggregate keyed by day and dimension.
- Use materialised views for the distributions (for example the vote histogram across rooms). Give each a unique index so `CONCURRENTLY` refreshes are possible.
- Refresh incrementally from a scheduled Bun job, or on write for small tables. The concurrency rule above means one refresh at a time per view.
- Bun's built-in client is `Bun.SQL`, which defaults to PostgreSQL when `DATABASE_URL` is a Postgres URL. It exposes pool settings (`max`, `idleTimeout`, `maxLifetime`, `connectionTimeout`) and tagged-template queries, so no ORM is needed for the stats endpoints. Source: https://github.com/oven-sh/bun/blob/main/docs/runtime/sql.mdx

### DuckDB in Bun

- The DuckDB Node.js (Neo) client, `@duckdb/node-api`, is the current package. The official docs say the latest stable version is 2.0.0 and list these unfinished areas: binding and appending MAP and UNION types, default values row by row, user-defined types and functions, profiling, table description, and Arrow APIs. The documented platforms are linux amd64 and arm64 (glibc and musl), macOS arm64 and x64, and Windows amd64 and arm64. Bun is not on that list. Source: https://duckdb.org/docs/2.0/clients/node_neo/overview
- The older `duckdb` package is deprecated and gets no DuckDB 1.5 release. Source: https://duckdb.org/docs/lts/clients/nodejs/overview
- A third-party FAQ says Bun 'loads `@duckdb/node-api`, and suits scripts and local tooling', and points to Node.js for production services. That is secondary and I did not confirm it against the DuckDB project. Source: https://leonardovida.github.io/drizzle-duckdb/reference/faq.html
- Use DuckDB for the one-off import of the Parquet history into Postgres. A migration script is a good fit for it; a serving path is not.

### pg_duckdb

- It adds DuckDB execution inside Postgres via `duckdb.force_execution`. It also reads Parquet, CSV and similar files from object storage. Source: https://github.com/duckdb/pg_duckdb
- The maintainers' own warning on v1.2.0 rules it out for production now. A managed or self-built Postgres image with an experimental extension also adds an upgrade and backup risk. Source: https://github.com/duckdb/pg_duckdb/releases
- Revisit when a non-experimental release exists.

### ClickHouse

- Columnar, fast for aggregates, and already operated. The cost is coupling: a product outage and an observability outage share a box, and product data would sit in a store built for telemetry, with separate backups and upgrades. Choose it only if raw event volume grows far beyond a few million rows or the analytics need ad-hoc queries across many dimensions.
- Upgrade cadence matters. The current build is an LTS release (26.8), which fits a long-lived dependency. Source: https://github.com/ClickHouse/ClickHouse/releases/tag/v26.8.40.7-lts

### Keep the Python service

- It serves the same charts today, but keeps a second runtime and a second cron-driven Parquet refresh. The rewrite removes both. Keep it only until the Postgres rollups match its output.

## Main tradeoffs

1. **Rollups versus raw queries.** Rollups make charts fast but fix the dimensions up front. A new chart needs either a new rollup or a slow query on raw events. Accept this for a public stats page with a known set of charts.
2. **Distributions.** A rollup cannot give an exact distribution unless the buckets were defined in advance. Store histograms with fixed buckets, not just averages.
3. **Freshness.** Scheduled rollups are slightly stale. For historical charts this is usually fine. Say so on the page.
4. **One database.** Postgres serves both the live app data and the stats. Keep the stats reads off the hot WebSocket path, for example by reading replicas or a cache, if they ever compete.

## Must decide now (cannot be retrofitted cheaply)

- **Event schema and privacy.** Decide whether raw events store the anonymous client id at all. A privacy-first product should hash or drop it at write time and keep only aggregates long term. Changing this later means either losing history or leaking ids that were already stored.
- **Retention.** Set how long raw events live, and whether rollups outlive them. Retention rules are easy to set now and hard to apply to already-mixed data.
- **Bucket and time definitions.** Fix the histogram bucket edges, the day boundary (UTC is simplest) and the value encoding for votes. Changing them later breaks the historical series.
- **Partitioning.** Partition the raw events table by month from day one if retention is long.
- **Stats API contract.** Define the public endpoints and their cache headers now, so the Python service can be swapped without changing what the statistics pages receive.

## What stayed open

- No benchmark of Postgres rollups or DuckDB against this data. The sizing above is arithmetic.
- Whether `@duckdb/node-api` loads and runs under Bun on Linux and macOS. I did not test it, and the official platform list does not include Bun.
- The npm `latest` tag `2.0.0-r.1` and the DuckDB docs' 2.0.0 disagree on the version label. I read the docs' 2.0.0 as the stable line, but the label mismatch is unresolved.
- The licence of ClickHouse and PostgreSQL was not checked in a source I read.
- The specific unresolved issues behind the pg_duckdb 'Experimental' label were not listed in what I read.

## Not verified in this run

- Postgres rollups vs DuckDB vs ClickHouse query latency on a few million rows: No benchmark run; sizing is arithmetic only.
- @duckdb/node-api running under Bun on Linux and macOS: Official platform list does not name Bun; not tested in this session.
- Version label mismatch for @duckdb/node-api (npm latest 2.0.0-r.1 vs docs 2.0.0): Registry tag and docs disagree; not resolved against the release page.
- Licences of ClickHouse and PostgreSQL: Not read in a source during this session.
- Specific unresolved issues behind the pg_duckdb Experimental label: The release page names no specific issues; the issue tracker was not read (budget reached).
- Bun.SQL defaults to PostgreSQL when DATABASE_URL is a Postgres URL, and exposes pool options max, idleTimeout, maxLifetime and connectionTimeout with tagged-template queries.: cited, but the page was never retrieved this run

## Sources

- https://github.com/duckdb/pg_duckdb/releases
- https://duckdb.org/docs/2.0/clients/node_neo/overview
- https://www.postgresql.org/docs/current/sql-refreshmaterializedview.html
- https://leonardovida.github.io/drizzle-duckdb/reference/faq.html
- https://github.com/duckdb/pg_duckdb
- https://duckdb.org/docs/lts/clients/nodejs/overview
- https://www.npmjs.com/package/@duckdb/node-api
- https://github.com/ClickHouse/ClickHouse/releases/tag/v26.8.40.7-lts
- https://github.com/duckdb/pg_duckdb/releases/tag/v1.2.0
- https://context7.com/duckdb/duckdb-node-neo
- https://duckdb.org/docs/current/clients/node_neo/overview
- https://context7.com/oven-sh/bun
