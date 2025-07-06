import { createPinoLogger } from '@bogeychan/elysia-logger';
import cron from '@elysiajs/cron';
import { Elysia, t } from 'elysia';
import {
  ActionSchema,
  CActionSchema,
} from './room.actions';
import { MessageHandler } from './message.handler';
import { RoomState } from './room.state';
import { Analytics } from './types';
import { WEBSOCKET_CONSTANTS } from './websocket.constants';
import { User } from './room.entity';

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
    idleTimeout: 70,
  },
}).use(
  cron({
    name: 'cleanupInactiveState',
    pattern: '0 */30 * * * *', // Every 30 seconds
    run() {
      roomState.cleanupInactiveState();
    },
  })
);

app.get('/health', () => {
  return { status: 'ok' };
});

app.get('/analytics', (): Analytics => {
  roomState.cleanupInactiveState();
  return roomState.toAnalytics();
});

app.post(
  '/leave',
  ({ body: { roomId, userId } }) => {
    log.debug({ roomId, userId }, 'Leave request via beacon');
    roomState.removeUserFromRoom(roomId, userId);
    return { success: true };
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
      ws.close();
      return;
    }

    log.debug(
      { roomId, userId, username, wsId: ws.id },
      'User connecting to room'
    );

    // Add user but don't send immediately - wait for WebSocket to be fully ready
    roomState.addUserToRoom(roomId, new User({
      id: userId,
      name: username,
      estimation: null,
      isSpectator: false,
      isPresent: true,
      ws,
    }));

    // Send initial state after a short delay to ensure WebSocket is ready
    setTimeout(() => {
      roomState.sendToEverySocketInRoom(roomId);
    }, WEBSOCKET_CONSTANTS.RECONNECT_DELAY);
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

    // DON'T remove user immediately - let heartbeat timeout handle it
    // This way users can reconnect without losing their spot

    // Just clean up the connection tracking
    const connection = roomState.getUserConnection(ws.id);
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
