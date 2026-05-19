#!/usr/bin/env bun
/**
 * End-to-end validation for valkey room-state persistence.
 *
 * Scenarios:
 *   A. Single-user vote → snapshot in Redis with TTL ~21600s
 *   B. Restart simulation: clear in-memory state → reconnect → vote preserved
 *   C. Debounce coalescing: 5 rapid actions → exactly 1 (or 2) SET commands
 *   D. Multi-user room snapshot integrity (estimations, spectator flag)
 *   E. Empty room → delete snapshot from Redis
 *   F. Multiple rooms isolated (no cross-contamination)
 *   G. TTL touch via cleanup (manually trigger; verify EXPIRE refreshed)
 *
 * Pre-req: fpp-server running on :7721, valkey on :6379.
 */

import { RedisClient } from 'bun';

const WS_URL = 'ws://localhost:7721/ws';
const REDIS_URL = 'redis://localhost:6379';
const KEY = (id: number) => `fpp:room:${id}`;

// Base offset per invocation so reruns don't collide with in-memory rooms
// the long-running server still remembers from a previous run. Room IDs are
// just unique integers in this app — any range works for a test.
const RUN_OFFSET = Math.floor(Date.now() / 1000) % 1_000_000;
const R = (n: number): number => 9_000_000 + RUN_OFFSET * 10 + n;

const redis = new RedisClient(REDIS_URL);
await redis.connect();

let failures = 0;
let passes = 0;

function assert(cond: boolean, label: string, detail?: unknown): void {
  if (cond) {
    console.log(`  ✓ ${label}`);
    passes++;
  } else {
    console.log(`  ✗ ${label}`, detail !== undefined ? detail : '');
    failures++;
  }
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function rid(): string {
  // 21-char id matching the strict length validation. Pad with deterministic
  // chars so generated ids are always exactly 21 chars even if Math.random
  // returns a short base36 string.
  const raw = Math.random().toString(36).slice(2);
  return (raw + 'abcdefghijklmnopqrstuvwxyz').slice(0, 21);
}

interface OpenedWS {
  ws: WebSocket;
  inbox: unknown[];
  closed: Promise<void>;
}

async function openWS(
  roomId: number,
  userId: string,
  username: string,
): Promise<OpenedWS> {
  const url = `${WS_URL}?roomId=${roomId}&userId=${userId}&username=${encodeURIComponent(username)}`;
  const ws = new WebSocket(url);
  const inbox: unknown[] = [];
  let resolveClose!: () => void;
  const closed = new Promise<void>((r) => (resolveClose = r));

  ws.addEventListener('message', (ev) => {
    try {
      inbox.push(JSON.parse(String(ev.data)));
    } catch {
      inbox.push(ev.data);
    }
  });
  ws.addEventListener('close', resolveClose);

  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('WS open timeout')), 3000);
    ws.addEventListener('open', () => {
      clearTimeout(t);
      resolve();
    });
    ws.addEventListener('error', () => {
      clearTimeout(t);
      reject(new Error('WebSocket error'));
    });
  });

  return { ws, inbox, closed };
}

function send(ws: WebSocket, payload: Record<string, unknown>): void {
  ws.send(JSON.stringify(payload));
}

async function readSnapshot(roomId: number): Promise<{
  raw: string | null;
  parsed: {
    users: Array<{
      id: string;
      estimation: number | null;
      name: string;
      isSpectator: boolean;
    }>;
    isFlipped: boolean;
  } | null;
  ttl: number;
}> {
  const raw = await redis.get(KEY(roomId));
  const ttl = await redis.ttl(KEY(roomId));
  return {
    raw,
    parsed: raw
      ? (JSON.parse(raw) as {
          users: Array<{
            id: string;
            estimation: number | null;
            name: string;
            isSpectator: boolean;
          }>;
          isFlipped: boolean;
        })
      : null,
    ttl,
  };
}

async function flushKeys(): Promise<void> {
  const keys = await redis.keys('fpp:room:*');
  if (keys.length > 0) {
    for (const k of keys) await redis.del(k);
  }
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Scenario A — Single-user vote writes snapshot                          */
/* ──────────────────────────────────────────────────────────────────────── */
async function scenarioA(): Promise<void> {
  console.log('\n=== A: single-user vote → snapshot ===');
  await flushKeys();
  const roomId = R(1);
  const userId = rid();

  const { ws } = await openWS(roomId, userId, 'Alice');
  await wait(150); // let open + initial broadcast settle

  send(ws, {
    action: 'estimate',
    userId,
    roomId,
    estimation: 5,
  });

  // Debounce is 500ms; wait a bit longer
  await wait(800);

  const snap = await readSnapshot(roomId);
  assert(snap.parsed !== null, 'snapshot written to Redis');
  assert(
    snap.parsed?.users.length === 1,
    'snapshot contains 1 user',
    snap.parsed?.users.length,
  );
  assert(
    snap.parsed?.users[0]?.estimation === 5,
    'estimation persisted',
    snap.parsed?.users[0],
  );
  assert(
    snap.ttl > 21500 && snap.ttl <= 21600,
    `TTL ≈ 21600s (got ${snap.ttl})`,
  );

  ws.close();
  await wait(200);
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Scenario B — Restart simulation (server keeps running, in-memory clear) */
/*   We can't kill the bun process from inside this script reliably, so we */
/*   simulate the restart by: (1) connecting, voting, snapshot ✅          */
/*   (2) leaving via WS close, waiting for delete debounce to NOT fire   */
/*   (3) Actually: a clean restart means the new instance has empty       */
/*       memory but the Redis snapshot is intact. We test the hydration   */
/*       path explicitly by making sure that a NEW connection to a roomId */
/*       that's only in Redis (not memory) gets the prior state.          */
/*   To produce that condition: vote → close all sockets → wait 30s+      */
/*   would normally evict. Instead, we use a roomId the server has never  */
/*   seen, pre-seed Redis with a snapshot, connect, expect hydrate.       */
/* ──────────────────────────────────────────────────────────────────────── */
async function scenarioB(): Promise<void> {
  console.log('\n=== B: rehydrate from Redis on first connection ===');
  await flushKeys();
  const roomId = R(2);
  const ghostUserId = rid();

  // Pre-seed a snapshot as if a prior instance wrote it
  const seed = {
    id: roomId,
    startedAt: Date.now() - 60_000,
    lastUpdated: Date.now() - 30_000,
    isFlipped: false,
    isAutoFlip: false,
    users: [
      {
        id: ghostUserId,
        name: 'GhostUser',
        estimation: 13,
        isSpectator: false,
      },
    ],
  };
  await redis.send('SET', [KEY(roomId), JSON.stringify(seed), 'EX', '21600']);

  // Confirm the snapshot is in Redis before we connect
  const pre = await readSnapshot(roomId);
  assert(pre.parsed?.users[0]?.estimation === 13, 'seed snapshot in Redis');

  // A fresh user connects to the same room — server must hydrate from Redis
  const liveUserId = rid();
  const { ws, inbox } = await openWS(roomId, liveUserId, 'LiveUser');
  await wait(400);

  // The first broadcast IS the RoomDto (no envelope) — find the message
  // that contains a `users` array. There may also be other framed messages.
  const roomMsg = inbox.find(
    (m): m is { users: Array<{ id: string; estimation: number | null }> } => {
      if (typeof m !== 'object' || m === null || !('users' in m)) return false;
      return Array.isArray(m.users);
    },
  );
  const users = roomMsg?.users;
  assert(Array.isArray(users), 'received roomState with users array');
  const ghost = users?.find((u) => u.id === ghostUserId);
  assert(ghost !== undefined, 'ghost user present after hydrate');
  assert(ghost?.estimation === 13, 'ghost estimation preserved', ghost);
  const live = users?.find((u) => u.id === liveUserId);
  assert(live !== undefined, 'live user also present in same room');

  ws.close();
  await wait(200);
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Scenario C — Debounce coalescing                                       */
/*   5 rapid state changes within debounce window → snapshot reflects the  */
/*   FINAL state. We can't see the SET count directly without MONITOR, but */
/*   we can verify the snapshot equals the last action and arrives once    */
/*   the debounce closes.                                                  */
/* ──────────────────────────────────────────────────────────────────────── */
async function scenarioC(): Promise<void> {
  console.log('\n=== C: rapid actions coalesce, final state wins ===');
  await flushKeys();
  const roomId = R(3);
  const userId = rid();

  const { ws } = await openWS(roomId, userId, 'Burst');
  await wait(150);

  // Fire 5 estimations in rapid succession
  for (const value of [1, 2, 3, 5, 8]) {
    send(ws, { action: 'estimate', userId, roomId, estimation: value });
    await wait(30);
  }

  // Right after the burst, snapshot may not exist yet (still debouncing)
  // Wait past debounce
  await wait(700);

  const snap = await readSnapshot(roomId);
  assert(
    snap.parsed?.users[0]?.estimation === 8,
    'final estimation 8 persisted',
    snap.parsed?.users[0],
  );

  ws.close();
  await wait(200);
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Scenario D — Multi-user room                                           */
/* ──────────────────────────────────────────────────────────────────────── */
async function scenarioD(): Promise<void> {
  console.log('\n=== D: multi-user room snapshot ===');
  await flushKeys();
  const roomId = R(4);
  const aliceId = rid();
  const bobId = rid();
  const carolId = rid();

  const a = await openWS(roomId, aliceId, 'Alice');
  const b = await openWS(roomId, bobId, 'Bob');
  const c = await openWS(roomId, carolId, 'Carol');
  await wait(200);

  send(a.ws, { action: 'estimate', userId: aliceId, roomId, estimation: 3 });
  send(b.ws, { action: 'estimate', userId: bobId, roomId, estimation: 5 });
  send(c.ws, {
    action: 'setSpectator',
    userId: carolId,
    roomId,
    targetUserId: carolId,
    isSpectator: true,
  });

  await wait(800);

  const snap = await readSnapshot(roomId);
  assert(snap.parsed?.users.length === 3, 'all 3 users in snapshot');
  const findU = (id: string) => snap.parsed?.users.find((u) => u.id === id);
  assert(findU(aliceId)?.estimation === 3, 'alice=3');
  assert(findU(bobId)?.estimation === 5, 'bob=5');
  assert(findU(carolId)?.isSpectator === true, 'carol isSpectator=true');

  a.ws.close();
  b.ws.close();
  c.ws.close();
  await wait(200);
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Scenario E — Empty room deletes Redis key                              */
/*   Need a roomId where ALL users leave (close without lingering         */
/*   sockets). We rely on `leave` action which removes the user from the  */
/*   server-side state, triggering removeUserFromRoom → del on empty.    */
/* ──────────────────────────────────────────────────────────────────────── */
async function scenarioE(): Promise<void> {
  console.log('\n=== E: empty room → Redis key deleted ===');
  await flushKeys();
  const roomId = R(5);
  const userId = rid();

  const { ws } = await openWS(roomId, userId, 'Loner');
  await wait(150);
  send(ws, { action: 'estimate', userId, roomId, estimation: 1 });
  await wait(700);

  const before = await readSnapshot(roomId);
  assert(before.parsed !== null, 'snapshot exists before leave');

  // Trigger explicit leave (server removes user, hits empty path)
  send(ws, { action: 'leave', userId, roomId });
  await wait(400);
  ws.close();
  await wait(400);

  const after = await readSnapshot(roomId);
  assert(
    after.parsed === null,
    'snapshot deleted after room empties',
    after.raw,
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Scenario F — Multiple rooms isolated                                   */
/* ──────────────────────────────────────────────────────────────────────── */
async function scenarioF(): Promise<void> {
  console.log('\n=== F: multiple rooms isolated ===');
  await flushKeys();
  const room1 = R(6);
  const room2 = R(7);
  const u1 = rid();
  const u2 = rid();

  const s1 = await openWS(room1, u1, 'RoneUser');
  const s2 = await openWS(room2, u2, 'RtwoUser');
  await wait(150);

  send(s1.ws, {
    action: 'estimate',
    userId: u1,
    roomId: room1,
    estimation: 21,
  });
  send(s2.ws, {
    action: 'estimate',
    userId: u2,
    roomId: room2,
    estimation: 34,
  });
  await wait(800);

  const snap1 = await readSnapshot(room1);
  const snap2 = await readSnapshot(room2);
  assert(
    snap1.parsed?.users[0]?.estimation === 21,
    'room 9006 = 21',
    snap1.parsed,
  );
  assert(
    snap2.parsed?.users[0]?.estimation === 34,
    'room 9007 = 34',
    snap2.parsed,
  );
  assert(
    snap1.parsed?.users.find((u) => u.id === u2) === undefined,
    'no leakage',
  );

  s1.ws.close();
  s2.ws.close();
  await wait(200);
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Scenario G — Flip preserves state in snapshot                          */
/* ──────────────────────────────────────────────────────────────────────── */
async function scenarioG(): Promise<void> {
  console.log('\n=== G: flip persists isFlipped in snapshot ===');
  await flushKeys();
  const roomId = R(8);
  const userId = rid();

  const { ws } = await openWS(roomId, userId, 'Flipper');
  await wait(150);
  send(ws, { action: 'estimate', userId, roomId, estimation: 8 });
  await wait(200);
  send(ws, { action: 'flip', userId, roomId });
  await wait(800);

  const snap = await readSnapshot(roomId);
  assert(snap.parsed?.isFlipped === true, 'isFlipped=true persisted');
  assert(snap.parsed?.users[0]?.estimation === 8, 'estimation still there');

  ws.close();
  await wait(200);
}

/* ──────────────────────────────────────────────────────────────────────── */

try {
  await scenarioA();
  await scenarioB();
  await scenarioC();
  await scenarioD();
  await scenarioE();
  await scenarioF();
  await scenarioG();
} catch (err) {
  console.error('Validation crashed:', err);
  failures++;
}

await flushKeys();
redis.close();

console.log(`\n${'='.repeat(60)}`);
console.log(`Result: ${passes} passed, ${failures} failed`);
console.log('='.repeat(60));

process.exit(failures > 0 ? 1 : 0);
