import { TRPCError } from "@trpc/server";

export interface CreateUserDto {
  id: string;
  name: string;
  estimation: number | null;
  isSpectator: boolean;
}

export const roomStateStatus = {
  estimating: "estimating",
  flippable: "flippable",
  flipped: "flipped",
} as const;

export const userStatus = {
  pending: "pending",
  estimated: "estimated",
  spectator: "spectator",
} as const;

export interface RoomStateDto {
  id: number;
  startedAt: number;
  lastUpdated: number;
  users: CreateUserDto[];
  isAutoFlip: boolean;
  status: keyof typeof roomStateStatus;
}

export class User {
  readonly id: string;
  readonly name: string;
  estimation: number | null = null;
  isSpectator: boolean;

  get status(): keyof typeof userStatus {
    if (this.isSpectator) {
      return userStatus.spectator;
    }
    if (this.estimation) {
      return userStatus.estimated;
    }
    return userStatus.pending;
  }

  constructor({ id, name, estimation, isSpectator }: CreateUserDto) {
    this.id = id;
    this.name = name;
    this.estimation = estimation;
    this.isSpectator = isSpectator;
  }
}

class RoomStateBase {
  readonly id: number;
  startedAt: number;
  lastUpdated: number;

  users: User[] = [];
  isFlipped = false;
  isAutoFlip = false;

  get isFlippable() {
    return (
      this.users.every(
        (user) => user.estimation !== null || user.isSpectator,
      ) &&
      this.users.some((user) => !user.isSpectator) &&
      !this.isFlipped
    );
  }

  get status(): keyof typeof roomStateStatus {
    if (this.isFlipped) {
      return roomStateStatus.flipped;
    }
    if (this.isFlippable) {
      return roomStateStatus.flippable;
    }
    return roomStateStatus.estimating;
  }

  constructor(id: number) {
    this.id = id;
    this.startedAt = Date.now();
    this.lastUpdated = Date.now();
  }

  static fromJson<T extends RoomStateBase>(
    this: new (id: number) => T,
    roomStateDto: RoomStateDto,
  ) {
    const roomState = new this(roomStateDto.id);
    roomState.startedAt = roomStateDto.startedAt;
    roomState.lastUpdated = roomStateDto.lastUpdated;
    roomState.users = roomStateDto.users.map((user) => new User(user));
    roomState.isFlipped = roomStateDto.status === roomStateStatus.flipped;
    roomState.isAutoFlip = roomStateDto.isAutoFlip;
    return roomState;
  }

  toJson(): RoomStateDto {
    return {
      id: this.id,
      startedAt: this.startedAt,
      lastUpdated: this.lastUpdated,
      users: this.users,
      isAutoFlip: this.isAutoFlip,
      status: this.status,
    };
  }
}

export class RoomStateClient extends RoomStateBase {
  getUser(userId: string | null) {
    if (!userId) {
      throw new Error(`User not found - userId not given`);
    }
    const user = this.users.find((user) => user.id === userId);
    if (!user) {
      throw new Error(`User not found - userId ${userId} not found`);
    }
    return user;
  }
}

export class RoomStateServer extends RoomStateBase {
  hasChanged = false;
  isFlipAction = false;

  /**
  /* USER MANAGEMENT
  */
  addUser(user: CreateUserDto) {
    if (!this.users.some((u) => u.id === user.id)) {
      this.users.push(new User(user));
      this.hasChanged = true;
    }
  }

  removeUser(userId: string) {
    if (this.users.some((user) => user.id === userId)) {
      this.users = this.users.filter((user) => user.id !== userId);
      this.hasChanged = true;
    }
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
    if (!this.isFlippable) {
      throw new TRPCError({
        message: "Cannot flip when not flippable",
        code: "INTERNAL_SERVER_ERROR",
      });
    }
    this.isFlipped = true;
    this.hasChanged = true;
    this.isFlipAction = true;
  }

  private autoFlip() {
    if (this.isAutoFlip && this.isFlippable && !this.isFlipped) {
      this.flip();
    }
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
