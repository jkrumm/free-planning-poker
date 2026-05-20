import { type ElysiaWS } from 'elysia/ws';
import { ATTR, EVENT } from '@fpp/shared/telemetry';
import { log } from './index';
import { RoomServer, type User } from './room.entity';
import { roomSnapshot } from './room.snapshot';
import { metrics } from './telemetry';
import { type Analytics, type AnalyticsUser } from './types';
import { captureError, captureMessage, recordEvent } from './utils/app-error';
import { WEBSOCKET_CONSTANTS } from './websocket.constants';

type CloseReason = 'empty' | 'timeout';

export class RoomState {
  private rooms = new Map<number, RoomServer>();
  private userConnections = new Map<
    string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { roomId: number; userId: string; ws: ElysiaWS<any, any> }
  >();

  /**
   * Live counts for the three concurrency gauges (read each metric-collection
   * cycle by the observable callbacks — see telemetry.registerActiveGauges).
   * The Maps are the source of truth; the gauges just sample them.
   */
  get activeRoomCount(): number {
    return this.rooms.size;
  }

  get activeConnectionCount(): number {
    return this.userConnections.size;
  }

  get activeUserCount(): number {
    let count = 0;
    for (const room of this.rooms.values()) count += room.users.length;
    return count;
  }

  getOrCreateRoom(roomId: number): RoomServer {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = new RoomServer(roomId);
      this.rooms.set(roomId, room);
      log.debug({ roomId }, 'Created new room');
      // Sole chokepoint for room.created — the rooms-Map insertion site, so the
      // count tracks fpp.room.active (rooms.size). Callers exclude heartbeat so
      // a stray liveness ping can't conjure a room.
      recordEvent(EVENT.ROOM_CREATED, { [ATTR.ROOM_ID]: roomId });
      metrics.roomCreated.add(1);
    }
    return room;
  }

  /**
   * Tear down a room: drop it from memory, delete its snapshot, and emit the
   * room.closed signal. Single chokepoint for both close reasons (`empty` when
   * the last user leaves, `timeout` when the 30-min sweep empties it).
   */
  private closeRoom(roomId: number, reason: CloseReason): void {
    this.rooms.delete(roomId);
    roomSnapshot.delete(roomId);
    recordEvent(EVENT.ROOM_CLOSED, {
      [ATTR.ROOM_ID]: roomId,
      [ATTR.CLOSE_REASON]: reason,
    });
    metrics.roomClosed.add(1, { [ATTR.CLOSE_REASON]: reason });
    log.debug({ roomId, reason }, 'Closed room');
  }

  /**
   * Hydrate a room from Redis if we don't already have populated in-memory
   * state for it. Safe to call concurrently — the snapshot store deduplicates
   * inflight fetches per room.
   *
   * Race handling: Bun delivers WebSocket `message` events even while an
   * async `open` is still awaiting, so a stray message can `getOrCreateRoom`
   * an empty in-memory room before hydration completes. We treat an empty
   * in-memory room as "not yet hydrated" and replace it with the snapshot
   * version when the fetch returns. Populated in-memory state always wins
   * (it's authoritative — the snapshot is just a warm cache).
   */
  async ensureHydrated(roomId: number): Promise<void> {
    const initial = this.rooms.get(roomId);
    if (initial && initial.users.length > 0) return;
    if (!roomSnapshot.isEnabled()) return;

    const json = await roomSnapshot.fetch(roomId);
    if (!json) return;

    const current = this.rooms.get(roomId);
    if (current && current.users.length > 0) {
      // Real users joined while we were fetching — in-memory wins.
      log.debug(
        { roomId, userCount: current.users.length },
        'Hydration skipped: in-memory state advanced during fetch',
      );
      return;
    }

    try {
      const dto = JSON.parse(json) as Parameters<
        typeof RoomServer.fromSnapshot
      >[0];
      const room = RoomServer.fromSnapshot(dto);
      this.rooms.set(roomId, room);
      log.info(
        { roomId, userCount: room.users.length },
        'Rehydrated room from Redis snapshot',
      );
    } catch (err) {
      captureError(
        err as Error,
        {
          component: 'roomState',
          action: 'ensureHydrated',
          extra: { roomId },
        },
        'medium',
      );
    }
  }

  /**
   * Returns the serialized room or null. A 0-user room is treated as "gone"
   * so we never overwrite a good snapshot with an empty placeholder created
   * by a stray getOrCreateRoom call during the open→hydrate window.
   */
  serializeRoom(roomId: number): string | null {
    const room = this.rooms.get(roomId);
    if (!room || room.users.length === 0) return null;
    return room.toStringifiedJson();
  }

  /** Force-write any pending snapshots. Call before draining on SIGTERM. */
  flushSnapshots(): Promise<void> {
    return roomSnapshot.flushAll((id) => this.serializeRoom(id));
  }

  addUserToRoom(roomId: number, user: User): void {
    if (!user.ws) {
      // addUserToRoom only runs from the WebSocket open/rejoin paths, where
      // ws is always live. A null here means a programming error — bail
      // rather than crash on user.ws.id below.
      captureMessage(
        'addUserToRoom called with ws-less user',
        {
          component: 'roomState',
          action: 'addUserToRoom',
          extra: { roomId, userId: user.id },
        },
        'high',
      );
      return;
    }
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
        {
          userId: user.id,
          roomId,
          name: user.name,
          isPresent: currentPresenceState,
        },
        'Updated existing user connection - preserved presence state',
      );
    } else {
      // Add new user
      room.addUser(user);
      log.debug(
        { userId: user.id, roomId, userCount: room.users.length },
        'Added new user to room',
      );
      // New user actually added → room.joined. The existing-user branch above is
      // a reconnect (already in the room), not a join, so it stays silent.
      recordEvent(EVENT.ROOM_JOINED, {
        [ATTR.ROOM_ID]: roomId,
        [ATTR.USER_ID]: user.id,
        [ATTR.ROOM_USER_COUNT]: room.users.length,
      });
    }
  }

  private cleanupUserConnection(userId: string, roomId: number): void {
    // Find and remove any existing WebSocket connections for this user
    for (const [wsId, connection] of this.userConnections.entries()) {
      if (connection.userId === userId && connection.roomId === roomId) {
        this.userConnections.delete(wsId);
        log.debug(
          { userId, roomId, wsId },
          'Cleaned up previous connection for user',
        );
      }
    }
  }

  removeUserFromRoom(
    roomId: number,
    userId: string,
    departure: 'leave' | 'kick' = 'leave',
  ): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }

    const userExists = room.users.some((user) => user.id === userId);
    if (!userExists) {
      return;
    }

    // room.removeUser emits room.left (the departure). A kick is additionally a
    // moderation event — emit user.kicked here, the only path that knows the
    // departure was forced (the sweep calls room.removeUser directly with none).
    if (departure === 'kick') {
      recordEvent(EVENT.USER_KICKED, {
        [ATTR.ROOM_ID]: roomId,
        [ATTR.USER_ID]: userId,
      });
    }

    room.removeUser(userId);

    // Clean up connection tracking
    this.cleanupUserConnection(userId, roomId);

    log.debug(
      { userId, roomId, userCount: room.users.length },
      'User removed from room',
    );

    // Send update to remaining users
    this.sendToEverySocketInRoom(roomId);

    // Clean up empty room
    if (room.users.length === 0) {
      this.closeRoom(roomId, 'empty');
    }
  }

  getUserConnection(wsId: string): { userId: string; roomId: number } | null {
    const connection = this.userConnections.get(wsId);
    return connection
      ? { userId: connection.userId, roomId: connection.roomId }
      : null;
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
      'WebSocket connection removed - user stays in room until heartbeat timeout',
    );

    return { userId, roomId };
  }

  sendToEverySocketInRoom(roomId: number): void {
    const room = this.rooms.get(roomId);
    if (!room || room.users.length === 0) {
      return;
    }

    const roomData = room.toStringifiedJson();
    let successCount = 0;
    let failureCount = 0;

    for (const user of room.users) {
      try {
        // Check if this user still has an active WebSocket connection
        const hasActiveConnection = Array.from(
          this.userConnections.values(),
        ).some((conn) => conn.userId === user.id && conn.roomId === roomId);

        if (hasActiveConnection && user.ws) {
          user.ws.send(roomData);
          successCount++;
          log.debug(
            { userId: user.id, roomId: room.id, wsId: user.ws.id },
            'Successfully sent room data to user',
          );
        } else {
          log.debug(
            { userId: user.id, roomId: room.id },
            'User has no active connection - skipping message send',
          );
        }
      } catch (error: unknown) {
        failureCount++;
        captureError(
          error as Error,
          {
            component: 'roomState',
            action: 'broadcastToUser',
            extra: {
              roomId: String(roomId),
              userId: user.id,
              totalUsers: room.users.length,
            },
          },
          'medium',
        );
      }
    }

    // Track if there were excessive failures
    if (failureCount > 0 && failureCount >= room.users.length / 2) {
      captureMessage(
        'High WebSocket send failure rate in room',
        {
          component: 'roomState',
          action: 'broadcastAll',
          extra: {
            roomId: String(roomId),
            totalUsers: room.users.length,
            successCount,
            failureCount,
            failureRate: Number(
              ((failureCount / room.users.length) * 100).toFixed(1),
            ),
          },
        },
        'high',
      );
    }

    room.lastUpdated = Date.now();
    room.hasChanged = false;

    // Write-through to Redis (debounced). Cheap on a hot broadcast burst —
    // multiple changes within PERSIST_DEBOUNCE_MS coalesce into one write.
    // Re-resolve the room at flush time so concurrent removals are reflected.
    roomSnapshot.schedule(roomId, () => this.serializeRoom(roomId));
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
      timestamp: Date.now(),
    });

    recordEvent(EVENT.ROOM_RENAMED, { [ATTR.ROOM_ID]: roomId });

    for (const user of room.users) {
      try {
        // Check if this user still has an active WebSocket connection
        const hasActiveConnection = Array.from(
          this.userConnections.values(),
        ).some((conn) => conn.userId === user.id && conn.roomId === roomId);

        if (hasActiveConnection && user.ws) {
          user.ws.send(roomNameChangeMessage);
          log.debug(
            { userId: user.id, roomId: room.id, roomName, wsId: user.ws.id },
            'Successfully sent room name change notification to user',
          );
        } else {
          log.debug(
            { userId: user.id, roomId: room.id },
            'User has no active connection - skipping room name change notification',
          );
        }
      } catch (error: unknown) {
        captureError(
          error as Error,
          {
            component: 'roomState',
            action: 'sendRoomNameChange',
            extra: {
              roomId: String(roomId),
              userId: user.id,
              roomName,
            },
          },
          'medium',
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
              wsId: user.ws?.id ?? null,
            },
            'Removing user due to 30-minute heartbeat timeout',
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
        this.closeRoom(room.id, 'timeout');
      } else {
        // Room survived the sweep — refresh its Redis TTL. Heartbeats alone
        // don't trigger writes, so without this an idle-but-occupied room
        // could expire from Redis while in-memory state is still alive.
        roomSnapshot.touch(room.id);
      }
    }

    // Cleanup summary is already logged by Pino
  }

  // Add method to update presence
  updateUserPresence(
    roomId: number,
    userId: string,
    isPresent: boolean,
  ): boolean {
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
    recordEvent(EVENT.USER_PRESENCE_CHANGED, {
      [ATTR.ROOM_ID]: roomId,
      [ATTR.USER_ID]: userId,
      [ATTR.USER_IS_PRESENT]: isPresent,
    });
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
