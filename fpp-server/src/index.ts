import { createPinoLogger } from '@bogeychan/elysia-logger';
import cron from '@elysiajs/cron';
import { Elysia, t } from 'elysia';
import {
  ActionSchema,
  CActionSchema,
  isChangeUsernameAction,
  isEstimateAction,
  isFlipAction,
  isHeartbeatAction,
  isLeaveAction,
  isRejoinAction,
  isResetAction,
  isSetAutoFlipAction,
  isSetSpectatorAction,
  isSetPresenceAction,
} from './room.actions';
import { RoomState } from './room.state';
import { Analytics } from './types';

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
    roomState.addUserToRoom(roomId, {
      id: userId,
      name: username,
      estimation: null,
      isSpectator: false,
      ws,
    });

    // Send initial state after a short delay to ensure WebSocket is ready
    setTimeout(() => {
      roomState.sendToEverySocketInRoom(roomId);
    }, 10);
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

      const room = roomState.getOrCreateRoom(data.roomId);
      log.debug({ ...data, wsId: ws.id }, 'Received message');

      switch (true) {
        case isHeartbeatAction(data):
          const heartbeatUpdated = roomState.updateHeartbeat(ws.id);
          if (!heartbeatUpdated) {
            log.warn(
              { userId: data.userId, roomId: data.roomId, wsId: ws.id },
              'Heartbeat received for unknown user - user needs to reconnect'
            );
            ws.send(
              JSON.stringify({ error: 'User not found - userId not found' })
            );
            return;
          }
          ws.send('pong');
          return;

        case isEstimateAction(data):
          room.setEstimation(data.userId, data.estimation);
          break;

        case isSetSpectatorAction(data):
          room.setSpectator(data.userId, data.isSpectator);
          break;

        case isResetAction(data):
          room.reset();
          break;

        case isSetAutoFlipAction(data):
          room.setAutoFlip(data.isAutoFlip);
          break;

        case isLeaveAction(data):
          log.debug(
            { userId: data.userId, roomId: data.roomId, wsId: ws.id },
            'User leaving room'
          );
          roomState.removeUserFromRoom(data.roomId, data.userId);
          return;

        case isRejoinAction(data):
          log.debug(
            { userId: data.userId, roomId: data.roomId, wsId: ws.id },
            'User rejoining room'
          );
          roomState.addUserToRoom(data.roomId, {
            id: data.userId,
            name: data.username,
            estimation: null,
            isSpectator: false,
            ws,
          });
          // Send update after a short delay for rejoin as well
          setTimeout(() => {
            roomState.sendToEverySocketInRoom(data.roomId);
          }, 10);
          return;

        case isSetPresenceAction(data):
          roomState.updateUserPresence(data.roomId, data.userId, data.isPresent);
          roomState.sendToEverySocketInRoom(data.roomId);
          return;

        case isChangeUsernameAction(data):
          room.changeUsername(data.userId, data.username);
          break;

        case isFlipAction(data):
          room.flip();
          break;

        default:
          log.error(
            {
              error: 'Unknown action',
              wsId: ws.id,
              data: String(data),
            },
            'Unknown action'
          );
          ws.send(
            JSON.stringify({
              error: 'Unknown action',
              wsId: ws.id,
              data: String(data),
            })
          );
          return;
      }

      roomState.sendToEverySocketInRoom(room.id);
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