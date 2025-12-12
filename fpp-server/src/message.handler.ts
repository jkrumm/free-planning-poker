// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck - This file contains Bun-specific imports

import * as Sentry from '@sentry/bun';
import { type ElysiaWS } from 'elysia/dist/ws';
import { log } from './index';
import {
  isChangeRoomNameAction,
  isChangeUsernameAction,
  isEstimateAction,
  isFlipAction,
  isHeartbeatAction,
  isKickAction,
  isLeaveAction,
  isRejoinAction,
  isResetAction,
  isSetAutoFlipAction,
  isSetPresenceAction,
  isSetSpectatorAction,
  type Action,
} from './room.actions';
import { User } from './room.entity';
import { type RoomState } from './room.state';
import { WEBSOCKET_CONSTANTS } from './websocket.constants';

export class MessageHandler {
  constructor(private roomState: RoomState) {}

  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(ws: ElysiaWS<any>, data: Action): void {
    const room = this.roomState.getOrCreateRoom(data.roomId);
    log.debug({ ...data, wsId: ws.id }, 'Received message');

    try {
      if (isHeartbeatAction(data)) {
        this.handleHeartbeat(ws, data);
        return;
      }

      if (isEstimateAction(data)) {
        room.setEstimation(data.userId, data.estimation);
        this.roomState.sendToEverySocketInRoom(room.id);
        return;
      }

      if (isSetSpectatorAction(data)) {
        room.setSpectator(data.targetUserId, data.isSpectator);
        this.roomState.sendToEverySocketInRoom(room.id);
        return;
      }

      if (isResetAction(data)) {
        room.reset();
        this.roomState.sendToEverySocketInRoom(room.id);
        return;
      }

      if (isSetAutoFlipAction(data)) {
        room.setAutoFlip(data.isAutoFlip);
        this.roomState.sendToEverySocketInRoom(room.id);
        return;
      }

      if (isLeaveAction(data)) {
        this.handleLeave(ws, data);
        return;
      }

      if (isRejoinAction(data)) {
        this.handleRejoin(ws, data);
        return;
      }

      if (isSetPresenceAction(data)) {
        this.roomState.updateUserPresence(
          data.roomId,
          data.userId,
          data.isPresent
        );
        this.roomState.sendToEverySocketInRoom(data.roomId);
        return;
      }

      if (isChangeUsernameAction(data)) {
        room.changeUsername(data.userId, data.username);
        this.roomState.sendToEverySocketInRoom(room.id);
        return;
      }

      if (isChangeRoomNameAction(data)) {
        this.handleChangeRoomName(ws, data);
        return;
      }

      if (isFlipAction(data)) {
        room.flip();
        this.roomState.sendToEverySocketInRoom(room.id);
        return;
      }

      if (isKickAction(data)) {
        this.handleKick(ws, data);
        return;
      }

      // If we get here, it's an unknown action
      log.error(
        {
          error: 'Unknown action',
          wsId: ws.id,
          data: String(data),
        },
        'Unknown action'
      );
      Sentry.captureMessage('Unknown WebSocket action received', {
        level: 'error',
        tags: {
          wsId: ws.id,
        },
        extra: {
          receivedData: data,
        },
      });
      ws.send(
        JSON.stringify({
          error: 'Unknown action',
          wsId: ws.id,
          data: String(data),
        })
      );
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          handler: 'handleMessage',
          roomId: String(data.roomId),
          userId: data.userId,
          action: (data as any)?.action,
        },
        extra: {
          actionData: data,
        },
      });
      throw error;
    }
  }

  /**
   * Handle heartbeat action
   */
  private handleHeartbeat(ws: ElysiaWS<any>, data: Action): void {
    const heartbeatUpdated = this.roomState.updateHeartbeat(ws.id);
    if (!heartbeatUpdated) {
      log.debug(
        { userId: data.userId, roomId: data.roomId, wsId: ws.id },
        'Heartbeat received for unknown user - user needs to reconnect'
      );
      ws.send(JSON.stringify({ error: 'User not found - userId not found' }));
      return;
    }
    ws.send('pong');
  }

  /**
   * Handle leave action
   */
  private handleLeave(ws: ElysiaWS<any>, data: Action): void {
    log.debug(
      { userId: data.userId, roomId: data.roomId, wsId: ws.id },
      'User leaving room'
    );
    this.roomState.removeUserFromRoom(data.roomId, data.userId);
  }

  /**
   * Handle rejoin action
   */
  private handleRejoin(ws: ElysiaWS<any>, data: Action): void {
    if (!isRejoinAction(data)) return;

    log.debug(
      { userId: data.userId, roomId: data.roomId, wsId: ws.id },
      'User rejoining room'
    );

    try {
      this.roomState.addUserToRoom(
        data.roomId,
        new User({
          id: data.userId,
          name: data.username,
          estimation: null,
          isSpectator: false,
          isPresent: true,
          ws,
        })
      );

      // Send update after a short delay for rejoin
      setTimeout(() => {
        this.roomState.sendToEverySocketInRoom(data.roomId);
      }, WEBSOCKET_CONSTANTS.RECONNECT_DELAY);
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          handler: 'handleRejoin',
          roomId: String(data.roomId),
          userId: data.userId,
          wsId: ws.id,
        },
      });
      throw error;
    }
  }

  /**
   * Handle change room name action
   */
  private handleChangeRoomName(ws: ElysiaWS<any>, data: Action): void {
    if (!isChangeRoomNameAction(data)) return;

    log.debug(
      {
        userId: data.userId,
        roomId: data.roomId,
        roomName: data.roomName,
        wsId: ws.id,
      },
      'Room name changed - propagating to all users'
    );

    // Send the room name change notification to all users in the room
    this.roomState.sendRoomNameChangeToAllUsers(data.roomId, data.roomName);
  }

  /**
   * Handle kick action
   */
  private handleKick(ws: ElysiaWS<any>, data: Action): void {
    if (!isKickAction(data)) return;

    log.debug(
      {
        userId: data.userId,
        roomId: data.roomId,
        targetUserId: data.targetUserId,
        wsId: ws.id,
      },
      'User kicking another user from room'
    );

    // Find the kicked user's WebSocket connection
    const room = this.roomState.getOrCreateRoom(data.roomId);
    const kickedUser = room.users.find((u) => u.id === data.targetUserId);

    if (kickedUser) {
      // Send kick notification to the kicked user BEFORE removing them
      try {
        kickedUser.ws.send(
          JSON.stringify({
            type: 'kicked',
            message: 'You have been removed from the room',
          })
        );
      } catch (error) {
        log.debug(
          'Failed to send kick notification - connection may be closed'
        );
        Sentry.captureException(error, {
          tags: {
            handler: 'handleKick',
            operation: 'send_kick_notification',
            roomId: String(data.roomId),
            targetUserId: data.targetUserId,
          },
          level: 'warning',
        });
      }

      // Close their WebSocket connection
      try {
        kickedUser.ws.close();
      } catch (error) {
        log.debug('Failed to close WebSocket - may already be closed');
        Sentry.captureException(error, {
          tags: {
            handler: 'handleKick',
            operation: 'close_websocket',
            roomId: String(data.roomId),
            targetUserId: data.targetUserId,
          },
          level: 'warning',
        });
      }
    }

    // Remove user from room
    this.roomState.removeUserFromRoom(data.roomId, data.targetUserId);
  }
}
