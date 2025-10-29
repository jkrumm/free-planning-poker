import { createPinoLogger } from '@bogeychan/elysia-logger';
import cron from '@elysiajs/cron';
import * as Sentry from '@sentry/bun';
import { Elysia, t } from 'elysia';
import { sentry } from 'elysiajs-sentry';
import { MessageHandler } from './message.handler';
import { ActionSchema, CActionSchema } from './room.actions';
import { User } from './room.entity';
import { RoomState } from './room.state';
import { type Analytics } from './types';
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
  .use(
    sentry({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
    })
  );

app.get('/health', () => {
  return { status: 'ok' };
});

app.get('/analytics', (): Analytics => {
  try {
    roomState.cleanupInactiveState();
    return roomState.toAnalytics();
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        endpoint: 'analytics',
      },
    });
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
      Sentry.captureException(error, {
        tags: {
          endpoint: 'leave',
          roomId: String(roomId),
          userId,
        },
      });
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

    if (!roomId || !userId || !username) {
      log.error(
        {
          error: 'Missing query parameters',
          wsId: ws.id,
          query: ws.data.query,
        },
        'Missing query parameters'
      );
      Sentry.captureMessage('WebSocket connection missing query parameters', {
        level: 'warning',
        tags: {
          wsId: ws.id,
        },
        extra: {
          query: ws.data.query,
        },
      });
      ws.close();
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
          // @ts-ignore
          ws,
        })
      );

      // Send the initial state after a short delay to ensure WebSocket is ready
      setTimeout(() => {
        roomState.sendToEverySocketInRoom(roomId);
      }, WEBSOCKET_CONSTANTS.RECONNECT_DELAY);
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          roomId: String(roomId),
          userId,
          wsId: ws.id,
          operation: 'websocket_open',
        },
      });
      log.error(
        { error, roomId, userId, wsId: ws.id },
        'Error in WebSocket open handler'
      );
      throw error;
    }
  },
  message(ws, data) {
    try {
      if (!CActionSchema.Check(data)) {
        log.error(
          {
            error: 'Invalid message format',
            wsId: ws.id,
            data: String(data),
          },
          'Invalid message format'
        );
        Sentry.captureMessage('Invalid WebSocket message format', {
          level: 'error',
          tags: {
            wsId: ws.id,
          },
          extra: {
            receivedData: String(data),
          },
        });
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
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          wsId: ws.id,
          action: (data as any)?.action,
          roomId: String((data as any)?.roomId),
          userId: (data as any)?.userId,
        },
        extra: {
          messageData: data,
        },
      });
      if (error instanceof Error) {
        log.error({ error, wsId: ws.id, ...data }, 'Error processing message');
        ws.send(
          JSON.stringify({
            error: error.message,
            wsId: ws.id,
            ...data,
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
      Sentry.captureMessage('WebSocket closed with abnormal code', {
        level: 'warning',
        tags: {
          closeCode: String(code),
          wsId: ws.id,
          roomId: connection?.roomId ? String(connection.roomId) : undefined,
          userId: connection?.userId,
        },
        extra: {
          reason: reason?.toString(),
        },
      });
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
