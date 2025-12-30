# Free Planning Poker - AI Development Guide

## Quick Reference

| Service | Runtime | Framework | Port | CLAUDE.md |
|---------|---------|-----------|------|-----------|
| **Next.js App** | Node 22 | Next.js 16 (Pages Router) | 3001 | This file |
| **WebSocket Server** | Bun | Elysia 1.4 | 3003 | `fpp-server/CLAUDE.md` |
| **Analytics API** | Python 3.12 | FastAPI | 3002 | `fpp-analytics/CLAUDE.md` |

---

## Multi-Service Architecture

Free Planning Poker runs on three independent services:

1. **Next.js App** (port 3001) - UI, tRPC API, database operations
2. **Bun WebSocket Server** (port 3003) - Real-time room state, in-memory
3. **FastAPI Analytics** (port 3002) - Analytics calculations, read-only

📖 **For detailed architecture**, see `ARCHITECTURE.md` and `.openspec/project.md`

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
1. Define Action type in `fpp-server/src/room.actions.ts`
2. Add handler in `fpp-server/src/message.handler.ts`
3. Update client to send action via `triggerAction()`
4. Update Zustand store to reflect state changes (if new state needed)

#### Pattern 2: Add Database Tracking
1. Add column/table in `src/server/db/schema.ts`
2. Generate migration !HumanInTheLoop!: `npm run db:generate`
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

| Service | Error Handling | Sentry Context |
|---------|----------------|----------------|
| Next.js | Sentry breadcrumbs + `captureError()` | component, action, userId, roomId |
| fpp-server | Sentry `captureException()` | roomId, userId, action type |
| fpp-analytics | Sentry `capture_exception()` | endpoint, calculation type |

### Development Workflow Commands

```bash
# Start all services simultaneously
npm run dev:all                           # Next.js + WebSocket + Analytics

# Or start individually:
npm run dev                               # Next.js (port 3001)
cd fpp-server && bun dev                  # WebSocket (port 3003)
cd fpp-analytics && uv run uvicorn main:app --reload  # Analytics (port 3002)

# Code quality (run from root)
npm run pre                               # Format, lint, type-check, build
```

---

## Project Overview

Free Planning Poker is a Next.js application using the **Pages Router** (not App Router). Key technologies:
- **Next.js 16.0.1** with Turbopack
- **React 19.2.0** with stricter linting rules
- **tRPC 11.7.1** for type-safe API layer
- **Bun WebSocket server** for real-time features
- **Zustand 5.0.8** for state management
- **Drizzle ORM 0.44.7** with MySQL
- **Tailwind CSS 4** + **Mantine 8.3.6** for UI

## Build & Development Commands

**IMPORTANT**: Always use `SKIP_ENV_VALIDATION=1` for builds to avoid environment validation failures.

```bash
# Development
npm run dev                              # Start dev server on port 3001 - Only suggest to user
npm run dev:all                          # Start all services (Next.js, fpp-server, analytics) - Only suggest to user

# Building (REQUIRED env var)
SKIP_ENV_VALIDATION=1 npm run build

# Code Quality & Validation
npm run validate                         # Validate all services in parallel
npm run validate:nextjs                  # Validate Next.js only
npm run validate:fpp-server              # Validate fpp-server only
npm run validate:fpp-analytics           # Validate fpp-analytics only

# Next.js specific
npm run lint                             # Run ESLint
npm run lint:fix                         # Auto-fix ESLint issues
npm run type-check                       # TypeScript type checking
npm run format                           # Format with Prettier
npm run pre                              # Run all checks (format, lint, type-check, build)

# fpp-server specific
cd fpp-server && bun run validate        # All checks for fpp-server
cd fpp-server && bun run lint            # ESLint for fpp-server
cd fpp-server && bun run type-check      # TypeScript for fpp-server

# fpp-analytics specific
npm run fpp-analytics:validate           # All checks for fpp-analytics
npm run fpp-analytics:lint               # Ruff lint
npm run fpp-analytics:type-check         # mypy type check

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

```plaintext
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

## Sentry Error Handling Standards

### Import Rule (Enforced by ESLint)
```typescript
// ✅ Correct - use the wrapper
import { captureError, captureMessage, addBreadcrumb } from 'fpp/utils/app-error';

// ❌ BANNED - direct Sentry imports
import { captureException, captureMessage } from '@sentry/nextjs';
```

### When to Use captureError

**Capture:**
- System errors (database, server crashes)
- Failed mutations with no fallback
- Authentication failures
- tRPC: INTERNAL_SERVER_ERROR, TIMEOUT, UNKNOWN
- Bugs in validation logic (e.g., unexpected null/undefined)

**Don't Capture:**
- User input validation errors (wrong format, too long, etc.)
- tRPC: BAD_REQUEST, CONFLICT (business logic errors)
- WebSocket 1006 closes (auto-reconnect)
- Expected business logic failures

### Severity Decision Tree

```
Prevents app from working? → critical
Blocks user action? → high (system errors, auth failures)
Validation/business error? → medium (fix the frontend)
Recoverable/handled? → medium (network issues, query failures)
Informational? → low
```

### tRPC Mutation Pattern

```typescript
mutation.mutate(data, {
  onError: (error) => {
      captureError(error, {
        component: 'ComponentName',
        action: 'actionName',
        extra: { errorCode }
      }, 'high');

    // Always show user feedback
    showErrorNotification(error.message);
  }
});
```

### captureError Usage

```typescript
// Good: Provides context
captureError(error, {
  component: 'UserProfile',
  action: 'updateSettings',
  extra: { userId, settingKey }
}, 'high');

// Bad: No context
captureError(error);

// Good: Capturing user input error to fix frontend validations
if (email.length > 100) {
  captureError('Email too long', { component: 'Form' }, 'medium');
}

// Good: Capturing validation logic bug
try {
  return value.trim().length > 50;
} catch (error) {
  captureError(error, { component: 'Form', action: 'validate' }, 'low');
}
```

### Breadcrumb Guidelines

**Use breadcrumbs for:**
- Navigation events (page changes, route transitions)
- WebSocket lifecycle (connect, disconnect, reconnect)
- Critical user actions (create room, join room, vote)
- State transitions (connection health, heartbeat pings)

**Don't use breadcrumbs for:**
- Every render or effect
- Repeated/frequent events (individual keystrokes, mouse moves)
- Events that don't help debug errors

**Current usage:** 21 files use breadcrumbs - mostly in hooks (WebSocket, heartbeat, connection health) and navigation. This is appropriate for central, high-level operations.

## Error Handling Implementation Guide

This section provides comprehensive patterns for implementing error handling across Next.js API routes and tRPC routers using CustomTRPCError.

### Overview

Free Planning Poker uses **CustomTRPCError** for centralized error capture. All system errors flow through a single capture point in `src/pages/api/trpc/[trpc].ts`, eliminating double-capture bugs and reducing boilerplate.

**Key Files:**
- `src/server/api/custom-error.ts` - CustomTRPCError class and helpers
- `src/pages/api/trpc/[trpc].ts` - Central error handler
- `src/utils/app-error.ts` - Sentry wrapper (used by API routes and frontend)

### Next.js API Routes (Pages Router)

All Next.js API route handlers (`/src/pages/api/*.ts`) must wrap their logic in try-catch blocks:

```typescript
import { type NextApiRequest, type NextApiResponse } from '@trpc/server/adapters/next';
import { captureError } from 'fpp/utils/app-error';

const ApiHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    // Validate request method
    if (req.method !== 'POST') {
      throw new MethodNotAllowedError('Only POST requests allowed');
    }

    // Parse and validate input
    const { userId, data } = req.body;
    validateInput(userId, data);

    // Perform database operations
    await db.insert(table).values({ userId, data });

    // Return success response
    return res.status(200).json({ success: true });
  } catch (error) {
    // Capture error with context
    captureError(
      error instanceof Error ? error : new Error('Operation failed'),
      {
        component: 'api-route-name',
        action: 'handlerName',
        extra: {
          method: req.method ?? 'unknown',
          hasBody: !!req.body,
          // Add relevant context (avoid sensitive data)
        },
      },
      'high', // Adjust severity based on impact
    );

    // Return error response
    return res.status(500).json({
      error: 'Internal server error',
      // Return safe error details if needed
    });
  }
};

export default ApiHandler;
```

**Key Points:**
- Wrap entire handler function in try-catch
- Capture errors with component/action context using `captureError`
- Return HTTP 500 with safe error message
- Use 'high' severity for API failures (blocks user action)

### tRPC Router Error Handling (CustomTRPCError)

**IMPORTANT:** tRPC routers use CustomTRPCError for centralized error capture. Do NOT use try-catch or captureError directly in routers.

#### Pattern 1: Database Query

```typescript
import { TRPCError } from '@trpc/server';
import { toCustomTRPCError } from 'fpp/server/api/custom-error';
import { createTRPCRouter, publicProcedure } from 'fpp/server/api/trpc';

export const exampleRouter = createTRPCRouter({
  getData: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx: { db }, input: { id } }) => {
      const data = await db.query.table.findFirst({
        where: eq(table.id, id),
      }).catch((error) => {
        throw toCustomTRPCError(error, 'Failed to query database', {
          component: 'exampleRouter',
          action: 'getData',
          extra: { id },
          severity: 'high',
        });
      });

      if (!data) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Data not found',
        });
      }

      return data;
    }),
});
```

#### Pattern 2: External API Fetch

```typescript
const response = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
}).catch((error) => {
  throw toCustomTRPCError(error, 'Failed to fetch external API', {
    component: 'exampleRouter',
    action: 'getData',
    extra: { url },
    severity: 'high',
  });
});

if (!response.ok) {
  throw toCustomTRPCError(
    new Error(`API error: ${response.status} ${response.statusText}`),
    'External API returned error status',
    {
      component: 'exampleRouter',
      action: 'getData',
      extra: { url, status: response.status },
      severity: 'high',
    },
  );
}

return response.json();
```

#### Pattern 3: Promise.allSettled

```typescript
const promises = [
  db.insert(table1).values(data1),
  db.insert(table2).values(data2),
  db.update(table3).set(data3).where(eq(table3.id, id)),
];

const results = await Promise.allSettled(promises);
const failedResults = results.filter(r => r.status === 'rejected');

if (failedResults.length > 0) {
  throw toCustomTRPCError(
    failedResults[0].reason,
    'Failed to persist data',
    {
      component: 'exampleRouter',
      action: 'procedureName',
      extra: {
        failedCount: failedResults.length,
        totalCount: promises.length,
      },
      severity: 'high',
    },
  );
}
```

### Error Types

**Business Logic Errors (use standard TRPCError):**
```typescript
// NOT_FOUND, CONFLICT, BAD_REQUEST, UNAUTHORIZED, FORBIDDEN
if (!data) {
  throw new TRPCError({
    code: 'NOT_FOUND',
    message: 'Resource not found',
  });
}
```
These are NOT captured in Sentry (expected user-facing errors).

**System Errors (use CustomTRPCError via toCustomTRPCError):**
```typescript
// Database failures, external API errors, timeouts
await db.query().catch((error) => {
  throw toCustomTRPCError(error, 'Failed to query', {
    component: 'routerName',
    action: 'procedureName',
    extra: { context },
    severity: 'high',
  });
});
```
These ARE captured in Sentry (unexpected system failures).

### Error Severity Guidelines

Use these severity levels consistently:

- **critical**: App crash, data loss, security breach
- **high**: User action blocked (database error, API failure, auth failure) - DEFAULT
- **medium**: Degraded experience (non-critical feature failures)
- **low**: Informational (analytics tracking failed, geo lookup failed)

### Common Mistakes to Avoid

❌ **Don't:**
- Use try-catch in tRPC routers (creates double-capture)
- Use captureError directly in tRPC routers (use toCustomTRPCError)
- Wrap business logic errors with CustomTRPCError (use standard TRPCError)
- Forget to add .catch() to async operations

✅ **Do:**
- Use .catch() with toCustomTRPCError for all database/fetch operations
- Use standard TRPCError for business logic errors
- Provide component, action, and extra context in metadata
- Use severity 'high' (default) for system errors

## Additional Resources
Use Context7 MCP as a reference for documentation:
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
- Feature branches - Descriptive names e.g. `feat/JK-60-add-analytics`
- Small stuff and so on usually can go directly to `master`

### Commit Messages
Follow conventional commits sometimes there might be a JK ticket number but not always:
```plaintext
feat(JK-60): add new feature
fix(JK-60): resolve bug
docs(JK-60): update documentation
style(JK-60): formatting changes
refactor(JK-60): code restructuring
test(JK-60): add tests
chore: maintenance tasks
```

---

**Last Updated**: 2025-12-27
**For detailed architecture explanation**: See `ARCHITECTURE.md` and `.openspec/project.md`
