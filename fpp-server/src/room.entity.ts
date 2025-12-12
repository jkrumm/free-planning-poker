// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck - This file contains Bun-specific imports that aren't available in Next.js

import * as Sentry from '@sentry/bun';
import { type ServerWebSocket } from 'bun';
import { type ElysiaWS } from 'elysia/dist/ws';
// Import base classes to extend
import {
  RoomBase,
  User as UserBase,
  type CreateUserDto as CreateUserDtoBase,
} from './room.types';
import { preciseTimeout } from './utils';

// Re-export shared types from room.types for backward compatibility
export {
  User as UserBase,
  RoomClient,
  RoomBase,
  RoomStateStatus,
  type RoomDto,
  type CreateUserDto as CreateUserDtoBase,
} from './room.types';

/**
 * Server-specific extensions that require Bun/Elysia dependencies
 */

export interface CreateUserDto extends CreateUserDtoBase {
  ws: ElysiaWS<ServerWebSocket<any>, any>;
}

export class User extends UserBase {
  ws: ElysiaWS<ServerWebSocket<any>, any>;

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
      Sentry.captureException(error, {
        tags: {
          operation: 'flip',
          roomId: String(this.id),
        },
        level: 'error',
      });
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
        Sentry.captureException(error, {
          tags: {
            operation: 'flip_analytics',
            roomId: String(this.id),
          },
          extra: {
            trackingUrl,
          },
          level: 'warning',
        });
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
