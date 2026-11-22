# Local development values; there is no secret in this file, so no op:// reference. `bun run dev` and
# `bun run db:migrate` read them. Tests start their own cluster and never read DATABASE_URL.
DATABASE_URL=postgres://postgres@127.0.0.1:5432/fpp
