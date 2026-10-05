# Error handling patterns

Extended examples moved verbatim out of `AGENTS.md` (size budget). The rules live in `AGENTS.md` §recordError Usage and §Error Handling Implementation Guide.

## recordError Usage

```typescript
// Good: Provides context
recordError(error, {
  component: 'UserProfile',
  action: 'updateSettings',
  extra: { userId, settingKey }
}, 'high');

// Bad: No context
recordError(error);

// Good: Capturing user input error to fix frontend validations
if (email.length > 100) {
  recordError('Email too long', { component: 'Form' }, 'medium');
}

// Good: Capturing validation logic bug
try {
  return value.trim().length > 50;
} catch (error) {
  recordError(error, { component: 'Form', action: 'validate' }, 'low');
}
```

## tRPC: External API Fetch

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

## tRPC: Promise.allSettled

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
