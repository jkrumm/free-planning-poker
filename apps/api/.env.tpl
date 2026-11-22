# Local development values; there is no secret in this file, so no op:// reference. Load it where a script
# needs it: `bun --env-file=.env.tpl run db:migrate`. Tests start their own cluster and never read DATABASE_URL.
DATABASE_URL=postgres://postgres@127.0.0.1:5432/fpp
