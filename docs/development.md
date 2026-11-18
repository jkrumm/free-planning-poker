# Development reference

Read the section a task needs. `AGENTS.md` names each one. Order: commands and env, cross-service, key files, lint, code patterns.

## Build & Development Commands

**IMPORTANT**: Always use `SKIP_ENV_VALIDATION=1` for local Next.js builds — env vars are injected by `secrets-run run --env-file=apps/web/.env.tpl` at runtime, not at build time.

All scripts run from the workspace root unless noted. The root `package.json` delegates to workspace members via `bun run --filter=@fpp/<pkg>`.

```bash
# Development (suggest to user — don't run yourself)
bun run dev                              # All services + Logdy UI (7720 / 7721 / 7722 / 7723)
bun run dev:web                          # Next.js only (port 7720)

# Building
SKIP_ENV_VALIDATION=1 bun run build      # Next.js production build
bun run --filter=@fpp/server build       # Server: bun build --target bun --outdir ./dist

# Validation (all workspaces in parallel)
bun run validate                         # Validate everything
bun run validate:web                     # @fpp/web only
bun run validate:server                  # @fpp/server only
bun run validate:db                      # @fpp/db only
bun run validate:shared                  # @fpp/shared only
bun run validate:analytics               # fpp-analytics only

# Per-service shortcuts
bun run --filter=@fpp/web format         # / lint / lint:fix / type-check / pre
bun run --filter=@fpp/server format      # / lint / lint:fix / type-check / validate
bun run fpp-analytics:format             # / :lint / :lint:fix / :type-check / :validate

# Database (@fpp/db package — drizzle-kit lives here)
bun run db:generate                      # Generate migration from schema changes - suggest to user
bun run db:migrate                       # Apply pending migrations - suggest to user
bun run db:studio                        # Drizzle Studio - suggest to user
bun run db:check                         # Verify schema/db are in sync

# Local rehydrate from prod data (in order — db-sync drops + recreates schema)
make db-sync-from-prod                   # MariaDB sync via SSH from VPS
make db-setup-local                      # Re-grant fpp user (no SSL — local has no TLS)
make analytics-update-local              # Regenerate parquet files for /analytics
```

### Local env (no 1Password needed)

Each service has its own `.env.tpl` resolved at dev-script time by `secrets-run run --env-file=.env.tpl --` (a faithful `op run` drop-in: passthrough to `op` on the MacBook, encrypted-cache resolution on the mini).

**No `.env.tpl` contains an `op://` reference.** Every local value is a literal, so `bun run dev` needs no 1Password access and runs on any machine — including the headless Mac mini. The three values that once came from `op://vps/*` (`MARIADB_FPP_PASSWORD`, `FPP_SERVER_SECRET`, `ANALYTICS_SECRET_TOKEN`) never needed prod values: the DB is a localhost container (`:13306`), and the two shared secrets only need the local services to agree with each other. Sourcing them from prod bought automatic rotation-propagation and cost the ability to develop on the mini, where the only way to resolve an `op://` ref is to cache it — and prod refs must never enter that cache (`dotfiles-private/headless.refs`).

Values that must agree across files (all local-only, none are secrets):

| Value | Defined in |
|-|-|
| `fpp-local-dev` | `apps/web/.env.tpl` + `LOCAL_FPP_DB_PASSWORD` in root `Makefile` |
| `local-dev-server-secret` | `apps/web/.env.tpl` + `apps/server/.env.tpl` |
| `local-dev-analytics-token` | `apps/web/.env.tpl` + `fpp-analytics/.env.tpl` |

**No local target needs 1Password — including `make db-sync-from-prod`.** It does reach the real production database, but the prod credential never touches this machine: the script's remote half is `ssh vps 'op run ...'`, so the VPS resolves `MARIADB_ROOT_PASSWORD` itself via its own op service account and only the dump comes back over SSH. Its local half reads the dev container's own env, as do `make db-setup-local` (root password from the container, grants the local-only password) and `make analytics-update-local` (reads the local DB). All three run on the headless mini; `db-sync-from-prod` needs only SSH access to the VPS over Tailscale. Vercel manages prod env directly.

### Local URLs

Browser hits Caddy at `https://fpp.test` / `fpp-server.test` / `fpp-analytics.test` / `fpp-logdy.test`. Node server-side fetches bypass Caddy and use `http://localhost:7721|7722` directly (Node doesn't trust Caddy's local CA).

## Cross-service changes

### When to Modify Which Service

**Next.js (this service):**
- UI components, pages, routing
- tRPC API endpoints (non-realtime)
- Database operations via Drizzle
- SEO, analytics tracking, auth

**fpp-server (WebSocket):**
- Real-time room state (votes, users, flip status)
- WebSocket action handlers
- In-memory room state management
- Broadcast logic

**fpp-analytics (FastAPI):**
- Read-only analytics calculations
- Parquet file processing
- Analytics page dashboard endpoints

### Cross-Service Change Patterns

#### Pattern 1: Add New Room Action
1. Define Action type in `packages/shared/src/room.actions.ts`
2. Add handler in `apps/server/src/message.handler.ts`
3. Update client to send action via `triggerAction()`
4. Update Zustand store to reflect state changes (if new state needed)

#### Pattern 2: Add Database Tracking
1. Add column/table in `packages/db/src/schema.ts`
2. Generate migration !HumanInTheLoop!: `bun run db:generate`
3. Update tRPC router to persist data
4. Update analytics if needed (`fpp-analytics/calculations/`)

#### Pattern 3: Add Analytics Metric
1. Update `fpp-analytics/update_readmodel.py` to sync table
2. Create calculation in `fpp-analytics/calculations/`
3. Add endpoint in `fpp-analytics/routers/`
4. Consume from Next.js via tRPC proxy

### Critical Cross-Service Rules

#### State Synchronization
Room state exists in THREE places:
1. **MySQL database** - Persistent, historical (Next.js writes via Drizzle)
2. **Bun server memory** - Authoritative, real-time (fpp-server manages)
3. **Client Zustand store** - Local, synced via WebSocket

**Rule:** Always update authoritative source first, then propagate.

#### Communication Protocols

| From → To | Protocol | Use Case | Example |
|-----------|----------|----------|---------|
| Client → Next.js | tRPC | Room creation, joining, name changes | `api.room.joinRoom.useMutation()` |
| Client → fpp-server | WebSocket | Real-time actions (vote, flip, reset) | `triggerAction({ action: 'selectEstimation' })` |
| fpp-server → Next.js | HTTP | Persist vote after flip | `fetch('/api/trpc/room.trackFlip')` |
| Next.js → fpp-analytics | None | Analytics runs independently | - |

#### Error Handling Responsibilities

| Service | Error Handling | Context attributes |
|---------|----------------|--------------------|
| Next.js | `recordError()` → OTEL span exception + log record | component, action, userId, roomId |
| fpp-server | `recordError()` → OTEL span exception + log record | roomId, userId, action |
| fpp-analytics | `capture_error()` → OTEL span exception + log record | endpoint, calculation |

## Key Files & Their Purpose

### State Management
- `apps/web/src/store/room.store.ts` - Real-time room state (users, votes, connection status)
- `apps/web/src/store/local-storage.store.ts` - Persistent client data (userId, username)

### Core Hooks
- `apps/web/src/hooks/useWebSocketRoom.ts` - WebSocket connection + action queue system
- `apps/web/src/hooks/useHeartbeat.ts` - Dual heartbeat (5min client, 30min server)
- `apps/web/src/hooks/usePresenceTracking.ts` - Tab visibility tracking
- `apps/web/src/hooks/use-has-mounted.hook.ts` - SSR hydration safety

### Room Components
- `apps/web/src/components/room/room-wrapper.tsx` - Room initialization & validation
- `apps/web/src/components/room/room.tsx` - Main room component (900 lines)

### WebSocket Server
- `apps/server/src/index.ts` - Elysia WebSocket server
- `apps/server/src/room.state.ts` - In-memory Map<roomId, RoomServer>
- `apps/server/src/message.handler.ts` - Handle WebSocket actions

### Database
- `packages/db/src/schema.ts` - Drizzle schema (rooms, users, votes, estimations)
- `packages/db/src/client.ts` - Drizzle/mysql2 client factory (`createClient`, `Db` type) — exposed as `@fpp/db/client` subpath so client code never bundles mysql2
- `apps/web/src/server/db/db.ts` - Singleton `db` instance built from `createClient(env.DATABASE_URL)`, dev-mode HMR caching
- `apps/web/src/server/api/routers/room.router.ts` - Room tRPC endpoints

## ESLint & React 19 Linting

We use **ESLint flat config** (`eslint.config.mjs`) with React 19's strict rules.

### Valid Suppression Patterns

React 19 introduced stricter linting. Some patterns require suppression for **valid use cases**:

#### 1. `react-hooks/set-state-in-effect` - Valid for:
- SSR hydration safety (mount detection)
- Timer initialization
- One-time initialization flags

```tsx
useEffect(() => {
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Valid pattern: SSR hydration safety
  setHasMounted(true);
}, []);
```

#### 2. `react-hooks/error-boundaries` - Valid for:
- Event log emission via `recordEvent` (not error handling)
- Component-level logging

#### 3. `react-hooks/purity` - Valid for:
- `Date.now()` in refs for timestamp tracking

#### 4. `react-hooks/immutability` - Valid for:
- Recursive callbacks (self-scheduling timers)

**Format**:
```tsx
// eslint-disable-next-line rule-name -- Brief explanation of why this is valid
```

## Code Style Guidelines

### TypeScript
- Use strict mode
- Prefer type inference over explicit types
- Use `type` for objects, `interface` for extensible contracts
- Use `satisfies` for type narrowing

### React Components
- Functional components with hooks
- Use `type` for component props
- Keep components small and focused
- Extract complex logic into custom hooks

### Zustand Patterns
**Selective subscriptions** - only subscribe to needed state:
```tsx
// ✅ Good - re-renders only when users change
const users = useRoomStore((state) => state.users);

// ❌ Bad - re-renders on ANY state change
const roomState = useRoomStore();
```

### Import Order (enforced by Prettier)
1. React imports
2. Next.js imports
3. Third-party libraries
4. Internal imports (using `fpp/*` alias)
5. Types

## Common Patterns

### tRPC Mutations
```typescript
const mutation = api.room.joinRoom.useMutation({
  onSuccess: (data) => { /* handle success */ },
  onError: (error) => {
    recordError(error, { component: 'X', action: 'Y' }, 'high');
  },
});
```

### WebSocket Actions
All WebSocket messages go through `triggerAction()`:
```typescript
triggerAction({
  action: 'selectEstimation',
  userId,
  roomId,
  estimation: '5',
});
```

### Error Handling
Use the facade verbs (emit OTEL log records correlated by trace_id):
```typescript
recordEvent(EVENT.WS_RECONNECTED); // typed, client-only domain event
recordError(error, { component: 'ComponentName', action: 'actionName' }, 'high');
```
