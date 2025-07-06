// @ts-ignore

import { ServerWebSocket } from 'bun';
// @ts-ignore
import { ElysiaWS } from 'elysia/dist/ws';
import { preciseTimeout } from './utils';

/**
 * Users can estimate or spectate
 */

export interface CreateUserDto {
  id: string;
  name: string;
  estimation: number | null;
  isSpectator: boolean;
  ws: ElysiaWS<ServerWebSocket<any>, any>;
}

const userStatus = {
  pending: 'pending',
  estimated: 'estimated',
  spectator: 'spectator',
} as const;

export class User {
  readonly id: string;
  name: string;
  estimation: number | null = null;
  isSpectator: boolean;
  ws: ElysiaWS<ServerWebSocket<any>, any>;
  firstHeartbeat = Date.now();
  lastHeartbeat = Date.now();
  isPresent : boolean;

  get status(): keyof typeof userStatus {
    if (this.isSpectator) {
      return userStatus.spectator;
    }
    if (this.estimation) {
      return userStatus.estimated;
    }
    return userStatus.pending;
  }

  constructor({ id, name, estimation, isSpectator, ws }: CreateUserDto) {
    this.id = id;
    this.name = name;
    this.estimation = estimation;
    this.isSpectator = isSpectator;
    this.isPresent = true;
    this.ws = ws;
  }
}

/**
 * Room has a list of Users and a status
 * The status is either estimating, flippable or flipped
 * If auto flip is enabled, the room will flip automatically once everyone estimated
 *
 * RoomDto is the serialized version of Room that is sent to the users using WebSocket
 * RoomBase is the base class which has methods to map between Room and RoomDto
 * RoomClient is the version of Room that is used on the frontend
 * RoomServer is the version of Room that is used on the backend it has additional methods to mutate the state
 */

export const RoomStateStatus = {
  estimating: 'estimating',
  flippable: 'flippable',
  flipped: 'flipped',
} as const;

export interface RoomDto {
  id: number;
  startedAt: number;
  lastUpdated: number;
  users: CreateUserDto[];
  isFlipped: boolean;
  isAutoFlip: boolean;
  status: keyof typeof RoomStateStatus;
}

class RoomBase {
  readonly id: number;
  startedAt: number;
  lastUpdated: number;

  users: User[] = [];
  isFlipped = false;
  isAutoFlip = false;

  get isFlippable() {
    return (
      this.users.every(
        (user) => user.estimation !== null || user.isSpectator
      ) &&
      this.users.some((user) => !user.isSpectator) &&
      !this.isFlipped
    );
  }

  get status(): keyof typeof RoomStateStatus {
    if (this.isFlipped) {
      return RoomStateStatus.flipped;
    }
    if (this.isFlippable) {
      return RoomStateStatus.flippable;
    }
    return RoomStateStatus.estimating;
  }

  constructor(id: number) {
    this.id = id;
    this.startedAt = Date.now();
    this.lastUpdated = Date.now();
  }

  // Possible to create instances of RoomClient and RoomServer
  static fromJson<T extends RoomBase>(
    this: new (id: number) => T,
    roomStateDto: RoomDto
  ) {
    const roomState = new this(roomStateDto.id);
    roomState.startedAt = roomStateDto.startedAt;
    roomState.lastUpdated = roomStateDto.lastUpdated;
    roomState.users = roomStateDto.users.map((user) => new User(user));
    roomState.isFlipped = roomStateDto.isFlipped;
    roomState.isAutoFlip = roomStateDto.isAutoFlip;
    return roomState;
  }

  toJson(): RoomDto {
    return {
      id: this.id,
      startedAt: this.startedAt,
      lastUpdated: this.lastUpdated,
      users: this.users,
      isFlipped: this.isFlipped,
      isAutoFlip: this.isAutoFlip,
      status: this.status,
    };
  }

  toStringifiedJson(): string {
    return JSON.stringify(this.toJson());
  }
}

export class RoomClient extends RoomBase {
  getUser(userId: string | null) {
    // NOTE: you can never trust frontends
    if (!userId) {
      throw new Error(`User not found - userId not given`);
    }
    const user = this.users.find((user) => user.id === userId);
    if (!user) {
      throw new Error(`User not found - userId not found`);
    }
    return user;
  }
}

export class RoomServer extends RoomBase {
  hasChanged = false;
  isFlipAction = false;

  /**
   * USER MANAGEMENT
   */

  addUser(user: CreateUserDto) {
    if (!this.users.some((u) => u.id === user.id)) {
      this.users.push(new User(user));
    }
    // NOTE: we always set hasChanged to repair out of sync for users
    this.hasChanged = true;
  }

  removeUser(userId: string) {
    if (this.users.some((user) => user.id === userId)) {
      this.users = this.users.filter((user) => user.id !== userId);
      this.hasChanged = true;
      this.autoFlip();
    }
  }

  changeUsername(userId: string, name: string) {
    this.users = this.users.map((user) => {
      if (user.id === userId) {
        user.name = name;
        this.hasChanged = true;
      }
      return user;
    });
  }

  /**
   * INTERACTIONS
   */

  setEstimation(userId: string, estimation: number | null) {
    this.users = this.users.map((user) => {
      if (user.id === userId) {
        user.estimation = estimation;
        user.isSpectator = false;
        this.hasChanged = true;
      }
      return user;
    });
    this.autoFlip();
  }

  setSpectator(userId: string, isSpectator: boolean) {
    this.users = this.users.map((user) => {
      if (user.id === userId) {
        user.isSpectator = isSpectator;
        user.estimation = null;
        this.hasChanged = true;
      }
      return user;
    });
    this.autoFlip();
  }

  flip() {
    if (!this.isFlippable && !this.isFlipped) {
      this.hasChanged = true; // NOTE: we always set hasChanged to repair out of sync for users
      return;
    }
    this.isFlipped = true;
    this.hasChanged = true;
    this.isFlipAction = true;

    const fppServerSecret = process.env.FPP_SERVER_SECRET;

    if (!fppServerSecret) {
      throw new Error('FPP_SERVER_SECRET not set');
    }

    fetch(
      `${
        process.env.NODE_ENV === 'production'
          ? 'https://free-planning-poker.com/'
          : 'http://localhost:3001'
      }/api/trpc/room.trackFlip?batch=1`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          JSON.stringify({
            '0': {
              json: {
                roomId: this.id,
                fppServerSecret,
                roomState: this.toStringifiedJson(),
              },
            },
          })
        ),
      }
    ).then();
  }

  private autoFlip() {
    if (!this.isAutoFlip) {
      return;
    }

    preciseTimeout(() => {
      if (this.isAutoFlip && this.isFlippable && !this.isFlipped) {
        this.flip();
      }
    }, 1000); // 1 second
  }

  setAutoFlip(isAutoFlip: boolean) {
    this.isAutoFlip = isAutoFlip;
    this.hasChanged = true;
    this.autoFlip();
  }

  reset() {
    this.startedAt = Date.now();
    this.lastUpdated = Date.now();
    this.users = this.users.map((user) => {
      user.estimation = null;
      return user;
    });
    this.isFlipped = false;
    this.hasChanged = true;
  }
}