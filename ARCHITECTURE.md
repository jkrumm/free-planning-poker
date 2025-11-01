# How I Built Free Planning Poker

An architectural deep-dive into a real-time planning poker application built with Next.js, React 19, and Bun.

## The Problem

Planning poker sessions need to be instant, collaborative, and dead-simple. Users should be able to create a room by just typing a name in the URL - no sign-ups, no friction, just planning. But under the hood, this simplicity requires solving some interesting challenges:

1. **Real-time synchronization** - Everyone needs to see votes instantly
2. **Anonymous yet persistent** - No accounts, but users should keep their identity across sessions
3. **Resilient connections** - Handle network drops gracefully
4. **Scalable state** - Manage potentially thousands of concurrent rooms efficiently

## The Architecture: A Tale of Two Servers

Free Planning Poker runs on a **dual-server architecture**. This isn't a microservices buzzword fest - it's a pragmatic solution that separates concerns cleanly:

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT                               │
│                                                              │
│  Next.js Pages (React 19)                                   │
│  ├─ tRPC Client (HTTP) ─────────┐                           │
│  └─ WebSocket Client ───────────┼─────────┐                 │
└──────────────────────────────────┼─────────┼─────────────────┘
                                   │         │
                    ┌──────────────▼─┐   ┌───▼──────────────┐
                    │  Next.js Server│   │   Bun WebSocket  │
                    │   (Port 3001)  │   │    Server        │
                    │                │   │   (Port 3003)    │
                    │  ├─ tRPC API   │   │  ├─ Elysia       │
                    │  ├─ SSR/SSG    │   │  ├─ In-Memory    │
                    │  └─ Static     │   │  │   Room State  │
                    └────────┬───────┘   │  └─ Message      │
                             │           │     Handler      │
                             │           └────────┬─────────┘
                             │                    │
                        ┌────▼────────────────────▼────┐
                        │      MySQL Database           │
                        │    (Drizzle ORM)             │
                        │                              │
                        │  rooms, users, votes,        │
                        │  estimations, events         │
                        └──────────────────────────────┘
```

### Server 1: Next.js (Port 3001)

The **Next.js server** handles the boring-but-necessary stuff:
- Initial page loads and SEO
- tRPC API endpoints for room creation/joining
- Database operations (room stats, user tracking)
- Analytics and tracking

**Why tRPC?** Because writing API routes in 2024 without end-to-end type safety feels like coding with your eyes closed. When the client calls `api.room.joinRoom.useMutation()`, TypeScript knows exactly what parameters it needs and what it returns. No manual type definitions, no API documentation drift.

Check out `src/server/api/routers/room.router.ts:102` for the room joining logic - it's a beautiful example of type-safe async mutations with Zod validation.

### Server 2: Bun WebSocket Server (Port 3003)

This is where the magic happens. The **Bun server** is a lightweight, blazing-fast WebSocket server that:
- Maintains real-time connections to all users in all rooms
- Stores room state **entirely in memory** for instant access
- Broadcasts state changes to all connected users
- Runs background cleanup jobs to remove stale rooms

**Why Bun?** Because WebSocket servers are I/O-bound, and Bun's event loop is ridiculously fast. Plus, the built-in WebSocket support with Elysia makes the code clean and simple.

The entire server is just ~100 lines in `fpp-server/src/index.ts:1` - no bloated frameworks, just pure WebSocket handling.

## The Data Flow: From Click to Update

Let's trace what happens when a user votes:

### 1. User Clicks a Card (Client)

```tsx
// src/components/room/room.tsx:456
const selectEstimation = (newEstimation: string) => {
  triggerAction({
    action: 'selectEstimation',
    userId,
    roomId,
    estimation: newEstimation,
  });
};
```

### 2. Action Queue System (WebSocket Hook)

Here's something cool: the app doesn't just fire-and-forget WebSocket messages. It has an **action queue** that handles network failures gracefully.

```tsx
// src/hooks/useWebSocketRoom.ts:89
const triggerAction = useCallback((action: Action) => {
  if (readyState === ReadyState.OPEN) {
    sendMessage(JSON.stringify(action));
  } else {
    // Queue it for when we reconnect
    actionQueueRef.current.push({ action, timestamp: Date.now() });
  }
}, [readyState, sendMessage]);
```

If the WebSocket is disconnected, actions get queued. When the connection is restored, the queue is drained automatically. Users don't even notice the network hiccup.

### 3. Server Receives and Validates (Bun Server)

```typescript
// fpp-server/src/index.ts:46
.ws('/ws', {
  message(ws, data) {
    if (!CActionSchema.Check(data)) return; // TypeBox validation
    messageHandler.handleMessage(ws, data);
  }
})
```

**TypeBox validation** ensures that garbage doesn't make it into the system. If a malicious client sends junk, it's rejected before hitting any logic.

### 4. State Update (Room State Manager)

```typescript
// fpp-server/src/message.handler.ts:45
case 'selectEstimation': {
  const user = room.getUser(userId);
  if (!user) return;

  user.selectEstimation(action.estimation);
  roomState.sendToEverySocketInRoom(roomId); // Broadcast to all
  break;
}
```

The in-memory room state is updated, then **broadcast to every connected user in that room**. This is O(n) where n = users in room, but rooms are typically 5-15 people, so it's blazing fast.

### 5. Client Receives Update (Zustand Store)

```typescript
// src/hooks/useWebSocketRoom.ts:150
onMessage: (event) => {
  const roomDto = JSON.parse(event.data);
  const room = RoomClient.fromJson(roomDto);
  updateRoomState(room); // Update Zustand store
}
```

The Zustand store (`src/store/room.store.ts:82`) receives the updated room state and triggers React re-renders **only for components that subscribe to changed state**.

### 6. UI Re-renders (Selective Subscriptions)

```tsx
// src/components/room/room.tsx:68
const users = useRoomStore((state) => state.users);
const isFlipped = useRoomStore((state) => state.isFlipped);
```

This is key: components subscribe **only to the state slices they need**. If a user changes their name, only the user list re-renders - not the entire room.

## State Management: The Zustand Philosophy

React's built-in state is great for local component state, but for a real-time app, you need something more powerful. I chose **Zustand** for three reasons:

1. **Selective subscriptions** - Components only re-render when their subscribed state changes
2. **No boilerplate** - No actions, reducers, dispatch - just `set()` and `get()`
3. **DevTools integration** - Full time-travel debugging in development

### The Two Stores

**Room Store** (`src/store/room.store.ts:1`)
Manages real-time room state: users, votes, estimations, connection status. This is the "hot" data that changes constantly.

**LocalStorage Store** (`src/store/local-storage.store.ts:1`)
Manages persistent client data: userId, username, recent rooms. Automatically syncs to localStorage using Zustand's `persist` middleware.

```typescript
// src/store/local-storage.store.ts:24
export const useLocalstorageStore = create<LocalStorageStore>()(
  persist(
    (set) => ({
      username: null,
      userId: null,
      setUsername: (username) => set({ username }),
      setUserId: (userId) => set({ userId }),
    }),
    {
      name: 'fpp-storage', // localStorage key
      version: 4,
    }
  )
);
```

This means users can refresh the page and keep their identity without any backend authentication.

## The Room Component: Where It All Comes Together

`src/components/room/room.tsx:1` is the heart of the application. It's a 900-line orchestration of:

- WebSocket connection management
- Real-time state synchronization
- User presence tracking
- Heartbeat system
- Action triggering
- Audio notifications
- Confetti animations

### The Connection Lifecycle

```tsx
// src/components/room/room.tsx:124
const { triggerAction, connectionStatus } = useWebSocketRoom({
  roomId,
  userId,
  username,
});
```

The `useWebSocketRoom` hook (`src/hooks/useWebSocketRoom.ts:1`) manages the entire WebSocket lifecycle:

1. **Connect** - Opens WebSocket to Bun server
2. **Join** - Sends join action with userId, roomId, username
3. **Heartbeat** - Sends ping every 5 minutes to keep connection alive
4. **Message** - Receives room state updates and applies them
5. **Disconnect** - Sends leave action, cleans up connection
6. **Reconnect** - Automatically retries with exponential backoff

### The Heartbeat System

WebSocket connections are fragile. Networks drop, browsers throttle background tabs, mobile devices switch networks. To combat this, I implemented a **dual heartbeat system**:

**Client-side** (`src/hooks/useHeartbeat.ts:66`):
```typescript
heartbeatTimeoutRef.current = setTimeout(() => {
  sendHeartbeat();
  scheduleNextHeartbeat(); // Recursive scheduling
}, 5 * 60 * 1000); // 5 minutes
```

**Server-side** (`fpp-server/src/room.state.ts:142`):
```typescript
cleanupInactiveState(): void {
  const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;

  for (const room of this.rooms.values()) {
    for (const user of room.users) {
      if (user.lastHeartbeat < thirtyMinutesAgo) {
        this.removeUserFromRoom(room.id, user.id);
      }
    }
  }
}
```

Clients send heartbeats every 5 minutes. The server runs a cron job every 30 minutes to clean up stale users. This prevents memory leaks and zombie connections.

### Presence Tracking

Here's something subtle but important: **tab visibility tracking**.

```typescript
// src/hooks/usePresenceTracking.ts:42
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.hidden) {
      lastVisibilityChange.current = Date.now();
    } else {
      const timeHidden = Date.now() - lastVisibilityChange.current;
      if (timeHidden > 10000) { // 10 seconds
        sendHeartbeat(); // Immediate heartbeat on return
      }
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
}, []);
```

When users switch tabs or minimize the browser, the app detects it. When they return after 10+ seconds, it sends an immediate heartbeat to ensure they're still connected. This prevents the server from thinking they've left when they've just been in another tab.

## Database Design: Persistent vs Ephemeral State

The database schema (`src/server/db/schema.ts:1`) is deliberately minimal. Real-time state lives in memory; only these things are persisted:

### Core Tables

**rooms** - Room metadata (id, name, number, creation timestamp)
**users** - User profiles (id, IP geolocation data for analytics)
**votes** - Historical vote records (roomId, duration, isRandom, isAutoFlip)
**estimations** - Individual user estimations per vote
**events** - User action tracking (joined room, changed name, etc.)
**pageViews** - Analytics data
**featureFlags** - Configuration switches

Notice what's **NOT** in the database:
- Current room state (users, their votes, flip status)
- WebSocket connection status
- Active user list

All of that lives in the Bun server's memory (`fpp-server/src/room.state.ts:11`):

```typescript
export class RoomState {
  private rooms = new Map<number, RoomServer>();
  private userConnections = new Map<string, ConnectionInfo>();

  sendToEverySocketInRoom(roomId: number): void {
    const room = this.rooms.get(roomId);
    const roomData = room.toStringifiedJson();

    for (const user of room.users) {
      if (this.hasActiveConnection(user.id, roomId)) {
        user.ws.send(roomData);
      }
    }
  }
}
```

When a vote is flipped, the server sends a tRPC call back to the Next.js server to persist the vote and estimations. This keeps the Bun server stateless for individual actions while maintaining durability for completed votes.

## Anonymous Identity: nanoid to the Rescue

Users don't create accounts. Instead, each client generates a **nanoid** (21-character random string) on first visit and stores it in localStorage.

```typescript
// src/server/api/routers/room.router.ts:122
if (!validateNanoId(userId)) {
  userId = nanoid(); // Generate new ID
  await db.insert(users).values({
    id: userId,
    ...userPayload, // IP geolocation for analytics
  });
}
```

This gives us:
- ✅ Anonymous users (no email, password, OAuth)
- ✅ Persistent identity across sessions (localStorage)
- ✅ Trackable analytics (each nanoid is unique)
- ✅ No GDPR nightmares (no personal data)

The collision probability of nanoid(21) is effectively zero - you'd need to generate ~4 million IDs per hour for 100 years to have a 1% chance of collision.

## Room Joining: The Validation Dance

When a user visits `/room/mycoolroom`, a complex validation flow kicks off in `src/components/room/room-wrapper.tsx:110`:

```typescript
useEffect(() => {
  // Step 1: Sanitize room name
  const correctedRoom = queryRoom
    .replace(/[^A-Za-z0-9]/g, '')
    .toLowerCase();

  // Step 2: Validate length
  if (correctedRoom.length < 3 || correctedRoom.length > 15) {
    router.push('/'); // Redirect to home
    return;
  }

  // Step 3: Correct URL if needed
  if (queryRoom !== correctedRoom) {
    router.push(`/room/${correctedRoom}`);
    return;
  }

  // Step 4: Join via tRPC
  joinRoomMutation.mutate({ queryRoom, userId, roomEvent }, {
    onSuccess: ({ userId, roomId, roomName }) => {
      setUserIdLocalStorage(userId);
      setRoomId(roomId);
      setRoomName(roomName);
    },
  });
}, [queryRoom, username, firstLoad]);
```

This ensures:
1. Room names are alphanumeric only
2. Length is 3-15 characters
3. URLs are normalized (redirects `/room/MyCoolRoom` to `/room/mycoolroom`)
4. Users get assigned a userId if they don't have one
5. Room is created in database if it doesn't exist
6. User is tracked in analytics

All of this happens transparently - users just see the room load.

## The Action System: Type-Safe WebSocket Messages

WebSocket messages could be a wild-west of JSON blobs, but I enforced structure using **discriminated unions** and **TypeBox validation**.

Every WebSocket message is an `Action` with a `action` type discriminator:

```typescript
// fpp-server/src/room.actions.ts:1
export type Action =
  | JoinAction
  | LeaveAction
  | SelectEstimationAction
  | FlipAction
  | ResetAction
  | HeartbeatAction
  | ChangeUsernameAction
  | ChangeSpectatorAction
  | KickAction;

export interface SelectEstimationAction {
  action: 'selectEstimation';
  userId: string;
  roomId: number;
  estimation: string;
}
```

The server validates every incoming message against a TypeBox schema:

```typescript
// fpp-server/src/room.actions.ts:156
export const CActionSchema = Type.Union([
  CJoinActionSchema,
  CLeaveActionSchema,
  CSelectEstimationActionSchema,
  CFlipActionSchema,
  CResetActionSchema,
  CHeartbeatActionSchema,
  CChangeUsernameActionSchema,
  CChangeSpectatorActionSchema,
  CKickActionSchema,
]);
```

This catches malformed messages before they hit the message handler, preventing runtime errors and potential exploits.

## Error Handling: Sentry + Breadcrumbs

Every critical operation is wrapped in error handling that captures context to Sentry:

```typescript
// src/utils/app-error.ts:35
export const captureError = (
  error: Error,
  context: ErrorContext,
  severity: 'low' | 'medium' | 'high'
) => {
  Sentry.captureException(error, {
    level: severity,
    tags: {
      component: context.component,
      action: context.action,
    },
    extra: context.extra,
  });
};
```

Before errors occur, breadcrumbs are dropped:

```typescript
// src/hooks/useWebSocketRoom.ts:140
addBreadcrumb('WebSocket connected', 'websocket', { roomId, userId });
```

When an error happens, Sentry shows a timeline of breadcrumbs leading up to it, making debugging production issues trivial.

Example breadcrumb trail for a connection error:
```
1. Room wrapper mounted
2. User joined room (roomId: 1234)
3. WebSocket connecting...
4. WebSocket connected
5. Heartbeat system started
6. First room state received
7. WebSocket disconnected (code: 1006)
8. Attempting reconnect (attempt 1)
9. ERROR: Failed to reconnect
```

## Performance: The Little Things

### Selective Re-renders

Components subscribe only to the state they need:

```tsx
// ❌ Bad - re-renders on ANY room state change
const roomState = useRoomStore();

// ✅ Good - re-renders only when users change
const users = useRoomStore((state) => state.users);
```

### Memoization

Expensive calculations are memoized:

```typescript
// src/components/room/room.tsx:200
const statistics = useMemo(() => {
  return calculateStatistics(users, isFlipped);
}, [users, isFlipped]);
```

### Lazy Imports

Non-critical components are lazy-loaded:

```tsx
const Confetti = dynamic(() => import('react-confetti'), { ssr: false });
```

### Debounced Actions

Username changes are debounced to avoid spamming the server:

```typescript
// src/components/room/username-input.tsx:45
const debouncedUpdateUsername = useDebouncedCallback(
  (newUsername: string) => {
    triggerAction({ action: 'changeUsername', userId, roomId, username: newUsername });
  },
  500 // Wait 500ms after user stops typing
);
```

## Security: Trust Nothing

### Input Validation

Every tRPC endpoint validates inputs with Zod:

```typescript
// src/server/api/routers/room.router.ts:104
.input(
  z.object({
    queryRoom: z
      .string()
      .min(2)
      .max(15)
      .transform((val) => val.toLowerCase().trim()),
    userId: z.string().nullable(),
  }),
)
```

Every WebSocket action validates with TypeBox:

```typescript
// fpp-server/src/room.actions.ts:85
export const CSelectEstimationActionSchema = Type.Object({
  action: Type.Literal('selectEstimation'),
  userId: Type.String({ minLength: 21, maxLength: 21 }),
  roomId: Type.Integer({ minimum: 1 }),
  estimation: Type.String({ maxLength: 50 }),
});
```

### SQL Injection Prevention

Drizzle ORM uses parameterized queries automatically:

```typescript
// src/server/api/routers/room.router.ts:250
const existingRoom = await db.query.rooms.findFirst({
  where: eq(rooms.id, roomId), // Parameterized, safe
});
```

### Rate Limiting

The Next.js proxy (`src/proxy.ts:1`) implements rate limiting for API routes using Upstash Redis.

### CORS Protection

The Bun WebSocket server only accepts connections from the same origin. Cross-origin requests are rejected at the transport level.

## Deployment: Vercel + Bun in Production

**Next.js Server**: Deployed to Vercel (serverless functions)
**Bun WebSocket Server**: Deployed to a dedicated VPS (needs persistent connections)
**Database**: PlanetScale MySQL (serverless, auto-scaling)
**Redis**: Upstash (serverless, for rate limiting)

The WebSocket server runs as a systemd service:

```bash
[Unit]
Description=FPP WebSocket Server
After=network.target

[Service]
Type=simple
User=fpp
WorkingDirectory=/home/fpp/fpp-server
ExecStart=/usr/local/bin/bun run src/index.ts
Restart=always

[Install]
WantedBy=multi-user.target
```

This gives automatic restarts and log management via journalctl.

## React 19 Strict Linting: Fighting the Rules (Wisely)

React 19 introduced stricter ESLint rules that flag patterns like `setState` in `useEffect` as errors. But some of these patterns are **valid and necessary**.

I documented every ESLint suppression in `CLAUDE.md` with detailed explanations:

```tsx
// src/hooks/use-has-mounted.hook.ts:8
useEffect(() => {
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Valid pattern: One-time initialization flag on mount
  setHasMounted(true);
}, []);
```

This pattern is React-team-acknowledged for SSR hydration safety. Suppressing the rule is correct here.

**Key principle**: Only suppress linting rules when you understand why the rule exists and why your case is an exception.

## Lessons Learned

### 1. In-Memory State is Fast, But Fragile

Storing room state in memory gives instant updates, but it means server restarts wipe active rooms. For Free Planning Poker, this is acceptable - planning sessions are short-lived. For a critical app, you'd need Redis or similar.

### 2. WebSockets Need Babysitting

Heartbeats, reconnection logic, action queues - WebSockets require way more infrastructure than HTTP. But for real-time apps, the UX is worth it.

### 3. Type Safety Everywhere

tRPC for HTTP, TypeBox for WebSocket, Zod for validation, Drizzle for SQL - every layer has type safety. This caught countless bugs before they reached production.

### 4. Selective Subscriptions Save Performance

Zustand's selective subscriptions were a game-changer. Without them, every state update would re-render the entire room component tree.

### 5. Anonymous Users Work Great

No authentication, no passwords, no OAuth flows. Just generate a nanoid and store it in localStorage. This reduced friction to near-zero while still enabling analytics.

## Interesting Code to Explore

Want to dive deeper? Check out these files:

- `src/components/room/room-wrapper.tsx:110` - Room joining validation flow
- `src/hooks/useWebSocketRoom.ts:89` - Action queue system for resilient connections
- `src/store/room.store.ts:82` - Room state update with kick detection
- `fpp-server/src/room.state.ts:60` - In-memory room state broadcast logic
- `fpp-server/src/message.handler.ts:23` - WebSocket action handling switch
- `src/components/room/room.tsx:456` - User interaction to WebSocket action
- `src/hooks/usePresenceTracking.ts:42` - Tab visibility tracking
- `src/server/api/routers/room.router.ts:172` - Recursive room creation with collision handling
- `src/utils/app-error.ts:35` - Sentry error capturing with breadcrumbs

---

**Built with**: Next.js 16, React 19, Bun, tRPC 11, Zustand, Drizzle ORM, Elysia, TypeBox, Zod, Tailwind 4, Mantine 8

**Repository**: [Free Planning Poker](https://github.com/yourusername/free-planning-poker)
**Live Demo**: [https://free-planning-poker.com](https://free-planning-poker.com)
