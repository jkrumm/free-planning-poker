import { type ElysiaWS } from 'elysia/dist/ws';
import { log } from './index';
import { RoomServer, type User } from './room.entity';
import { type Analytics, type AnalyticsUser } from './types';
import { WEBSOCKET_CONSTANTS } from './websocket.constants';

export class RoomState {
  private rooms = new Map<number, RoomServer>();
  private userConnections = new Map<
    string,
    { roomId: number; userId: string; ws: ElysiaWS<any> }
  >();

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

    // Remove any existing connection for this user in this room
    this.cleanupUserConnection(user.id, roomId);

    // Track the WebSocket connection
    this.userConnections.set(user.ws.id, {
      roomId,
      userId: user.id,
      ws: user.ws,
    });

    const existingUser = room.users.find((u) => u.id === user.id);

    if (existingUser) {
      // Update existing user's connection but preserve their current presence state
      const currentPresenceState = existingUser.isPresent;
      existingUser.ws = user.ws;
      existingUser.name = user.name;
      existingUser.lastHeartbeat = Date.now();
      existingUser.isPresent = currentPresenceState; // Preserve the current presence state
      log.debug(
        { userId: user.id, roomId, name: user.name, isPresent: currentPresenceState },
        'Updated existing user connection - preserved presence state'
      );
    } else {
      // Add new user
      room.addUser(user);
      log.debug(
        { userId: user.id, roomId, userCount: room.users.length },
        'Added new user to room'
      );
    }
  }

  private cleanupUserConnection(userId: string, roomId: number): void {
    // Find and remove any existing WebSocket connections for this user
    for (const [wsId, connection] of this.userConnections.entries()) {
      if (connection.userId === userId && connection.roomId === roomId) {
        this.userConnections.delete(wsId);
        log.debug(
          { userId, roomId, wsId },
          'Cleaned up previous connection for user'
        );
      }
    }
  }

  removeUserFromRoom(roomId: number, userId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }

    const userExists = room.users.some((user) => user.id === userId);
    if (!userExists) {
      return;
    }

    room.removeUser(userId);

    // Clean up connection tracking
    this.cleanupUserConnection(userId, roomId);

    log.debug(
      { userId, roomId, userCount: room.users.length },
      'User removed from room'
    );

    // Send update to remaining users
    this.sendToEverySocketInRoom(roomId);

    // Clean up empty room
    if (room.users.length === 0) {
      this.rooms.delete(roomId);
      log.debug({ roomId }, 'Removed empty room');
    }
  }

  getUserConnection(wsId: string): { userId: string; roomId: number } | null {
    const connection = this.userConnections.get(wsId);
    return connection ? { userId: connection.userId, roomId: connection.roomId } : null;
  }

  removeConnection(wsId: string): { userId: string; roomId: number } | null {
    const connection = this.userConnections.get(wsId);
    if (!connection) {
      return null;
    }

    const { userId, roomId } = connection;
    
    // Only remove the connection, not the user
    this.userConnections.delete(wsId);
    
    log.debug(
      { userId, roomId, wsId },
      'WebSocket connection removed - user stays in room until heartbeat timeout'
    );

    return { userId, roomId };
  }

  sendToEverySocketInRoom(roomId: number): void {
    const room = this.rooms.get(roomId);
    if (!room || room.users.length === 0) {
      return;
    }

    const roomData = room.toStringifiedJson();

    for (const user of room.users) {
      try {
        // Check if this user still has an active WebSocket connection
        const hasActiveConnection = Array.from(this.userConnections.values())
          .some(conn => conn.userId === user.id && conn.roomId === roomId);
      
        if (hasActiveConnection) {
          user.ws.send(roomData);
          log.debug(
            { userId: user.id, roomId: room.id, wsId: user.ws.id },
            'Successfully sent room data to user'
          );
        } else {
          log.debug(
            { userId: user.id, roomId: room.id },
            'User has no active connection - skipping message send'
          );
        }
      } catch (error) {
        log.debug(
          { userId: user.id, roomId: room.id, error },
          'Failed to send message to user - connection likely closed'
        );
      }
    }

    room.lastUpdated = Date.now();
    room.hasChanged = false;
  }

  sendRoomNameChangeToAllUsers(roomId: number, roomName: string): void {
    const room = this.rooms.get(roomId);
    if (!room || room.users.length === 0) {
      return;
    }

    const roomNameChangeMessage = JSON.stringify({
      type: 'roomNameChanged',
      roomId,
      roomName,
      timestamp: Date.now()
    });

    for (const user of room.users) {
      try {
        // Check if this user still has an active WebSocket connection
        const hasActiveConnection = Array.from(this.userConnections.values())
          .some(conn => conn.userId === user.id && conn.roomId === roomId);
      
        if (hasActiveConnection) {
          user.ws.send(roomNameChangeMessage);
          log.debug(
            { userId: user.id, roomId: room.id, roomName, wsId: user.ws.id },
            'Successfully sent room name change notification to user'
          );
        } else {
          log.debug(
            { userId: user.id, roomId: room.id },
            'User has no active connection - skipping room name change notification'
          );
        }
      } catch (error) {
        log.debug(
          { userId: user.id, roomId: room.id, error },
          'Failed to send room name change notification to user - connection likely closed'
        );
      }
    }

    room.lastUpdated = Date.now();
  }

  updateHeartbeat(wsId: string): boolean {
    const connection = this.userConnections.get(wsId);
    if (!connection) {
      return false;
    }

    const room = this.rooms.get(connection.roomId);
    if (!room) {
      return false;
    }

    const user = room.users.find((u) => u.id === connection.userId);
    if (!user) {
      return false;
    }

    user.lastHeartbeat = Date.now();
    return true;
  }

  cleanupInactiveState(): void {
    const now = Date.now();
    // Use the constant from websocket.constants.ts
    const HEARTBEAT_TIMEOUT = WEBSOCKET_CONSTANTS.HEARTBEAT_TIMEOUT;

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
              wsId: user.ws.id,
            },
            'Removing user due to 30-minute heartbeat timeout'
          );
          usersToRemove.push(user.id);
        }
      }

    // Remove inactive users
    for (const userId of usersToRemove) {
      room.removeUser(userId);
      this.cleanupUserConnection(userId, room.id);
    }

    // Send updates if users were removed
    if (usersToRemove.length > 0) {
      this.sendToEverySocketInRoom(room.id);
    }

    // Clean up empty rooms
    if (room.users.length === 0) {
      this.rooms.delete(room.id);
      log.debug({ roomId: room.id }, 'Removed empty room during cleanup');
    }
  }}

  // Add method to update presence
  updateUserPresence(roomId: number, userId: string, isPresent: boolean): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }

    const user = room.users.find((u) => u.id === userId);
    if (!user) {
      return false;
    }

    user.isPresent = isPresent;
    room.hasChanged = true;
    return true;
  }

  toAnalytics(): Analytics {
    let connectedUsers = 0;
    const roomsList = Array.from(this.rooms.values()).map((room) => {
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
      openRooms: this.rooms.size,
      rooms: roomsList,
    };
  }
}