import { type ElysiaWS } from 'elysia/dist/ws';
// Import base classes to extend
import {
  RoomBase,
  User as UserBase,
  type CreateUserDto as CreateUserDtoBase,
} from './room.types';
import { preciseTimeout } from './utils';
import { captureError } from './utils/app-error';

// Re-export shared types from room.types for backward compatibility
export {
  RoomClient,
  RoomBase,
  RoomStateStatus,
  type RoomDto,
  type CreateUserDto as CreateUserDtoBase,
} from './room.types';
export { User as UserBase } from './room.types';

/**
 * Server-specific extensions that require Bun/Elysia dependencies
 */

export interface CreateUserDto extends CreateUserDtoBase {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ws: ElysiaWS<any, any>;
}

export class User extends UserBase {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ws: ElysiaWS<any, any>;

  constructor(params: CreateUserDto) {
    super(params);
    this.ws = params.ws;
  }
}

/**
 * RoomServer is the server-side version of Room with mutation methods
 * RoomClient and RoomDto are exported from room.types.ts
 */

export class RoomServer extends RoomBase {
  // Override to use server-side User class with WebSocket
  declare users: User[];

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

  setSpectator(targetUserId: string, isSpectator: boolean) {
    this.users = this.users.map((user) => {
      if (user.id === targetUserId) {
        user.isSpectator = isSpectator;
        user.estimation = null; // Clear estimation when becoming spectator
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
      const error = new Error('FPP_SERVER_SECRET not set');
      captureError(
        error,
        {
          component: 'roomEntity',
          action: 'flip',
          extra: {
            roomId: String(this.id),
          },
        },
        'critical'
      );
      throw error;
    }

    // Track flip analytics - fire and forget with error handling
    const trackingUrl = `${
      process.env.NODE_ENV === 'production'
        ? 'https://free-planning-poker.com/'
        : 'http://localhost:3001'
    }/api/trpc/room.trackFlip?batch=1`;

    fetch(trackingUrl, {
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
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `Analytics tracking failed with status ${response.status}`
          );
        }
      })
      .catch((error) => {
        // Only capture analytics failures - these are non-critical
        captureError(
          error as Error,
          {
            component: 'roomEntity',
            action: 'trackFlipAnalytics',
            extra: {
              roomId: String(this.id),
              trackingUrl,
            },
          },
          'low'
        );
      });
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
