# WebSocket Server Reference

Moved verbatim from `apps/server/AGENTS.md` to keep that file under its 8,000-byte budget (dotfiles `rules/writing-for-agents.md`). The pointers in that file say when to read each section.

## Directory Structure

```
apps/server/src/
├── index.ts               # Elysia app, WebSocket route, cron jobs, SIGTERM drain
├── message.handler.ts     # Action handler switch
├── room.state.ts          # In-memory Map<roomId, RoomServer>
├── room.entity.ts         # RoomServer & UserServer classes
├── types.ts               # Local utility types (Analytics)
├── utils.ts               # Helper functions
├── websocket.constants.ts # Reconnect delay, idle timeout
└── utils/
    └── app-error.ts       # OTEL facade (recordError, recordEvent)

packages/shared/src/       # imported as `@fpp/shared`
├── room.actions.ts        # TypeBox action schemas + Action union (types only)
├── room.types.ts          # Room/User DTOs for client serialization
└── username.validator.ts  # USERNAME_RULES + validateUsername
```

The action schemas are exported as TypeBox `t.Object` definitions; `TypeCompiler.Compile(ActionSchema)` runs once at server boot in `index.ts` so the TypeBox runtime never reaches the web bundle.

---

## Key Files Explained

### index.ts

- Elysia app factory with WebSocket route
- TypeBox validation on incoming messages
- Connection tracking (open, close, error)
- Cron job for 30-minute cleanup
- OpenTelemetry initialization (telemetry.ts + Elysia opentelemetry plugin)
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

### `@fpp/shared` — `packages/shared/src/room.actions.ts`

- TypeBox schemas for every action type
- Union type `Action` as discriminated union
- Validation happens before `message.handler` receives (via the compiled schema in `index.ts`)
- Type guards: `isEstimateAction()`, `isFlipAction()`, etc.
- Compilation lives in `apps/server/src/index.ts` (not in the shared package) so the web bundle stays free of TypeBox runtime

---

## Common Patterns

### Adding a New WebSocket Action

**Step 1: Define Action Type** (`packages/shared/src/room.actions.ts`):

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

**Step 2: Add to Union** (`packages/shared/src/room.actions.ts`):

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

fpp-server emits OpenTelemetry traces, log records **and metrics** to
ClickStack/HyperDX. **Observability v2** added metrics + log-based events + a
typed taxonomy — see `docs/otel-migration/05-observability-v2.md` and
`.claude/rules/observability.md`. The facade uses OTEL-native verbs (clean
break, no Sentry-era aliases). fpp-server is the **authoritative owner of all
metrics**.

### Telemetry Helpers

**Import:**

```typescript
import { recordError, recordEvent } from './utils/app-error';
import { metrics } from './telemetry';
import { ATTR, EVENT } from '@fpp/shared/telemetry';
```

**Usage:**

```typescript
// Exceptions
recordError(
  error as Error,
  {
    component: 'messageHandler',
    action: 'estimate',
    extra: { roomId, userId },
  },
  'high',
);

// Log-based domain events — emitted at the state-mutation chokepoint in
// room.entity / room.state (NOT the handler), so timer/cron paths are covered.
recordEvent(EVENT.VOTE_CAST, {
  [ATTR.ROOM_ID]: this.id,
  [ATTR.USER_ID]: userId,
  [ATTR.VOTE_VALUE]: estimation,
});

// Metrics — typed handles from telemetry.ts (never a raw meter). No room.id /
// user.id on a metric. instrumentAction owns the action RED metrics.
metrics.voteCast.add(1, { [ATTR.VOTE_VALUE]: estimation });

// Operator narration → Pino (stdout), not OTEL.
log.warn(
  { component: 'messageHandler', action: 'routeAction' },
  'Unknown action',
);
```

### Error Severity Guidelines

| Severity     | Use Case                 | Examples                                            |
| ------------ | ------------------------ | --------------------------------------------------- |
| **critical** | Data loss, service crash | Room state corruption, missing environment variable |
| **high**     | User action blocked      | Message handler crash, broadcast failure (>50%)     |
| **medium**   | Degraded experience      | Individual send failure, analytics tracking failure |
| **low**      | Informational            | Unknown action, connection error (expected)         |

### What NOT to Capture

- Room/user not found (stale state, expected)
- Invalid message format (validation, expected) → Pino warning, not OTEL
- Normal WebSocket closes (1000, 1001, 1005, 1006)
- Abnormal closes → the `ws.disconnected` event, not an error

### Centralized Capture Points

**HTTP endpoints:** Elysia `onError` hook captures all uncaught errors
**WebSocket messages:** Manual try-catch in message handler
**WebSocket lifecycle:** Manual capture in open/error handlers

### Privacy & Performance

- **PII removed:** users are anonymous nanoid(21) — no email/IP/auth attached.
- **Sampling:** 100% traces (full fidelity at this scale). Metrics aggregated;
  events 100%. Revisit head/tail sampling only if span volume becomes a cost.
- **Development:** OTEL ships to local ClickStack on `http://localhost:4319` (unauthed)

### Graceful Degradation

- **Invalid messages**: Silently drop (already filtered by TypeBox)
- **Room not found**: Skip action (user likely stale)
- **User not in room**: Skip action (already left)
- **WebSocket send fails**: Capture error, continue to other users

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
TRPC_URL=http://localhost:3001/api/trpc          # Next.js tRPC endpoint
FPP_SERVER_SECRET=secret-token                   # Auth for callbacks
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4319 # ClickStack OTLP (traces/logs/metrics)
OTEL_SERVICE_NAME=fpp-server
NODE_ENV=development
FACTORY_FEEDBACK_URL=https://<mini-tailnet-name>:8796/feedback/free-planning-poker  # prod only, optional
FACTORY_FEEDBACK_TOKEN=<see-1password>           # prod only, optional; feedback-free-planning-poker token
```

`POST /feedback` (`src/feedback.ts`) takes in-app feedback from the web sidebar form and forwards it to the software-factory door
(tailnet-only, bearer token). Per-client and global rate limits are in-memory. Without the two `FACTORY_FEEDBACK_*` vars the endpoint
answers 503 and the form reports feedback as unavailable. CORS is allow-listed for the web origins in `index.ts`.

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
5. **Observable** - Every action logged, OTEL traces + log records to HyperDX, analytics endpoint for introspection

---

## Additional Resources

Use Context7 MCP as a reference for documentation:

- **Elysia Docs**: https://elysiajs.com
- **TypeBox Docs**: https://github.com/sinclairzx81/typebox
- **Bun WebSocket**: https://bun.sh/docs/api/websockets
- **Elysia OpenTelemetry Plugin**: https://elysiajs.com/patterns/opentelemetry
- **HyperDX Docs**: https://hyperdx.io/docs

---

**Last Updated**: 2026-05-20
**For architecture overview**: See `/ARCHITECTURE.md`
**For client integration**: See `/AGENTS.md` (root)
