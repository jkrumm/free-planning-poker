# FPP WebSocket Server

Real-time planning poker room state management via Bun + Elysia + WebSocket.

## Quick Start

```bash
bun install
bun dev  # Runs on port 3003
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
src/
├── index.ts           # Elysia app + WebSocket route
├── room.state.ts      # In-memory room state manager
├── room.entity.ts     # RoomServer & UserServer classes
├── message.handler.ts # Action handler switch
├── room.actions.ts    # TypeBox schemas
├── room.types.ts      # DTOs for client serialization
└── utils.ts           # Helper functions
```

---

## Deployment

### Production Build

```bash
bun run build   # Outputs to dist/
bun run start   # Runs production build
```

### VPS Deployment (Systemd)

**Service file:** `/etc/systemd/system/fpp-server.service`
```ini
[Unit]
Description=FPP WebSocket Server
After=network.target

[Service]
Type=simple
User=fpp
WorkingDirectory=/app/fpp-server
ExecStart=/usr/local/bin/bun run dist/index.js
Restart=always
RestartSec=10

Environment=NODE_ENV=production
Environment=TRPC_URL=https://your-domain.com/api/trpc
EnvironmentFile=/app/fpp-server/.env

[Install]
WantedBy=multi-user.target
```

**Commands:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable fpp-server
sudo systemctl start fpp-server
sudo systemctl status fpp-server
```

**Logs:**
```bash
sudo journalctl -u fpp-server -f
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
- Check with: `sudo journalctl -u fpp-server -n 100`

### Health Checks
- WebSocket endpoint: `ws://localhost:3003/ws`
- Analytics endpoint: `GET http://localhost:3003/analytics`

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
