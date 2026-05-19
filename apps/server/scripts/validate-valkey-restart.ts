#!/usr/bin/env bun
/**
 * Real restart validation. Caller manages the server lifecycle:
 *
 *   PHASE=write  bun scripts/validate-valkey-restart.ts <roomId>
 *     → connects, votes 21, closes WS, leaves Redis snapshot in place.
 *
 *   PHASE=read   bun scripts/validate-valkey-restart.ts <roomId>
 *     → connects to the SAME roomId, expects the ghost vote of 21 to be in
 *       the first broadcast (rehydrated from Redis on the fresh server).
 *
 * Between PHASE=write and PHASE=read, the caller kills + restarts fpp-server.
 */

const WS_URL = 'ws://localhost:7721/ws';
const phase = process.env.PHASE;
const roomId = Number(process.argv[2]);
if (!roomId || !phase) {
  console.error('Usage: PHASE=write|read bun ... <roomId>');
  process.exit(2);
}

const userId = (Math.random().toString(36).slice(2) + 'abcdefghijklmnop').slice(
  0,
  21,
);

function openAndCollect(timeoutMs: number): Promise<{
  ws: WebSocket;
  inbox: unknown[];
}> {
  const url = `${WS_URL}?roomId=${roomId}&userId=${userId}&username=Restarter`;
  const ws = new WebSocket(url);
  const inbox: unknown[] = [];
  ws.addEventListener('message', (ev) => {
    try {
      inbox.push(JSON.parse(String(ev.data)));
    } catch {
      inbox.push(ev.data);
    }
  });
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('WS open timeout')), timeoutMs);
    ws.addEventListener('open', () => {
      clearTimeout(t);
      resolve({ ws, inbox });
    });
    ws.addEventListener('error', () => {
      clearTimeout(t);
      reject(new Error('WebSocket error'));
    });
  });
}

if (phase === 'write') {
  // userId persists via the saved file so the reader can match it
  const writerId = (
    Math.random().toString(36).slice(2) + 'abcdefghijklmnop'
  ).slice(0, 21);
  const url = `${WS_URL}?roomId=${roomId}&userId=${writerId}&username=Writer`;
  const ws = new WebSocket(url);
  await new Promise<void>((resolve, reject) => {
    ws.addEventListener('open', () => resolve());
    ws.addEventListener('error', () => reject(new Error('WebSocket error')));
  });
  await new Promise((r) => setTimeout(r, 150));
  ws.send(
    JSON.stringify({
      action: 'estimate',
      userId: writerId,
      roomId,
      estimation: 21,
    }),
  );
  await new Promise((r) => setTimeout(r, 800)); // > debounce
  ws.close();
  await new Promise((r) => setTimeout(r, 200));
  await Bun.write(
    `/tmp/valkey-restart-${roomId}.json`,
    JSON.stringify({ writerId, roomId }),
  );
  console.log(JSON.stringify({ phase: 'write', writerId, roomId }));
} else if (phase === 'read') {
  const saved = JSON.parse(
    await Bun.file(`/tmp/valkey-restart-${roomId}.json`).text(),
  ) as { writerId: string };
  const { ws, inbox } = await openAndCollect(3000);
  await new Promise((r) => setTimeout(r, 400));
  ws.close();

  const room = inbox.find(
    (
      m,
    ): m is {
      users: Array<{ id: string; estimation: number | null; name: string }>;
    } => typeof m === 'object' && m !== null && 'users' in m,
  );
  const ghost = room?.users.find((u) => u.id === saved.writerId);
  if (!ghost) {
    console.error(
      JSON.stringify({
        ok: false,
        reason: 'ghost user missing after restart',
        users: room?.users,
      }),
    );
    process.exit(1);
  }
  if (ghost.estimation !== 21) {
    console.error(
      JSON.stringify({
        ok: false,
        reason: 'ghost estimation lost',
        ghost,
      }),
    );
    process.exit(1);
  }
  console.log(
    JSON.stringify({
      ok: true,
      phase: 'read',
      ghost,
      roomCount: room?.users.length,
    }),
  );
}
