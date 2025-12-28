# FPP WebSocket Server - AI Development Guide

## Project Overview

Bun-powered WebSocket server managing real-time planning poker room state. Runs independently on port 3003.

### Tech Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Runtime | Bun | latest |
| Framework | Elysia | 1.4.18 |
| Validation | TypeBox | latest |
| Monitoring | Sentry | @sentry/bun 10.30.0 |
| Logging | @bogeychan/elysia-logger (pino) | latest |

### Architecture Role

This service is the **AUTHORITATIVE source for real-time room state**. All room actions (votes, flips, kicks) go through here. The Next.js server calls this service for real-time updates, not the other way around (except for vote persistence callbacks).

---

## Critical Rules

### 🚨 In-Memory State Only
- ALL room state lives in `RoomState.rooms` Map
- NO database access from this service
- State persists only while server is running
- Server restart = all active rooms lost (acceptable for short-lived planning sessions)

### 🚨 TypeBox Validation (NOT Zod)
- Every incoming WebSocket message MUST validate against `CActionSchema`
- Invalid messages are silently dropped (no error response)
- Use `Type.Object()`, not `z.object()` (this is NOT Zod)
- Syntax: `Type.String({ minLength: 21, maxLength: 21 })`

### 🚨 Broadcast Pattern
- State changes ALWAYS broadcast to entire room via `sendToEverySocketInRoom()`
- NO individual user updates (creates race conditions)
- Broadcast sends full room DTO, not diffs
- Pre-serialize once with `room.toStringifiedJson()`, send same string to all

### 🚨 Heartbeat System
- Client heartbeat: Every 5 minutes
- Server cleanup: Every 30 minutes (cron job)
- Users inactive >30min are removed automatically
- Gap is intentional (prevents premature removal on network hiccups)

---

## Directory Structure

```
fpp-server/src/
├── index.ts               # Elysia app, WebSocket route, cron jobs (146 lines)
├── message.handler.ts     # Action handler switch (301 lines)
├── room.state.ts          # In-memory Map<roomId, RoomServer> (388 lines)
├── room.entity.ts         # RoomServer & UserServer classes (206 lines)
├── room.actions.ts        # TypeBox schemas & Action types (219 lines)
├── room.types.ts          # DTOs for client serialization (146 lines)
├── types.ts               # Shared utility types (23 lines)
├── utils.ts               # Helper functions (17 lines)
└── websocket.constants.ts # Cron schedule (4 lines)
```

**Total:** ~1,550 lines for a complete real-time WebSocket server

---

## Key Files Explained

### index.ts
- Elysia app factory with WebSocket route
- TypeBox validation on incoming messages
- Connection tracking (open, close, error)
- Cron job for 30-minute cleanup
- Sentry initialization
- CORS handled by Elysia (same-origin only)

### message.handler.ts
- Switch statement on `action` discriminator
- Updates room state via RoomState methods
- Broadcasts after every state change
- Handles tRPC fetch for vote persistence (when room flips)

### room.state.ts
- Central `Map<roomId, RoomServer>` of all active rooms
- `sendToEverySocketInRoom()` - core broadcast method
- `addUserToRoom()`, `removeUserFromRoom()` - user lifecycle
- `cleanupInactiveState()` - 30-minute sweep
- Separate `userConnections` Map for WebSocket tracking

### room.entity.ts
- `RoomServer` class - room state + mutation methods
- `UserServer` class - user state + mutation methods
- Methods like `flip()`, `reset()`, `selectEstimation()`
- Auto-flip logic with 1-second delay

### room.actions.ts
- TypeBox schemas for every action type
- Union type `Action` as discriminated union
- Validation happens before message.handler receives
- Type guards: `isEstimateAction()`, `isFlipAction()`, etc.

---

## Common Patterns

### Adding a New WebSocket Action

**Step 1: Define Action Type** (`room.actions.ts`):
```typescript
export interface NewActionAction {
  action: 'newAction';
  userId: string;
  roomId: number;
  param: string;
}

export const CNewActionActionSchema = Type.Object({
  action: Type.Literal('newAction'),
  userId: Type.String({ minLength: 21, maxLength: 21 }),
  roomId: Type.Integer({ minimum: 1 }),
  param: Type.String({ maxLength: 100 }),
});
```

**Step 2: Add to Union** (`room.actions.ts`):
```typescript
export type Action =
  | JoinAction
  | LeaveAction
  | NewActionAction  // ADD HERE
  | ...;

export const CActionSchema = Type.Union([
  CJoinActionSchema,
  CLeaveActionSchema,
  CNewActionActionSchema,  // ADD HERE
  ...
]);
```

**Step 3: Handle Action** (`message.handler.ts`):
```typescript
case 'newAction': {
  const room = roomState.rooms.get(action.roomId);
  if (!room) return;

  const user = room.getUser(action.userId);
  if (!user) return;

  // Update state
  user.someProperty = action.param;

  // Broadcast
  roomState.sendToEverySocketInRoom(action.roomId);
  break;
}
```

**Step 4: Client Integration** (in Next.js):
```typescript
triggerAction({
  action: 'newAction',
  userId,
  roomId,
  param: 'value',
});
```

### Broadcasting State Changes

```typescript
// ALWAYS do this after state changes
roomState.sendToEverySocketInRoom(roomId);

// What it does:
// 1. Gets room from Map
// 2. Serializes room.toStringifiedJson()
// 3. Sends to every connected user's WebSocket
```

### Persisting to Database

```typescript
// fpp-server has NO database connection
// For persistence, it calls back to Next.js tRPC:

await fetch(`${process.env.TRPC_URL}/room.trackFlip`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fppServerSecret: process.env.FPP_SERVER_SECRET,
    roomId,
    roomState: room.toStringifiedJson(),
  }),
});
```

---

## Error Handling

### Sentry Integration

```typescript
import * as Sentry from '@sentry/bun';

try {
  // risky operation
} catch (error) {
  Sentry.captureException(error, {
    tags: { roomId, userId, action: action.action },
  });
  // Don't throw - silently fail to avoid disrupting other users
}
```

**NO custom error wrapper** - Direct Sentry usage only.

### Graceful Degradation

- **Invalid messages**: Silently drop (already filtered by TypeBox)
- **Room not found**: Skip action (user likely stale)
- **User not in room**: Skip action (already left)
- **WebSocket send fails**: Remove user from room (connection lost)

---

## Testing & Verification

```bash
# Run dev server with hot reload USUALLY ONLY RUN BY HUMAN 
bun dev

# Build for production
bun run build

# Run production build
bun run start

# Format code
bun run format
```

### Manual Testing Checklist

1. Open client in two browser tabs
2. Join same room from both tabs
3. Vote from one tab → Should appear in other tab
4. Flip cards → Should broadcast to both
5. Reset → Should clear for both
6. Close one tab → User should disappear from other tab
7. Refresh tab → User should reconnect and see current state

---

## Performance Characteristics

### Memory Usage
- Each room: ~2-5 KB (depends on user count)
- Each user: ~500 bytes
- 1000 active rooms with 10 users each: ~20-50 MB

### Broadcast Latency
- Local broadcast: <5ms
- Network + client render: 20-100ms typical
- Scales linearly with users per room (O(n))

### Connection Limits
- Bun WebSocket: Tested to 10k concurrent connections
- Typical usage: 50-200 concurrent rooms
- No artificial limits imposed

---

## Common Gotchas

### 1. TypeBox vs Zod

❌ **Wrong** (Zod syntax):
```typescript
z.object({ action: z.literal('vote') })
```

✅ **Correct** (TypeBox syntax):
```typescript
Type.Object({ action: Type.Literal('vote') })
```

**Why TypeBox?** Faster validation, better for WebSocket hot path.

### 2. Serialization

❌ **Wrong** (double-stringify):
```typescript
ws.send(JSON.stringify(room.toStringifiedJson()))
```

✅ **Correct** (already stringified):
```typescript
ws.send(room.toStringifiedJson())
```

`toStringifiedJson()` returns a string (already JSON.stringify'd).

### 3. Heartbeat Timing Gap

- Client heartbeat: **5 minutes**
- Server cleanup: **30 minutes**

Gap is intentional:
- Avoids premature removal on network hiccups
- Gives users 25 minutes of grace period
- Reconnection works seamlessly within this window

### 4. Cron Job Schedule

```typescript
pattern: '0 */30 * * * *'  // Runs at 0 and 30 minutes past every hour
```

NOT "every 30 minutes from server start" - runs on the clock (0:00, 0:30, 1:00, 1:30, etc.).

### 5. WebSocket Close Codes

```typescript
// Normal closures (NOT tracked in Sentry)
1000, 1001, 1005, 1006

// Abnormal closures (tracked in Sentry)
Any other code
```

---

## Development Workflow

### Local Development

```bash
# Install dependencies
bun install

# Run dev server (port 3003) USUALLY RUN BY HUMAN
bun dev

# Check TypeScript types
bun run typecheck
```

### Environment Variables

```bash
TRPC_URL=http://localhost:3001/api/trpc  # Next.js tRPC endpoint
FPP_SERVER_SECRET=secret-token           # Auth for callbacks
SENTRY_DSN=https://...                   # Error tracking
NODE_ENV=development
```

### Debugging

```typescript
// Use pino logger
log.info({ roomId, userId }, 'User joined room');
log.error({ error, roomId }, 'Failed to broadcast');
```

**Production logs:** Structured JSON (for log aggregation)
**Development logs:** Pretty-printed with colors

---

## Architecture Insights

### Design Decisions

**1. Dual-Map Structure**
- `rooms`: Authoritative state
- `userConnections`: WebSocket tracking
- Separation allows WebSocket-agnostic room logic

**2. Connection ≠ User**
- Users persist beyond WebSocket lifetime
- Enables graceful reconnects
- Heartbeat is source of truth for removal

**3. Dirty Flag Pattern**
- `hasChanged` prevents unnecessary broadcasts
- Optimistic approach: assume change, reset after broadcast

**4. No Database in Hot Path**
- MySQL only for: room creation, user join, vote persistence
- WebSocket actions touch zero persistent storage
- Trade-off: Lose ephemeral state on restart

**5. Single Responsibility**
- `RoomServer`: Domain logic + mutations
- `RoomState`: Lifecycle + broadcasting
- `MessageHandler`: Action routing
- Clean separation, easy to test

### What Makes It Elegant

1. **Type Safety** - Shared types between frontend/backend, runtime validation at WebSocket boundary
2. **Event Sourcing (Implicit)** - Actions are events, state mutations are pure, broadcast is side effect
3. **Functional Core, Imperative Shell** - `RoomBase` is pure domain logic, `RoomServer` is imperative mutations
4. **Minimal Surface Area** - 11 actions, 2 data structures, 3 classes, no inheritance complexity
5. **Observable** - Every action logged, Sentry for errors, analytics endpoint for introspection

---

## Additional Resources
Use Context7 MCP as a reference for documentation:
- **Elysia Docs**: https://elysiajs.com
- **TypeBox Docs**: https://github.com/sinclairzx81/typebox
- **Bun WebSocket**: https://bun.sh/docs/api/websockets
- **Sentry Bun SDK**: https://docs.sentry.io/platforms/javascript/guides/bun/

---

**Last Updated**: 2025-12-27
**For architecture overview**: See `/ARCHITECTURE.md` and `/.openspec/project.md`
**For client integration**: See `/CLAUDE.md` (root)
