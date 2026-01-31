# JK-65: Apply Sentry captureError Pattern (Next.js Only)

## Goal
Standardize error handling in Next.js app by removing noise, fixing severity levels, and adding global error boundary. **Quick wins approach**: Improved signal-to-noise ratio with minimal changes.

---

## Context

### Existing Infrastructure (Well-Designed)
- **captureError wrapper** exists at `src/utils/app-error.ts`
- Signature: `captureError(error, { component, action, extra }, severity)`
- Severity: `'low' | 'medium' | 'high' | 'critical'` → maps to Sentry levels
- Already used in 50+ locations
- Also provides: `captureMessage()`, `addBreadcrumb()`

### Problems to Fix
1. **No error code checking in tRPC** → Capturing business logic errors (BAD_REQUEST, CONFLICT)
2. **No global error boundary** → Unhandled errors outside room components
3. **Inconsistent severity** → form.tsx uses 'low' where 'medium' is appropriate
4. **Over-capturing** → WebSocket trusted events, unnecessary try-catch blocks
5. **No enforcement** → Developers can bypass wrapper with direct Sentry imports

### Severity Guidelines (from Sentry research)
- `critical` → App crashes, data loss, complete failures
- `high` → Feature blocking errors, auth failures, system errors (tRPC INTERNAL_SERVER_ERROR)
- `medium` → Recoverable errors, transient network issues, query failures with fallbacks
- `low` → Informational, cleanup failures, graceful degradation

### What NOT to Capture
- User input validation errors (wrong format, too long, etc.)
- tRPC BAD_REQUEST, CONFLICT (business logic errors)
- WebSocket 1006 closes (normal disconnects)
- First network failure (only after retries)

### What TO Capture
- System errors (database, server crashes)
- Failed mutations with no fallback
- Authentication failures
- tRPC: INTERNAL_SERVER_ERROR, TIMEOUT, UNKNOWN
- Bugs in validation logic (e.g., unexpected null/undefined in try-catch)

---

## Implementation Plan (5 Critical Changes)

### 1. Add Global Error Boundary
**File:** `src/pages/_app.tsx`
**Line:** ~65-67 (inside `<main>` tag)

**Change:**
```tsx
import { ErrorBoundary } from 'fpp/components/room/error-boundry';

<main>
  <ErrorBoundary componentName="App">
    <Component {...pageProps} />
  </ErrorBoundary>
</main>
```

**Why:** Catches all client-side rendering errors outside room components.

---

### 2. Fix Contact Form tRPC Error Handling
**File:** `src/pages/contact.tsx`

**Note:** Validation try-catch blocks (lines 61-138) are CORRECT as-is:
- They catch bugs in validation logic itself (e.g., unexpected null value)
- Already use 'low' severity (appropriate for edge cases)
- Provide good context (component, action, extra)
- **Do NOT remove these** - they detect real bugs

#### 2a. Add tRPC error code checking to form submission
**Lines:** 176-193 (contactMutation onError)

**Current code:**
```typescript
onError: (error) => {
  captureError(error, {
    component: 'Contact',
    action: 'submitForm',
  }, 'high');

  notifications.show({
    title: 'Error',
    message: 'Failed to send message. Please try again.',
    color: 'red',
  });
}
```

**Change to:**
```typescript
onError: (error) => {
  const errorCode = error.data?.code;

  // Only capture system errors
  const shouldCapture =
    errorCode === 'INTERNAL_SERVER_ERROR' ||
    errorCode === 'TIMEOUT' ||
    errorCode === 'UNKNOWN';

  if (shouldCapture) {
    captureError(error, {
      component: 'Contact',
      action: 'submitForm',
      extra: { errorCode }
    }, 'high'); // System errors are high priority
  }

  // Always show notification for all errors
  notifications.show({
    title: 'Error',
    message: 'Failed to send message. Please try again.',
    color: 'red',
  });
}
```

**Why:** Only capture unexpected system errors, not validation failures from backend.

---

### 3. Fix Error Boundary Severity
**File:** `src/components/room/error-boundry.tsx`
**Line:** 34

**Change:**
```typescript
// FROM:
scope.setLevel('error');

// TO:
scope.setLevel('fatal');
```

**Why:** Error boundary catches represent catastrophic rendering failures (fatal, not just error).

---

### 4. Add ESLint Rule to Enforce captureError Wrapper
**File:** `eslint.config.mjs`
**Section:** rules object (line 59)

**Add:**
```javascript
rules: {
  // ... existing rules ...

  // Sentry: Enforce captureError wrapper instead of direct Sentry calls
  'no-restricted-imports': [
    'error',
    {
      paths: [
        {
          name: '@sentry/nextjs',
          importNames: ['captureException', 'captureMessage'],
          message: 'Use captureError() or captureMessage() from fpp/utils/app-error instead of direct Sentry calls for consistent context and severity handling.',
        },
      ],
    },
  ],
}
```

**Why:** Prevents developers from bypassing the standardized wrapper, ensures consistent error context and severity levels across the codebase.

---

### 5. Add Sentry Standards to CLAUDE.md
**File:** `free-planning-poker/CLAUDE.md`
**Location:** After "## Common Gotchas" section (after line ~240)

**Add:**
```markdown
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
Validation/business error? → Don't capture
Prevents app from working? → critical
Blocks user action? → high (system errors, auth failures)
Recoverable/handled? → medium (network issues, query failures)
Informational? → low
```

### tRPC Mutation Pattern

```typescript
mutation.mutate(data, {
  onError: (error) => {
    const errorCode = error.data?.code;

    // Only capture system errors
    const shouldCapture =
      errorCode === 'INTERNAL_SERVER_ERROR' ||
      errorCode === 'TIMEOUT' ||
      errorCode === 'UNKNOWN';

    if (shouldCapture) {
      captureError(error, {
        component: 'ComponentName',
        action: 'actionName',
        extra: { errorCode }
      }, 'high');
    }

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

// Bad: Capturing user input error
if (email.length > 100) {
  captureError('Email too long', { component: 'Form' }, 'low');
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
```

**Why:** Ensures future code follows the standardized pattern.

---

## Optional Improvements (If Time Permits)

### 6. Fix form.tsx severity
**File:** `src/components/index/form.tsx`
**Line:** 74-86

**Change:** Update severity from `'low'` to `'medium'` for query failures

### 7. Remove unnecessary try-catch in form.tsx
**Lines:** 48-59, 119-131, 154-169

**Why:** setState and router.push don't throw synchronously, these are unnecessary

### 8. Reduce WebSocket error severity
**File:** `src/hooks/useWebSocketRoom.ts`
**Lines:** 159-182

**Change:**
```typescript
onError: (event) => {
  // Filter out trusted events - normal state changes
  if (Object.keys(event).length === 1 && event.isTrusted) {
    return;
  }

  addBreadcrumb('WebSocket error occurred', 'websocket', {
    eventKeys: Object.keys(event).join(', '),
  });

  captureError(
    'WebSocket error occurred',
    {
      component: 'useWebSocketRoom',
      action: 'onError',
      extra: {
        eventKeys: Object.keys(event).join(', '),
      },
    },
    'medium', // Changed from 'high' - most are transient
  );
},
```

---

## Critical Files

1. `src/pages/_app.tsx` - Add global error boundary
2. `src/pages/contact.tsx` - Add tRPC error code checking (keep validation as-is)
3. `src/components/room/error-boundry.tsx` - Update severity to fatal
4. `eslint.config.mjs` - Ban direct Sentry.captureException imports
5. `free-planning-poker/CLAUDE.md` - Add error handling standards + breadcrumb guidelines

---

## Validation Steps

```bash
# Type checking
npm run type-check

# Linting (will enforce new ESLint rule)
npm run lint
npm run lint:fix  # If needed

# Build (use SKIP_ENV_VALIDATION)
SKIP_ENV_VALIDATION=1 npm run build

# Full validation
npm run validate:nextjs
```

**Manual Testing (user will test):**
- [ ] Form validation errors → No Sentry events
- [ ] Contact form server error → Sentry event with `high` severity
- [ ] Rendering error in room → Error boundary catches with `fatal` severity
- [ ] Rendering error outside room → Global boundary catches with `fatal` severity

---

## Expected Results

- **Improved signal-to-noise ratio** (only system errors captured from tRPC)
- **Consistent severity levels** (easier to prioritize issues)
- **Global error boundary** (no unhandled rendering errors)
- **Enforced standards** (ESLint prevents direct Sentry usage)
- **Documented standards** (future code follows pattern + breadcrumb guidelines)

---

## Out of Scope (Next.js Only)

- fpp-server (Bun/Elysia WebSocket server) - separate migration later
- fpp-analytics (Python/FastAPI) - separate migration later
- Comprehensive audit of all 50+ captureError usages - focused on high-impact changes only
- Breadcrumb audit (21 files) - current usage is appropriate, just documenting guidelines

---

## Implementation Order

1. ✅ Add global error boundary (_app.tsx) - Immediate protection
2. ✅ Fix error boundary severity (error-boundry.tsx) - Correct categorization
3. ✅ Add ESLint rule (eslint.config.mjs) - Enforce standards going forward
4. ✅ Fix contact form tRPC error handling (contact.tsx) - Reduce noise
5. ✅ Add documentation (CLAUDE.md) - Long-term consistency
6. ⚠️ Optional improvements (form.tsx, useWebSocketRoom.ts) - If time permits
7. ✅ Run validation (type-check, lint, build)
8. ✅ Manual testing - Verify improvements
