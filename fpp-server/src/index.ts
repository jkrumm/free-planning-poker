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
} from './room.actions';
import { ErrorType, RoomState } from './room.state';
import { Analytics } from './types';

export const log = createPinoLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});

export const roomState = new RoomState();

const app = new Elysia({
  websocket: {
    idleTimeout: 3 * 60 + 30, // WebSocket idle timeout 3 minutes 30 seconds
  },
}).use(
  cron({
    name: 'cleanupInactiveState',
    pattern: '*/30 * * * * *', // Runs every 30 seconds
    run() {
      roomState.cleanupInactiveState();
    },
  }),
).use(
  cron({
    name: 'cleanupInteractionsAndErrors',
    pattern: '0 0 * * * *', // Runs every hour
    run() {
      roomState.cleanupInteractionsAndErrors();
    },
  }),
);

app.get('/analytics', (): Analytics => {
  try {
    roomState.cleanupInactiveState();
    return roomState.toAnalytics();
  } catch (error) {
    roomState.trackError({
      message: ErrorType.GetAnalyticsFailed,
      originalError: error,
      roomId: null,
      userId: null,
    });
    throw error;
  }
});

app.ws('/ws', {
  body: ActionSchema,
  query: t.Object({
    roomId: t.Number(),
    userId: t.String(),
    username: t.String(),
  }),
  open(ws) {
    try {
      const { roomId, userId, username } = ws.data.query;

      if (!roomId || !userId || !username) {
        roomState.trackError({
          message: ErrorType.MissingQueryParamsOpenConnection,
          originalError: null,
          roomId,
          userId,
        });
        ws.close();
        return;
      }

      roomState.addUserToRoom(roomId, {
        id: userId,
        name: username,
        estimation: null,
        isSpectator: false,
        ws,
      });

      roomState.sendToEverySocketInRoom(roomId);
    } catch (error) {
      roomState.trackError({
        message: ErrorType.OpenFailed,
        originalError: error,
        roomId: ws.data.query.roomId,
        userId: ws.data.query.userId,
      });
    }
  },
  message(ws, data) {
    const userId: string | null = (data as { userId?: string })?.userId ?? null;
    const roomId: number | null = (data as { roomId?: number })?.roomId ?? null;
    try {
      if (!CActionSchema.Check(data)) {
        roomState.trackError({
          message: ErrorType.InvalidMessageFormat,
          originalError: null,
          roomId,
          userId,
          extra: { data: String(data) },
        });
        ws.send(
          JSON.stringify({
            error: ErrorType.InvalidMessageFormat,
            wsId: ws.id,
            data: String(data),
          }),
        );
        return;
      }

      const room = roomState.getOrCreateRoom(data.roomId);

      log.debug({ ...data, wsId: ws.id }, 'Received message');

      switch (true) {
        case isHeartbeatAction(data):
          roomState.updateHeartbeat(ws.id);
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
          roomState.removeUserFromRoom(data.roomId, data.userId);
          break;

        case isRejoinAction(data):
          roomState.addUserToRoom(data.roomId, {
            id: data.userId,
            name: data.username,
            estimation: null,
            isSpectator: false,
            ws,
          });
          break;

        case isChangeUsernameAction(data):
          room.changeUsername(data.userId, data.username);
          break;

        case isFlipAction(data):
          room.flip();
          break;

        default:
          roomState.trackError({
            message: ErrorType.UnknownAction,
            originalError: null,
            roomId,
            userId,
            extra: { data: String(data) },
          });
          ws.send(
            JSON.stringify({
              error: ErrorType.UnknownAction,
              wsId: ws.id,
              data: String(data),
            }),
          );
          break;
      }

      roomState.sendToEverySocketInRoom(room.id);
    } catch (error) {
      roomState.trackError({
        message: ErrorType.MessageFailed,
        originalError: error,
        roomId,
        userId,
        extra: { data: String(data) },
      });
    }
  },
  close(ws) {
    try {
      log.debug({ wsId: ws.id }, `Connection closed`);
      roomState.removeUserFromRoomByWsId(ws.id);
    } catch (error) {
      roomState.trackError({
        message: ErrorType.CloseFailed,
        originalError: error,
        roomId: null,
        userId: null,
      });
    }
  },
  // error(ws, error) {
  //     console.error(`WebSocket error: ${error.message}`);
  // }
});

app.listen(3003);

log.info(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
