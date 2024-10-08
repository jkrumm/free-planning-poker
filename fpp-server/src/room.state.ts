import { ElysiaWS } from 'elysia/dist/ws';
import { log } from './index';
import { RoomServer, User } from './room.entity';

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
            'Removed user by wsId'
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
      room.hasChanged = false; // Reset change flag after update
    }
  }

  cleanupInactiveRooms(): void {
    for (const [roomId, room] of this.rooms) {
      if (room.users.length === 0) {
        this.rooms.delete(roomId);
        log.debug({ roomId }, 'Removed room due to inactivity');
      }
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

  cleanupInactiveUsers(): void {
    let hasChanged = false;
    const now = Date.now();
    for (const room of this.rooms.values()) {
      for (const user of room.users) {
        if (now - user.lastHeartbeat > 3 * 60 * 1000) {
          room.removeUser(user.id);
          log.debug(
            { userId: user.id, roomId: room.id },
            'Removed user due to inactivity'
          );
        }
      }
    }
    if (hasChanged) {
      this.cleanupInactiveRooms();
    }
  }
}
