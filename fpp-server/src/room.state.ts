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
      log.debug({ roomId }, 'Created new room');
    }
    return room;
  }

  addUserToRoom(roomId: number, user: User): void {
    const room = this.getOrCreateRoom(roomId);
    const existingUser = room.users.find(u => u.id === user.id);
    
    if (existingUser) {
      // Update existing user's WebSocket connection and heartbeat
      existingUser.ws = user.ws;
      existingUser.name = user.name;
      existingUser.lastHeartbeat = Date.now();
      log.debug(
        { userId: user.id, roomId }, 
        'Updated existing user WebSocket connection'
      );
    } else {
      room.addUser(user);
      log.debug(
        { userId: user.id, roomId, userCount: room.users.length }, 
        'Added new user to room'
      );
    }
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
    log.info(
      { userId, roomId, userCount: room.users.length },
      'User removed from room'
    );
    
    // ALWAYS send update when user is removed
    this.forceSendToEverySocketInRoom(roomId);
    
    if (room.users.length === 0) {
      this.rooms.delete(roomId);
      log.debug({ roomId }, 'Removed empty room');
    }
  }

  removeUserFromRoomByWsId(wsId: string): { userId: string; roomId: number } | null {
    for (const room of this.rooms.values()) {
      for (const user of room.users) {
        if (user.ws.id === wsId) {
          const userId = user.id;
          const roomId = room.id;
          room.removeUser(user.id);
          
          log.info(
            { userId, roomId, userCount: room.users.length },
            'User disconnected via WebSocket close'
          );
          
          // FORCE send updated state to remaining users
          this.forceSendToEverySocketInRoom(roomId);
          
          // Clean up empty room
          if (room.users.length === 0) {
            this.rooms.delete(roomId);
            log.debug({ roomId }, 'Removed empty room after user disconnect');
          }
          
          return { userId, roomId };
        }
      }
    }
    return null;
  }

  // Original method - only sends if hasChanged
  sendToEverySocketInRoom(roomId: number): void {
    const room = this.rooms.get(roomId);
    if (room && room.hasChanged) {
      this.doSendToEverySocketInRoom(room);
    }
  }

  // New method - ALWAYS sends (for critical updates like disconnections)
  forceSendToEverySocketInRoom(roomId: number): void {
    const room = this.rooms.get(roomId);
    if (room) {
      this.doSendToEverySocketInRoom(room);
    }
  }

  // New method - Force sync all rooms (called by cron)
  forceSync(): void {
    for (const room of this.rooms.values()) {
      // Only sync rooms that have users
      if (room.users.length > 0) {
        this.doSendToEverySocketInRoom(room);
      }
    }
  }

  // Consolidated send logic
  private doSendToEverySocketInRoom(room: RoomServer): void {
    const deadConnections: string[] = [];
    const roomData = room.toStringifiedJson();
    
    for (const user of room.users) {
      try {
        user.ws.send(roomData);
      } catch (error) {
        log.warn(
          { userId: user.id, roomId: room.id, wsId: user.ws.id, error },
          'Failed to send message to user - marking for removal'
        );
        deadConnections.push(user.id);
      }
    }
    
    // Remove users with dead connections and force another update if needed
    if (deadConnections.length > 0) {
      for (const userId of deadConnections) {
        room.removeUser(userId);
      }
      log.info(
        { roomId: room.id, removedUsers: deadConnections.length },
        'Removed users with dead connections'
      );
      
      // Recursive call to update remaining users about the removals
      if (room.users.length > 0) {
        this.doSendToEverySocketInRoom(room);
      }
    }
    
    room.lastUpdated = Date.now();
    room.hasChanged = false; // Reset change flag after update
  }

  updateHeartbeat(wsId: string): boolean {
    for (const room of this.rooms.values()) {
      for (const user of room.users) {
        if (user.ws.id === wsId) {
          user.lastHeartbeat = Date.now();
          return true;
        }
      }
    }
    return false; // User not found
  }

  cleanupInactiveState(): void {
    const now = Date.now();
    const HEARTBEAT_TIMEOUT = 80 * 1000; // 80 seconds (client timeout is 60s + buffer)
    
    for (const room of this.rooms.values()) {
      const usersToRemove: string[] = [];
      
      for (const user of room.users) {
        const timeSinceLastHeartbeat = now - user.lastHeartbeat;
        if (timeSinceLastHeartbeat > HEARTBEAT_TIMEOUT) {
          log.info(
            { 
              userId: user.id, 
              roomId: room.id, 
              timeSinceLastHeartbeat,
              wsId: user.ws.id 
            },
            'Removing user due to heartbeat timeout'
          );
          usersToRemove.push(user.id);
        }
      }
      
      // Remove inactive users
      for (const userId of usersToRemove) {
        room.removeUser(userId);
      }
      
      // FORCE send updates if users were removed (critical for sync)
      if (usersToRemove.length > 0) {
        this.forceSendToEverySocketInRoom(room.id);
      }
      
      // Clean up empty rooms
      if (room.users.length === 0) {
        this.rooms.delete(room.id);
        log.debug({ roomId: room.id }, 'Removed empty room during cleanup');
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