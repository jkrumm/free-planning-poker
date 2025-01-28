import { log } from './index';
import { RoomServer, User } from './room.entity';
import { Analytics, AnalyticsUser } from './types';

export const InteractionType = {
  CreateRoomState: 'createRoomState',
  UserJoined: 'UserJoined',
  UserRejoined: 'UserRejoined',
  UserLeft: 'UserLeft',
  UserRemoved: 'UserRemoved',
  UserClosedConnection: 'UserClosedConnection',
  DeletedRoomDueToUserLeave: 'deletedRoomDueToUserLeave',
  DeletedRoomDueToInactivity: 'deletedRoomDueToInactivity',

  Heartbeat: 'heartbeat',
  ChangedUsername: 'changedUsername',
  Estimated: 'estimated',
  SetSpectator: 'setSpectator',
  Reset: 'reset',
  SetAutoFlip: 'setAutoFlip',
  Flipped: 'flipped',
} as const;

export interface Interaction {
  timestamp: number;
  type: (typeof InteractionType)[keyof typeof InteractionType];
}

export const ErrorType = {
  MissingQueryParamsOpenConnection: 'MissingQueryParamsOpenConnection',
  OpenFailed: 'OpenFailed',
  InvalidMessageFormat: 'InvalidMessageFormat',
  UnknownAction: 'UnknownAction',
  MessageFailed: 'MessageFailed',
  CloseFailed: 'CloseFailed',
  GetAnalyticsFailed: 'GetAnalyticsFailed',
};

export interface CustomError {
  timestamp: number;
  message: typeof ErrorType[keyof typeof ErrorType];
  originalError: string | null;
  roomId: number | null;
  userId: string | null;
  extra: Record<string, string> | null;
}

export class RoomState {
  private rooms: Map<number, RoomServer> = new Map();
  private interactions: Interaction[] = [];
  private errors: CustomError[] = [];

  trackInteraction(type: (typeof InteractionType)[keyof typeof InteractionType]): this {
    log.debug('Interaction: ' + type);
    this.interactions.push({
      timestamp: Date.now(),
      type,
    });
    return this;
  }

  trackError({
               message,
               originalError,
               roomId,
               userId,
    extra
             }: {
    message: typeof ErrorType[keyof typeof ErrorType],
    originalError: Error | unknown | null,
    roomId: number | null,
    userId: string | null
    extra?: Record<string, string>
  }) {
    const error: CustomError = {
      timestamp: Date.now(),
      message,
      originalError: originalError instanceof Error ? originalError.toString() : null,
      roomId,
      userId,
      extra: extra || null,
    };
    log.error(error, message);
    this.errors.push(error);
  }

  getOrCreateRoom(roomId: number): RoomServer {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = new RoomServer(roomId);
      this.rooms.set(roomId, room);
      this.trackInteraction(InteractionType.CreateRoomState);
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
    this.trackInteraction(InteractionType.UserLeft);
    if (room.users.length === 0) {
      this.rooms.delete(roomId);
      this.trackInteraction(InteractionType.DeletedRoomDueToUserLeave);
    }
  }

  removeUserFromRoomByWsId(wsId: string): void {
    for (const room of this.rooms.values()) {
      for (const user of room.users) {
        if (user.ws.id === wsId) {
          room.removeUser(user.id);
          this.trackInteraction(InteractionType.UserClosedConnection);
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
          this.trackInteraction(InteractionType.Heartbeat);
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
          this.trackInteraction(InteractionType.UserRemoved);
        }
      }
      this.sendToEverySocketInRoom(room.id);
      if (room.users.length === 0) {
        this.rooms.delete(room.id);
        this.trackInteraction(InteractionType.DeletedRoomDueToInactivity);
      }
    }
  }

  cleanupInteractionsAndErrors(): void {
    // Keep only the last 10000 interactions and 100 errors or the last 7 days
    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    this.interactions = this.interactions.filter((interaction) => interaction.timestamp > oneWeekAgo);
    this.errors = this.errors.filter((error) => error.timestamp > oneWeekAgo);
    this.interactions = this.interactions.slice(-10000);
    this.errors = this.errors.slice(-100);
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

    // Group by interaction type and count them grouped by timestamp by hour
    const interactionsWeekly: {
      timestamp: number;
      interactionCounts: Record<(typeof InteractionType)[keyof typeof InteractionType], number>
    }[] = [];
    const interactionsByHour: Record<number, Record<string, number>> = {};
    for (const interaction of this.interactions) {
      const hour = Math.floor(interaction.timestamp / (60 * 60 * 1000));
      if (!interactionsByHour[hour]) {
        interactionsByHour[hour] = {};
      }
      if (!interactionsByHour[hour][interaction.type]) {
        interactionsByHour[hour][interaction.type] = 0;
      }
      interactionsByHour[hour][interaction.type]++;
    }
    for (const hour in interactionsByHour) {
      const timestamp = parseInt(hour) * 60 * 60 * 1000;
      interactionsWeekly.push({
        timestamp,
        interactionCounts: interactionsByHour[hour],
      });
    }

    const interactionsDaily: {
      timestamp: number;
      interactionCounts: Record<(typeof InteractionType)[keyof typeof InteractionType], number>
    }[] = [];
    const interactionsByDay: Record<number, Record<string, number>> = {};
    for (const interaction of this.interactions) {
      const day = Math.floor(interaction.timestamp / (24 * 60 * 60 * 1000));
      if (!interactionsByDay[day]) {
        interactionsByDay[day] = {};
      }
      if (!interactionsByDay[day][interaction.type]) {
        interactionsByDay[day][interaction.type] = 0;
      }
      interactionsByDay[day][interaction.type]++;
    }
    for (const day in interactionsByDay) {
      const timestamp = parseInt(day) * 24 * 60 * 60 * 1000;
      interactionsDaily.push({
        timestamp,
        interactionCounts: interactionsByDay[day],
      });
    }

    return {
      connectedUsers,
      openRooms: this['rooms'].size,
      rooms: roomsList,
      errors: this.errors,
      interactionsWeekly,
      interactionsDaily
    };
  }
}
