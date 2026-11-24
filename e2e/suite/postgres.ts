import { execFile, spawnSync } from 'node:child_process'
import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { freePort } from './port.ts'

const exec = promisify(execFile)

export type PostgresCluster = {
  /** `postgres://postgres@127.0.0.1:<port>/postgres`: superuser, trust authentication, 127.0.0.1 only */
  readonly url: string
  stop(): Promise<void>
  /** The same as `stop`, for a process that is exiting and can await nothing. */
  stopSync(): void
}

/** Attempts at a free port: another process can take it between `freePort` and the postmaster's bind. */
const START_ATTEMPTS = 5

/**
 * A private PostgreSQL cluster in a temporary directory, for the native mode of the suite (`E2E_MODE=native`): own data
 * directory, own port, no Unix socket, durability off. The same pattern as `startPostgres` of @fpp/test-kit, copied
 * because this package may import no workspace package, and written on Node's APIs because a Playwright worker runs on
 * Node, not Bun. Binaries come from `PG_BIN_DIR` or the directory of the `initdb` on PATH.
 */
export async function startPostgres(): Promise<PostgresCluster> {
  const binDir = await resolveBinDir()
  const pgCtl = join(binDir, 'pg_ctl')
  const dir = await mkdtemp(join(tmpdir(), 'fpp-e2e-pg-'))
  const data = join(dir, 'data')
  const log = join(dir, 'postgres.log')
  try {
    await exec(join(binDir, 'initdb'), [
      '-D',
      data,
      '-U',
      'postgres',
      '-A',
      'trust',
      '-E',
      'UTF8',
      '--locale=C',
      '--no-sync',
      '--no-instructions',
    ])
    for (let attempt = 1; ; attempt++) {
      const port = await freePort()
      const settings = [
        `-p ${port}`,
        '-c listen_addresses=127.0.0.1',
        "-c unix_socket_directories=''",
        '-c fsync=off',
        '-c synchronous_commit=off',
        '-c full_page_writes=off',
      ].join(' ')
      try {
        await exec(pgCtl, ['-D', data, '-l', log, '-o', settings, '-w', '-t', '60', 'start'])
        return {
          url: `postgres://postgres@127.0.0.1:${port}/postgres`,
          stop: async () => {
            await exec(pgCtl, ['-D', data, '-m', 'immediate', '-w', 'stop']).catch(() => undefined)
            await rm(dir, { recursive: true, force: true })
          },
          stopSync: () => {
            spawnSync(pgCtl, ['-D', data, '-m', 'immediate', '-w', 'stop'])
            spawnSync('rm', ['-rf', dir])
          },
        }
      } catch (error) {
        const text = await readFile(log, 'utf8').catch(() => '')
        if (!/could not bind|address already in use/i.test(text) || attempt === START_ATTEMPTS)
          throw new Error(
            `postgres did not start (attempt ${attempt}): ${String(error)}\n${text}`,
            {
              cause: error,
            },
          )
      }
    }
  } catch (error) {
    await rm(dir, { recursive: true, force: true })
    throw error
  }
}

async function resolveBinDir(): Promise<string> {
  const fromEnv = process.env['PG_BIN_DIR']
  if (fromEnv) return fromEnv
  for (const entry of (process.env['PATH'] ?? '').split(delimiter)) {
    const candidate = join(entry, 'initdb')
    if (
      await access(candidate).then(
        () => true,
        () => false,
      )
    )
      return dirname(candidate)
  }
  throw new Error(
    'no PostgreSQL server binaries: set PG_BIN_DIR to the directory that holds initdb and pg_ctl',
  )
}
