# CustomTRPCError Refactoring Specification

**Status**: Draft
**Created**: 2025-12-30
**Author**: Claude (based on architectural analysis)
**Estimated Effort**: 4-6 hours

---

## Problem Statement

### Current Issue: Double-Capture Bug

The current error handling implementation has a critical issue where errors are captured **twice**:

1. **Router-level capture**: Each tRPC router wraps operations in try-catch and calls `captureError()`
2. **Central handler capture**: `src/pages/api/trpc/[trpc].ts` also captures INTERNAL_SERVER_ERROR

**Example of double-capture:**
```typescript
// Router (room.router.ts)
try {
  const data = await db.query.rooms.findFirst();
  return data;
} catch (error) {
  captureError(error, { component: 'roomRouter', action: 'getData' }, 'high');  // ← Capture #1
  throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed', cause: error });
}

// [trpc].ts central handler
if (error.code === 'INTERNAL_SERVER_ERROR') {
  captureError(error, { component: 'trpcMiddleware', action: path }, 'high');  // ← Capture #2
}
```

**Result**: Same error sent to Sentry twice with different contexts.

### Additional Problems

1. **Code Duplication**: Every tRPC procedure needs 15+ lines of boilerplate:
   - try-catch wrapper
   - captureError with metadata
   - instanceof TRPCError check
   - Convert to TRPCError
   - Re-throw TRPCErrors

2. **Inconsistency Risk**: Developers might:
   - Forget to add error handling in new routers
   - Use different patterns across routers
   - Set incorrect severity levels

3. **Maintenance Burden**: Pattern must be manually maintained across:
   - analytics.router.ts
   - contact.router.ts
   - room.router.ts (3 procedures)
   - roadmap.router.ts
   - config.router.ts
   - landingpage.router.ts
   - sentry.router.ts

4. **Verbosity**: Router code obscured by error handling boilerplate

---

## Proposed Solution: CustomTRPCError

### Architecture

Introduce a custom error class that extends `TRPCError` and carries Sentry metadata. Move all error capturing to the central tRPC error handler.

```
┌─────────────────────────────────────────────────────────────┐
│  Router (clean!)                                            │
│  ├─ Business logic                                          │
│  ├─ Throw TRPCError for business errors (NOT_FOUND, etc.)  │
│  └─ Throw CustomTRPCError for system errors                │
│     (includes component, action, extra, severity)           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  [trpc].ts Central Handler (single capture point!)         │
│  ├─ Business errors → Log as warning, don't capture        │
│  ├─ CustomTRPCError → captureError with metadata           │
│  └─ Other errors → captureError with generic context       │
└─────────────────────────────────────────────────────────────┘
                            ↓
                         Sentry
                    (single capture)
```

### Benefits

✅ **Eliminates double-capture** - Errors sent to Sentry exactly once
✅ **DRY principle** - Error handling logic centralized
✅ **Cleaner routers** - 80% less error handling boilerplate
✅ **Type-safe metadata** - TypeScript enforces structure
✅ **Impossible to forget** - All errors flow through central handler
✅ **Consistent severity** - Centralized severity mapping
✅ **Easy to evolve** - Change error handling in one place

### Trade-offs

⚠️ **Less explicit** - Error boundaries not visible as try-catch blocks
⚠️ **Migration effort** - Need to refactor 8+ router files
⚠️ **Custom extension** - Deviation from standard tRPC patterns

**Verdict**: Benefits significantly outweigh trade-offs for a production app.

---

## Implementation Details

### 1. Create CustomTRPCError Class

**File**: `src/server/api/custom-error.ts` (new file)

```typescript
import { TRPCError, type TRPC_ERROR_CODE_KEY } from '@trpc/server';

/**
 * Metadata attached to CustomTRPCError for Sentry capture
 */
export interface ErrorMetadata {
  /** Router or component name (e.g., 'roomRouter', 'analyticsRouter') */
  component: string;

  /** Procedure or action name (e.g., 'getRoomStats', 'updateRoomName') */
  action: string;

  /** Additional context for debugging (must be JSON-serializable) */
  extra?: Record<string, string | number | boolean | null>;

  /** Sentry severity level */
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Custom TRPCError that carries Sentry metadata for centralized error capture.
 *
 * Use this when catching system errors (database failures, external API errors, etc.)
 * that should be reported to Sentry.
 *
 * @example
 * ```typescript
 * const data = await db.query.table.findFirst().catch((error) => {
 *   throw new CustomTRPCError(
 *     'INTERNAL_SERVER_ERROR',
 *     'Failed to get data',
 *     { component: 'exampleRouter', action: 'getData', extra: { id }, severity: 'high' },
 *     error
 *   );
 * });
 * ```
 */
export class CustomTRPCError extends TRPCError {
  public readonly metadata: ErrorMetadata;

  constructor(
    code: TRPC_ERROR_CODE_KEY,
    message: string,
    metadata: ErrorMetadata,
    cause?: unknown,
  ) {
    super({ code, message, cause });
    this.metadata = metadata;

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, CustomTRPCError.prototype);
  }
}

/**
 * Helper function to convert any error to CustomTRPCError with INTERNAL_SERVER_ERROR code.
 * Use this as the most common case for system errors.
 *
 * @example
 * ```typescript
 * const data = await db.query.table.findFirst().catch((error) =>
 *   throw toCustomTRPCError(error, 'Failed to get data', {
 *     component: 'exampleRouter',
 *     action: 'getData',
 *     extra: { id },
 *     severity: 'high',
 *   })
 * );
 * ```
 */
export function toCustomTRPCError(
  error: unknown,
  message: string,
  metadata: ErrorMetadata,
): CustomTRPCError {
  return new CustomTRPCError('INTERNAL_SERVER_ERROR', message, metadata, error);
}

/**
 * Helper to check if an error is a business logic error (shouldn't be captured in Sentry)
 */
export function isBusinessLogicError(error: TRPCError): boolean {
  return [
    'BAD_REQUEST',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'CONFLICT',
    'PRECONDITION_FAILED',
  ].includes(error.code);
}
```

### 2. Update Central tRPC Error Handler

**File**: `src/pages/api/trpc/[trpc].ts`

**Changes needed:**
1. Import `CustomTRPCError` and `isBusinessLogicError`
2. Update error handler to check for CustomTRPCError
3. Remove double-capture logic

```typescript
import { type TRPCError } from '@trpc/server';
import { createNextApiHandler } from '@trpc/server/adapters/next';

import { captureError } from 'fpp/utils/app-error';
import { CustomTRPCError, isBusinessLogicError } from 'fpp/server/api/custom-error';

import { appRouter } from 'fpp/server/api/root';
import { createTRPCContext } from 'fpp/server/api/trpc';

export const config = {
  region: 'fra1',
  maxDuration: 10,
};

const trpcErrorHandler = ({
  error,
  type,
  path,
  input,
}: {
  error: TRPCError;
  type: 'query' | 'mutation' | 'subscription' | 'unknown';
  path: string | undefined;
  input: unknown;
}) => {
  // Business logic errors are expected - log but don't capture in Sentry
  if (isBusinessLogicError(error)) {
    console.warn('TRPC Business Logic Error', {
      type,
      path,
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
      },
    });
    return;
  }

  // System errors should be captured
  console.error('TRPC System Error', {
    type,
    path,
    error: {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack,
    },
  });

  // Check if error has custom metadata from router
  if (error instanceof CustomTRPCError) {
    // Use metadata provided by router
    captureError(error, error.metadata, error.metadata.severity ?? 'high');
  } else {
    // Fallback for errors without metadata (uncaught system errors)
    const inputObj = input != null && typeof input === 'object' ? input : {};

    captureError(
      error,
      {
        component: 'trpcMiddleware',
        action: path ?? 'unknown',
        extra: {
          endpoint: path ?? 'unknown',
          type,
          trpc_error_code: error.code,
          ...(Object.keys(inputObj).length > 0 && Object.keys(inputObj).length <= 5
            ? inputObj
            : { inputKeyCount: Object.keys(inputObj).length }),
        },
      },
      'high',
    );
  }
};

export default createNextApiHandler({
  router: appRouter,
  createContext: createTRPCContext,
  onError: trpcErrorHandler,
});
```

### 3. Update Router Pattern

**Before** (current - verbose):
```typescript
export const roomRouter = createTRPCRouter({
  getRoomStats: publicProcedure
    .input(z.object({ roomId: z.number().positive() }))
    .query(async ({ ctx: { db }, input: { roomId } }) => {
      try {
        // Validate room exists
        const room = await db.query.rooms.findFirst({
          where: eq(rooms.id, roomId),
        });
        if (!room) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Room not found',
          });
        }

        // Fetch stats
        const response = await fetch(`${env.ANALYTICS_URL}/room/${roomId}/stats`);
        if (!response.ok) {
          throw new Error(`Analytics API error: ${response.status}`);
        }
        return response.json();
      } catch (error) {
        if (!(error instanceof TRPCError)) {
          captureError(
            error instanceof Error ? error : new Error('Failed to get room stats'),
            {
              component: 'roomRouter',
              action: 'getRoomStats',
              extra: { roomId },
            },
            'high',
          );
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to get room stats',
            cause: error,
          });
        }
        throw error;
      }
    }),
});
```

**After** (new - clean):
```typescript
import { TRPCError } from '@trpc/server';
import { toCustomTRPCError } from 'fpp/server/api/custom-error';

export const roomRouter = createTRPCRouter({
  getRoomStats: publicProcedure
    .input(z.object({ roomId: z.number().positive() }))
    .query(async ({ ctx: { db }, input: { roomId } }) => {
      // Validate room exists
      const room = await db.query.rooms.findFirst({
        where: eq(rooms.id, roomId),
      }).catch((error) => {
        throw toCustomTRPCError(error, 'Failed to query room', {
          component: 'roomRouter',
          action: 'getRoomStats',
          extra: { roomId },
          severity: 'high',
        });
      });

      if (!room) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Room not found',
        });
      }

      // Fetch stats
      const response = await fetch(`${env.ANALYTICS_URL}/room/${roomId}/stats`).catch((error) => {
        throw toCustomTRPCError(error, 'Failed to fetch analytics', {
          component: 'roomRouter',
          action: 'getRoomStats',
          extra: { roomId, analyticsUrl: env.ANALYTICS_URL },
          severity: 'high',
        });
      });

      if (!response.ok) {
        throw toCustomTRPCError(
          new Error(`Analytics API error: ${response.status}`),
          'Analytics API returned error status',
          {
            component: 'roomRouter',
            action: 'getRoomStats',
            extra: { roomId, status: response.status },
            severity: 'high',
          },
        );
      }

      return response.json();
    }),
});
```

**Savings**: 30 lines → 15 lines (50% reduction)

---

## Migration Strategy

### Phase 1: Foundation (30 minutes)

1. ✅ **Create `src/server/api/custom-error.ts`**
   - Implement CustomTRPCError class
   - Add toCustomTRPCError helper
   - Add isBusinessLogicError helper
   - Export all types

2. ✅ **Update `src/pages/api/trpc/[trpc].ts`**
   - Import CustomTRPCError and helpers
   - Update trpcErrorHandler to handle CustomTRPCError
   - Remove double-capture logic

3. ✅ **Test central handler**
   - Verify CustomTRPCError is captured correctly
   - Verify fallback works for uncaught errors
   - Check Sentry for single captures

### Phase 2: Router Migration (2-3 hours)

Refactor routers one at a time in order of complexity (simple → complex):

**Priority 1: Simple routers (single procedure, straightforward logic)**
- [ ] `src/server/api/routers/config.router.ts` - getLatestTag
- [ ] `src/server/api/routers/landingpage.router.ts` - getStats
- [ ] `src/server/api/routers/analytics.router.ts` - getAnalytics, getServerAnalytics

**Priority 2: Medium routers (multiple procedures, some complexity)**
- [ ] `src/server/api/routers/contact.router.ts` - sendMail (fetch operation)
- [ ] `src/server/api/routers/roadmap.router.ts` - getRoadmap (multiple fetches)

**Priority 3: Complex routers (multiple procedures, complex logic)**
- [ ] `src/server/api/routers/room.router.ts` - getRoomStats, updateRoomName, trackFlip
- [ ] `src/server/api/routers/sentry.router.ts` - report mutation

**For each router:**
1. Remove `import { captureError } from 'fpp/utils/app-error'`
2. Add `import { toCustomTRPCError } from 'fpp/server/api/custom-error'`
3. Remove try-catch blocks
4. Replace `captureError + throw new TRPCError` with `.catch(() => throw toCustomTRPCError(...))`
5. Keep business logic TRPCErrors (NOT_FOUND, CONFLICT) unchanged
6. Test procedure individually
7. Verify Sentry receives single capture with correct metadata

### Phase 3: Cleanup & Documentation (30 minutes)

1. ✅ **Remove router-level captureError calls**
   - Search codebase for remaining `captureError` in routers
   - Ensure all moved to CustomTRPCError pattern

2. ✅ **Update `CLAUDE.md` documentation**
   - Replace "tRPC Router Error Handling" section with CustomTRPCError pattern
   - Update code examples
   - Add reference to custom-error.ts

3. ✅ **Run validation**
   - `npm run lint` - verify no ESLint errors
   - `npm run type-check` - verify TypeScript types
   - `SKIP_ENV_VALIDATION=1 npm run build` - verify build succeeds

4. ✅ **Integration testing**
   - Test each router procedure manually
   - Verify errors show in Sentry with correct context
   - Verify no double-captures

### Phase 4: Verification (30 minutes)

**Check Sentry for:**
- [ ] No duplicate error events (compare timestamps)
- [ ] Correct component/action names in error context
- [ ] Appropriate severity levels
- [ ] Extra metadata populated correctly

**Verify in code:**
- [ ] No remaining try-catch + captureError pattern in routers
- [ ] All routers import toCustomTRPCError
- [ ] Business logic errors (NOT_FOUND, etc.) still use standard TRPCError
- [ ] Central handler has CustomTRPCError check

---

## Files to Modify

### New Files (1)
- `src/server/api/custom-error.ts` - CustomTRPCError class and helpers

### Modified Files (9)
1. `src/pages/api/trpc/[trpc].ts` - Central error handler
2. `src/server/api/routers/analytics.router.ts` - Remove captureError, use toCustomTRPCError
3. `src/server/api/routers/config.router.ts` - Remove captureError, use toCustomTRPCError
4. `src/server/api/routers/contact.router.ts` - Remove captureError, use toCustomTRPCError
5. `src/server/api/routers/landingpage.router.ts` - Remove captureError, use toCustomTRPCError
6. `src/server/api/routers/roadmap.router.ts` - Remove captureError, use toCustomTRPCError
7. `src/server/api/routers/room.router.ts` - Remove captureError, use toCustomTRPCError (3 procedures)
8. `src/server/api/routers/sentry.router.ts` - Remove captureError, use toCustomTRPCError
9. `CLAUDE.md` - Update error handling documentation

### Unchanged Files
- `src/utils/app-error.ts` - captureError wrapper still used by API routes and frontend
- `src/pages/api/track-page-view.ts` - Next.js API route (not tRPC, keeps current pattern)
- `src/pages/api/track-event.ts` - Next.js API route (not tRPC, keeps current pattern)
- `src/components/room/error-boundry.tsx` - React error boundary (keeps current pattern)

---

## Code Patterns Reference

### Pattern 1: Database Query with CustomTRPCError

```typescript
const data = await db.query.table.findFirst({
  where: eq(table.id, id),
}).catch((error) => {
  throw toCustomTRPCError(error, 'Failed to query database', {
    component: 'exampleRouter',
    action: 'procedureName',
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
```

### Pattern 2: External API Fetch with CustomTRPCError

```typescript
const response = await fetch(url, options).catch((error) => {
  throw toCustomTRPCError(error, 'Failed to fetch external API', {
    component: 'exampleRouter',
    action: 'procedureName',
    extra: { url },
    severity: 'high',
  });
});

if (!response.ok) {
  throw toCustomTRPCError(
    new Error(`API error: ${response.status}`),
    'External API returned error status',
    {
      component: 'exampleRouter',
      action: 'procedureName',
      extra: { url, status: response.status },
      severity: 'high',
    },
  );
}

return response.json();
```

### Pattern 3: Promise.allSettled with CustomTRPCError

```typescript
const results = await Promise.allSettled([
  db.insert(table1).values(data1),
  db.insert(table2).values(data2),
]);

// Check for failures
const failed = results.filter(r => r.status === 'rejected');
if (failed.length > 0) {
  throw toCustomTRPCError(
    failed[0].reason,
    'Failed to persist data',
    {
      component: 'exampleRouter',
      action: 'procedureName',
      extra: { failedCount: failed.length },
      severity: 'high',
    },
  );
}
```

### Pattern 4: Multiple Sequential Operations

```typescript
// Query 1
const room = await db.query.rooms.findFirst({
  where: eq(rooms.id, roomId),
}).catch((error) => {
  throw toCustomTRPCError(error, 'Failed to query room', {
    component: 'roomRouter',
    action: 'updateRoomName',
    extra: { roomId },
    severity: 'high',
  });
});

if (!room) {
  throw new TRPCError({ code: 'NOT_FOUND', message: 'Room not found' });
}

// Query 2
const conflict = await db.query.rooms.findFirst({
  where: eq(rooms.name, newName),
}).catch((error) => {
  throw toCustomTRPCError(error, 'Failed to check name conflict', {
    component: 'roomRouter',
    action: 'updateRoomName',
    extra: { roomId, newName },
    severity: 'high',
  });
});

if (conflict && conflict.id !== roomId) {
  throw new TRPCError({ code: 'CONFLICT', message: 'Name already exists' });
}

// Update
await db.update(rooms)
  .set({ name: newName })
  .where(eq(rooms.id, roomId))
  .catch((error) => {
    throw toCustomTRPCError(error, 'Failed to update room name', {
      component: 'roomRouter',
      action: 'updateRoomName',
      extra: { roomId, newName },
      severity: 'high',
    });
  });

return { success: true };
```

---

## Testing Checklist

### Unit Tests (if applicable)
- [ ] CustomTRPCError instanceof TRPCError returns true
- [ ] CustomTRPCError metadata is accessible
- [ ] toCustomTRPCError creates correct error structure
- [ ] isBusinessLogicError identifies business errors correctly

### Integration Tests
- [ ] Router throws CustomTRPCError on system errors
- [ ] Router throws standard TRPCError on business errors
- [ ] Central handler captures CustomTRPCError with metadata
- [ ] Central handler captures uncaught errors with fallback
- [ ] Sentry receives errors exactly once
- [ ] Error context includes component, action, extra fields

### Manual Testing
For each migrated router:
- [ ] Trigger database error (invalid query) → Check Sentry
- [ ] Trigger fetch error (network failure) → Check Sentry
- [ ] Trigger business error (NOT_FOUND) → Verify NOT in Sentry
- [ ] Verify error response to client is safe (no stack traces)

---

## Rollback Plan

If issues arise during migration:

1. **Immediate rollback**: Git revert to last working commit
2. **Partial rollback**: Keep CustomTRPCError class, revert specific router migrations
3. **Fallback pattern**: Add try-catch back to specific procedures if needed

**Risk**: Low - Changes are additive and each router can be tested independently.

---

## Success Criteria

✅ **No double-captures** - Verify in Sentry that errors appear exactly once
✅ **Reduced boilerplate** - Router files reduced by ~30-50% in error handling code
✅ **Type safety** - No TypeScript errors, metadata enforced by types
✅ **Consistent pattern** - All routers follow same error handling approach
✅ **Correct severity** - Errors in Sentry have appropriate severity levels
✅ **All tests pass** - ESLint, TypeScript, build all succeed
✅ **Documentation updated** - CLAUDE.md reflects new pattern

---

## Future Enhancements

Once CustomTRPCError is established:

1. **Auto-inject context** - Middleware to automatically add userId, roomId from context
2. **Error codes** - Add application-specific error codes (e.g., `DB_001`, `API_002`)
3. **Retry metadata** - Track retry counts for idempotent operations
4. **Performance metrics** - Add operation duration to metadata
5. **Structured logging** - Enhance console logs with metadata

---

## References

- tRPC Error Handling: https://trpc.io/docs/server/error-handling
- tRPC Error Codes: https://trpc.io/docs/server/error-formatting#error-codes
- Sentry Context: https://docs.sentry.io/platforms/javascript/enriching-events/context/
- Project Error Handler: `src/pages/api/trpc/[trpc].ts`
- Error Wrapper: `src/utils/app-error.ts`

---

**End of Specification**
