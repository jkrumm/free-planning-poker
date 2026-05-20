import { trace } from '@opentelemetry/api';
import { type ElysiaWS } from 'elysia/ws';
// Import base classes to extend
import {
  RoomBase,
  User as UserBase,
  type CreateUserDto as CreateUserDtoBase,
} from '@fpp/shared';
import { validateUsername } from '@fpp/shared';
import { ATTR, EVENT } from '@fpp/shared/telemetry';
import { metrics } from './telemetry';
import { preciseTimeout } from './utils';
import { recordError, recordEvent } from './utils/app-error';
import { tracedFetch } from './utils/traced-fetch';

// Re-export shared types from room.types for backward compatibility
export {
  RoomClient,
  RoomBase,
  RoomStateStatus,
  type RoomDto,
  type CreateUserDto as CreateUserDtoBase,
} from '@fpp/shared';
export { User as UserBase } from '@fpp/shared';

/**
 * Server-specific extensions that require Bun/Elysia dependencies
 */

export interface CreateUserDto extends CreateUserDtoBase {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ws: ElysiaWS<any, any>;
}

interface CreateGhostUserDto extends CreateUserDtoBase {
  ws?: null;
}

export class User extends UserBase {
  // ws is null for "ghost" users restored from a Redis snapshot before any
  // client has reconnected. The first reconnect populates it via addUserToRoom.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ws: ElysiaWS<any, any> | null;

  constructor(params: CreateUserDto | CreateGhostUserDto) {
    super(params);
    this.ws = params.ws ?? null;
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
   * Rehydrate a room from a Redis snapshot. Users come back without a live
   * WebSocket (`ws = null`); they get a real one back the moment they
   * reconnect (`addUserToRoom` updates the existing entry in-place).
   * Heartbeats reset to now, so the 30-minute sweep gives every restored
   * user a fresh grace period to come back.
   */
  static fromSnapshot(dto: {
    id: number;
    startedAt: number;
    lastUpdated: number;
    isFlipped: boolean;
    isAutoFlip: boolean;
    users: Array<{
      id: string;
      name: string;
      estimation: number | null;
      isSpectator: boolean;
    }>;
  }): RoomServer {
    const room = new RoomServer(dto.id);
    room.startedAt = dto.startedAt;
    room.lastUpdated = dto.lastUpdated;
    room.isFlipped = dto.isFlipped;
    room.isAutoFlip = dto.isAutoFlip;
    room.users = dto.users.map(
      (u) =>
        new User({
          id: u.id,
          name: u.name,
          estimation: u.estimation,
          isSpectator: u.isSpectator,
          isPresent: false,
        }),
    );
    return room;
  }

  /**
   * USER MANAGEMENT
   */

  addUser(user: User) {
    if (!this.users.some((u) => u.id === user.id)) {
      this.users.push(user);
    }
    // NOTE: we always set hasChanged to repair out of sync for users
    this.hasChanged = true;
  }

  removeUser(userId: string) {
    if (this.users.some((user) => user.id === userId)) {
      this.users = this.users.filter((user) => user.id !== userId);
      this.hasChanged = true;
      // Sole chokepoint for room.left — reached by leave, kick, AND the 30-min
      // heartbeat sweep (which calls removeUser directly).
      recordEvent(EVENT.ROOM_LEFT, {
        [ATTR.ROOM_ID]: this.id,
        [ATTR.USER_ID]: userId,
        [ATTR.ROOM_USER_COUNT]: this.users.length,
      });
      this.autoFlip();
    }
  }

  changeUsername(userId: string, name: string) {
    // Validate username with shared validation logic (strict mode)
    const validation = validateUsername(name, { strict: true });
    if (!validation.isValid) {
      throw new Error(validation.error ?? 'Invalid username');
    }

    let changed = false;
    this.users = this.users.map((user) => {
      if (user.id === userId) {
        user.name = validation.cleaned;
        this.hasChanged = true;
        changed = true;
      }
      return user;
    });

    if (changed) {
      recordEvent(EVENT.USER_RENAMED, {
        [ATTR.ROOM_ID]: this.id,
        [ATTR.USER_ID]: userId,
      });
    }
  }

  /**
   * INTERACTIONS
   */

  setEstimation(userId: string, estimation: number | null) {
    let changed = false;
    this.users = this.users.map((user) => {
      if (user.id === userId) {
        user.estimation = estimation;
        user.isSpectator = false;
        this.hasChanged = true;
        changed = true;
      }
      return user;
    });

    if (changed) {
      const voteCount = this.users.filter((u) => u.estimation !== null).length;
      const span = trace.getActiveSpan();
      span?.setAttribute(ATTR.ROUND_VOTE_COUNT, voteCount);
      if (estimation !== null) {
        span?.setAttribute(ATTR.VOTE_VALUE, estimation);
        recordEvent(EVENT.VOTE_CAST, {
          [ATTR.ROOM_ID]: this.id,
          [ATTR.USER_ID]: userId,
          [ATTR.VOTE_VALUE]: estimation,
          [ATTR.ROUND_VOTE_COUNT]: voteCount,
        });
        // The planning-poker deck is a bounded set → vote.value is a safe
        // (low-cardinality) metric label.
        metrics.voteCast.add(1, { [ATTR.VOTE_VALUE]: estimation });
      } else {
        // null estimate = deselect → emit vote.cleared (event only, no metric)
        // so "changed my mind"/indecision rate stays measurable.
        recordEvent(EVENT.VOTE_CLEARED, {
          [ATTR.ROOM_ID]: this.id,
          [ATTR.USER_ID]: userId,
          [ATTR.ROUND_VOTE_COUNT]: voteCount,
        });
      }
    }

    this.autoFlip();
  }

  setSpectator(targetUserId: string, isSpectator: boolean) {
    let changed = false;
    this.users = this.users.map((user) => {
      if (user.id === targetUserId) {
        user.isSpectator = isSpectator;
        user.estimation = null; // Clear estimation when becoming spectator
        this.hasChanged = true;
        changed = true;
      }
      return user;
    });

    if (changed) {
      recordEvent(EVENT.USER_SPECTATOR_CHANGED, {
        [ATTR.ROOM_ID]: this.id,
        [ATTR.USER_ID]: targetUserId,
        [ATTR.USER_IS_SPECTATOR]: isSpectator,
      });
    }

    this.autoFlip();
  }

  flip(trigger: 'manual' | 'auto') {
    const wasFlipped = this.isFlipped;
    if (!this.isFlippable && !wasFlipped) {
      this.hasChanged = true; // NOTE: we always set hasChanged to repair out of sync for users
      return;
    }
    this.isFlipped = true;
    this.hasChanged = true;
    this.isFlipAction = true;

    // Sole chokepoint for round.flipped — reached by the manual flip action AND
    // the auto-flip timer. Emit only on the actual transition (a redundant
    // re-flip on an already-flipped room must not double-count). The active
    // span is present for the manual path, absent for the timer.
    if (!wasFlipped) {
      const voters = this.users.filter((u) => u.estimation !== null);
      const voteCount = voters.length;
      const distinctValues = new Set(voters.map((u) => u.estimation)).size;
      const consensus = voteCount > 0 && distinctValues === 1;
      const durationSec = (Date.now() - this.startedAt) / 1000;

      trace.getActiveSpan()?.setAttributes({
        [ATTR.ROUND_VOTE_COUNT]: voteCount,
        [ATTR.ROUND_DISTINCT_VALUES]: distinctValues,
        [ATTR.ROUND_CONSENSUS]: consensus,
      });
      recordEvent(EVENT.ROUND_FLIPPED, {
        [ATTR.ROOM_ID]: this.id,
        [ATTR.ROUND_VOTE_COUNT]: voteCount,
        [ATTR.ROUND_DISTINCT_VALUES]: distinctValues,
        [ATTR.ROUND_CONSENSUS]: consensus,
        [ATTR.ROUND_DURATION]: durationSec,
        [ATTR.FLIP_TRIGGER]: trigger,
      });
      metrics.roundFlipped.add(1, {
        [ATTR.FLIP_TRIGGER]: trigger,
        [ATTR.ROUND_CONSENSUS]: consensus,
      });
    }

    const fppServerSecret = process.env.FPP_SERVER_SECRET;

    if (!fppServerSecret) {
      const error = new Error('FPP_SERVER_SECRET not set');
      recordError(
        error,
        {
          component: 'roomEntity',
          action: 'flip',
          extra: {
            roomId: String(this.id),
          },
        },
        'critical',
      );
      throw error;
    }

    // Track flip analytics - fire and forget with error handling. TRPC_URL
    // is the canonical override in prod (set in compose.yml); in dev it
    // points to the local Next.js port. Defaults match each env.
    const trackingUrl = `${
      process.env.TRPC_URL ??
      (process.env.NODE_ENV === 'production'
        ? 'https://free-planning-poker.com/api/trpc'
        : 'http://localhost:7720/api/trpc')
    }/room.trackFlip?batch=1`;

    // tracedFetch injects W3C traceparent so the Next.js handler joins
    // the same trace as the WebSocket flip action.
    tracedFetch(trackingUrl, {
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
        }),
      ),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `Analytics tracking failed with status ${response.status}`,
          );
        }
      })
      .catch((error) => {
        // Persistence path for vote + estimation rows. Failure is silent to
        // the user (WebSocket flip already succeeded) but means data loss —
        // surface as warning so it shows in HyperDX.
        recordError(
          error as Error,
          {
            component: 'roomEntity',
            action: 'trackFlipAnalytics',
            extra: {
              roomId: String(this.id),
              trackingUrl,
            },
          },
          'medium',
        );
      });
  }

  private autoFlip() {
    if (!this.isAutoFlip) {
      return;
    }

    preciseTimeout(() => {
      if (this.isAutoFlip && this.isFlippable && !this.isFlipped) {
        this.flip('auto');
      }
    }, 1000); // 1 second
  }

  setAutoFlip(isAutoFlip: boolean) {
    this.isAutoFlip = isAutoFlip;
    this.hasChanged = true;
    recordEvent(EVENT.ROOM_AUTOFLIP_CHANGED, {
      [ATTR.ROOM_ID]: this.id,
      [ATTR.ROOM_AUTOFLIP_ENABLED]: isAutoFlip,
    });
    this.autoFlip();
  }

  reset() {
    // Count votes before clearing so round.reset captures the round's size.
    const voteCount = this.users.filter((u) => u.estimation !== null).length;
    this.startedAt = Date.now();
    this.lastUpdated = Date.now();
    this.users = this.users.map((user) => {
      user.estimation = null;
      return user;
    });
    this.isFlipped = false;
    this.hasChanged = true;
    recordEvent(EVENT.ROUND_RESET, {
      [ATTR.ROOM_ID]: this.id,
      [ATTR.ROUND_VOTE_COUNT]: voteCount,
    });
  }
}
