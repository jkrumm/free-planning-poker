/**
 * Shared types between Next.js frontend and Bun server
 * This file must not import any Bun-specific or server-specific dependencies
 */

/**
 * Users can estimate or spectate
 */

export interface CreateUserDto {
  id: string;
  name: string;
  estimation: number | null;
  isSpectator: boolean;
  isPresent: boolean;
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
  firstHeartbeat = Date.now();
  lastHeartbeat = Date.now();
  isPresent: boolean;

  get status(): keyof typeof userStatus {
    if (this.isSpectator) {
      return userStatus.spectator;
    }
    if (this.estimation) {
      return userStatus.estimated;
    }
    return userStatus.pending;
  }

  constructor({ id, name, estimation, isSpectator, isPresent }: CreateUserDto) {
    this.id = id;
    this.name = name;
    this.estimation = estimation;
    this.isSpectator = isSpectator;
    this.isPresent = isPresent;
  }
}

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

export class RoomBase {
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
