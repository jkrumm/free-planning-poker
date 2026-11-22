import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { freePort } from './port.ts'

export type PostgresCluster = {
  /** `postgres://postgres@127.0.0.1:<port>/postgres`, superuser, no password */
  readonly url: string
  readonly port: number
  /** the temporary directory that holds the cluster; removed by `stop` */
  readonly dir: string
  stop(): Promise<void>
  /** Stops the server and keeps its data, for a test of an outage; `resume` starts it again on the same port. */
  halt(): Promise<void>
  resume(): Promise<void>
}

/** Attempts at a free port: another process can take the port between `freePort` and the postmaster's bind. */
const START_ATTEMPTS = 5

/**
 * Starts a private PostgreSQL cluster in a new temporary directory, from the server binaries in `PG_BIN_DIR` (or,
 * when it is unset, the directory of the `initdb` on PATH). Nothing is shared with another test run: own data
 * directory, own port, TCP on 127.0.0.1 only, no Unix socket. Durability is switched off; a test cluster is thrown away.
 */
export async function startPostgres(
  options: { readonly binDir?: string } = {},
): Promise<PostgresCluster> {
  const binDir = options.binDir ?? resolveBinDir()
  const dir = await mkdtemp(join(tmpdir(), 'fpp-pg-'))
  const data = join(dir, 'data')
  const log = join(dir, 'postgres.log')
  try {
    await run(join(binDir, 'initdb'), [
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
      const start = () =>
        run(
          join(binDir, 'pg_ctl'),
          ['-D', data, '-l', log, '-o', settings, '-w', '-t', '60', 'start'],
          {
            check: false,
          },
        )
      const started = await start()
      if (started.ok) {
        return {
          url: `postgres://postgres@127.0.0.1:${port}/postgres`,
          port,
          dir,
          stop: () => stopCluster(binDir, data, dir),
          halt: async () => {
            await run(join(binDir, 'pg_ctl'), ['-D', data, '-m', 'fast', '-w', 'stop'])
          },
          resume: async () => {
            const resumed = await start()
            if (!resumed.ok) throw new Error(`postgres did not start again: ${resumed.output}`)
          },
        }
      }
      const text = await readFile(log, 'utf8').catch(() => '')
      const portTaken = /could not bind|address already in use/i.test(text)
      if (!portTaken || attempt === START_ATTEMPTS) {
        throw new Error(`postgres did not start (attempt ${attempt}): ${started.output}\n${text}`)
      }
    }
  } catch (error) {
    await rm(dir, { recursive: true, force: true })
    throw error
  }
}

function resolveBinDir(): string {
  const fromEnv = process.env.PG_BIN_DIR
  if (fromEnv) return fromEnv
  const initdb = Bun.which('initdb')
  if (initdb) return dirname(initdb)
  throw new Error(
    'no PostgreSQL server binaries: set PG_BIN_DIR to the directory that holds initdb and pg_ctl',
  )
}

async function stopCluster(binDir: string, data: string, dir: string): Promise<void> {
  await run(join(binDir, 'pg_ctl'), ['-D', data, '-m', 'immediate', '-w', 'stop'], { check: false })
  await rm(dir, { recursive: true, force: true })
}

async function run(
  command: string,
  args: readonly string[],
  options: { readonly check?: boolean } = {},
): Promise<{ ok: boolean; output: string }> {
  const child = Bun.spawn([command, ...args], { stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  const output = `${stdout}${stderr}`.trim()
  if (code !== 0 && options.check !== false) throw new Error(`${command} exited ${code}: ${output}`)
  return { ok: code === 0, output }
}
