import { RedisClient } from 'bun';
import { log } from './index';
import { captureError, captureMessage } from './utils/app-error';

const ROOM_KEY_PREFIX = 'fpp:room:';
// 6h covers long-idle rooms (open tab through a meeting + lunch). The 30-min
// cleanup cron also touches every surviving room's TTL, so as long as memory
// has the room, Redis has it.
const SNAPSHOT_TTL_SECONDS = 21600;
const PERSIST_DEBOUNCE_MS = 500;

export class RoomSnapshotStore {
  private client: RedisClient | null = null;
  private available = false;
  private persistTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private inflightPersists = new Map<number, Promise<void>>();
  private hydrationPromises = new Map<number, Promise<string | null>>();

  init(url: string | undefined): void {
    if (!url) {
      log.warn(
        'REDIS_URL not set — room snapshots disabled (state will not survive restart)',
      );
      return;
    }

    try {
      this.client = new RedisClient(url, {
        autoReconnect: true,
        maxRetries: 20,
        enableOfflineQueue: true,
        enableAutoPipelining: true,
      });
      this.client.onconnect = () => {
        this.available = true;
        log.info({ url: maskUrl(url) }, 'Connected to Redis/Valkey');
      };
      this.client.onclose = (err) => {
        this.available = false;
        log.warn(
          { err: err?.message ?? 'unknown' },
          'Redis/Valkey connection closed — snapshots paused until reconnect',
        );
      };
      void this.client.connect().catch((err: Error) => {
        captureError(
          err,
          {
            component: 'roomSnapshot',
            action: 'connect',
            extra: { url: maskUrl(url) },
          },
          'high',
        );
      });
    } catch (err) {
      captureError(
        err as Error,
        { component: 'roomSnapshot', action: 'init' },
        'high',
      );
    }
  }

  isEnabled(): boolean {
    return this.client !== null;
  }

  /**
   * Fetch a room snapshot. Deduplicates concurrent reads for the same room.
   * Returns the raw JSON string (deserialization is the caller's concern so
   * the snapshot store stays decoupled from RoomServer).
   */
  fetch(roomId: number): Promise<string | null> {
    if (!this.client) return Promise.resolve(null);

    const existing = this.hydrationPromises.get(roomId);
    if (existing) return existing;

    const p = this.doFetch(roomId).finally(() => {
      this.hydrationPromises.delete(roomId);
    });
    this.hydrationPromises.set(roomId, p);
    return p;
  }

  private async doFetch(roomId: number): Promise<string | null> {
    if (!this.client) return null;
    try {
      return await this.client.get(`${ROOM_KEY_PREFIX}${roomId}`);
    } catch (err) {
      // Fail open: hydration miss is recoverable (room starts empty).
      captureMessage(
        'Redis fetch failed — proceeding without snapshot',
        {
          component: 'roomSnapshot',
          action: 'fetch',
          extra: { roomId, error: (err as Error).message },
        },
        'medium',
      );
      return null;
    }
  }

  /**
   * Debounced write-through. Called after any state change. Multiple calls
   * within the debounce window collapse to one write.
   */
  schedule(roomId: number, serialize: () => string | null): void {
    if (!this.client) return;
    if (this.persistTimers.has(roomId)) return;

    const timer = setTimeout(() => {
      this.persistTimers.delete(roomId);
      void this.persistNow(roomId, serialize);
    }, PERSIST_DEBOUNCE_MS);
    this.persistTimers.set(roomId, timer);
  }

  /**
   * Force-flush all pending writes. Used on SIGTERM before draining so the
   * next instance picks up the latest state.
   */
  async flushAll(
    serializeFor: (roomId: number) => string | null,
  ): Promise<void> {
    if (!this.client) return;
    const ids = Array.from(this.persistTimers.keys());
    for (const timer of this.persistTimers.values()) clearTimeout(timer);
    this.persistTimers.clear();

    await Promise.all(
      ids.map((id) => {
        const json = serializeFor(id);
        if (json === null) return Promise.resolve();
        return this.writeRaw(id, json);
      }),
    );
    await Promise.all(this.inflightPersists.values());
  }

  /**
   * Refresh the TTL on an existing snapshot without rewriting the payload.
   * Called by the 30-min cleanup cron so idle-but-alive rooms (heartbeats
   * only, no state changes) never expire from Redis while still in memory.
   * No-op if the key has already expired or never existed.
   */
  touch(roomId: number): void {
    if (!this.client) return;
    this.client
      .expire(`${ROOM_KEY_PREFIX}${roomId}`, SNAPSHOT_TTL_SECONDS)
      .catch((err: Error) => {
        captureMessage(
          'Redis TTL touch failed',
          {
            component: 'roomSnapshot',
            action: 'touch',
            extra: { roomId, error: err.message },
          },
          'low',
        );
      });
  }

  delete(roomId: number): void {
    if (!this.client) return;
    const timer = this.persistTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.persistTimers.delete(roomId);
    }
    this.client.del(`${ROOM_KEY_PREFIX}${roomId}`).catch((err: Error) => {
      captureMessage(
        'Redis delete failed',
        {
          component: 'roomSnapshot',
          action: 'delete',
          extra: { roomId, error: err.message },
        },
        'low',
      );
    });
  }

  private async persistNow(
    roomId: number,
    serialize: () => string | null,
  ): Promise<void> {
    const existing = this.inflightPersists.get(roomId);
    if (existing) await existing;

    let json: string | null;
    try {
      json = serialize();
    } catch (err) {
      captureError(
        err as Error,
        {
          component: 'roomSnapshot',
          action: 'serialize',
          extra: { roomId },
        },
        'medium',
      );
      return;
    }
    // Room is gone — the explicit `delete()` path already cleared Redis.
    if (json === null) return;

    const p = this.writeRaw(roomId, json).finally(() => {
      this.inflightPersists.delete(roomId);
    });
    this.inflightPersists.set(roomId, p);
    return p;
  }

  private async writeRaw(roomId: number, json: string): Promise<void> {
    if (!this.client) return;
    try {
      // `SET key value EX seconds` is atomic; Bun's typed .set lacks TTL,
      // so drop to the raw command. Cast args to satisfy strict typing.
      await this.client.send('SET', [
        `${ROOM_KEY_PREFIX}${roomId}`,
        json,
        'EX',
        String(SNAPSHOT_TTL_SECONDS),
      ]);
    } catch (err) {
      // Fail open: in-memory state is still authoritative; we just lose
      // restart resilience for this room until the next change.
      captureMessage(
        'Redis write failed — snapshot may be stale',
        {
          component: 'roomSnapshot',
          action: 'write',
          extra: { roomId, error: (err as Error).message },
        },
        'medium',
      );
    }
  }
}

function maskUrl(url: string): string {
  // Strip credentials from URL for safe logging.
  try {
    const u = new URL(url);
    if (u.password) u.password = '***';
    if (u.username) u.username = '***';
    return u.toString();
  } catch {
    return 'redis://<unparseable>';
  }
}

export const roomSnapshot = new RoomSnapshotStore();
