/**
 * Does `server.stop()` resolve after the server closed its WebSockets itself (Bun issue 36223)? Prints one line per
 * case and exits 1 when a stop hangs past 3 s. Run it after a Bun bump: `bun apps/api/scripts/stop-after-close.ts`.
 */
import type { ServerWebSocket } from 'bun'

const HANG_MS = 3_000

const race = (stop: Promise<unknown>) =>
  Promise.race([
    stop.then(() => 'resolved' as const),
    Bun.sleep(HANG_MS).then(() => 'hung' as const),
  ])

async function stopAfter(mode: 'close' | 'terminate', waitForClients: boolean, force: boolean) {
  const sockets = new Set<ServerWebSocket<undefined>>()
  const server = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    fetch: (request, bun) =>
      bun.upgrade(request) ? undefined : new Response('expected an upgrade', { status: 426 }),
    websocket: {
      open: (ws) => void sockets.add(ws),
      message: () => {},
      close: (ws) => void sockets.delete(ws),
    },
  })
  const clients = await Promise.all(
    [1, 2, 3].map(
      () =>
        new Promise<WebSocket>((resolve) => {
          const client = new WebSocket(`ws://127.0.0.1:${server.port}`)
          client.addEventListener('open', () => resolve(client), { once: true })
        }),
    ),
  )
  const closed = Promise.all(
    clients.map((client) => new Promise((resolve) => client.addEventListener('close', resolve))),
  )
  for (const ws of sockets)
    if (mode === 'close') ws.close(4002)
    else ws.terminate()
  if (waitForClients) await closed
  const began = performance.now()
  const outcome = await race(server.stop(force))
  const ms = Math.round(performance.now() - began)
  return {
    line: `${mode}, ${waitForClients ? 'after the clients closed' : 'at once'}, stop(${force}): ${outcome} in ${ms} ms`,
    outcome,
  }
}

const results = []
for (const mode of ['close', 'terminate'] as const)
  for (const waitForClients of [true, false])
    for (const force of [false, true]) results.push(await stopAfter(mode, waitForClients, force))
console.log(`bun ${Bun.version}`)
for (const { line } of results) console.log(line)
process.exit(results.some(({ outcome }) => outcome === 'hung') ? 1 : 0)
