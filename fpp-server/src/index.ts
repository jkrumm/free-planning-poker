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
import { RoomState } from './room.state';

export const log = createPinoLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});

const roomState = new RoomState();

const app = new Elysia({
  websocket: {
    idleTimeout: 3 * 60 + 30, // WebSocket idle timeout 3 minutes 30 seconds
  },
}).use(
  cron({
    name: 'cleanupInactiveUsers',
    pattern: '*/30 * * * * *', // Runs every 30 seconds
    run() {
      roomState.cleanupInactiveUsers();
    },
  })
);

app.get(
  '/analytics',
  (): {
    connectedUsers: number;
    openRooms: number;
    rooms: {
      userCount: number;
      lastActive: string;
      users: {
        estimation: any;
        isSpectator: boolean;
        lastActive: string;
      }[];
    }[];
  } => {
    roomState.cleanupInactiveUsers();

    let connectedUsers = 0;
    const roomsList = Array.from(roomState['rooms'].values()).map((room) => {
      let mostRecentActivity = 0;
      const users = room.users.map((user) => {
        connectedUsers++;
        if (user.lastHeartbeat > mostRecentActivity) {
          mostRecentActivity = user.lastHeartbeat;
        }
        return {
          estimation: user.estimation,
          isSpectator: user.isSpectator,
          lastActive: new Date(user.lastHeartbeat).toLocaleString(), // Human-readable timestamp
        };
      });

      return {
        userCount: room.users.length,
        lastActive: new Date(mostRecentActivity).toLocaleString(), // Most recent activity in the room
        users,
      };
    });

    return {
      connectedUsers, // Total number of users across all rooms
      openRooms: roomState['rooms'].size,
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

    roomState.addUserToRoom(roomId, {
      id: userId,
      name: username,
      estimation: null,
      isSpectator: false,
      ws,
    });

    roomState.sendToEverySocketInRoom(roomId);
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

      roomState.sendToEverySocketInRoom(room.id);
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
    roomState.removeUserFromRoomByWsId(ws.id);
  },
  // error(ws, error) {
  //     console.error(`WebSocket error: ${error.message}`);
  // }
});

app.listen(3003);

log.info(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
