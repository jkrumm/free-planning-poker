import { type ElysiaWS } from 'elysia/dist/ws';
import { log } from './index';
import {
  type Action,
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
  isSetSpectatorAction
} from './room.actions';
import { type RoomState } from './room.state';
import { WEBSOCKET_CONSTANTS } from './websocket.constants';
import { User } from './room.entity';

export class MessageHandler {
  constructor(private roomState: RoomState) {}

  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(ws: ElysiaWS<any>, data: Action): void {
      const room = this.roomState.getOrCreateRoom(data.roomId);
      log.debug({ ...data, wsId: ws.id }, 'Received message');

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
        this.roomState.updateUserPresence(data.roomId, data.userId, data.isPresent);
        this.roomState.sendToEverySocketInRoom(data.roomId);
        return;
      }

      if (isChangeUsernameAction(data)) {
        room.changeUsername(data.userId, data.username);
        this.roomState.sendToEverySocketInRoom(room.id);
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
          data: String(data)
        },
        'Unknown action'
      );
      ws.send(
        JSON.stringify({
          error: 'Unknown action',
          wsId: ws.id,
          data: String(data)
        })
      );
  }

  /**
   * Handle heartbeat action
   */
  private handleHeartbeat(ws: ElysiaWS<any>, data: Action): void {
    const heartbeatUpdated = this.roomState.updateHeartbeat(ws.id);
    if (!heartbeatUpdated) {
      log.warn(
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

    this.roomState.addUserToRoom(data.roomId, new User({
      id: data.userId,
      name: data.username,
      estimation: null,
      isSpectator: false,
      isPresent: true,
      ws
    }));

    // Send update after a short delay for rejoin
    setTimeout(() => {
      this.roomState.sendToEverySocketInRoom(data.roomId);
    }, WEBSOCKET_CONSTANTS.RECONNECT_DELAY);
  }

  /**
   * Handle kick action
   */
  private handleKick(ws: ElysiaWS<any>, data: Action): void {
    if (!isKickAction(data)) return;

    log.debug(
      { userId: data.userId, roomId: data.roomId, targetUserId: data.targetUserId, wsId: ws.id },
      'User kicking another user from room'
    );

    // Find the kicked user's WebSocket connection
    const room = this.roomState.getOrCreateRoom(data.roomId);
    const kickedUser = room.users.find(u => u.id === data.targetUserId);
    
    if (kickedUser) {
      // Send kick notification to the kicked user BEFORE removing them
      try {
        kickedUser.ws.send(JSON.stringify({ 
          type: 'kicked',
          message: 'You have been removed from the room'
        }));
      } catch (error) {
        log.debug('Failed to send kick notification - connection may be closed');
      }
      
      // Close their WebSocket connection
      try {
        kickedUser.ws.close();
      } catch (error) {
        log.debug('Failed to close WebSocket - may already be closed');
      }
    }

    // Remove user from room
    this.roomState.removeUserFromRoom(data.roomId, data.targetUserId);
  }
}