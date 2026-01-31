# Error Handling Architecture

**Domain**: Backend Infrastructure
**Last Updated**: 2025-12-30
**Status**: Implemented (JK-65)

---

## Overview

Free Planning Poker uses a centralized error handling architecture to eliminate double-capture bugs and provide consistent error reporting to Sentry across all tRPC routers.

---

## Problem

### Double-Capture Bug

The original error handling captured errors **twice**:

1. **Router-level**: Each tRPC router wrapped operations in try-catch and called `captureError()`
2. **Central handler**: `[trpc].ts` also captured INTERNAL_SERVER_ERROR

**Result**: Same error sent to Sentry twice with different contexts, inflating error counts and complicating debugging.

### Additional Issues

- **Code Duplication**: 15+ lines of boilerplate per procedure
- **Inconsistency**: Different patterns across routers
- **Maintenance**: Manual updates across 8+ router files
- **Verbosity**: Business logic obscured by error handling

---

## Architecture

### CustomTRPCError Pattern

A custom error class extends `TRPCError` and carries Sentry metadata. All error capturing happens in the central tRPC error handler.

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

### Key Benefits

✅ **Single Capture** - Each error sent to Sentry exactly once
✅ **80% Less Boilerplate** - Routers focus on business logic
✅ **Type-Safe Metadata** - TypeScript enforces structure
✅ **Impossible to Forget** - All errors flow through central handler
✅ **Consistent Severity** - Centralized severity mapping
✅ **Easy Evolution** - Change error handling in one place

---

## Core Patterns

### Pattern 1: Database Query

```typescript
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
  throw new TRPCError({ code: 'NOT_FOUND', message: 'Not found' });
}
```

### Pattern 2: External Fetch

```typescript
const response = await fetch(url, options).catch((error) => {
  throw toCustomTRPCError(error, 'Failed to fetch external API', {
    component: 'exampleRouter',
    action: 'getData',
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
      action: 'getData',
      extra: { url, status: response.status },
      severity: 'high',
    },
  );
}
```

### Pattern 3: Promise.allSettled

```typescript
const results = await Promise.allSettled([
  db.insert(table1).values(data1),
  db.insert(table2).values(data2),
]);

const failedResults = results.filter(
  (r): r is PromiseRejectedResult => r.status === 'rejected'
);

if (failedResults.length > 0) {
  throw toCustomTRPCError(
    failedResults[0]!.reason,
    'Failed to persist data',
    {
      component: 'exampleRouter',
      action: 'batchInsert',
      extra: { failedCount: failedResults.length },
      severity: 'high',
    },
  );
}
```

---

## API Reference

### CustomTRPCError Class

Extends `TRPCError` with Sentry metadata support.

```typescript
class CustomTRPCError extends TRPCError {
  public readonly metadata: ErrorMetadata;

  constructor(
    code: TRPC_ERROR_CODE_KEY,
    message: string,
    metadata: ErrorMetadata,
    cause?: unknown,
  );

  extendMetadata(extra: Record<string, string | number | boolean | null>): this;
}
```

**Properties:**
- `metadata.component` - Router or component name (e.g., 'roomRouter')
- `metadata.action` - Procedure or action name (e.g., 'getRoomStats')
- `metadata.extra` - Additional JSON-serializable context
- `metadata.severity` - Sentry severity: 'low' | 'medium' | 'high' | 'critical'

### Helper Functions

#### `toCustomTRPCError()`

Convenience wrapper for creating CustomTRPCError with INTERNAL_SERVER_ERROR code.

```typescript
function toCustomTRPCError(
  error: unknown,
  message: string,
  metadata: Omit<ErrorMetadata, 'severity'> & { severity?: 'low' | 'medium' | 'high' | 'critical' },
): CustomTRPCError;
```

**Default severity**: `'high'` (user action blocked)

#### `fromError()`

Convert any error to CustomTRPCError. Returns unchanged if already CustomTRPCError.

```typescript
function fromError(error: unknown, metadata: ErrorMetadata): CustomTRPCError;
```

#### `isBusinessLogicError()`

Check if error is a business logic error (shouldn't be captured in Sentry).

```typescript
function isBusinessLogicError(error: TRPCError): boolean;
```

**Returns `true` for:**
- `BAD_REQUEST` - Invalid input
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Access denied
- `NOT_FOUND` - Resource not found
- `CONFLICT` - Resource state conflict
- `PRECONDITION_FAILED` - Precondition not met

---

## Severity Guidelines

Use consistent severity levels for Sentry capture:

- **critical** - App crash, data loss, security breach
- **high** - User action blocked (database error, API failure, auth failure)
- **medium** - Degraded experience (validation errors, missing optional data)
- **low** - Informational (geo lookup failed, analytics tracking failed)

---

## Central Handler Logic

The central tRPC error handler in `src/pages/api/trpc/[trpc].ts`:

```typescript
const trpcErrorHandler = ({ error, type, path, input }) => {
  // Business logic errors are expected - log but don't capture
  if (isBusinessLogicError(error)) {
    console.warn('TRPC Business Logic Error', { type, path, error });
    return;
  }

  console.error('TRPC System Error', { type, path, error });

  // Check if error has custom metadata from router
  if (error instanceof CustomTRPCError) {
    captureError(error, error.metadata, error.metadata.severity ?? 'high');
  } else {
    // Fallback for errors without metadata (uncaught system errors)
    captureError(error, {
      component: 'trpcMiddleware',
      action: path ?? 'unknown',
      extra: { endpoint: path, type, trpc_error_code: error.code },
    }, 'high');
  }
};
```

---

## ESLint Enforcement

Direct Sentry imports are banned via ESLint rule:

```javascript
'no-restricted-imports': [
  'error',
  {
    paths: [{
      name: '@sentry/nextjs',
      importNames: ['captureException', 'captureMessage'],
      message: 'Use captureError/captureMessage from fpp/utils/app-error instead',
    }],
  },
],
```

**Exceptions**: `app-error.ts`, instrumentation files, Sentry config files

---

## Migration from Old Pattern

### Before (30 lines, double-capture)

```typescript
export const exampleRouter = createTRPCRouter({
  getData: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx: { db }, input: { id } }) => {
      try {
        const data = await db.query.table.findFirst({
          where: eq(table.id, id),
        });

        if (!data) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Data not found',
          });
        }

        return data;
      } catch (error) {
        if (!(error instanceof TRPCError)) {
          captureError(error, {
            component: 'exampleRouter',
            action: 'getData',
            extra: { id },
          }, 'high');

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to get data',
            cause: error,
          });
        }
        throw error;
      }
    }),
});
```

### After (8 lines, single capture)

```typescript
import { toCustomTRPCError } from 'fpp/server/api/custom-error';

export const exampleRouter = createTRPCRouter({
  getData: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx: { db }, input: { id } }) => {
      const data = await db.query.table.findFirst({
        where: eq(table.id, id),
      }).catch((error) => {
        throw toCustomTRPCError(error, 'Failed to get data', {
          component: 'exampleRouter',
          action: 'getData',
          extra: { id },
        });
      });

      if (!data) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Data not found' });
      }

      return data;
    }),
});
```

---

## Related Documentation

- Implementation details: `openspec/archive/JK-65-custom-trpc-error/IMPLEMENTATION.md`
- CLAUDE.md: Error Handling Implementation Guide (comprehensive patterns)
- Source: `src/server/api/custom-error.ts`
- Central handler: `src/pages/api/trpc/[trpc].ts`

---

## Change History

| Date | Change | Ticket |
|------|--------|--------|
| 2025-12-30 | Initial implementation of CustomTRPCError architecture | JK-65 |
