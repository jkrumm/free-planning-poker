import { ElysiaWS } from 'elysia/dist/ws';
import { log } from './index';
import { RoomServer, User } from './room.entity';
import { Analytics, AnalyticsUser } from './types';

export class RoomState {
  private rooms: Map<number, RoomServer> = new Map();

  getOrCreateRoom(roomId: number): RoomServer {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = new RoomServer(roomId);
      this.rooms.set(roomId, room);
    }
    return room;
  }

  addUserToRoom(roomId: number, user: User): void {
    const room = this.getOrCreateRoom(roomId);
    room.addUser(user);
  }

  removeUserFromRoom(roomId: number, userId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }
    if (!room.users.some((user) => user.id === userId)) {
      return;
    }
    room.removeUser(userId);
    if (room.users.length === 0) {
      this.rooms.delete(roomId);
      log.debug({ roomId }, 'Removed room due to inactivity');
    }
  }

  removeUserFromRoomByWsId(wsId: string): void {
    for (const room of this.rooms.values()) {
      for (const user of room.users) {
        if (user.ws.id === wsId) {
          room.removeUser(user.id);
          log.debug(
            { userId: user.id, roomId: room.id },
            'Removed user by wsId',
          );
          return;
        }
      }
    }
  }

  sendToEverySocketInRoom(roomId: number): void {
    const room = this.rooms.get(roomId);
    if (room && room.hasChanged) {
      for (const user of room.users) {
        user.ws.send(room.toStringifiedJson());
      }
      room.lastUpdated = Date.now();
      room.hasChanged = false; // Reset change flag after update
    }
  }

  updateHeartbeat(wsId: string): void {
    for (const room of this.rooms.values()) {
      for (const user of room.users) {
        if (user.ws.id === wsId) {
          user.lastHeartbeat = Date.now();
          return;
        }
      }
    }
  }

  cleanupInactiveState(): void {
    const now = Date.now();
    for (const room of this.rooms.values()) {
      for (const user of room.users) {
        if (now - user.lastHeartbeat > 3 * 60 * 1000) { // 3 minutes
          room.removeUser(user.id);
          log.debug(
            { userId: user.id, roomId: room.id },
            'Removed user due to inactivity',
          );
        }
      }
      this.sendToEverySocketInRoom(room.id);
      if (room.users.length === 0) {
        this.rooms.delete(room.id);
        log.debug({ roomId: room.id }, 'Removed room due to inactivity');
      }
    }
  }

  toAnalytics(): Analytics {
    let connectedUsers = 0;
    const roomsList = Array.from(this['rooms'].values()).map((room) => {
      let mostRecentActivity = room.startedAt;
      const users: AnalyticsUser[] = room.users.map((user) => {
        connectedUsers++;
        if (user.lastHeartbeat > mostRecentActivity) {
          mostRecentActivity = user.lastHeartbeat;
        }
        return {
          estimation: user.estimation,
          isSpectator: user.isSpectator,
          firstActive: user.firstHeartbeat,
          firstActiveReadable: new Date(user.firstHeartbeat).toLocaleString(),
          lastActive: user.lastHeartbeat,
          lastActiveReadable: new Date(user.lastHeartbeat).toLocaleString(),
        };
      });

      const lastActive =
        room.lastUpdated > mostRecentActivity
          ? room.lastUpdated
          : mostRecentActivity;

      return {
        userCount: room.users.length,
        firstActive: room.startedAt,
        firstActiveReadable: new Date(room.startedAt).toLocaleString(),
        lastActive,
        lastActiveReadable: new Date(lastActive).toLocaleString(),
        lastUpdated: room.lastUpdated,
        lastUpdatedReadable: new Date(room.lastUpdated).toLocaleString(),
        users,
      };
    });

    return {
      connectedUsers,
      openRooms: this['rooms'].size,
      rooms: roomsList,
    };
  }
}
