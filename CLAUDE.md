# Free Planning Poker - Claude Development Guide

## Project Overview
Free Planning Poker is a Next.js application using the **Pages Router** (not App Router). We use:
- **Next.js 16.0.1** with Turbopack
- **React 19.2.0** with stricter linting rules
- **tRPC 11.7.1** for type-safe API layer
- **Bun WebSocket server** for real-time features
- **Zustand 5.0.8** for state management
- **Drizzle ORM 0.44.7** with MySQL
- **Tailwind CSS 4** + **Mantine 8.3.6** for UI

### Architecture
Dual-server setup:
1. **Next.js server** (port 3001) - Pages Router, tRPC API, database operations
2. **Bun WebSocket server** (port 3003) - Real-time room state, in-memory

📖 **For detailed architecture**, see `ARCHITECTURE.md`

## Build & Development Commands

**IMPORTANT**: Always use `SKIP_ENV_VALIDATION=1` for builds to avoid environment validation failures.

```bash
# Development
npm run dev                              # Start dev server on port 3001 - Only suggest to user
npm run dev:all                          # Start all services (Next.js, fpp-server, analytics) - Only suggest to user

# Building (REQUIRED env var)
SKIP_ENV_VALIDATION=1 npm run build

# Code Quality
npm run lint                             # Run ESLint
npm run lint:fix                         # Auto-fix ESLint issues
npm run type-check                       # TypeScript type checking
npm run format                           # Format with Prettier
npm run pre                              # Run all checks (format, lint, type-check, build)

# Database
npm run db:generate                      # Generate Drizzle migrations - Only suggest to user
npm run db:migrate                       # Run migrations - Only suggest to user
npm run db:studio                        # Open Drizzle Studio - Only suggest to user
```

## Critical Rules

### 🚨 Pages Router - NOT App Router
This project uses Next.js **Pages Router**. Do not use App Router patterns:
- ❌ No `app/` directory
- ❌ No Server Components
- ❌ No `async` components
- ❌ No `export const metadata`
- ✅ Use `/src/pages` directory
- ✅ Use `getStaticProps`, `getServerSideProps`
- ✅ Import from `next/router` not `next/navigation`
- ✅ Use tRPC for API routes

### 🚨 Import Alias
Use `fpp/*` for all internal imports:
```typescript
// ✅ Correct
import { api } from 'fpp/utils/api';
import { useRoomStore } from 'fpp/store/room.store';

// ❌ Wrong
import { api } from '../../utils/api';
import { useRoomStore } from '../store/room.store';
```

### 🚨 Environment Variables
- **Client vars**: Must be prefixed with `NEXT_PUBLIC_`
- **Build command**: Always use `SKIP_ENV_VALIDATION=1 npm run build`
- **Environment file**: Use Doppler (not .env) for local development

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
- Sentry breadcrumb logging (not error handling)
- Component-level logging

#### 3. `react-hooks/purity` - Valid for:
- `Date.now()` in refs for timestamp tracking

#### 4. `react-hooks/immutability` - Valid for:
- Recursive callbacks (self-scheduling timers)

**Format**:
```tsx
// eslint-disable-next-line rule-name -- Brief explanation of why this is valid
```

## Project Structure

```
free-planning-poker/
├── src/
│   ├── components/         # React components
│   │   └── room/          # Room-related components (main app)
│   ├── hooks/             # Custom React hooks
│   ├── pages/             # Next.js Pages Router
│   │   ├── _app.tsx       # App wrapper
│   │   ├── _document.tsx  # HTML document
│   │   ├── api/           # tRPC API routes
│   │   └── room/          # Room pages
│   ├── server/            # Server-side code
│   │   ├── api/           # tRPC routers
│   │   └── db/            # Database schema
│   ├── store/             # Zustand stores
│   ├── utils/             # Utility functions
│   ├── env.ts             # Environment validation
│   └── proxy.ts           # Next.js proxy (rate limiting)
├── fpp-server/            # Bun WebSocket server
│   └── src/
│       ├── index.ts       # Elysia server entry
│       ├── room.state.ts  # In-memory room state
│       ├── room.entity.ts # Room/User classes
│       ├── room.types.ts  # Shared types
│       ├── room.actions.ts # WebSocket action types
│       └── message.handler.ts # Action handler
└── public/                # Static assets
```

## Key Files & Their Purpose

### State Management
- `src/store/room.store.ts` - Real-time room state (users, votes, connection status)
- `src/store/local-storage.store.ts` - Persistent client data (userId, username)

### Core Hooks
- `src/hooks/useWebSocketRoom.ts` - WebSocket connection + action queue system
- `src/hooks/useHeartbeat.ts` - Dual heartbeat (5min client, 30min server)
- `src/hooks/usePresenceTracking.ts` - Tab visibility tracking
- `src/hooks/use-has-mounted.hook.ts` - SSR hydration safety

### Room Components
- `src/components/room/room-wrapper.tsx` - Room initialization & validation
- `src/components/room/room.tsx` - Main room component (900 lines)

### WebSocket Server
- `fpp-server/src/index.ts` - Elysia WebSocket server
- `fpp-server/src/room.state.ts` - In-memory Map<roomId, RoomServer>
- `fpp-server/src/message.handler.ts` - Handle WebSocket actions

### Database
- `src/server/db/schema.ts` - Drizzle schema (rooms, users, votes, estimations)
- `src/server/api/routers/room.router.ts` - Room tRPC endpoints

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
    captureError(error, { component: 'X', action: 'Y' }, 'high');
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
Use Sentry with breadcrumbs:
```typescript
addBreadcrumb('User action', 'component', { userId, roomId });
captureError(error, { component: 'ComponentName', action: 'actionName' }, 'high');
```

## Testing & Verification

Before committing:
```bash
npm run pre  # Runs format, lint, type-check, and build
```

## Common Gotchas

### 1. WebSocket vs tRPC
- **tRPC** (HTTP): Room creation, joining, stats, name changes
- **WebSocket**: Real-time state (votes, flips, user presence)

### 2. State Duplication
Room state exists in THREE places:
1. MySQL database (persistent)
2. Bun server memory (real-time, authoritative)
3. Client Zustand store (local, synced via WebSocket)

### 3. nanoid(21) for User IDs
Users are anonymous. Each client generates a 21-character nanoid stored in localStorage.

### 4. Connection Resilience
The app has an **action queue** in `useWebSocketRoom.ts` - actions sent while disconnected are queued and sent on reconnect.

### 5. Build Environment
Local builds require `SKIP_ENV_VALIDATION=1` - environment variables are managed via Doppler.

## Research & Documentation

### Using MCPs for Research

**IMPORTANT Rate Limits:**
- `mcp__brave-search__brave_web_search`: **1 request per second**
- `mcp__context7__get-library-docs`: No known rate limit

**Pattern**:
```typescript
// For library documentation
await mcp__context7__resolve_library_id({ libraryName: 'react' });
await mcp__context7__get_library_docs({
  context7CompatibleLibraryID: '/websites/react_dev',
  topic: 'hooks useEffect best practices'
});

// For current best practices (WAIT 1 SECOND between calls)
await sleep(1000);
await mcp__brave-search__brave_web_search({
  query: 'React 19 best practices 2025'
});
```

## Additional Resources

- **Next.js 16**: https://nextjs.org/docs
- **React 19**: https://react.dev
- **tRPC v11**: https://trpc.io/docs
- **React Query v5**: https://tanstack.com/query/latest
- **Mantine v8**: https://mantine.dev
- **Drizzle ORM**: https://orm.drizzle.team
- **Elysia**: https://elysiajs.com

## Version Control

### Branch Strategy
- `master` - Main branch (production)
- Feature branches - Descriptive names

### Commit Messages
Follow conventional commits:
```
feat: add new feature
fix: resolve bug
docs: update documentation
style: formatting changes
refactor: code restructuring
test: add tests
chore: maintenance tasks
```

---

**Last Updated**: 2025-10-31
**For detailed architecture explanation**: See `ARCHITECTURE.md`
