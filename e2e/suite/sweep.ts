/**
 * Removes the Compose projects of earlier image-mode runs that outlived them (`fpp-e2e-*`, a killed process never reached
 * its cleanup), once their oldest container is older than two hours: a run takes minutes, so nothing that old is alive.
 * Run by `make v9-sweep`, and by run.ts before it starts a stack. Never fatal: with no Docker engine there is nothing to
 * sweep, and a failure here must not fail a run.
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const exec = promisify(execFile)
const MAX_AGE_MS = 2 * 60 * 60 * 1000
const PROJECT = /^fpp-e2e-/

try {
  const { stdout } = await exec('docker', [
    'ps',
    '--all',
    '--no-trunc',
    '--format',
    '{{.ID}} {{.Label "com.docker.compose.project"}}',
  ])
  const byProject = new Map<string, string[]>()
  for (const line of stdout.split('\n')) {
    const [id, project] = line.trim().split(' ')
    if (id === undefined || project === undefined || !PROJECT.test(project)) continue
    byProject.set(project, [...(byProject.get(project) ?? []), id])
  }
  for (const [project, ids] of byProject) {
    const created = await exec('docker', ['inspect', '--format', '{{.Created}}', ...ids])
    const oldest = Math.min(
      ...created.stdout
        .trim()
        .split('\n')
        .map((text) => Date.parse(text)),
    )
    if (!(Date.now() - oldest > MAX_AGE_MS)) continue
    console.log(`==> removing the stack ${project}, started ${new Date(oldest).toISOString()}`)
    await exec('docker', ['compose', '-p', project, 'down', '--volumes', '--remove-orphans'])
  }
} catch (error) {
  console.log(
    `==> no sweep: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`,
  )
}
