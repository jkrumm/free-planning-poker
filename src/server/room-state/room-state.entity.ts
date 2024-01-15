export interface CreateUserDto {
  id: string;
  name: string;
  estimation: number | null;
  isSpectator: boolean;
}

export interface RoomStateDto {
  id: number;
  lastUpdated: number;
  users: CreateUserDto[];
  isFlipped: boolean;
  isAutoFlip: boolean;
}

export class User {
  readonly id: string;
  readonly name: string;
  estimation: number | null = null;
  isSpectator: boolean;

  get status(): "spectator" | "voted" | "pending" {
    if (this.isSpectator) {
      return "spectator";
    }
    if (this.estimation) {
      return "voted";
    }
    return "pending";
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
  lastUpdated: number;

  users: User[] = [];
  isFlipped = false;
  isAutoFlip = false;

  static fromJson<T extends RoomStateBase>(
    this: new (id: number) => T,
    roomStateJson: RoomStateDto,
  ) {
    const roomState = new this(roomStateJson.id);
    roomState.lastUpdated = roomStateJson.lastUpdated;
    roomState.users = roomStateJson.users.map((user) => new User(user));
    roomState.isFlipped = roomStateJson.isFlipped;
    roomState.isAutoFlip = roomStateJson.isAutoFlip;
    return roomState;
  }

  get isFlippable() {
    return (
      this.users.every(
        (user) => user.estimation !== null || user.isSpectator,
      ) && this.users.some((user) => !user.isSpectator)
    );
  }

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

  constructor(id: number) {
    this.id = id;
    this.lastUpdated = Date.now();
  }

  toJson() {
    return {
      users: this.users,
      isFlipped: this.isFlipped,
      isAutoFlip: this.isAutoFlip,
      isFlippable: this.isFlippable,
    };
  }
}

export class RoomStateClient extends RoomStateBase {
  calculateAverage(): number {
    const estimations = this.users
      .filter((user) => user.estimation !== null)
      .map((user) => user.estimation) as number[];
    if (estimations.length === 0) {
      throw new Error("Cannot calculate average when no estimations");
    }
    return (
      estimations.reduce((sum, estimation) => sum + estimation, 0) /
      estimations.length
    );
  }

  stackEstimations(): { number: number; amount: number }[] {
    const voting: { number: number; amount: number }[] = [];
    this.users.forEach((item) => {
      if (!item.estimation) return;
      const index = voting.findIndex((v) => v.number === item.estimation);
      if (index === -1) {
        voting.push({ number: item.estimation, amount: 1 });
      } else {
        voting[index]!.amount++;
      }
    });
    return voting.slice(0, this.calculateAverage() > 9 ? 3 : 4);
  }
}

export class RoomStateServer extends RoomStateBase {
  hasChanged = false;

  /**
  /* USER MANAGEMENT
  */
  addUser(user: CreateUserDto) {
    if (!this.users.some((u) => u.id === user.id)) {
      this.users.push(new User(user));
      this.hasChanged = true;
    }
  }

  getUserIds() {
    return this.users.map((user) => user.id);
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
        this.hasChanged = true;
      }
      return user;
    });
    this.autoFlip();
  }

  flip() {
    if (!this.isFlippable) {
      throw new Error("Cannot flip when not flippable");
    }
    this.isFlipped = true;
    this.hasChanged = true;
  }

  private autoFlip() {
    if (this.isFlippable && this.isAutoFlip) {
      this.flip();
    }
  }

  setAutoFlip(isAutoFlip: boolean) {
    this.isAutoFlip = isAutoFlip;
    this.hasChanged = true;
    this.autoFlip();
  }

  reset() {
    this.users = this.users.map((user) => {
      user.estimation = null;
      return user;
    });
    this.isFlipped = false;
    this.isAutoFlip = false;
    this.hasChanged = true;
  }

  fullReset() {
    this.users = [];
    this.isFlipped = false;
    this.isAutoFlip = false;
    this.hasChanged = true;
  }
}
