# FPP WebSocket Server (`@fpp/server`)

Real-time planning poker room state management via Bun + Elysia + WebSocket. Workspace member of the [free-planning-poker monorepo](../../README.md).

## Quick Start

```bash
# From repo root
bun install                            # install workspace deps
bun run --filter=@fpp/server dev       # run on port 3003

# Or from this dir
cd apps/server && bun dev
```

## Architecture

This service is the authoritative source for real-time room state. It:

- Maintains in-memory Map of all active rooms
- Broadcasts state changes to all connected clients
- Runs cleanup cron every 30 minutes

**For detailed architecture**, see `/ARCHITECTURE.md` and `CLAUDE.md`.

---

## Local Setup

### Prerequisites

1. Install Bun: `curl -fsSL https://bun.sh/install | bash`
2. Ensure Next.js server is running (port 3001) for tRPC callbacks

### Environment Variables

Create `.env` file:

```bash
TRPC_URL=http://localhost:3001/api/trpc  # Next.js tRPC endpoint for persistence
FPP_SERVER_SECRET=dev-secret-token       # Auth token for callbacks
SENTRY_DSN=...                           # Error tracking
NODE_ENV=development
```

### Install & Run

```bash
bun install   # Install dependencies
bun dev       # Start dev server (port 3003)
```

---

## Project Structure

```
apps/server/
├── src/
│   ├── index.ts           # Elysia app + WebSocket route + Sentry + SIGTERM drain
│   ├── room.state.ts      # In-memory room state manager
│   ├── room.entity.ts     # RoomServer & UserServer classes
│   ├── message.handler.ts # Action handler switch
│   ├── types.ts           # Local utility types (Analytics)
│   ├── utils.ts           # Helper functions
│   ├── utils/app-error.ts # Sentry wrapper (captureError, addBreadcrumb)
│   └── websocket.constants.ts
├── Dockerfile             # Bun monorepo build → self-contained binary
├── tsconfig.json
└── package.json

# Shared with the web app:
packages/shared/src/
├── room.actions.ts        # TypeBox schemas + Action union (imported as @fpp/shared)
├── room.types.ts          # Room/User DTOs for client serialization
└── username.validator.ts
```

`TypeBox` schemas live in `@fpp/shared` as type definitions only; `TypeCompiler.Compile(ActionSchema)` happens once at server boot in `apps/server/src/index.ts` to keep TypeBox internals out of the web bundle.

---

## Deployment

### Production Build (local validation)

```bash
bun run build           # bun build --target bun --outdir ./dist
bun run start           # NODE_ENV=production bun dist/index.js
```

### VPS — Docker via RollHook

Production runs from `apps/server/Dockerfile` built from the **repo root** as build context. The Dockerfile:

1. Copies `package.json`, `bun.lock`, and every workspace manifest (`apps/web`, `apps/server`, `packages/db`, `packages/shared`).
2. Runs `bun install --frozen-lockfile` at the workspace root so symlinks resolve.
3. Compiles `bun build --compile` against `src/index.ts`, producing a single self-contained binary at `/app/server` in a fresh `oven/bun:1.3-alpine` runner.

CI (`deploy.yml`) builds and ships the image via [RollHook](https://rollhook.jkrumm.com) on every master push. Rollouts are zero-downtime: the container's `SIGTERM` handler flips `/health` to 503, sleeps 3s so Traefik deregisters, then closes listening sockets.

**Manual redeploy** (no code change — e.g., env var rotated):

```bash
gh workflow run deploy.yml -f service=fpp-server
```

**Logs (on VPS):**

```bash
docker logs -f fpp-server
```

---

## Monitoring

### Sentry

- Error tracking enabled via `@sentry/bun`
- Captures WebSocket errors, message handler errors, broadcast failures
- Context: roomId, userId, action type

### Logs

- Production: JSON format (structured logging via pino)
- Development: Pretty-printed with colors
- Check with: `docker logs --tail 100 fpp-server`

### Health Checks

- Health: `GET http://localhost:3003/health` (returns 503 during SIGTERM drain)
- Analytics: `GET http://localhost:3003/analytics` (room/user counts + DTOs)
- WebSocket: `ws://localhost:3003/ws?roomId=…&userId=…&username=…`
- Production: `GET https://server.free-planning-poker.com/health`

---

## Common Tasks

### Add New WebSocket Action

See `CLAUDE.md` for detailed guide. Quick steps:

1. Define type in `room.actions.ts`
2. Add TypeBox schema
3. Handle in `message.handler.ts`
4. Update client code

### Debug Connection Issues

```bash
# Test WebSocket connection
wscat -c ws://localhost:3003/ws

# Send test join action
{"action":"join","userId":"test123456789012345678","roomId":1,"username":"TestUser"}
```

### Monitor Memory Usage

```bash
# Bun includes built-in memory profiling
bun --inspect src/index.ts
```

---

## Performance Notes

- Scales to 10k concurrent connections
- Each room: ~2-5 KB memory
- Broadcast latency: <5ms local
- Cleanup runs every 30 minutes

---

## Troubleshooting

### WebSocket won't connect

- Check CORS (same-origin only)
- Verify port 3003 is not in use
- Check firewall rules

### State not persisting across restarts

- **Expected behavior** (in-memory only)
- Persistent state lives in MySQL (Next.js manages)

### Users not being cleaned up

- Check client heartbeat (every 5 min)
- Check cron job logs (every 30 min)
- Verify `cleanupInactiveState()` is running

### High memory usage

- Check number of active rooms: `GET /analytics`
- Rooms should auto-delete when empty
- Restart service if memory leak suspected

---

## For AI Development

See `CLAUDE.md` for:

- TypeBox patterns (NOT Zod)
- Broadcast patterns
- Error handling
- Common gotchas

---

**Last Updated**: 2025-12-27
