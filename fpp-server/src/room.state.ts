import { ElysiaWS } from 'elysia/dist/ws';
import { log } from './index';
import { RoomServer, User } from './room.entity';

export const sockets = new Map<number, Map<string, ElysiaWS<any>>>();

export const getOrCreateRoomSockets = (roomId: number) => {
  if (!sockets.has(roomId)) {
    sockets.set(roomId, new Map());
  }

  return sockets.get(roomId);
};

export const addSocketToRoom = (
  roomId: number,
  wsId: string,
  ws: ElysiaWS<any>
) => {
  const roomSockets = getOrCreateRoomSockets(roomId);

  if (!roomSockets) {
    return;
  }

  roomSockets.set(wsId, ws);
};

export const sendToEverySocketInRoom = (room: RoomServer) => {
  if (!room.hasChanged) {
    return;
  }

  const roomSockets = getOrCreateRoomSockets(room.id);

  if (!roomSockets) {
    return;
  }

  updateRoom(room);

  for (const ws of roomSockets.values()) {
    ws.send(room.toStringifiedJson());
  }
};

export const removeSocket = (wsId: string) => {
  for (const roomSockets of sockets.values()) {
    if (roomSockets.has(wsId)) {
      roomSockets.delete(wsId);
    }
  }
};

export const rooms = new Map<number, RoomServer>();

export const getOrCreateRoom = (roomId: number): RoomServer => {
  const room = rooms.get(roomId);

  if (room) {
    return room;
  }

  const newRoom = new RoomServer(roomId);
  rooms.set(roomId, newRoom);
  return newRoom;
};

export const updateRoom = (room: RoomServer) => {
  rooms.set(room.id, room);
};

export const cleanupRooms = () => {
  log.debug(
    {
      roomsAmount: rooms.size,
    },
    'Running cleanupRooms'
  );
  for (const [roomId, room] of rooms) {
    if (room.users.length === 0) {
      rooms.delete(roomId);
      log.debug(
        {
          roomsAmount: rooms.size,
          roomId,
        },
        'Removed room due to inactivity'
      );
    }
  }
  for (const [roomId, roomSockets] of sockets) {
    if (roomSockets.size === 0) {
      sockets.delete(roomId);
      log.debug(
        {
          roomsAmount: rooms.size,
          roomId,
        },
        'Removed room sockets due to inactivity'
      );
    }
  }
};

export const heartbeats = new Map<string, number>();

export const updateHeartbeat = (wsId: string) => {
  heartbeats.set(wsId, Date.now());
};

export const removeHeartbeat = (wsId: string) => {
  heartbeats.delete(wsId);
};

export const findRoomAndUserIdByWebsocketId = (
  wsId: string
): { room: RoomServer; userId: string } | null => {
  for (const [roomId, room] of rooms) {
    for (const user of room.users) {
      if (user.ws.id === wsId) {
        return { room, userId: user.id };
      }
    }
  }

  return null;
};

export const cleanupHeartbeats = () => {
  log.debug(
    {
      heartbeatsAmount: heartbeats.size,
    },
    'Running cleanupHeartbeats'
  );
  const now = Date.now();
  for (const [wsId, lastHeartbeat] of heartbeats) {
    if (now - lastHeartbeat > 3 * 60 * 1000) {
      const roomAndUserId = findRoomAndUserIdByWebsocketId(wsId);
      if (roomAndUserId) {
        roomAndUserId.room.removeUser(roomAndUserId.userId);
        sendToEverySocketInRoom(roomAndUserId.room);
      }
      removeSocket(wsId);
      removeHeartbeat(wsId);
      log.info(
        {
          heartbeatsAmount: heartbeats.size,
          wsId,
          userId: roomAndUserId?.userId,
          roomId: roomAndUserId?.room.id,
        },
        'Removed socket due to inactivity'
      );
    }
  }
};
