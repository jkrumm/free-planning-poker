# importer: the one-time import of v1, and its rehearsal on a real dump

Row `v9-importer`, 2026-11-22. What the row left open, as decided, and the rehearsal on a production dump. Contract: `docs/v9/ARCHITECTURE.md`, sections Data model (What comes over from v1) and Cutover. Code: `apps/api/src/jobs/import-v1` (its `AGENTS.md` says how to run it).

## Decisions

- **The importer reads the dump, not a MariaDB.** Cutover step 2 runs it against a dump, and reading the dump file needs no MariaDB in CI or on the factory's remote step host, which has PostgreSQL only. The reader (`dump.ts`) splits a `mariadb-dump` stream into statements, maps each `INSERT` by its table's `CREATE TABLE` column order, and refuses a dump not written in UTC. `fpp_users` and `fpp_feature_flags` are never read. A scratch MariaDB (`make v1-mariadb`, one shot, in a test slot) restores the same dump to count v1 itself, which checks the reader.
- **The key that makes a second apply change nothing.** `room.id` is v1's room id, and the identity moves past the highest id afterwards. Topic and round ids are UUID v7 with the reveal time as their timestamp and the rest from SHA-256 of the v1 vote id. Rooms, addresses, topics, rounds and `visitor_day` are inserted with `ON CONFLICT DO NOTHING`; `stat_daily` is an upsert that writes only a value that differs.
- **Names.** v1 lowercased and trimmed `/room/<x>` and stored any 2 to 15 characters, and its numbers were whatever integer a link typed. The mapping, one function for the importer and later the room shell (`parseV1Address` in `@fpp/room-core/types`): a name equal to the room's number is no name; an address valid in v9 is itself; otherwise NFKD, combining marks dropped, every run outside a-z and 0-9 one hyphen, hyphens at the ends trimmed, and the rest must pass the name rule. A name of six or eight digits is what v9 reads as a number, so it stays a second number address of its room unless it is another room's number. On a collision a name v1 held exactly wins, then the room used last, then the lower id. Production needed none of the mapping: all 334 of its names are valid v9 names as they are.
- **What cannot be carried** is listed by v1 id and reason, never by name. A room always comes over with its rounds; only an address is skipped. 32 numbers that are not six digits and 9 digit names of other lengths lead nowhere in v9, because `/room/<slug>` takes six or eight digits only.
- **Rounds.** One untitled topic in state `done` per `fpp_votes` row, at the position of its round number; numbered per room by reveal time. Players are v1's amount of estimations. A reveal with no estimate keeps `summary` null, because v1 stored 21 and 1 as its bounds; production has none.
- **stat_daily.** For every day from v1's first to its last, every job metric (zeros included) from v1's own counting, which is how v1's analytics counted: a votes row is a round, its amount of estimations its votes, lowest equal to highest a consensus. `card_votes` and `estimators` come from `fpp_estimations` (a vote is a non-spectator estimation with a value). `estimators_new` counts a user's first v1 day ever, further back than the job's 13 months. Estimations whose value is no card of v1's deck (13 in production: -1000 and 1000, sent by hand to v1's socket) count as votes and never as a card, so the public page cannot show them.
- **The rollup job and v1's rounds.** `computeDay` now adds an imported round's `summary.count` to `votes`, so the day the job rolls again keeps v1's votes. On that one day (the latest with a `rounds` row, at the cutover the day of the switch) v1's card votes and v1's rooms created are rolled away, because the job reads them from no table. The cutover should run the import after v1's last write and expect that day's two figures to drop by what v1 did that morning.
- **visitor_day.** The days inside the 13 months the sweep keeps (`VISITOR_DAY_RETENTION`, counted back from the run's `now` in SQL as the sweep counts), each hashed by `hashVisitor` under the API's `VISITOR_KEY` and written by `recordEstimatingDays`, the batch form of `recordEstimatingDay`. The cutover runs with production's key, or a returning browser lands on other rows.
- **Refusal.** A target with rooms of another origin than v1 is refused (exit 2) unless `ALLOW_OTHER_ORIGINS=1`. Then a v1 id held by a v9 room and an address held by another room are skips, and the importer's daily rows overwrite the job's on the days both cover.

## Rehearsal

On the development host, 2026-11-22. The dump came the way `vps`'s `fpp-sync-from-prod` takes it: `mariadb-dump --single-transaction` in the production container over `ssh vps`, gzipped, 5.3 MB, in 5 s. It was restored into a scratch MariaDB 11.4 (`factory slot run -- make v1-mariadb DUMP=… SQL=…`, 1 to 2 s, removed by the same command) and imported into a scratch PostgreSQL 18 cluster in a temporary directory, database `fpp_import_rehearsal`, migrated by `db:migrate`, under a throwaway `VISITOR_KEY`. Both, and the dump, were deleted afterwards.

| Run | Wall time | Written |
|-|-|-|
| dry run | 0.8 s | nothing |
| apply | 2.4 s | every planned row |
| apply again | 2.0 s | nothing; every table's count and md5 over its rows equal to the first apply's |

Phases of the first apply: read dump 471 ms, plan 89 ms, check target 22 ms, rooms and addresses 161 ms, topics and rounds 1,182 ms, visitor days 108 ms, daily statistics 170 ms. The maintenance window needs a minute for the import, plus the dump's own transfer.

| v1 table | Rows read |
|-|-|
| `fpp_rooms` | 4,647 |
| `fpp_votes` | 27,352 |
| `fpp_estimations` | 164,868 (22,337 of them no vote) |
| `fpp_page_views` | 95,582 |
| `fpp_events` | 79,730 |

| v9 table | Rows |
|-|-|
| `room` | 4,647 |
| `room_slug` | 4,955: 4,283 numbers and 334 names as primary addresses, 338 further numbers |
| `topic` | 27,352 |
| `round` | 27,352, every `summary` and `deck` a jsonb object |
| `round_vote` | 0 |
| `visitor_day` | 16,145, from 2025-10-22 |
| `stat_daily` | 21,659, days 2024-01-19 to 2026-11-22 |

Skips: 41, every one an address, no room and no round. 32 numbers that are not six digits; 9 names of digits only that are not six or eight of them. No orphaned votes row.

### GET /api/stats against v1's own counts

`GET /api/stats` answered by the API composed in process over the scratch database; v1's counts by SQL over the scratch MariaDB of the same dump.

| Figure | v1 (MariaDB) | v9 |
|-|-|-|
| rounds | 27,352 votes rows | `totals.rounds` 27,352 |
| votes | 142,331, the sum of `amount_of_estimations` | `totals.votes` 142,331 |
| rooms created | 4,647 rooms | `totals.roomsCreated` 4,647 |
| consensus rounds | 5,659 with lowest equal to highest | `totals.consensusRounds` 5,659 |
| card votes 1, 2, 3, 5, 8, 13, 21 | 14,750, 32,997, 43,961, 31,036, 13,562, 4,773, 1,439 | `cards` the same seven figures |
| estimating days | 24,792 distinct user and day | sum of `estimators` 24,792 |
| estimating days in 13 months | 16,145 | `visitor_day` 16,145 |
| voters | 7,238 | sum of `estimators_new` 7,238 |
| page views, events | 95,582, 79,730 | sums of `page_views`, `events` the same |

v1's two own counts of votes differ: the estimations hold 142,531 votes, the votes rows sum to 142,331. `totals.votes` follows the rounds, so that history and totals agree; card votes follow the estimations (142,518 after the 13 off the deck).
