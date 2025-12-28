# [Feature Name] - tRPC API Specification

## Overview
[1-2 sentence description of what this API endpoint does]

## Endpoint Definition

**Router:** `src/server/api/routers/[router-name].router.ts`

**Procedure:** `.[query|mutation]`

**Name:** `[procedureName]`

## Input Schema

```typescript
.input(
  z.object({
    fieldName: z.string().min(1).max(100),
    // ... additional fields
  })
)
```

## Output Schema

```typescript
{
  fieldName: string;
  // ... return fields
}
```

## Implementation Logic

### 1. Validation
- [What validation is performed beyond Zod schema]
- [What business rules are checked]
- [What errors are thrown]

### 2. Database Operations
- [What queries/mutations to run]
- [Drizzle ORM methods used]
- [Transaction requirements]

### 3. Side Effects
- [Any WebSocket notifications needed]
- [Any analytics tracking]
- [Any external service calls]

### 4. Return Value
- [What is returned]
- [Any transformations applied]

## Error Handling

| Error Condition | HTTP Code | Error Message | TRPCError Code |
|----------------|-----------|---------------|----------------|
| [Condition] | 400 | "[Message]" | BAD_REQUEST |
| [Condition] | 404 | "[Message]" | NOT_FOUND |
| [Condition] | 500 | "[Message]" | INTERNAL_SERVER_ERROR |

## Client Integration

```typescript
// Query example
const { data, isLoading, error } = api.[router].[procedureName].useQuery(
  { input },
  {
    enabled: boolean,  // Optional: only fetch when true
    refetchOnMount: false,  // Optional
  }
);

// Mutation example
const mutation = api.[router].[procedureName].useMutation({
  onSuccess: (data) => {
    // Handle success (update UI, show toast, etc.)
  },
  onError: (error) => {
    captureError(error, { component: 'ComponentName', action: 'actionName' }, 'high');
  },
});

// Trigger mutation
mutation.mutate({ fieldName: value });
```

## Sentry Integration

```typescript
// In tRPC procedure
try {
  // ... operation
} catch (error) {
  // Let tRPC error handling capture to Sentry
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Operation failed',
    cause: error,
  });
}
```

## Testing Checklist

- [ ] Input validation works (try invalid inputs)
- [ ] Database operations succeed
- [ ] Transactions roll back on error
- [ ] Error cases return correct HTTP codes
- [ ] Client integration works (query/mutation)
- [ ] Loading states display correctly
- [ ] Sentry captures errors correctly
- [ ] Side effects trigger (WebSocket, analytics, etc.)

## Related Specs

- [Link to related WebSocket spec if applicable]
- [Link to database schema changes]
- [Link to UI component that calls this endpoint]
