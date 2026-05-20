// telemetry import MUST be first — registers Tracer/Logger/Meter providers
// before anything else can call into @opentelemetry/api.
import {
  registerActiveGauges,
  shutdownTelemetry,
  telemetryConfig,
} from './telemetry';

import { createPinoLogger } from '@bogeychan/elysia-logger';
import cron from '@elysiajs/cron';
import { opentelemetry } from '@elysiajs/opentelemetry';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import { Elysia, t } from 'elysia';
import {
  ActionSchema,
  isHeartbeatAction,
  USERNAME_RULES,
  validateUsername,
} from '@fpp/shared';
import { ATTR, EVENT } from '@fpp/shared/telemetry';
import { MessageHandler } from './message.handler';
import { User } from './room.entity';
import { roomSnapshot } from './room.snapshot';
import { RoomState } from './room.state';
import { type Analytics } from './types';
import { recordError, recordEvent } from './utils/app-error';
import { instrumentAction } from './utils/instrument-action';
import { WEBSOCKET_CONSTANTS } from './websocket.constants';

export const log = createPinoLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  base: {
    service: 'fpp-server',
  },
});

// Compile the action schema once at server boot. Lives here (not in
// @fpp/shared) so the TypeBox compiler stays out of the web bundle.
const CActionSchema = TypeCompiler.Compile(ActionSchema);

// Initialize Redis/Valkey snapshot store. Optional — when REDIS_URL is unset
// the store is a no-op and the server behaves exactly as before (in-memory
// state lost on restart). This keeps Redis off the critical path.
roomSnapshot.init(process.env.REDIS_URL);

const roomState = new RoomState();
const messageHandler = new MessageHandler(roomState);

// Wire the three concurrency gauges to the live roomState Maps now that it
// exists. The observable callbacks sample these each metric-collection cycle.
registerActiveGauges({
  users: () => roomState.activeUserCount,
  rooms: () => roomState.activeRoomCount,
  connections: () => roomState.activeConnectionCount,
});

// Flipped on SIGTERM so /health returns 503 and the proxy stops routing here
// before we close listening sockets. See SIGTERM handler at the bottom.
let isShuttingDown = false;

const app = new Elysia({
  websocket: {
    idleTimeout: 180,
  },
})
  // Mount OTEL first so trace context exists for every downstream middleware.
  // Skip tracing for liveness probes and the discovery root to reduce noise.
  .use(
    opentelemetry({
      ...telemetryConfig,
      checkIfShouldTrace: (req) => {
        const u = new URL(req.url);
        return u.pathname !== '/' && u.pathname !== '/health';
      },
    }),
  )
  .use(
    cron({
      name: 'cleanupInactiveState',
      pattern: '0 */30 * * * *', // At 0 and 30 minutes past every hour
      run() {
        roomState.cleanupInactiveState();
      },
    }),
  )
  // Centralized error handler (HTTP endpoints only)
  .onError(({ code, error, set, request }) => {
    const url = new URL(request.url);

    // NOT_FOUND is expected (favicon.ico, robots.txt, etc.) - don't capture
    if (code === 'NOT_FOUND') {
      set.status = 404;
      return { error: 'Not found', timestamp: Date.now() };
    }

    recordError(
      error as Error,
      {
        component: 'elysiaOnError',
        action: url.pathname,
        extra: {
          errorCode: code,
          method: request.method,
        },
      },
      'high',
    );

    set.status = code === 'VALIDATION' ? 400 : 500;
    return {
      error:
        code === 'VALIDATION' ? 'Invalid request' : 'Internal server error',
      timestamp: Date.now(),
    };
  });

app.get('/', () => {
  return { status: 'ok', service: 'fpp-server' };
});

app.get('/health', ({ set }) => {
  if (isShuttingDown) {
    set.status = 503;
    return { status: 'shutting_down' };
  }
  return { status: 'ok' };
});

app.get('/analytics', (): Analytics => {
  // Exceptions propagate to .onError (single capture point) — no inner
  // try-catch needed.
  roomState.cleanupInactiveState();
  return roomState.toAnalytics();
});

app.post(
  '/leave',
  ({ body: { roomId, userId } }) => {
    log.debug({ roomId, userId }, 'Leave request via beacon');
    // Exceptions propagate to .onError (single capture point).
    roomState.removeUserFromRoom(roomId, userId);
    return { success: true };
  },
  {
    body: t.Object({
      roomId: t.Number(),
      userId: t.String(),
    }),
  },
);

app.ws('/ws', {
  body: ActionSchema,
  query: t.Object({
    roomId: t.Number(),
    userId: t.String(),
    username: t.String({
      minLength: USERNAME_RULES.MIN_LENGTH,
      maxLength: USERNAME_RULES.MAX_LENGTH,
    }),
  }),
  async open(ws) {
    const { roomId, userId, username } = ws.data.query;
    // Connection success is recorded as the ws.connected event below, after
    // setup; rejections here are operator narration → Pino warnings.

    if (!roomId || !userId || !username) {
      log.warn(
        {
          component: 'websocketOpen',
          action: 'validateParams',
          wsId: ws.id,
          hasRoomId: !!roomId,
          hasUserId: !!userId,
          hasUsername: !!username,
        },
        'WebSocket connection missing query parameters',
      );
      ws.close(1008, 'Missing parameters');
      return;
    }

    // Validate username with shared validation logic (strict mode)
    const usernameValidation = validateUsername(username, { strict: true });
    if (!usernameValidation.isValid) {
      log.warn(
        {
          component: 'websocketOpen',
          action: 'validateUsername',
          wsId: ws.id,
          username: username.slice(0, 20),
          error: usernameValidation.error ?? 'Unknown validation error',
        },
        'WebSocket connection with invalid username',
      );
      ws.close(1008, usernameValidation.error ?? 'Invalid username');
      return;
    }

    log.debug(
      { roomId, userId, username, wsId: ws.id },
      'User connecting to room',
    );

    try {
      // Rehydrate room from Redis snapshot if we don't have it in memory yet
      // (typically: this server instance just started). No-op if room is
      // already loaded, Redis is unreachable, or no snapshot exists.
      await roomState.ensureHydrated(roomId);

      // Add user but don't send immediately - wait for WebSocket to be fully ready
      roomState.addUserToRoom(
        roomId,
        new User({
          id: userId,
          name: username,
          estimation: null,
          isSpectator: false,
          isPresent: true,
          ws,
        }),
      );

      // Send the initial state after a short delay to ensure WebSocket is ready
      setTimeout(() => {
        roomState.sendToEverySocketInRoom(roomId);
      }, WEBSOCKET_CONSTANTS.RECONNECT_DELAY);

      recordEvent(EVENT.WS_CONNECTED, {
        [ATTR.ROOM_ID]: roomId,
        [ATTR.USER_ID]: userId,
      });
    } catch (error) {
      recordError(
        error as Error,
        {
          component: 'websocketOpen',
          action: 'setupConnection',
          extra: {
            roomId: String(roomId),
            userId,
            wsId: ws.id,
          },
        },
        'high',
      );
      ws.close(1011, 'Setup failed');
    }
  },
  message(ws, data) {
    // Validate at the transport edge. Invalid frames are noise — drop them
    // without a span (the WS route schema guards too; this is belt-and-braces
    // and controls the error reply).
    if (!CActionSchema.Check(data)) {
      const safeData =
        typeof data === 'object'
          ? JSON.stringify(data).slice(0, 200)
          : String(data).slice(0, 200);
      log.warn(
        {
          component: 'websocketMessage',
          action: 'validateMessage',
          wsId: ws.id,
          receivedData: safeData,
        },
        'Invalid WebSocket message format',
      );
      ws.send(JSON.stringify({ error: 'Invalid message format', wsId: ws.id }));
      return;
    }

    // heartbeat bypasses instrumentAction entirely — liveness only, no
    // span/event/metric (it is the dominant message and pure noise to trace).
    if (isHeartbeatAction(data)) {
      messageHandler.handleMessage(ws, data);
      return;
    }

    // Transport/RED via instrumentAction: continue the browser's trace across
    // the WS boundary, span + time + count the action. The domain event +
    // metric fire at the entity/state chokepoint inside the handler.
    instrumentAction(ws, data, () => messageHandler.handleMessage(ws, data));
  },
  close(ws, code, reason) {
    log.debug(
      { wsId: ws.id, code, reason: reason?.toString() },
      'WebSocket connection closed',
    );

    const connection = roomState.getUserConnection(ws.id);

    // Track abnormal closures, but ignore common expected codes:
    // 1000 = Normal closure
    // 1001 = Going away (e.g., browser navigating away)
    // 1005 = No status received (browser-generated, common on tab close/reload)
    // 1006 = Abnormal closure (no close frame - very common for tab closes, network issues)
    const expectedCloseCodes = [1000, 1001, 1005, 1006];
    if (!expectedCloseCodes.includes(code)) {
      // Abnormal close → the ws.disconnected event (carries room/user +
      // close.reason). A Pino debug line keeps the raw reason text for the
      // terminal without a second OTEL record.
      recordEvent(EVENT.WS_DISCONNECTED, {
        ...(connection && {
          [ATTR.ROOM_ID]: connection.roomId,
          [ATTR.USER_ID]: connection.userId,
        }),
        [ATTR.CLOSE_REASON]: String(code),
      });
      log.debug(
        {
          component: 'websocketClose',
          closeCode: code,
          reason: reason?.toString() ?? 'none',
          wsId: ws.id,
          roomId: connection?.roomId ?? null,
          userId: connection?.userId ?? null,
        },
        `WebSocket closed with abnormal code: ${code}`,
      );
    }

    // DON'T remove the user immediately - let heartbeat timeout handle it
    // This way users can reconnect without losing their spot

    // Just clean up the connection tracking
    if (connection) {
      roomState.removeConnection(ws.id);
      log.debug(
        { userId: connection.userId, roomId: connection.roomId, wsId: ws.id },
        'WebSocket closed - user will be removed by heartbeat timeout if not reconnected',
      );
    }
  },
});

// Container/prod default is 3003 (Dockerfile EXPOSE + Traefik target both pin
// to that). Local dev sets PORT=7721 to fit the personal-apps 7720-range.
app.listen(Number(process.env.PORT ?? 3003));

log.info(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);

// Graceful shutdown for RollHook zero-downtime rollouts: flip /health to 503,
// give Traefik ~3s to deregister, then close the server and exit.
async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  log.info({ signal }, 'Shutdown initiated, draining for 3s');
  // Flush pending room snapshots concurrently with the Traefik drain — both
  // need to finish before we stop accepting connections, and they don't
  // contend for resources.
  const snapshotFlush = roomState
    .flushSnapshots()
    .catch((err: Error) =>
      log.error({ err }, 'Snapshot flush failed during shutdown'),
    );
  await Promise.all([
    snapshotFlush,
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  try {
    await app.stop();
  } catch (error) {
    log.error({ err: error }, 'Error stopping server');
  }
  await shutdownTelemetry(2000);
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
