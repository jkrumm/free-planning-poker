# Free Planning Poker - Project Architecture

## Service Topology

```plaintext
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT                               │
│  Next.js Pages (React 19) + Zustand State                   │
│  ├─ tRPC Client (HTTP) ─────────┐                           │
│  └─ WebSocket Client ───────────┼─────────┐                 │
└──────────────────────────────────┼─────────┼─────────────────┘
                                   │         │
                    ┌──────────────▼─┐   ┌───▼──────────────┐
                    │  Next.js Server│   │   Bun WebSocket  │
                    │   (Port 3001)  │   │    Server        │
                    │                │   │   (Port 3003)    │
                    │  ├─ tRPC API   │   │  ├─ In-Memory    │
                    │  ├─ Drizzle    │   │  │   Room State  │
                    │  └─ SSR/SSG    │   │  └─ Broadcast    │
                    └────────┬───────┘   └────────┬─────────┘
                             │                    │
                        ┌────▼────────────────────▼────┐
                        │      MySQL Database           │
                        │    (PlanetScale)             │
                        └──────────────────────────────┘

                    ┌──────────────────────────────────┐
                    │   FastAPI Analytics (3002)       │
                    │   ├─ Parquet files (read-only)   │
                    │   └─ Polars calculations         │
                    └──────────────────────────────────┘
```

---

## Technology Matrix

| Service | Runtime | Framework | Port | State | Deployment |
|---------|---------|-----------|------|-------|------------|
| **Next.js App** | Node 22 | Next.js 16 (Pages Router) | 3001 | DB + Client | Vercel |
| **WebSocket Server** | Bun | Elysia 1.4 | 3003 | In-Memory | VPS (systemd) |
| **Analytics API** | Python 3.12 | FastAPI | 3002 | Parquet files | Docker (CPS) |

### Service Responsibilities

**Next.js App:**
- Client-side rendering (Pages Router, NOT App Router)
- tRPC API routes for non-realtime operations
- Database persistence via Drizzle ORM
- Zustand for client state management
- SEO, analytics tracking, rate limiting

**WebSocket Server:**
- AUTHORITATIVE source for real-time room state
- In-memory Map<roomId, RoomServer>
- Broadcasts state changes to all connected users
- NO database access (calls back to Next.js for persistence)
- Cron job cleans up stale users every 30 minutes

**Analytics API:**
- Read-only analytics calculations from Parquet files
- Parquet updated every 10 minutes by separate updater container
- NO write access to MySQL from FastAPI
- Polars for data processing (NOT pandas)

---

## Data Flow Decision Tree

### When to Use tRPC (HTTP)

**Use tRPC for:**
- Room creation (initial setup)
- Room joining (user registration)
- Username changes (persistent)
- Analytics queries
- Database reads/writes

**Pattern:**
```typescript
// Client
const mutation = api.room.joinRoom.useMutation();
mutation.mutate({ queryRoom, userId });

// Server (src/server/api/routers/room.router.ts)
.mutation(async ({ input, ctx }) => {
  await db.insert(users).values(...);
  return { roomId, userId };
});
```

### When to Use WebSocket

**Use WebSocket for:**
- Real-time room state (votes, users, flip status)
- User presence (join/leave)
- Voting actions (select estimation)
- Card flipping (show/hide votes)
- Room reset
- Heartbeat/keepalive

**Pattern:**
```typescript
// Client
triggerAction({
  action: 'selectEstimation',
  userId,
  roomId,
  estimation: '5',
});

// Server (fpp-server/src/message.handler.ts)
case 'selectEstimation': {
  user.selectEstimation(action.estimation);
  roomState.sendToEverySocketInRoom(roomId);
}
```

### When to Use Direct HTTP (Non-tRPC)

**Use direct HTTP for:**
- fpp-server → Next.js tRPC (vote persistence after flip)
- Next.js → Analytics API (proxied through tRPC if needed)

---

## State Synchronization Model

### Three-Copy State Architecture

Room state exists in THREE places:

1. **MySQL Database (Persistent)**
   - Tables: rooms, users, votes, estimations, events
   - Written by: Next.js server (via tRPC)
   - Read by: Next.js server, Analytics updater
   - Purpose: Historical data, analytics, durability

2. **Bun Server Memory (Authoritative)**
   - Structure: `Map<roomId, RoomServer>`
   - Updated by: WebSocket actions
   - Read by: WebSocket broadcast
   - Purpose: Real-time state, sub-10ms updates
   - Volatility: Lost on server restart (acceptable)

3. **Client Zustand Store (Local)**
   - Structure: `useRoomStore` with selective subscriptions
   - Updated by: WebSocket messages from Bun server
   - Read by: React components
   - Purpose: Reactive UI updates
   - Sync: Eventually consistent with Bun server

### Update Flow: Adding a Vote

```plaintext
1. User clicks card → Client calls triggerAction()
2. WebSocket sends to Bun server
3. Bun server updates in-memory RoomServer
4. Bun server broadcasts to all users in room
5. Clients receive update, update Zustand store
6. React components re-render (selective subscriptions)

[NO database write yet - only in memory]

When room is flipped:
7. Bun server calls Next.js tRPC endpoint
8. Next.js persists vote + estimations to MySQL
9. Vote now durable, available for analytics
```

---

## Key Technical Decisions

### Anonymous Identity (nanoid)

**Decision:** No authentication, generate nanoid(21) on first visit

**Implementation:**
- Client generates nanoid on mount if not in localStorage
- Next.js validates nanoid on join, creates user record with IP geolocation
- Stored in localStorage for persistence across sessions
- Collision probability: Effectively zero

**Benefits:**
- Zero friction (no sign-up)
- Persistent identity across sessions
- Trackable for analytics
- GDPR-friendly (no personal data)

### In-Memory Room State

**Decision:** Store active room state in Bun server memory, NOT database

**Benefits:**
- Sub-10ms broadcast latency
- No database round-trips for every vote
- Scales horizontally (each Bun instance = independent rooms)
- Sessions are short-lived (acceptable to lose on restart)

**Trade-offs:**
- Volatility: Server restart = lost rooms
- Stickiness: Users must reconnect to same instance

### Action Queue for Resilience

**Decision:** Queue WebSocket actions when disconnected, replay on reconnect

**Implementation:** `src/hooks/useWebSocketRoom.ts:89`

**Pattern:**
```typescript
if (readyState === ReadyState.OPEN) {
  sendMessage(JSON.stringify(action));
} else {
  actionQueueRef.current.push({ action, timestamp: Date.now() });
}
// On reconnect: Drain queue
```

**Benefits:**
- Network drops don't lose user actions
- Users don't notice brief disconnects
- Actions are idempotent (safe to replay)

### Dual Heartbeat System

**Decision:** Client pings every 5 min, server cleans up >30 min stale

**Client:** `src/hooks/useHeartbeat.ts:66` - Self-scheduling timeout
**Server:** `fpp-server/src/room.state.ts:142` - Cron job

**Benefits:**
- 5 min client: Keeps connection alive through NAT timeouts
- 30 min server: Cleanup without premature removal
- Gap prevents race conditions on brief network hiccups

---

## Directory Map

### Next.js Application (src/)

```plaintext
src/
├── pages/
│   ├── api/trpc/[trpc].ts        # tRPC entry point
│   ├── room/[room].tsx           # Main room page
│   ├── _app.tsx                  # App wrapper (tRPC provider)
│   └── _document.tsx             # HTML document
├── server/
│   ├── api/
│   │   ├── root.ts               # tRPC root router
│   │   └── routers/
│   │       ├── room.router.ts    # Room operations (join, create, stats)
│   │       └── ...
│   └── db/
│       ├── schema.ts             # Drizzle ORM schema
│       └── index.ts              # Database client
├── components/
│   └── room/
│       ├── room-wrapper.tsx      # Room validation + initialization
│       ├── room.tsx              # Main room component (900 lines)
│       └── ...
├── hooks/
│   ├── useWebSocketRoom.ts       # WebSocket connection + action queue
│   ├── useHeartbeat.ts           # Heartbeat system
│   └── usePresenceTracking.ts   # Tab visibility tracking
├── store/
│   ├── room.store.ts             # Real-time room state (Zustand)
│   └── local-storage.store.ts   # Persistent userId/username
└── utils/
    ├── api.ts                    # tRPC client wrapper
    └── app-error.ts              # Sentry error handling
```

### WebSocket Server (fpp-server/src/)

```plaintext
fpp-server/src/
├── index.ts                      # Elysia app + WebSocket route + cron
├── message.handler.ts            # Action handler switch statement
├── room.state.ts                 # In-memory Map<roomId, RoomServer>
├── room.entity.ts                # RoomServer & UserServer classes
├── room.actions.ts               # TypeBox schemas + Action types
├── room.types.ts                 # DTOs for client serialization
└── utils.ts                      # Helper functions
```

### Analytics API (fpp-analytics/)

```plaintext
fpp-analytics/
├── main.py                       # FastAPI app factory
├── update_readmodel.py           # Sync script (separate container)
├── config.py                     # Environment configuration
├── data/                         # Parquet files (volume mount)
├── routers/
│   ├── analytics.py              # GET /, /daily-analytics
│   └── room.py                   # GET /room/{id}/stats
└── calculations/
    ├── traffic.py                # Unique users, page views, etc.
    ├── votes.py                  # Vote metrics
    └── ...
```

---

## Cross-Service Change Patterns

### Pattern 1: Add New Room Action

**Example:** Add "Pause Timer" action

**Steps:**
1. Define Action type (`fpp-server/src/room.actions.ts`)
2. Add TypeBox schema + union entry
3. Handle action (`fpp-server/src/message.handler.ts`)
4. Update RoomServer entity if needed (`fpp-server/src/room.entity.ts`)
5. Add client trigger (`src/components/room/room.tsx`)
6. Update Zustand store if new state needed (`src/store/room.store.ts`)

**Files Changed:** 2-4 (depending on if new state is needed)

**Spec Files:**
- `.openspec/changes/[feature]/specs/websocket.md` - Action definition
- `.openspec/changes/[feature]/specs/state.md` - Client state (if needed)
- `.openspec/changes/[feature]/specs/ui.md` - UI trigger

### Pattern 2: Add Database Tracking

**Example:** Track "room timer started" event

**Steps:**
1. Add column/table (`src/server/db/schema.ts`)
2. Generate migration: `npm run db:generate`
3. Add tRPC endpoint (`src/server/api/routers/room.router.ts`)
4. Call from client or fpp-server
5. Update analytics if needed (`fpp-analytics/calculations/...`)

**Files Changed:** 3-5

**Spec Files:**
- `.openspec/changes/[feature]/specs/database.md` - Schema changes
- `.openspec/changes/[feature]/specs/api.md` - tRPC endpoint
- `.openspec/changes/[feature]/specs/analytics.md` - Analytics (if needed)

### Pattern 3: Add Analytics Metric

**Example:** Calculate "average timer duration"

**Steps:**
1. Update sync script (`fpp-analytics/update_readmodel.py`)
2. Create calculation (`fpp-analytics/calculations/timer.py`)
3. Add endpoint (`fpp-analytics/routers/analytics.py`)
4. Consume from client (tRPC or direct fetch)

**Files Changed:** 3-4

**Spec Files:**
- `.openspec/changes/[feature]/specs/analytics.md` - Calculation + endpoint

---

## Technology Constraints

### Must Use (Architectural Decisions)

- Next.js **Pages Router** (NOT App Router)
- tRPC for type-safe HTTP APIs
- WebSocket for real-time state
- Zustand with selective subscriptions
- Drizzle ORM (NOT Prisma, TypeORM)
- TypeBox in fpp-server (NOT Zod)
- Polars in fpp-analytics (NOT pandas)

### Must Avoid

- Server Components (Pages Router incompatible)
- Direct database access from fpp-server
- Caching in fpp-analytics (on-demand calculation is design)
- Storing personal data (GDPR constraint)

---

## Deployment Constraints

### Environment Variables

**Next.js:**
- `NEXT_PUBLIC_*` for client-side vars
- `SKIP_ENV_VALIDATION=1` required for builds
- Doppler for local development

**fpp-server:**
- `TRPC_URL` for persistence callbacks
- `SENTRY_DSN` for error tracking

**fpp-analytics:**
- `ANALYTICS_SECRET_TOKEN` for auth
- `DATA_DIR` for Parquet files
- `DB_*` for MySQL (updater only)

### Port Allocation

- 3001: Next.js
- 3003: WebSocket
- 3002: Analytics (Docker only)

---

**Last Updated:** 2025-12-27
**For detailed architecture:** See `/ARCHITECTURE.md`
**For component guides:** See `CLAUDE.md` files
