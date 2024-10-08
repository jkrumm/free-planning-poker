import { createPinoLogger } from '@bogeychan/elysia-logger';
import cron from '@elysiajs/cron';
import { Elysia, t } from 'elysia';
import { ElysiaWS } from 'elysia/dist/ws';
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
import { RoomServer } from './room.entity';
import {
  addSocketToRoom,
  cleanupHeartbeats,
  cleanupRooms,
  getOrCreateRoom,
  heartbeats,
  removeHeartbeat,
  removeSocket,
  rooms,
  sendToEverySocketInRoom,
  sockets,
  updateHeartbeat,
} from './room.state';

export const log = createPinoLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});

const app = new Elysia({
  websocket: {
    idleTimeout: 3 * 60 + 30, // WebSocket idle timeout 3 minutes 30 seconds
  },
})
  .use(
    cron({
      name: 'cleanupHeartbeats',
      pattern: '*/30 * * * * *', // Runs every 30 seconds
      run() {
        cleanupHeartbeats();
      },
    })
  )
  .use(
    cron({
      name: 'cleanupRooms',
      pattern: '0 0 * * *', // Runs every hour
      run() {
        cleanupRooms();
      },
    })
  );

app.get(
  '/analytics',
  (): {
    openSockets: number;
    connectedSocketUsers: number;
    openHeartbeats: number;
    openRooms: number;
    rooms: RoomServer[];
  } => {
    let connectedSocketUsers = 0;

    sockets.forEach((room) => {
      connectedSocketUsers += room.size;
    });

    const roomsList = Array.from(rooms.values());

    roomsList.forEach((room) => {
      room.users.forEach((user) => {
        // @ts-ignore
        delete user.ws;
      });
    });

    return {
      openSockets: sockets.size,
      connectedSocketUsers,
      openHeartbeats: heartbeats.size,
      openRooms: rooms.size,
      rooms: roomsList,
    };
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

    const room = getOrCreateRoom(roomId);

    room.addUser({
      id: userId,
      name: username,
      estimation: null,
      isSpectator: false,
      ws,
    });

    addSocketToRoom(roomId, userId, ws as ElysiaWS<any>);
    sendToEverySocketInRoom(room);
  },
  message(ws, data) {
    try {
      if (!CActionSchema.Check(data)) {
        ws.send(
          JSON.stringify({
            error: 'Invalid message format',
            wsId: ws.id,
            data: String(data),
          })
        );
        return;
      }

      const room = getOrCreateRoom(data.roomId);

      log.debug({ ...data, wsId: ws.id }, 'Received message');

      switch (true) {
        case isHeartbeatAction(data):
          updateHeartbeat(ws.id);
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
          removeSocket(ws.id);
          removeHeartbeat(ws.id);
          if (!room.users.some((user) => user.id === data.userId)) {
            return;
          }
          room.removeUser(data.userId);
          break;

        case isRejoinAction(data):
          room.addUser({
            id: data.userId,
            name: data.username,
            estimation: null,
            isSpectator: false,
            ws,
          });
          addSocketToRoom(data.roomId, data.userId, ws as ElysiaWS<any>);
          break;

        case isChangeUsernameAction(data):
          room.changeUsername(data.userId, data.username);
          break;

        case isFlipAction(data):
          if (!room.isFlippable) {
            log.error(
              {
                status: room.status,
                wsId: ws.id,
                ...data,
              },
              'Room is not in estimating state during flip action'
            );
            ws.send(
              JSON.stringify({
                error: 'Cannot flip when not flippable',
                wsId: ws.id,
                ...data,
              })
            );
            break;
          }

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
          break;
      }

      sendToEverySocketInRoom(room);
    } catch (error) {
      if (error instanceof Error) {
        log.error({ error, wsId: ws.id, ...data }, 'Error processing message');
        ws.send(
          JSON.stringify({
            error: error.message,
            stack: error.stack,
            name: error.name,
            wsId: ws.id,
            ...data,
          })
        );
      }
    }
  },
  close(ws) {
    log.debug({ wsId: ws.id }, `Connection closed`);
    removeSocket(ws.id);
    removeHeartbeat(ws.id);
  },
  // error(ws, error) {
  //     console.error(`WebSocket error: ${error.message}`);
  // }
});

app.listen(3003);

log.info(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
