// `make import-v1`: the shell of the one-time import of v1 (apps/api/src/jobs/import-v1). Reads the arguments and the
// environment (DATABASE_URL, VISITOR_KEY: the API's own), runs the import, prints its report and writes it as JSON.
import { parseArgs } from 'node:util'
import { formatReport, ImportRefused, runImport } from '../src/jobs/import-v1/command.ts'

const VISITOR_KEY_MIN = 32

const { values } = parseArgs({
  options: {
    dump: { type: 'string' },
    report: { type: 'string', default: 'import-v1-report.json' },
    apply: { type: 'boolean', default: false },
    'allow-other-origins': { type: 'boolean', default: false },
  },
})
const databaseUrl = process.env.DATABASE_URL
const visitorKey = process.env.VISITOR_KEY ?? ''
if (values.dump === undefined) throw new Error('--dump <file.sql[.gz]> is required')
if (!databaseUrl) throw new Error('DATABASE_URL is not set: the Postgres to import into')
if (visitorKey.length < VISITOR_KEY_MIN)
  throw new Error(`VISITOR_KEY must be the API's own, at least ${VISITOR_KEY_MIN} characters`)
const dump = Bun.file(values.dump)
if (!(await dump.exists())) throw new Error(`no dump at ${values.dump}`)

try {
  const report = await runImport({
    dump,
    databaseUrl,
    visitorKey,
    apply: values.apply,
    allowOtherOrigins: values['allow-other-origins'],
    now: new Date(),
  })
  console.log(formatReport(report))
  await Bun.write(values.report, `${JSON.stringify(report, null, 2)}\n`)
  console.log(`report: ${values.report}`)
} catch (error) {
  if (error instanceof ImportRefused) {
    console.error(
      `refused: the target holds ${error.rooms} rooms of another origin than v1 (--allow-other-origins imports anyway)`,
    )
    process.exit(2)
  }
  throw error
}
