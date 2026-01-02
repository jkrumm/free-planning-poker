import { createPinoLogger } from '@bogeychan/elysia-logger';
import cron from '@elysiajs/cron';
import * as Sentry from '@sentry/bun';
import { Elysia, t } from 'elysia';
import { MessageHandler } from './message.handler';
import { ActionSchema, CActionSchema } from './room.actions';
import { User } from './room.entity';
import { RoomState } from './room.state';
import { type Analytics } from './types';
import { addBreadcrumb, captureError, captureMessage } from './utils/app-error';
import { WEBSOCKET_CONSTANTS } from './websocket.constants';

export const log = createPinoLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport:
    process.env.NODE_ENV === 'production'
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
          },
        },
});

// Initialize Sentry before Elysia app
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  enabled: process.env.NODE_ENV !== 'development',

  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Privacy filtering (match Next.js beforeSend)
  beforeSend(event) {
    // Remove PII
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
      delete event.user.geo;
    }

    // Remove sensitive headers
    if (event.request?.headers) {
      delete event.request.headers;
    }

    // Sample high-frequency connection errors (10%)
    if (event.tags?.errorType === 'connection') {
      return Math.random() < 0.1 ? event : null;
    }

    return event;
  },
});

const roomState = new RoomState();
const messageHandler = new MessageHandler(roomState);

const app = new Elysia({
  websocket: {
    idleTimeout: 180,
  },
})
  .use(
    cron({
      name: 'cleanupInactiveState',
      pattern: '0 */30 * * * *', // Every 30 seconds
      run() {
        roomState.cleanupInactiveState();
      },
    })
  )
  // Centralized error handler (HTTP endpoints only)
  .onError(({ code, error, set, request }) => {
    const url = new URL(request.url);

    captureError(
      error as Error,
      {
        component: 'elysiaOnError',
        action: url.pathname,
        extra: {
          errorCode: code,
          method: request.method,
        },
      },
      'high'
    );

    set.status = code === 'VALIDATION' ? 400 : 500;
    return {
      error:
        code === 'VALIDATION' ? 'Invalid request' : 'Internal server error',
      timestamp: Date.now(),
    };
  });

app.get('/health', () => {
  return { status: 'ok' };
});

app.get('/analytics', (): Analytics => {
  try {
    roomState.cleanupInactiveState();
    return roomState.toAnalytics();
  } catch (error) {
    captureError(
      error as Error,
      {
        component: 'httpEndpoint',
        action: 'analytics',
      },
      'high'
    );
    throw error;
  }
});

app.post(
  '/leave',
  ({ body: { roomId, userId } }) => {
    log.debug({ roomId, userId }, 'Leave request via beacon');

    try {
      roomState.removeUserFromRoom(roomId, userId);
      return { success: true };
    } catch (error) {
      captureError(
        error as Error,
        {
          component: 'httpEndpoint',
          action: 'leave',
          extra: {
            roomId: String(roomId),
            userId,
          },
        },
        'high'
      );
      throw error;
    }
  },
  {
    body: t.Object({
      roomId: t.Number(),
      userId: t.String(),
    }),
  }
);

app.ws('/ws', {
  body: ActionSchema,
  query: t.Object({
    roomId: t.Number(),
    userId: t.String(),
    username: t.String(),
  }),
  open(ws) {
    const { roomId, userId, username } = ws.data.query;

    addBreadcrumb('WebSocket connection opened', 'websocket', {
      roomId: roomId ? String(roomId) : 'unknown',
      userId: userId ?? 'unknown',
    });

    if (!roomId || !userId || !username) {
      captureMessage(
        'WebSocket connection missing query parameters',
        {
          component: 'websocketOpen',
          action: 'validateParams',
          extra: {
            wsId: ws.id,
            hasRoomId: !!roomId,
            hasUserId: !!userId,
            hasUsername: !!username,
          },
        },
        'medium'
      );
      ws.close(1008, 'Missing parameters');
      return;
    }

    log.debug(
      { roomId, userId, username, wsId: ws.id },
      'User connecting to room'
    );

    try {
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
        })
      );

      // Send the initial state after a short delay to ensure WebSocket is ready
      setTimeout(() => {
        roomState.sendToEverySocketInRoom(roomId);
      }, WEBSOCKET_CONSTANTS.RECONNECT_DELAY);
    } catch (error) {
      captureError(
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
        'high'
      );
      ws.close(1011, 'Setup failed');
    }
  },
  message(ws, data) {
    const actionData =
      typeof data === 'object' && data !== null
        ? (data as Record<string, unknown>)
        : {};

    // Extract action info for breadcrumb
    const actionStr =
      typeof actionData.action === 'string' ||
      typeof actionData.action === 'number'
        ? String(actionData.action)
        : 'unknown';
    const roomIdStr =
      typeof actionData.roomId === 'string' ||
      typeof actionData.roomId === 'number'
        ? String(actionData.roomId)
        : 'unknown';
    const userIdStr =
      typeof actionData.userId === 'string' ||
      typeof actionData.userId === 'number'
        ? String(actionData.userId)
        : 'unknown';

    addBreadcrumb(`WebSocket action: ${actionStr}`, 'websocket.action', {
      roomId: roomIdStr,
      userId: userIdStr,
      action: actionStr,
    });

    try {
      if (!CActionSchema.Check(data)) {
        captureMessage(
          'Invalid WebSocket message format',
          {
            component: 'websocketMessage',
            action: 'validateMessage',
            extra: {
              wsId: ws.id,
              receivedData: String(data),
            },
          },
          'medium'
        );
        ws.send(
          JSON.stringify({
            error: 'Invalid message format',
            wsId: ws.id,
            data: String(data),
          })
        );
        return;
      }

      messageHandler.handleMessage(ws, data);
    } catch (error: unknown) {
      captureError(
        error as Error,
        {
          component: 'websocketMessage',
          action: actionStr,
          extra: {
            wsId: ws.id,
            roomId: roomIdStr,
            userId: userIdStr,
          },
        },
        'high'
      );

      if (error instanceof Error) {
        ws.send(
          JSON.stringify({
            error: error.message,
            timestamp: Date.now(),
            wsId: ws.id,
          })
        );
      }
    }
  },
  close(ws, code, reason) {
    log.debug(
      { wsId: ws.id, code, reason: reason?.toString() },
      'WebSocket connection closed'
    );

    const connection = roomState.getUserConnection(ws.id);

    // Track abnormal closures, but ignore common expected codes:
    // 1000 = Normal closure
    // 1001 = Going away (e.g., browser navigating away)
    // 1005 = No status received (browser-generated, common on tab close/reload)
    // 1006 = Abnormal closure (no close frame - very common for tab closes, network issues)
    const expectedCloseCodes = [1000, 1001, 1005, 1006];
    if (!expectedCloseCodes.includes(code)) {
      addBreadcrumb('WebSocket abnormal close', 'websocket', {
        closeCode: String(code),
        reason: reason?.toString() ?? 'unknown',
        roomId: connection?.roomId ? String(connection.roomId) : 'unknown',
        userId: connection?.userId ?? 'unknown',
      });

      captureMessage(
        `WebSocket closed with abnormal code: ${code}`,
        {
          component: 'websocketClose',
          action: 'handleClose',
          extra: {
            closeCode: code,
            reason: reason?.toString() ?? 'none',
            wsId: ws.id,
            roomId: connection?.roomId ? String(connection.roomId) : 'unknown',
            userId: connection?.userId ?? 'unknown',
          },
        },
        'low'
      );
    }

    // DON'T remove the user immediately - let heartbeat timeout handle it
    // This way users can reconnect without losing their spot

    // Just clean up the connection tracking
    if (connection) {
      roomState.removeConnection(ws.id);
      log.debug(
        { userId: connection.userId, roomId: connection.roomId, wsId: ws.id },
        'WebSocket closed - user will be removed by heartbeat timeout if not reconnected'
      );
    }
  },
});

app.listen(3003);

log.info(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
