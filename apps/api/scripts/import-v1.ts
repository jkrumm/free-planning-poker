// `make import-v1`: the shell of the one-time import of v1 (apps/api/src/jobs/import-v1). Reads the arguments and the
// environment (DATABASE_URL, VISITOR_KEY: the API's own), runs the import, prints its report and writes it as JSON.
import { parseArgs } from 'node:util'
import { parseEnv } from '../src/env.ts'
import { formatReport, ImportRefused, runImport } from '../src/jobs/import-v1/command.ts'

const { values } = parseArgs({
  options: {
    dump: { type: 'string' },
    report: { type: 'string', default: 'import-v1-report.json' },
    apply: { type: 'boolean', default: false },
    'allow-other-origins': { type: 'boolean', default: false },
  },
})
if (values.dump === undefined) throw new Error('--dump <file.sql[.gz]> is required')
// The API's own parser: the same rules for DATABASE_URL and VISITOR_KEY, so the hash is the one the API writes.
const { databaseUrl, visitorKey } = parseEnv(process.env)
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
