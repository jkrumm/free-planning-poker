# apps/api/src/jobs/import-v1

The one-time import of v1's MariaDB dump (decisions and the rehearsal: `docs/v9/evidence/import-rehearsal.md`). It moves five years of data once, at the cutover, and cannot be repeated there: a change here is proven on the fixture and, when it changes what is written, on a real dump again.

- **Run:** `make import-v1 DUMP=<file.sql[.gz]>` with `DATABASE_URL` and `VISITOR_KEY` (the API's own: another key puts returning browsers on other `visitor_day` rows). A dry run unless `APPLY=1`; it prints counts and skips and writes the JSON report to `REPORT` (gitignored).
- **Every write is keyed** (v1 room id, address, stable UUID v7 of the v1 vote id, `visitor_day` and `stat_daily` keys), so a second apply writes nothing. A new row kind needs a key of the same sort, and the server test's second apply proves it.
- **A skip names a v1 id and a reason, never a room name**: the report and the evidence are read by people outside the database.
- **The fixture dump** `apps/api/test/import/v1-fixture.sql` is real `mariadb-dump` 11.4 output; change `v1-fixture.seed.sql` and write it again with `factory slot run -- make v1-mariadb SQL=apps/api/test/import/v1-fixture.seed.sql DB=v1 OUT=apps/api/test/import/v1-fixture.sql` (Docker runs only inside a test slot).
- **A real dump** comes as `vps`'s `fpp-sync-from-prod` takes it (`mariadb-dump` over `ssh vps`), never into the shared development MariaDB. Import it into a scratch cluster, and delete the dump afterwards: `fpp_users` holds places and devices.
